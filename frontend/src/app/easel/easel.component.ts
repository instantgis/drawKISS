import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService, LayerRow } from '../supabase.service';

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
  styleUrl: './easel.component.scss'
})
export class EaselComponent implements OnInit, OnDestroy {
  private supabase = inject(SupabaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  imageUrl = signal<string | null>(null);
  imageTitle = signal<string>('');
  layers = signal<LayerRow[]>([]);
  selectedLayerId = signal<string | null>(null);
  gridRows = signal(5);
  gridCols = signal(5);
  selectedCell = signal<{ row: number; col: number } | null>(null);
  showGrid = signal(true);
  error = signal<string | null>(null);
  isLoading = signal(false);

  private refreshInterval: ReturnType<typeof setInterval> | null = null;

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

    try {
      await this.supabase.loadImage(imageId);

      const image = this.supabase.currentImage();
      const layers = this.supabase.currentLayers();

      if (image) {
        this.imageTitle.set(image.title || 'Untitled');
        // Default to raw image
        this.imageUrl.set(this.supabase.getPublicUrl(image.raw_path));
      }

      this.layers.set(layers);

      // If there are layers, select the first visible one
      const visibleLayer = layers.find(l => l.visible);
      if (visibleLayer) {
        this.selectLayer(visibleLayer.id);
      }
    } catch (e) {
      this.error.set('Failed to load image');
    } finally {
      this.isLoading.set(false);
    }
  }

  selectLayer(layerId: string | null) {
    this.selectedLayerId.set(layerId);

    if (layerId) {
      const layer = this.layers().find(l => l.id === layerId);
      if (layer) {
        this.imageUrl.set(this.supabase.getPublicUrl(layer.storage_path));
        return;
      }
    }

    // Fall back to raw image
    const image = this.supabase.currentImage();
    if (image) {
      this.imageUrl.set(this.supabase.getPublicUrl(image.raw_path));
    }
  }

  showRawImage() {
    this.selectedLayerId.set(null);
    const image = this.supabase.currentImage();
    if (image) {
      this.imageUrl.set(this.supabase.getPublicUrl(image.raw_path));
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
}

