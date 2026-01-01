import { Component, signal, viewChild, ElementRef, inject, OnDestroy, computed } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImageProcessorService, LayerType } from '../image-processor.service';
import { SupabaseService, ImageRow, LayerRow } from '../supabase.service';
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
  imports: [TitleCasePipe, FormsModule, CategoryPickerComponent]
})
export class CaptureComponent implements OnDestroy {
  private processor = inject(ImageProcessorService);
  private supabase = inject(SupabaseService);

  videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  canvasEl = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');

  // Mode: capture (camera active) or edit (working with captured image)
  mode = signal<Mode>('capture');

  cameraActive = signal(false);
  processing = signal(false);
  rawImageUrl = signal<string | null>(null);
  processedImageUrl = signal<string | null>(null);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Title input for the image
  imageTitle = signal('');

  // Selected category
  selectedCategory = signal<string | null>(null);

  // Saved image reference (after saving raw)
  savedImage = signal<ImageRow | null>(null);

  // Saved layers for this image
  savedLayers = signal<LayerRow[]>([]);

  // Current raw blob for reprocessing
  private rawBlob: Blob | null = null;

  // Layer type and param for preview
  layerType = signal<LayerType>('posterize');
  paramValue = signal(4);
  layerSaved = signal(false); // Track if current preview was saved

  // Available layer types
  layerTypes: LayerType[] = ['posterize', 'edges', 'blur', 'threshold'];

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
      this.processedImageUrl.set(null);
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

  async processImage() {
    if (!this.rawBlob) return;

    this.processing.set(true);
    this.error.set(null);

    const oldUrl = this.processedImageUrl();
    if (oldUrl) URL.revokeObjectURL(oldUrl);

    try {
      const resultBlob = await this.processor.processImage(this.rawBlob, {
        type: this.layerType(),
        param_value: this.paramValue()
      });
      this.processedImageUrl.set(URL.createObjectURL(resultBlob));
    } catch (err) {
      this.error.set('Failed to process image. Is the backend running?');
      console.error(err);
    } finally {
      this.processing.set(false);
    }
  }

  setLayerType(type: LayerType) {
    this.layerType.set(type);
    this.paramValue.set(this.processor.getDefaultParam(type));
    this.layerSaved.set(false);
    if (this.rawBlob) this.processImage();
  }

  setParamValue(value: number) {
    this.paramValue.set(value);
    this.layerSaved.set(false);
    if (this.rawBlob) this.processImage();
  }

  getParamRange() {
    return this.processor.getParamRange(this.layerType());
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
   * Add the current filter as a new layer to the saved image
   */
  async addLayer() {
    const image = this.savedImage();
    const processedUrl = this.processedImageUrl();

    if (!image || !processedUrl) return;

    this.processing.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    try {
      const response = await fetch(processedUrl);
      const processedBlob = await response.blob();

      const layer = await this.supabase.uploadLayer(
        image.id,
        processedBlob,
        this.layerType(),
        this.paramValue()
      );

      // Add to saved layers list
      this.savedLayers.update(layers => [...layers, layer]);
      this.layerSaved.set(true);
      this.successMessage.set(`Layer added: ${this.layerType()} (${this.paramValue()})`);
    } catch (err) {
      this.error.set('Failed to add layer');
      console.error(err);
    } finally {
      this.processing.set(false);
    }
  }

  /**
   * Discard current capture and start fresh
   */
  discard() {
    this.cleanupUrls();
    this.rawBlob = null;
    this.rawImageUrl.set(null);
    this.processedImageUrl.set(null);
    this.savedImage.set(null);
    this.savedLayers.set([]);
    this.imageTitle.set('');
    this.mode.set('capture');
    this.error.set(null);
    this.successMessage.set(null);
  }

  private cleanupUrls() {
    const rawUrl = this.rawImageUrl();
    const processedUrl = this.processedImageUrl();
    if (rawUrl) URL.revokeObjectURL(rawUrl);
    if (processedUrl) URL.revokeObjectURL(processedUrl);
  }

  ngOnDestroy() {
    this.stopCamera();
    this.cleanupUrls();
  }
}

