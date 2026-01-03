import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService, ImageRow, ProgressPhotoRow } from '../supabase.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-progress-timeline',
  templateUrl: './progress-timeline.component.html',
  styleUrl: './progress-timeline.component.scss'
})
	export class ProgressTimelineComponent implements OnInit, OnDestroy {
	  private supabase = inject(SupabaseService);
	  private route = inject(ActivatedRoute);
	  private router = inject(Router);
	  private routeSub: Subscription | null = null;

	  imageId = signal<string>('');
  image = signal<ImageRow | null>(null);
  progressPhotos = signal<ProgressPhotoRow[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  // Signed URLs cache
  referenceUrl = signal<string>('');
  photoUrls = signal<Map<string, string>>(new Map());

  // Selected photo for full view
  selectedPhoto = signal<ProgressPhotoRow | null>(null);

	  ngOnInit() {
	    this.routeSub = this.route.params.subscribe(params => {
	      this.imageId.set(params['imageId']);
	      void this.loadData();
	    });
	  }

  private async loadData() {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Load image and progress photos in parallel
      await this.supabase.loadImage(this.imageId());
      const image = this.supabase.currentImage();
      if (!image) throw new Error('Image not found');

      this.image.set(image);

      const [refUrl, photos] = await Promise.all([
        this.supabase.getSignedUrl(image.raw_path),
        this.supabase.getProgressPhotos(this.imageId())
      ]);

      this.referenceUrl.set(refUrl);
      this.progressPhotos.set(photos);

      // Load signed URLs for progress photos
      await this.loadPhotoUrls(photos);
    } catch (e) {
      this.error.set('Failed to load progress');
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadPhotoUrls(photos: ProgressPhotoRow[]) {
    const urls = new Map<string, string>();
    await Promise.all(
      photos.map(async p => {
        const url = await this.supabase.getSignedUrl(p.storage_path);
        urls.set(p.id, url);
      })
    );
    this.photoUrls.set(urls);
  }

  getPhotoUrl(photo: ProgressPhotoRow): string {
    return this.photoUrls().get(photo.id) || '';
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString();
  }

  selectPhoto(photo: ProgressPhotoRow | null) {
    this.selectedPhoto.set(photo);
  }

  async markAsFinal(photo: ProgressPhotoRow) {
    try {
      await this.supabase.markProgressPhotoAsFinal(photo.id);
      // Update local state
      this.progressPhotos.update(photos =>
        photos.map(p => p.id === photo.id ? { ...p, is_final: true } : p)
      );
    } catch {
      this.error.set('Failed to mark as final');
    }
  }

  async deletePhoto(photo: ProgressPhotoRow) {
    if (!confirm('Delete this progress photo?')) return;

    try {
      await this.supabase.deleteProgressPhoto(photo.id);
      this.progressPhotos.update(photos => photos.filter(p => p.id !== photo.id));
      this.selectedPhoto.set(null);
    } catch {
      this.error.set('Failed to delete');
    }
  }

  addMore() {
    this.router.navigate(['/progress', this.imageId(), 'capture']);
  }

  goBack() {
    this.router.navigate(['/gallery']);
	  }

	  ngOnDestroy() {
	    this.routeSub?.unsubscribe();
	  }
}

