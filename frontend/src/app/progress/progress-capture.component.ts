import { Component, signal, viewChild, ElementRef, inject, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';

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

  constructor() {
    this.route.params.subscribe(params => {
      this.imageId.set(params['imageId']);
      this.loadImageInfo();
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
    if (!blob) return;

    this.processing.set(true);
    this.error.set(null);

    try {
      await this.supabase.uploadProgressPhoto(this.imageId(), blob, this.notes() || undefined);
      this.router.navigate(['/progress', this.imageId()]);
    } catch (e) {
      this.error.set('Failed to save progress photo');
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

  ngOnDestroy() {
    this.stopCamera();
    if (this.capturedUrl()) {
      URL.revokeObjectURL(this.capturedUrl()!);
    }
  }
}

