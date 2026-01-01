import { Component, signal, viewChild, ElementRef, inject, OnDestroy } from '@angular/core';
import { ImageProcessorService, ProcessingOptions } from './image-processor.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnDestroy {
  private processor = inject(ImageProcessorService);

  videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  canvasEl = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');

  // State
  cameraActive = signal(false);
  processing = signal(false);
  processedImageUrl = signal<string | null>(null);
  error = signal<string | null>(null);

  // Processing options
  options = signal<ProcessingOptions>({
    levels: 4,
    blur_radius: 5,
    threshold: 100,
    mode: 'posterize'
  });

  private stream: MediaStream | null = null;
  private starting = false;

  async startCamera() {
    if (this.starting || this.cameraActive()) return;
    this.starting = true;

    try {
      this.error.set(null);
      this.processedImageUrl.set(null);

      // Stop any existing stream first
      this.cleanupStream();

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      const video = this.videoEl()?.nativeElement;
      if (video && this.stream) {
        video.srcObject = this.stream;

        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error('Video failed to load'));
          setTimeout(() => reject(new Error('Video load timeout')), 5000);
        });

        await video.play();
        this.cameraActive.set(true);
      }
    } catch (err) {
      this.cleanupStream();
      this.error.set('Failed to access camera. Please allow camera permissions.');
      console.error(err);
    } finally {
      this.starting = false;
    }
  }

  private cleanupStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        this.stream?.removeTrack(track);
      });
      this.stream = null;
    }
    const video = this.videoEl()?.nativeElement;
    if (video) {
      video.srcObject = null;
    }
  }

  stopCamera() {
    this.cleanupStream();
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
      if (blob) this.processImage(blob);
    }, 'image/png');
  }

  private processImage(blob: Blob) {
    this.processing.set(true);
    this.error.set(null);

    // Revoke old URL
    const oldUrl = this.processedImageUrl();
    if (oldUrl) URL.revokeObjectURL(oldUrl);

    this.processor.processImage(blob, this.options()).subscribe({
      next: (resultBlob) => {
        this.processedImageUrl.set(URL.createObjectURL(resultBlob));
        this.processing.set(false);
      },
      error: (err) => {
        this.error.set('Failed to process image. Is the backend running?');
        this.processing.set(false);
        console.error(err);
      }
    });
  }

  updateOption<K extends keyof ProcessingOptions>(key: K, value: ProcessingOptions[K]) {
    this.options.update(opts => ({ ...opts, [key]: value }));
  }

  downloadImage() {
    const url = this.processedImageUrl();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `drawkiss-${Date.now()}.png`;
    a.click();
  }

  ngOnDestroy() {
    this.stopCamera();
    const url = this.processedImageUrl();
    if (url) URL.revokeObjectURL(url);
  }
}
