import { Component, signal, viewChild, ElementRef, inject, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-progress-capture',
  templateUrl: './progress-capture.component.html',
  styleUrl: './progress-capture.component.scss'
})
export class ProgressCaptureComponent implements OnDestroy {
  private supabase = inject(SupabaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  canvasEl = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');

  imageId = signal<string>('');
  imageTitle = signal<string>('');
  cameraActive = signal(false);
  processing = signal(false);
  capturedBlob = signal<Blob | null>(null);
  capturedUrl = signal<string | null>(null);
  error = signal<string | null>(null);
  notes = signal('');

  private stream: MediaStream | null = null;
	private routeSub: Subscription | null = null;

	constructor() {
		this.routeSub = this.route.params.subscribe(params => {
			this.imageId.set(params['imageId']);
			void this.loadImageInfo();
		});
	}

  private async loadImageInfo() {
    try {
      await this.supabase.loadImage(this.imageId());
      const image = this.supabase.currentImage();
      if (image) {
        this.imageTitle.set(image.title || 'Untitled');
      }
    } catch {
      this.error.set('Failed to load image');
    }
  }

  async startCamera() {
    if (this.cameraActive()) return;
    this.error.set(null);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      const video = this.videoEl()?.nativeElement;
      if (video) {
        video.srcObject = this.stream;
        await video.play();
        this.cameraActive.set(true);
      }
    } catch (e) {
      this.error.set('Camera access denied');
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.cameraActive.set(false);
  }

  capture() {
    const video = this.videoEl()?.nativeElement;
    const canvas = this.canvasEl()?.nativeElement;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (blob) {
        this.capturedBlob.set(blob);
        this.capturedUrl.set(URL.createObjectURL(blob));
        this.stopCamera();
      }
    }, 'image/png');
  }

  async save() {
    const blob = this.capturedBlob();
    if (!blob) {
      console.error('[ProgressCapture] save() called but no blob captured');
      this.error.set('No photo captured');
      return;
    }

    const imageId = this.imageId();
    if (!imageId) {
      console.error('[ProgressCapture] save() called but no imageId');
      this.error.set('No image selected');
      return;
    }

    console.log('[ProgressCapture] Starting save...', { imageId, blobSize: blob.size });
    this.processing.set(true);
    this.error.set(null);

    try {
      const result = await this.supabase.uploadProgressPhoto(imageId, blob, this.notes() || undefined);
      console.log('[ProgressCapture] Save successful:', result);
      this.router.navigate(['/progress', imageId]);
    } catch (e) {
      console.error('[ProgressCapture] Save failed:', e);
      const message = e instanceof Error ? e.message : 'Failed to save progress photo';
      this.error.set(message);
    } finally {
      this.processing.set(false);
    }
  }

  retake() {
    if (this.capturedUrl()) {
      URL.revokeObjectURL(this.capturedUrl()!);
    }
    this.capturedBlob.set(null);
    this.capturedUrl.set(null);
    this.notes.set('');
    this.startCamera();
  }

  cancel() {
    this.router.navigate(['/gallery']);
  }

  viewTimeline() {
    this.router.navigate(['/progress', this.imageId()]);
  }

  ngOnDestroy() {
		this.routeSub?.unsubscribe();
    this.stopCamera();
    if (this.capturedUrl()) {
      URL.revokeObjectURL(this.capturedUrl()!);
    }
  }
}

