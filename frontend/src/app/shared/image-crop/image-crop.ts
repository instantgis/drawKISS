import { Component, signal, input, viewChild, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../supabase.service';

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-image-crop',
  imports: [],
  templateUrl: './image-crop.html',
  styleUrl: './image-crop.scss',
})
export class ImageCrop implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);

  /** The image URL to crop (optional - if not provided, loads from route params) */
  imageUrl = input<string>();

  // Internal state for routed mode
  internalUrl = signal('');
  private imageType: 'progress' | 'raw' | 'layer' | null = null;
  private itemId = '';
  private storagePath = '';
  private returnUrl = '';

  containerEl = viewChild<ElementRef<HTMLDivElement>>('container');
  imageEl = viewChild<ElementRef<HTMLImageElement>>('image');
  canvasEl = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  // State
  isLoading = signal(true);
  error = signal<string | null>(null);
  isProcessing = signal(false);

  // Image natural width (for scale calculation)
  private naturalWidth = 0;

  // Displayed dimensions (exposed for template)
  displayWidth = signal(0);
  displayHeight = signal(0);
  private scale = 1;

  // Crop rectangle in display coordinates
  cropRect = signal<CropRect>({ x: 0, y: 0, width: 0, height: 0 });

  // Drag state
  private isDragging = false;
  private dragType: 'move' | 'nw' | 'ne' | 'sw' | 'se' | null = null;
  private startX = 0;
  private startY = 0;
  private startRect: CropRect = { x: 0, y: 0, width: 0, height: 0 };

  ngOnInit() {
    const params = this.route.snapshot.params;
    const type = params['type'] as 'progress' | 'raw' | 'layer';
    const id = params['id'];
    if (type && id) {
      this.imageType = type;
      this.itemId = id;
      void this.loadImageFromRoute();
    }
  }

  private async loadImageFromRoute() {
    this.isLoading.set(true);
    try {
      console.log('Loading image for crop:', this.imageType, this.itemId);
      const result = await this.supabase.getImageForCrop(this.imageType!, this.itemId);
      console.log('getImageForCrop result:', result);
      if (!result) throw new Error('Image not found');
      this.storagePath = result.storagePath;
      this.returnUrl = result.returnUrl;
      const url = await this.supabase.getSignedUrl(result.storagePath);
      console.log('Signed URL:', url);
      this.internalUrl.set(url);
    } catch (e) {
      console.error('Failed to load image for crop:', e);
      this.error.set('Failed to load image');
      this.isLoading.set(false);
    }
  }

  ngOnDestroy() {
    this.removeEventListeners();
  }

  onImageLoad() {
    const img = this.imageEl()?.nativeElement;
    const container = this.containerEl()?.nativeElement;
    if (!img || !container) return;

    this.naturalWidth = img.naturalWidth;
    this.displayWidth.set(img.clientWidth);
    this.displayHeight.set(img.clientHeight);
    this.scale = this.naturalWidth / this.displayWidth();

    // Initialize crop to full image with 10% margin
    const dw = this.displayWidth();
    const dh = this.displayHeight();
    const margin = Math.min(dw, dh) * 0.1;
    this.cropRect.set({
      x: margin,
      y: margin,
      width: dw - margin * 2,
      height: dh - margin * 2
    });

    this.isLoading.set(false);
    this.addEventListeners();
  }

  onImageError(event: Event) {
    console.error('Image failed to load:', event, 'URL was:', this.internalUrl());
    this.error.set('Failed to load image');
    this.isLoading.set(false);
  }

  private addEventListeners() {
    const container = this.containerEl()?.nativeElement;
    if (!container) return;

    container.addEventListener('mousedown', this.onPointerDown);
    container.addEventListener('touchstart', this.onTouchStart, { passive: false });
    window.addEventListener('mousemove', this.onPointerMove);
    window.addEventListener('mouseup', this.onPointerUp);
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onPointerUp);
  }

  private removeEventListeners() {
    const container = this.containerEl()?.nativeElement;
    if (container) {
      container.removeEventListener('mousedown', this.onPointerDown);
      container.removeEventListener('touchstart', this.onTouchStart);
    }
    window.removeEventListener('mousemove', this.onPointerMove);
    window.removeEventListener('mouseup', this.onPointerUp);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onPointerUp);
  }

  private onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      this.handlePointerDown(touch.clientX, touch.clientY, e.target as HTMLElement);
    }
  };

  private onPointerDown = (e: MouseEvent) => {
    this.handlePointerDown(e.clientX, e.clientY, e.target as HTMLElement);
  };

  private handlePointerDown(clientX: number, clientY: number, target: HTMLElement) {
    const container = this.containerEl()?.nativeElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Determine drag type from target class
    if (target.classList.contains('handle-nw')) this.dragType = 'nw';
    else if (target.classList.contains('handle-ne')) this.dragType = 'ne';
    else if (target.classList.contains('handle-sw')) this.dragType = 'sw';
    else if (target.classList.contains('handle-se')) this.dragType = 'se';
    else if (target.classList.contains('crop-area')) this.dragType = 'move';
    else return;

    this.isDragging = true;
    this.startX = x;
    this.startY = y;
    this.startRect = { ...this.cropRect() };
  }

  private onTouchMove = (e: TouchEvent) => {
    if (!this.isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    this.handlePointerMove(touch.clientX, touch.clientY);
  };

  private onPointerMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    this.handlePointerMove(e.clientX, e.clientY);
  };

  private handlePointerMove(clientX: number, clientY: number) {
    const container = this.containerEl()?.nativeElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const dx = x - this.startX;
    const dy = y - this.startY;

    const minSize = 50;
    const dw = this.displayWidth();
    const dh = this.displayHeight();
    let newRect = { ...this.startRect };

    switch (this.dragType) {
      case 'move':
        newRect.x = Math.max(0, Math.min(dw - newRect.width, this.startRect.x + dx));
        newRect.y = Math.max(0, Math.min(dh - newRect.height, this.startRect.y + dy));
        break;
      case 'nw':
        newRect.x = Math.max(0, Math.min(this.startRect.x + this.startRect.width - minSize, this.startRect.x + dx));
        newRect.y = Math.max(0, Math.min(this.startRect.y + this.startRect.height - minSize, this.startRect.y + dy));
        newRect.width = this.startRect.width - (newRect.x - this.startRect.x);
        newRect.height = this.startRect.height - (newRect.y - this.startRect.y);
        break;
      case 'ne':
        newRect.width = Math.max(minSize, Math.min(dw - this.startRect.x, this.startRect.width + dx));
        newRect.y = Math.max(0, Math.min(this.startRect.y + this.startRect.height - minSize, this.startRect.y + dy));
        newRect.height = this.startRect.height - (newRect.y - this.startRect.y);
        break;
      case 'sw':
        newRect.x = Math.max(0, Math.min(this.startRect.x + this.startRect.width - minSize, this.startRect.x + dx));
        newRect.width = this.startRect.width - (newRect.x - this.startRect.x);
        newRect.height = Math.max(minSize, Math.min(dh - this.startRect.y, this.startRect.height + dy));
        break;
      case 'se':
        newRect.width = Math.max(minSize, Math.min(dw - this.startRect.x, this.startRect.width + dx));
        newRect.height = Math.max(minSize, Math.min(dh - this.startRect.y, this.startRect.height + dy));
        break;
    }

    this.cropRect.set(newRect);
  }

  private onPointerUp = () => {
    this.isDragging = false;
    this.dragType = null;
  };

  async applyCrop() {
    const canvas = this.canvasEl()?.nativeElement;
    const img = this.imageEl()?.nativeElement;
    if (!canvas || !img) return;

    this.isProcessing.set(true);

    try {
      const crop = this.cropRect();
      const sx = Math.round(crop.x * this.scale);
      const sy = Math.round(crop.y * this.scale);
      const sw = Math.round(crop.width * this.scale);
      const sh = Math.round(crop.height * this.scale);

      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas context');

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Failed to create blob')), 'image/png');
      });

      await this.supabase.saveCroppedImage(this.storagePath, blob);
      this.router.navigate([this.returnUrl]);
    } catch {
      this.error.set('Failed to crop image');
    } finally {
      this.isProcessing.set(false);
    }
  }

  cancel() {
    this.router.navigate([this.returnUrl]);
  }
}
