import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
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
}

