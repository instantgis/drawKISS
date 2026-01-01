import { Injectable, signal } from '@angular/core';
import { environment } from '../environments/environment';

export type LayerType = 'posterize' | 'edges' | 'blur' | 'threshold';

export interface ProcessingRequest {
  type: LayerType;
  param_value: number;
}

@Injectable({
  providedIn: 'root'
})
export class ImageProcessorService {
  private apiUrl = environment.apiUrl;

  // Processing state
  isProcessing = signal(false);
  error = signal<string | null>(null);

  constructor() {}

  /**
   * Process an image with the specified filter.
   * Returns the processed image as a Blob.
   */
  async processImage(file: Blob, request: ProcessingRequest): Promise<Blob> {
    this.isProcessing.set(true);
    this.error.set(null);

    try {
      const formData = new FormData();
      formData.append('file', file, 'image.png');
      formData.append('type', request.type);
      formData.append('param_value', request.param_value.toString());

      const response = await fetch(`${this.apiUrl}/process`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Processing failed' }));
        throw new Error(errorData.error || 'Processing failed');
      }

      return await response.blob();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      this.error.set(message);
      throw e;
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Get default param value for a layer type.
   */
  getDefaultParam(type: LayerType): number {
    switch (type) {
      case 'posterize': return 4;    // levels 2-8
      case 'edges': return 100;      // threshold 0-255
      case 'blur': return 5;         // radius 1-21
      case 'threshold': return 128;  // cutoff 0-255
    }
  }

  /**
   * Get param range for a layer type.
   */
  getParamRange(type: LayerType): { min: number; max: number; label: string } {
    switch (type) {
      case 'posterize': return { min: 2, max: 8, label: 'Levels' };
      case 'edges': return { min: 0, max: 255, label: 'Threshold' };
      case 'blur': return { min: 1, max: 21, label: 'Radius' };
      case 'threshold': return { min: 0, max: 255, label: 'Cutoff' };
    }
  }
}

