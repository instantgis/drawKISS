import { Component, signal, viewChild, ElementRef, inject, OnDestroy, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService, ImageRow } from '../supabase.service';
import { CategoryPickerComponent } from '../shared/category-picker/category-picker.component';

type Mode = 'capture' | 'edit';

interface CameraCapabilities {
  zoom?: { min: number; max: number; step: number };
  brightness?: { min: number; max: number; step: number };
}

@Component({
  selector: 'app-capture',
  templateUrl: './capture.component.html',
  styleUrl: './capture.component.scss',
  imports: [FormsModule, CategoryPickerComponent]
})
export class CaptureComponent implements OnDestroy {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  canvasEl = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');

  // Mode: capture (camera active) or edit (working with captured image)
  mode = signal<Mode>('capture');

  cameraActive = signal(false);
  processing = signal(false);
  rawImageUrl = signal<string | null>(null);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Title input for the image
  imageTitle = signal('');

  // Selected category
  selectedCategory = signal<string | null>(null);

  // Saved image reference (after saving raw)
  savedImage = signal<ImageRow | null>(null);

  // Current raw blob for saving
  private rawBlob: Blob | null = null;

  // Computed: is image saved to DB?
  isImageSaved = computed(() => this.savedImage() !== null);

  // Camera controls
  cameraCapabilities = signal<CameraCapabilities>({});
  currentZoom = signal(1);
  currentBrightness = signal(0);

  private stream: MediaStream | null = null;
  private starting = false;
  private videoTrack: MediaStreamTrack | null = null;

  async startCamera() {
    if (this.starting || this.cameraActive()) return;
    this.starting = true;

    try {
      this.error.set(null);
      this.cleanupStream();

      // Prefer back camera on phones, fallback to any camera on laptops
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },  // Back camera preferred, not required
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      const video = this.videoEl()?.nativeElement;
      if (video && this.stream) {
        video.srcObject = this.stream;

        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error('Video failed to load'));
          setTimeout(() => reject(new Error('Video load timeout')), 5000);
        });

        await video.play();
        this.cameraActive.set(true);

        // Detect camera capabilities for zoom/brightness
        this.videoTrack = this.stream.getVideoTracks()[0];
        this.detectCameraCapabilities();
      }
    } catch (err) {
      this.cleanupStream();
      this.error.set('Failed to access camera. Please allow camera permissions.');
      console.error(err);
    } finally {
      this.starting = false;
    }
  }

  private detectCameraCapabilities() {
    if (!this.videoTrack) return;

    try {
      // Use 'any' to access non-standard capabilities
      const capabilities = this.videoTrack.getCapabilities() as any;
      const caps: CameraCapabilities = {};

      if (capabilities.zoom) {
        caps.zoom = {
          min: capabilities.zoom.min,
          max: capabilities.zoom.max,
          step: capabilities.zoom.step || 0.1
        };
        this.currentZoom.set(capabilities.zoom.min);
      }

      // exposureCompensation is the standard way to control brightness
      if (capabilities.exposureCompensation) {
        caps.brightness = {
          min: capabilities.exposureCompensation.min,
          max: capabilities.exposureCompensation.max,
          step: capabilities.exposureCompensation.step || 0.5
        };
        this.currentBrightness.set(0); // Usually 0 is default
      }

      this.cameraCapabilities.set(caps);
    } catch (e) {
      console.log('Camera capabilities not available');
    }
  }

  adjustZoom(delta: number) {
    const caps = this.cameraCapabilities().zoom;
    if (!caps || !this.videoTrack) return;

    const newZoom = Math.max(caps.min, Math.min(caps.max, this.currentZoom() + delta * caps.step * 5));
    this.currentZoom.set(newZoom);

    this.videoTrack.applyConstraints({
      advanced: [{ zoom: newZoom } as any]
    });
  }

  adjustBrightness(delta: number) {
    const caps = this.cameraCapabilities().brightness;
    if (!caps || !this.videoTrack) return;

    const newBrightness = Math.max(caps.min, Math.min(caps.max, this.currentBrightness() + delta * caps.step * 2));
    this.currentBrightness.set(newBrightness);

    this.videoTrack.applyConstraints({
      advanced: [{ exposureCompensation: newBrightness } as any]
    });
  }

  private cleanupStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        this.stream?.removeTrack(track);
      });
      this.stream = null;
    }
    this.videoTrack = null;
    this.cameraCapabilities.set({});
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
      if (blob) {
        this.rawBlob = blob;
        this.rawImageUrl.set(URL.createObjectURL(blob));
        this.stopCamera();
        this.mode.set('edit');
        // Don't auto-process - let user choose filter first
      }
    }, 'image/png');
  }

  /**
   * Save the raw image to gallery (creates the image record)
   */
  async saveRawImage() {
    if (!this.rawBlob) return;

    const title = this.imageTitle().trim() || `Capture ${new Date().toLocaleDateString()}`;
    const categoryId = this.selectedCategory();

    this.processing.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    try {
      const image = await this.supabase.uploadRawImage(this.rawBlob, title, categoryId);
      this.savedImage.set(image);
      this.successMessage.set('Image saved! Now add layers with different filters.');
    } catch (err) {
      this.error.set('Failed to save image');
      console.error(err);
    } finally {
      this.processing.set(false);
    }
  }

  /**
   * Navigate to the layer editor for the saved image
   */
  goToLayerEditor() {
    const image = this.savedImage();
    if (image) {
      this.router.navigate(['/edit', image.id]);
    }
  }

  /**
   * Discard current capture and start fresh
   */
  discard() {
    this.cleanupUrls();
    this.rawBlob = null;
    this.rawImageUrl.set(null);
    this.savedImage.set(null);
    this.imageTitle.set('');
    this.mode.set('capture');
    this.error.set(null);
    this.successMessage.set(null);
  }

  private cleanupUrls() {
    const rawUrl = this.rawImageUrl();
    if (rawUrl) URL.revokeObjectURL(rawUrl);
  }

  ngOnDestroy() {
    this.stopCamera();
    this.cleanupUrls();
  }
}

