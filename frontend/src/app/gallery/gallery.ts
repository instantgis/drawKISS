import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService, ImageRow, CategoryRow } from '../supabase.service';

@Component({
  selector: 'app-gallery',
  imports: [RouterLink],
  templateUrl: './gallery.html',
  styleUrl: './gallery.css',
})
export class Gallery implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  images = signal<ImageRow[]>([]);
  categories = signal<CategoryRow[]>([]);
  selectedCategory = signal<string | null>(null);
  isLoading = signal(false);

  filteredImages = computed(() => {
    const catId = this.selectedCategory();
    const allImages = this.images();
    if (!catId) return allImages;
    return allImages.filter(img => img.category_id === catId);
  });

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      const [images, categories] = await Promise.all([
        this.supabase.getAllImages(),
        this.supabase.getCategories()
      ]);
      this.images.set(images);
      this.categories.set(categories);
    } finally {
      this.isLoading.set(false);
    }
  }

  selectCategory(categoryId: string | null) {
    this.selectedCategory.set(categoryId);
  }

  openImage(imageId: string) {
    this.router.navigate(['/easel', imageId]);
  }

  getThumbnailUrl(image: ImageRow): string {
    // Use Supabase image transformations for thumbnails
    return this.supabase.getThumbnailUrl(image.raw_path, 200, 150);
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString();
  }
}
