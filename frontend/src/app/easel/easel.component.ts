import { Component, signal, computed, inject, OnInit, OnDestroy, ElementRef, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService, LayerRow } from '../supabase.service';
import { CategoryPickerComponent } from '../shared/category-picker/category-picker.component';

interface GridLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isVertical: boolean;
}

@Component({
  selector: 'app-easel',
  templateUrl: './easel.component.html',
  styleUrl: './easel.component.scss',
  imports: [CategoryPickerComponent]
})
export class EaselComponent implements OnInit, OnDestroy {
  private supabase = inject(SupabaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private currentImageId: string | null = null;

  imageUrl = signal<string | null>(null);
  imageTitle = signal<string>('');
  selectedCategory = signal<string | null>(null);
  layers = signal<LayerRow[]>([]);
  selectedLayerId = signal<string | null>(null);
  gridRows = signal(5);
  gridCols = signal(5);
  selectedCell = signal<{ row: number; col: number } | null>(null);
  showGrid = signal(true);
  error = signal<string | null>(null);
  isLoading = signal(false);

  // Zoom & pan state
  zoom = signal(1);
  panX = signal(0);
  panY = signal(0);
  isPanning = signal(false);
  private panStartX = 0;
  private panStartY = 0;
  private panOffsetX = 0;
  private panOffsetY = 0;

  // Fullscreen state
  isFullscreen = signal(false);

  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private el = inject(ElementRef);

  gridLines = computed<GridLine[]>(() => {
    const rows = this.gridRows();
    const cols = this.gridCols();
    const lines: GridLine[] = [];

    // Vertical lines
    for (let i = 0; i <= cols; i++) {
      lines.push({
        x1: (i / cols) * 100,
        y1: 0,
        x2: (i / cols) * 100,
        y2: 100,
        isVertical: true
      });
    }

    // Horizontal lines
    for (let i = 0; i <= rows; i++) {
      lines.push({
        x1: 0,
        y1: (i / rows) * 100,
        x2: 100,
        y2: (i / rows) * 100,
        isVertical: false
      });
    }

    return lines;
  });

  cells = computed(() => {
    const rows = this.gridRows();
    const cols = this.gridCols();
    const result: { row: number; col: number; x: number; y: number; width: number; height: number }[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result.push({
          row: r,
          col: c,
          x: (c / cols) * 100,
          y: (r / rows) * 100,
          width: 100 / cols,
          height: 100 / rows
        });
      }
    }

    return result;
  });

