import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService, ImageRow, CategoryRow } from '../supabase.service';

@Component({
  selector: 'app-gallery',
  imports: [RouterLink],
  templateUrl: './gallery.html',
  styleUrl: './gallery.scss',
})
export class Gallery implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  private readonly PAGE_SIZE = 20;

  images = signal<ImageRow[]>([]);
  categories = signal<CategoryRow[]>([]);
  selectedCategory = signal<string | null>(null);
  isLoading = signal(false);
  isLoadingMore = signal(false);
  hasMore = signal(false);

  // Cache for signed thumbnail URLs
  thumbnailUrls = signal<Map<string, string>>(new Map());

  // Cache for progress photo counts
  progressCounts = signal<Map<string, number>>(new Map());

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
      const [imageResult, categories] = await Promise.all([
        this.supabase.getImages({ limit: this.PAGE_SIZE }),
        this.supabase.getCategories()
      ]);
      this.images.set(imageResult.images);
      this.hasMore.set(imageResult.hasMore);
      this.categories.set(categories);

      // Pre-load signed thumbnail URLs and progress counts
      await Promise.all([
        this.loadThumbnailUrls(imageResult.images),
        this.loadProgressCounts(imageResult.images)
      ]);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadProgressCounts(images: ImageRow[]) {
    const imageIds = images.map(img => img.id);
    if (imageIds.length === 0) return;
    const counts = await this.supabase.getProgressPhotoCounts(imageIds);
    this.progressCounts.update(existing => {
      const merged = new Map(existing);
      counts.forEach((count, id) => merged.set(id, count));
      return merged;
    });
  }

  private async loadThumbnailUrls(images: ImageRow[]) {
    const urls = new Map(this.thumbnailUrls());
    await Promise.all(
      images.map(async (img) => {
        if (!urls.has(img.id)) {
          const url = await this.supabase.getSignedThumbnailUrl(img.raw_path, 200, 150);
          urls.set(img.id, url);
        }
      })
    );
    this.thumbnailUrls.set(urls);
  }

  async loadMore() {
    if (this.isLoadingMore() || !this.hasMore()) return;

    this.isLoadingMore.set(true);
    try {
      const result = await this.supabase.getImages({
        categoryId: this.selectedCategory() ?? undefined,
        limit: this.PAGE_SIZE,
        offset: this.images().length
      });
      this.images.update(imgs => [...imgs, ...result.images]);
      this.hasMore.set(result.hasMore);

      // Load thumbnail URLs for new images
      await this.loadThumbnailUrls(result.images);
    } finally {
      this.isLoadingMore.set(false);
    }
  }

  async selectCategory(categoryId: string | null) {
    this.selectedCategory.set(categoryId);
    // Reload from start when category changes
    this.isLoading.set(true);
    try {
      const result = await this.supabase.getImages({
        categoryId: categoryId ?? undefined,
        limit: this.PAGE_SIZE
      });
      this.images.set(result.images);
      this.hasMore.set(result.hasMore);
    } finally {
      this.isLoading.set(false);
    }
  }

  openImage(imageId: string) {
    this.router.navigate(['/easel', imageId]);
  }

  editLayers(event: Event, imageId: string) {
    event.stopPropagation();
    this.router.navigate(['/edit', imageId]);
  }

  getThumbnailUrl(image: ImageRow): string {
    // Return cached signed URL
    return this.thumbnailUrls().get(image.id) || '';
  }

  getProgressCount(imageId: string): number {
    return this.progressCounts().get(imageId) || 0;
  }

  addProgress(event: Event, imageId: string) {
    event.stopPropagation();
    this.router.navigate(['/progress', imageId, 'capture']);
  }

  viewProgress(event: Event, imageId: string) {
    event.stopPropagation();
    this.router.navigate(['/progress', imageId]);
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString();
  }

  async deleteImage(event: Event, image: ImageRow) {
    event.stopPropagation(); // Don't open the image

    const confirmed = confirm(`Delete "${image.title || 'Untitled'}"?\n\nThis will permanently delete the image and all its layers.`);
    if (!confirmed) return;

    try {
      await this.supabase.deleteImage(image.id);
      // Remove from local state
      this.images.update(imgs => imgs.filter(i => i.id !== image.id));
    } catch (e) {
      alert('Failed to delete image');
    }
  }
}
