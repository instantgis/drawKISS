import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SharedImageService } from './shared-image.service';

/**
 * Share target handler component
 *
 * When an image is shared to drawKISS from another app:
 * 1. Service worker caches the image at '/shared-image'
 * 2. User is redirected to /share?received=true
 * 3. This component retrieves the cached image
 * 4. Stores it in SharedImageService for capture component to use
 * 5. Redirects to /capture
 */
@Component({
  selector: 'app-share',
  templateUrl: './share.component.html',
  styleUrl: './share.component.scss'
})
export class ShareComponent implements OnInit {
  private router = inject(Router);
  private sharedImageService = inject(SharedImageService);

  loading = signal(true);
  error = signal<string | null>(null);

  async ngOnInit() {
    await this.processSharedImage();
  }

  private async processSharedImage() {
    try {
      // Retrieve the shared image from cache
      const cache = await caches.open('share-target-cache-v1');
      const response = await cache.match('/shared-image');

      if (!response) {
        this.error.set('No shared image found');
        this.loading.set(false);
        return;
      }

      // Get the blob from the cached response
      const blob = await response.blob();
      const filename = response.headers.get('X-Shared-Filename') || 'shared-image';

      // Create a File object from the blob
      const file = new File([blob], filename, { type: blob.type });

      // Store in the shared image service
      this.sharedImageService.setSharedImage(file);

      // Clean up the cache
      await cache.delete('/shared-image');

      // Navigate to capture page
      this.router.navigate(['/capture'], { 
        queryParams: { shared: 'true' } 
      });

    } catch (err) {
      console.error('Error processing shared image:', err);
      this.error.set('Failed to process shared image');
      this.loading.set(false);
    }
  }

  goToCapture() {
    this.router.navigate(['/capture']);
  }
}

