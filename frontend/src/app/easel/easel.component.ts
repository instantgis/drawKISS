import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { SupabaseService } from '../supabase.service';

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

  imageUrl = signal<string | null>(null);
  gridRows = signal(5);
  gridCols = signal(5);
  selectedCell = signal<{ row: number; col: number } | null>(null);
  showGrid = signal(true);
  error = signal<string | null>(null);

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
    this.loadCurrentImage();
    // Auto-refresh every 10 seconds
    this.refreshInterval = setInterval(() => this.loadCurrentImage(), 10000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  async loadCurrentImage() {
    try {
      // Get the current image from supabase service
      const image = this.supabase.currentImage();
      if (image) {
        // Show raw image as base
        this.imageUrl.set(this.supabase.getPublicUrl(image.raw_path));
      }

      // TODO: Layer compositing with currentLayers()
      this.error.set(null);
    } catch (e) {
      this.error.set('Failed to load image');
    }
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

