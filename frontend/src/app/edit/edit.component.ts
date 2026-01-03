import { Component, inject, signal, OnInit, OnDestroy, ElementRef, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService, ImageRow, LayerRow, FilterRow } from '../supabase.service';
import { ImageProcessorService, LayerType } from '../image-processor.service';
import { FilterSelectorComponent } from '../shared/filter-selector/filter-selector.component';

@Component({
  selector: 'app-edit',
  standalone: true,
  imports: [FilterSelectorComponent],
  templateUrl: './edit.component.html',
  styleUrl: './edit.component.scss'
})
export class EditComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private processor = inject(ImageProcessorService);

  // Image state
  image = signal<ImageRow | null>(null);
  rawImageUrl = signal<string | null>(null);
  savedLayers = signal<LayerRow[]>([]);

  // Filter state
  selectedFilter = signal<FilterRow | null>(null);
  paramValue = signal(4);
  processedImageUrl = signal<string | null>(null);

  // UI state
  loading = signal(true);
  processing = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  filterPanelOpen = signal(false);
  layerPanelOpen = signal(false);

  // Layer preview state (cached signed URLs for thumbnails)
  layerUrls = signal<Map<string, string>>(new Map());
  previewingLayerId = signal<string | null>(null);

  // Zoom/pan state
  zoom = signal(1);
  panX = signal(0);
  panY = signal(0);
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private lastPanX = 0;
  private lastPanY = 0;

  readonly MIN_ZOOM = 0.5;
  readonly MAX_ZOOM = 5;
  readonly ZOOM_STEP = 0.25;

  private rawBlob: Blob | null = null;

  async ngOnInit() {
    const imageId = this.route.snapshot.paramMap.get('imageId');
    if (!imageId) {
      this.error.set('No image ID provided');
      this.loading.set(false);
      return;
    }

    try {
      await this.loadImage(imageId);
    } catch (e) {
      this.error.set('Failed to load image');
      console.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy() {
    this.cleanupUrls();
  }

  private async loadImage(imageId: string) {
    // Load image record
    await this.supabase.loadImage(imageId);
    const image = this.supabase.currentImage();
    if (!image) throw new Error('Image not found');

    this.image.set(image);
    this.savedLayers.set(this.supabase.currentLayers());

    // Load raw image blob
    const url = await this.supabase.getSignedUrl(image.raw_path);
    const response = await fetch(url);
    this.rawBlob = await response.blob();
    this.rawImageUrl.set(URL.createObjectURL(this.rawBlob));
  }

  private cleanupUrls() {
    const raw = this.rawImageUrl();
    const processed = this.processedImageUrl();
    if (raw) URL.revokeObjectURL(raw);
    if (processed) URL.revokeObjectURL(processed);
  }

  onFilterSelected(filter: FilterRow) {
    this.selectedFilter.set(filter);
    this.paramValue.set(this.processor.getDefaultParam(filter.code as LayerType));
    this.successMessage.set(null);
    // Clear old preview
    const oldUrl = this.processedImageUrl();
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    this.processedImageUrl.set(null);
  }

  onFilterSelectedAndClose(filter: FilterRow) {
    this.onFilterSelected(filter);
    this.filterPanelOpen.set(false);
  }

  setParamValue(value: number) {
    this.paramValue.set(value);
  }

  getParamRange(): { min: number; max: number } {
    const filter = this.selectedFilter();
    if (!filter) return { min: 2, max: 16 };
    const range = this.processor.getParamRange(filter.code as LayerType);
    return { min: range.min, max: range.max };
  }

  hasParams(): boolean {
    const filter = this.selectedFilter();
    if (!filter) return false;
    return filter.code !== 'invert';
  }

  async preview() {
    const filter = this.selectedFilter();
    if (!this.rawBlob || !filter) return;

    this.processing.set(true);
    this.error.set(null);

    const oldUrl = this.processedImageUrl();
    if (oldUrl) URL.revokeObjectURL(oldUrl);

    try {
      const resultBlob = await this.processor.processImage(this.rawBlob, {
        type: filter.code as LayerType,
        param_value: this.paramValue()
      });
      this.processedImageUrl.set(URL.createObjectURL(resultBlob));
    } catch (e) {
      this.error.set('Failed to process image');
      console.error(e);
    } finally {
      this.processing.set(false);
    }
  }

  async saveLayer() {
    const image = this.image();
    const filter = this.selectedFilter();
    const processedUrl = this.processedImageUrl();

    if (!image || !filter || !processedUrl) return;

    this.processing.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    try {
      const response = await fetch(processedUrl);
      const blob = await response.blob();

      const layer = await this.supabase.uploadLayer(
        image.id,
        blob,
        filter.id,
        this.paramValue(),
        filter.name
      );

      this.savedLayers.update(layers => [...layers, layer]);
      this.successMessage.set(`Layer saved: ${filter.name}`);
    } catch (e) {
      this.error.set('Failed to save layer');
      console.error(e);
    } finally {
      this.processing.set(false);
    }
  }

  goBack() {
    this.router.navigate(['/gallery']);
  }

  toggleFilterPanel() {
    this.filterPanelOpen.update(v => !v);
  }

  // ========== Layer Panel ==========

  async toggleLayerPanel() {
    const isOpening = !this.layerPanelOpen();
    this.layerPanelOpen.set(isOpening);

    if (isOpening) {
      // Load layer URLs when opening panel
      await this.loadLayerUrls();
    }
  }

  private async loadLayerUrls() {
    const layers = this.savedLayers();
    const urlMap = new Map<string, string>();

    for (const layer of layers) {
      try {
        const url = await this.supabase.getSignedUrl(layer.storage_path);
        urlMap.set(layer.id, url);
      } catch (e) {
        console.error('Failed to load layer URL:', layer.id, e);
      }
    }

    this.layerUrls.set(urlMap);
  }

  getLayerUrl(layerId: string): string | null {
    return this.layerUrls().get(layerId) ?? null;
  }

  async previewLayer(layer: LayerRow) {
    const url = this.getLayerUrl(layer.id);
    if (!url) return;

    // Clear any filter preview and show layer
    const oldUrl = this.processedImageUrl();
    if (oldUrl && !this.previewingLayerId()) {
      URL.revokeObjectURL(oldUrl);
    }

    this.previewingLayerId.set(layer.id);
    this.processedImageUrl.set(url);
    this.selectedFilter.set(null);
    this.layerPanelOpen.set(false);
  }

  clearLayerPreview() {
    if (this.previewingLayerId()) {
      this.previewingLayerId.set(null);
      this.processedImageUrl.set(null);
    }
  }

  async deleteLayer(layer: LayerRow) {
    if (!confirm(`Delete layer "${layer.name || 'Untitled'}"?`)) return;

    this.processing.set(true);
    try {
      await this.supabase.deleteLayer(layer.id);
      this.savedLayers.update(layers => layers.filter(l => l.id !== layer.id));

      // Clear preview if we're viewing this layer
      if (this.previewingLayerId() === layer.id) {
        this.clearLayerPreview();
      }

      // Remove from URL cache
      this.layerUrls.update(map => {
        const newMap = new Map(map);
        newMap.delete(layer.id);
        return newMap;
      });

      this.successMessage.set('Layer deleted');
    } catch (e) {
      this.error.set('Failed to delete layer');
      console.error(e);
    } finally {
      this.processing.set(false);
    }
  }

  goToEasel() {
    const image = this.image();
    if (image) {
      this.router.navigate(['/easel', image.id]);
    }
  }

  // ========== Zoom/Pan Controls ==========

  zoomIn() {
    this.zoom.update(z => Math.min(this.MAX_ZOOM, z + this.ZOOM_STEP));
  }

  zoomOut() {
    this.zoom.update(z => {
      const newZoom = Math.max(this.MIN_ZOOM, z - this.ZOOM_STEP);
      // Reset pan if zooming out to fit
      if (newZoom <= 1) {
        this.panX.set(0);
        this.panY.set(0);
      }
      return newZoom;
    });
  }

  resetZoom() {
    this.zoom.set(1);
    this.panX.set(0);
    this.panY.set(0);
  }

  onWheel(event: WheelEvent) {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }

  onPanStart(event: MouseEvent | TouchEvent) {
    if (this.zoom() <= 1) return; // Only pan when zoomed in

    this.isPanning = true;
    const point = this.getEventPoint(event);
    this.panStartX = point.x;
    this.panStartY = point.y;
    this.lastPanX = this.panX();
    this.lastPanY = this.panY();
  }

  onPanMove(event: MouseEvent | TouchEvent) {
    if (!this.isPanning) return;

    const point = this.getEventPoint(event);
    const dx = point.x - this.panStartX;
    const dy = point.y - this.panStartY;

    this.panX.set(this.lastPanX + dx);
    this.panY.set(this.lastPanY + dy);
  }

  onPanEnd() {
    this.isPanning = false;
  }

  private getEventPoint(event: MouseEvent | TouchEvent): { x: number; y: number } {
    if ('touches' in event && event.touches.length > 0) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    const mouseEvent = event as MouseEvent;
    return { x: mouseEvent.clientX, y: mouseEvent.clientY };
  }

  getTransformStyle(): string {
    return `translate(${this.panX()}px, ${this.panY()}px) scale(${this.zoom()})`;
  }

  isZoomed(): boolean {
    return this.zoom() !== 1;
  }
}

