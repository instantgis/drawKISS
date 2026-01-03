import { Injectable, signal } from '@angular/core';

/**
 * Service to pass shared images between components
 * Used by the share target flow to pass images to capture component
 */
@Injectable({
  providedIn: 'root'
})
export class SharedImageService {
  private sharedImage = signal<File | null>(null);

  /**
   * Set a shared image (called by ShareComponent)
   */
  setSharedImage(file: File) {
    this.sharedImage.set(file);
  }

  /**
   * Get and consume the shared image (called by CaptureComponent)
   * Returns null if no image is pending
   */
  consumeSharedImage(): File | null {
    const file = this.sharedImage();
    if (file) {
      this.sharedImage.set(null);
    }
    return file;
  }

  /**
   * Check if there's a pending shared image
   */
  hasSharedImage(): boolean {
    return this.sharedImage() !== null;
  }
}

