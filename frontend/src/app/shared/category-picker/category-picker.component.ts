import { Component, signal, inject, input, output, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService, CategoryRow } from '../../supabase.service';

@Component({
  selector: 'app-category-picker',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './category-picker.component.html',
  styleUrl: './category-picker.component.scss'
})
export class CategoryPickerComponent implements OnInit {
  private supabase = inject(SupabaseService);

  selectedId = input<string | null>(null);
  selectedChange = output<string>();

  categories = signal<CategoryRow[]>([]);
  isCreating = signal(false);
  newName = '';

  async ngOnInit() {
    await this.loadCategories();
  }

  async loadCategories() {
    const cats = await this.supabase.getCategories();
    this.categories.set(cats);

    // Auto-select first category if none selected
    if (!this.selectedId() && cats.length > 0) {
      this.selectedChange.emit(cats[0].id);
    }
  }

  select(id: string) {
    this.selectedChange.emit(id);
  }

  startCreate() {
    this.isCreating.set(true);
    this.newName = '';
    // Focus input after render
    setTimeout(() => {
      const input = document.querySelector('.chip-input') as HTMLInputElement;
      input?.focus();
    }, 0);
  }

  cancelCreate() {
    this.isCreating.set(false);
    this.newName = '';
  }

  onBlur() {
    // Delay to allow click on confirm button
    setTimeout(() => {
      if (!this.newName.trim()) {
        this.cancelCreate();
      }
    }, 150);
  }

  async createCategory() {
    const name = this.newName.trim();
    if (!name) {
      this.cancelCreate();
      return;
    }

    try {
      const newCat = await this.supabase.createCategory(name);
      this.categories.update(cats => [...cats, newCat]);
      this.isCreating.set(false);
      this.newName = '';
      this.selectedChange.emit(newCat.id);
    } catch (e) {
      console.error('Failed to create category', e);
    }
  }
}