  ngOnInit() {
    // Get imageId from route params
    const imageId = this.route.snapshot.paramMap.get('imageId');
    if (imageId) {
      this.loadImage(imageId);
    } else {
      this.error.set('No image ID provided');
    }
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  async loadImage(imageId: string) {
    this.isLoading.set(true);
    this.error.set(null);
    this.currentImageId = imageId;

    try {
      await this.supabase.loadImage(imageId);

      const image = this.supabase.currentImage();
      const layers = this.supabase.currentLayers();

      if (image) {
        this.imageTitle.set(image.title || 'Untitled');
        this.selectedCategory.set(image.category_id);
        // Default to raw image (signed URL for private bucket)
        const signedUrl = await this.supabase.getSignedUrl(image.raw_path);
        this.imageUrl.set(signedUrl);
        // Restore grid settings
        this.gridRows.set(image.grid_rows ?? 5);
        this.gridCols.set(image.grid_cols ?? 5);
      }

      this.layers.set(layers);

      // If there are layers, select the first visible one
      const visibleLayer = layers.find(l => l.visible);
      if (visibleLayer) {
        await this.selectLayer(visibleLayer.id);
      }
    } catch (e) {
      this.error.set('Failed to load image');
    } finally {
      this.isLoading.set(false);
    }
  }

  async selectLayer(layerId: string | null) {
    this.selectedLayerId.set(layerId);

    if (layerId) {
      const layer = this.layers().find(l => l.id === layerId);
      if (layer) {
        const signedUrl = await this.supabase.getSignedUrl(layer.storage_path);
        this.imageUrl.set(signedUrl);
        return;
      }
    }

    // Fall back to raw image
    const image = this.supabase.currentImage();
    if (image) {
      const signedUrl = await this.supabase.getSignedUrl(image.raw_path);
      this.imageUrl.set(signedUrl);
    }
  }

  async showRawImage() {
    this.selectedLayerId.set(null);
    const image = this.supabase.currentImage();
    if (image) {
      const signedUrl = await this.supabase.getSignedUrl(image.raw_path);
      this.imageUrl.set(signedUrl);
    }
  }

  async deleteLayer(event: Event, layerId: string) {
    event.stopPropagation();

    const layer = this.layers().find(l => l.id === layerId);
    if (!layer) return;

    const confirmed = confirm(`Delete layer "${layer.type} (${layer.param_value})"?`);
    if (!confirmed) return;

    try {
      await this.supabase.deleteLayer(layerId);
      this.layers.update(layers => layers.filter(l => l.id !== layerId));

      // If deleted layer was selected, show raw image
      if (this.selectedLayerId() === layerId) {
        this.showRawImage();
      }
    } catch (e) {
      this.error.set('Failed to delete layer');
    }
  }

  goBack() {
    this.router.navigate(['/gallery']);
  }

  selectCell(row: number, col: number) {
    const current = this.selectedCell();
    if (current?.row === row && current?.col === col) {
      this.selectedCell.set(null);
    } else {
      this.selectedCell.set({ row, col });
    }
  }

  isCellDimmed(row: number, col: number): boolean {
    const selected = this.selectedCell();
    if (!selected) return false;
    return selected.row !== row || selected.col !== col;
  }

  toggleGrid() {
    this.showGrid.update(v => !v);
  }

  clearSelection() {
    this.selectedCell.set(null);
  }

  // Zoom methods
  zoomIn() {
    this.zoom.update(z => Math.min(z + 0.25, 5));
  }

  zoomOut() {
    this.zoom.update(z => Math.max(z - 0.25, 0.5));
  }

  resetZoom() {
    this.zoom.set(1);
    this.panX.set(0);
    this.panY.set(0);
  }

  onWheel(event: WheelEvent) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    this.zoom.update(z => Math.max(0.5, Math.min(5, z + delta)));
  }

  // Pan methods
  onPanStart(event: MouseEvent | TouchEvent) {
    if (this.zoom() <= 1) return;
    this.isPanning.set(true);
    const point = this.getEventPoint(event);
    this.panStartX = point.x;
    this.panStartY = point.y;
    this.panOffsetX = this.panX();
    this.panOffsetY = this.panY();
  }

  onPanMove(event: MouseEvent | TouchEvent) {
    if (!this.isPanning()) return;
    const point = this.getEventPoint(event);
    const dx = point.x - this.panStartX;
    const dy = point.y - this.panStartY;
    this.panX.set(this.panOffsetX + dx);
    this.panY.set(this.panOffsetY + dy);
  }

  onPanEnd() {
    this.isPanning.set(false);
  }

  private getEventPoint(event: MouseEvent | TouchEvent): { x: number; y: number } {
    if (event instanceof TouchEvent) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    return { x: event.clientX, y: event.clientY };
  }

  // Fullscreen methods
  async toggleFullscreen() {
    const container = this.el.nativeElement.querySelector('.easel-container');
    if (!document.fullscreenElement) {
      await container?.requestFullscreen();
      this.isFullscreen.set(true);
    } else {
      await document.exitFullscreen();
      this.isFullscreen.set(false);
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    this.isFullscreen.set(!!document.fullscreenElement);
  }

  // Save grid settings
  async saveGridSettings() {
    if (!this.currentImageId) return;

    try {
      await this.supabase.updateGridSettings(
        this.currentImageId,
        this.gridRows(),
        this.gridCols()
      );
    } catch (e) {
      // Error already set in service
    }
  }

  // Update category
  async updateCategory(categoryId: string) {
    if (!this.currentImageId) return;

    this.selectedCategory.set(categoryId);
    try {
      await this.supabase.updateImageCategory(this.currentImageId, categoryId);
    } catch (e) {
      // Error already set in service
    }
  }

  // Update title
  async updateTitle(title: string) {
    if (!this.currentImageId) return;

    const trimmed = title.trim();
    if (trimmed === this.imageTitle()) return;

    this.imageTitle.set(trimmed || 'Untitled');
    try {
      await this.supabase.updateImageTitle(this.currentImageId, trimmed);
    } catch (e) {
      // Error already set in service
    }
  }
}

