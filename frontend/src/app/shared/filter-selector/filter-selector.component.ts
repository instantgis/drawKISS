import { Component, inject, input, output, OnInit, signal } from '@angular/core';
import { SupabaseService, FilterRow } from '../../supabase.service';

@Component({
  selector: 'app-filter-selector',
  standalone: true,
  templateUrl: './filter-selector.component.html',
  styleUrl: './filter-selector.component.scss'
})
export class FilterSelectorComponent implements OnInit {
  private supabase = inject(SupabaseService);

  /** Currently selected filter ID */
  selectedId = input<string>('');

  /** Emits the selected filter */
  filterSelected = output<FilterRow>();

  /** Available filters from database */
  filters = signal<FilterRow[]>([]);

  /** Loading state */
  loading = signal(true);

  async ngOnInit() {
    try {
      const filters = await this.supabase.getFilters();
      this.filters.set(filters);
    } catch (e) {
      console.error('Failed to load filters:', e);
    } finally {
      this.loading.set(false);
    }
  }

  select(filter: FilterRow) {
    this.filterSelected.emit(filter);
  }

  isSelected(filter: FilterRow): boolean {
    return filter.id === this.selectedId();
  }
}

