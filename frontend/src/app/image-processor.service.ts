import { Injectable, signal } from '@angular/core';

export type LayerType =
  | 'posterize' | 'edges' | 'blur' | 'threshold'           // original
  | 'adaptive_threshold' | 'bilateral' | 'invert'          // new
  | 'contrast' | 'median' | 'contours' | 'pencil_sketch'   // new
  | 'watercolor';                                           // artistic

export interface ProcessingRequest {
  type: LayerType;
  param_value: number;
}

// Declare cv as a global (loaded via script tag in index.html)
declare const cv: any;

@Injectable({
  providedIn: 'root'
})
export class ImageProcessorService {
  // Processing state
  isProcessing = signal(false);
  isReady = signal(false);
  status = signal<string>('Initializing...');
  error = signal<string | null>(null);

  constructor() {
    this.waitForOpenCV();
  }

  /**
   * Wait for OpenCV.js to load from CDN script tag.
   */
  private async waitForOpenCV(): Promise<void> {
    this.status.set('Loading OpenCV.js...');

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('OpenCV load timeout (30s)')), 30000);

        const checkReady = () => {
          if (typeof cv !== 'undefined' && cv.Mat) {
            clearTimeout(timeout);
            resolve();
            return true;
          }
          return false;
        };

        // Already loaded?
        if (checkReady()) return;

        // Poll for cv to become available and ready
        const poll = setInterval(() => {
          if (typeof cv !== 'undefined') {
            // cv object exists, check if WASM is ready
            if (cv.Mat) {
              clearInterval(poll);
              clearTimeout(timeout);
              resolve();
            } else if (!cv.onRuntimeInitialized) {
              // Set callback if not already set
              cv.onRuntimeInitialized = () => {
                clearInterval(poll);
                clearTimeout(timeout);
                resolve();
              };
            }
          }
        }, 100);
      });

      this.isReady.set(true);
      this.status.set('Ready');
      console.log('[ImageProcessor] OpenCV.js ready');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load OpenCV');
      console.error('[ImageProcessor] OpenCV load error:', e);
    }
  }

  private async ensureReady(): Promise<void> {
    if (typeof cv !== 'undefined' && cv.Mat && this.isReady()) return;

    // Wait for initialization to complete
    let attempts = 0;
    while (typeof cv === 'undefined' || !cv.Mat || !this.isReady()) {
      await new Promise(r => setTimeout(r, 100));
      if (++attempts > 100) throw new Error('OpenCV not ready after 10s');
    }
  }

  // ========== Filter implementations ==========

  private posterize(src: any, levels: number): any {
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const n = Math.max(2, Math.min(16, levels));
    const step = 255 / n;
    for (let i = 0; i < gray.rows; i++) {
      for (let j = 0; j < gray.cols; j++) {
        const val = gray.ucharAt(i, j);
        gray.ucharPtr(i, j)[0] = Math.min(255, Math.round(val / step) * step);
      }
    }
    return gray;
  }

  private edges(src: any, threshold: number): any {
    const gray = new cv.Mat(), blurred = new cv.Mat(), edgesMat = new cv.Mat(), result = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    const t = Math.max(0, Math.min(255, threshold));
    cv.Canny(blurred, edgesMat, t, t * 2);
    cv.bitwise_not(edgesMat, result);
    gray.delete(); blurred.delete(); edgesMat.delete();
    return result;
  }

  private blur(src: any, radius: number): any {
    const gray = new cv.Mat(), result = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    let r = Math.max(1, Math.min(21, radius));
    if (r % 2 === 0) r++;
    cv.GaussianBlur(gray, result, new cv.Size(r, r), 0);
    gray.delete();
    return result;
  }

  private threshold(src: any, cutoff: number): any {
    const gray = new cv.Mat(), result = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.threshold(gray, result, Math.max(0, Math.min(255, cutoff)), 255, cv.THRESH_BINARY);
    gray.delete();
    return result;
  }

  private adaptiveThreshold(src: any, blockSize: number): any {
    const gray = new cv.Mat(), result = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    let b = Math.max(3, Math.min(99, blockSize));
    if (b % 2 === 0) b++;
    cv.adaptiveThreshold(gray, result, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, b, 2);
    gray.delete();
    return result;
  }

  private bilateral(src: any, diameter: number): any {
    const gray = new cv.Mat(), result = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const d = Math.max(1, Math.min(15, diameter));
    cv.bilateralFilter(gray, result, d, d * 2, d * 2);
    gray.delete();
    return result;
  }

  private invert(src: any): any {
    const gray = new cv.Mat(), result = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.bitwise_not(gray, result);
    gray.delete();
    return result;
  }

  private contrast(src: any, alpha: number): any {
    const gray = new cv.Mat(), result = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const a = Math.max(0.5, Math.min(3.0, alpha / 100 + 1));
    cv.convertScaleAbs(gray, result, a, 0);
    gray.delete();
    return result;
  }

  private median(src: any, ksize: number): any {
    const gray = new cv.Mat(), result = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    let k = Math.max(1, Math.min(21, ksize));
    if (k % 2 === 0) k++;
    cv.medianBlur(gray, result, k);
    gray.delete();
    return result;
  }

  private contours(src: any, threshold: number): any {
    const gray = new cv.Mat(), blurred = new cv.Mat(), binary = new cv.Mat();
    const result = new cv.Mat(src.rows, src.cols, cv.CV_8UC1, new cv.Scalar(255));
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.threshold(blurred, binary, Math.max(0, Math.min(255, threshold)), 255, cv.THRESH_BINARY);
    const contoursList = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(binary, contoursList, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);
    cv.drawContours(result, contoursList, -1, new cv.Scalar(0), 2);
    gray.delete(); blurred.delete(); binary.delete(); hierarchy.delete(); contoursList.delete();
    return result;
  }

  private pencilSketch(src: any, intensity: number): any {
    const gray = new cv.Mat(), blurred = new cv.Mat(), edges = new cv.Mat();
    const inverted = new cv.Mat(), result = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    // Blur for smooth base
    let blur = Math.max(1, Math.min(21, Math.round(intensity / 12)));
    if (blur % 2 === 0) blur++;
    cv.GaussianBlur(gray, blurred, new cv.Size(blur, blur), 0);
    // Edge detection
    const t = Math.max(20, Math.min(150, intensity));
    cv.Canny(blurred, edges, t, t * 2);
    cv.bitwise_not(edges, inverted);
    // Blend edges with blurred gray for pencil effect
    cv.addWeighted(blurred, 0.3, inverted, 0.7, 0, result);
    gray.delete(); blurred.delete(); edges.delete(); inverted.delete();
    return result;
  }

  /**
   * Watercolor effect: Creates smooth, painterly regions with soft edges.
   * Uses multiple bilateral filter passes to create smooth color regions,
   * then combines with edge detection for that hand-painted look.
   */
  private watercolor(src: any, smoothness: number): any {
    // Step 1: Convert to RGB for bilateral filtering
    const rgb = new cv.Mat();
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);

    // Step 2: Apply bilateral filter multiple times for smooth, painterly regions
    // Bilateral filter smooths while preserving edges - perfect for watercolor
    const d = Math.max(5, Math.min(15, Math.round(smoothness / 8)));
    let temp = rgb.clone();
    let smoothed = new cv.Mat();

    // Multiple passes create increasingly smooth color regions
    const passes = Math.max(2, Math.min(5, Math.round(smoothness / 25)));
    for (let i = 0; i < passes; i++) {
      cv.bilateralFilter(temp, smoothed, d, d * 2, d * 2);
      temp.delete();
      temp = smoothed.clone();
    }

    // Step 3: Create soft edges using median blur + adaptive threshold
    const gray = new cv.Mat();
    const edges = new cv.Mat();
    cv.cvtColor(smoothed, gray, cv.COLOR_RGB2GRAY);

    // Median blur removes noise while keeping edges
    let medianK = Math.max(3, Math.min(9, Math.round(smoothness / 15)));
    if (medianK % 2 === 0) medianK++;
    cv.medianBlur(gray, gray, medianK);

    // Adaptive threshold creates ink-like outlines
    let blockSize = Math.max(5, Math.min(15, Math.round(smoothness / 10)));
    if (blockSize % 2 === 0) blockSize++;
    cv.adaptiveThreshold(gray, edges, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY, blockSize, 2);

    // Step 4: Combine smoothed image with edges
    const edgesRgb = new cv.Mat();
    cv.cvtColor(edges, edgesRgb, cv.COLOR_GRAY2RGB);

    const combined = new cv.Mat();
    cv.bitwise_and(smoothed, edgesRgb, combined);

    // Step 5: Convert to grayscale for the layer system
    const result = new cv.Mat();
    cv.cvtColor(combined, result, cv.COLOR_RGB2GRAY);

    // Cleanup
    rgb.delete(); temp.delete(); smoothed.delete();
    gray.delete(); edges.delete(); edgesRgb.delete(); combined.delete();

    return result;
  }

  /**
   * Process an image with the specified filter.
   * Uses client-side OpenCV.js directly (no worker).
   */
  async processImage(file: Blob, request: ProcessingRequest): Promise<Blob> {
    await this.ensureReady();
    this.isProcessing.set(true);
    this.error.set(null);

    try {
      const imageBitmap = await createImageBitmap(file);
      const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create canvas context');

      ctx.drawImage(imageBitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
      const src = cv.matFromImageData(imageData);

      let result: any;
      switch (request.type) {
        case 'posterize': result = this.posterize(src, request.param_value); break;
        case 'edges': result = this.edges(src, request.param_value); break;
        case 'blur': result = this.blur(src, request.param_value); break;
        case 'threshold': result = this.threshold(src, request.param_value); break;
        case 'adaptive_threshold': result = this.adaptiveThreshold(src, request.param_value); break;
        case 'bilateral': result = this.bilateral(src, request.param_value); break;
        case 'invert': result = this.invert(src); break;
        case 'contrast': result = this.contrast(src, request.param_value); break;
        case 'median': result = this.median(src, request.param_value); break;
        case 'contours': result = this.contours(src, request.param_value); break;
        case 'pencil_sketch': result = this.pencilSketch(src, request.param_value); break;
        case 'watercolor': result = this.watercolor(src, request.param_value); break;
        default: throw new Error(`Unknown filter: ${request.type}`);
      }

      const rgba = new cv.Mat();
      cv.cvtColor(result, rgba, cv.COLOR_GRAY2RGBA);
      const outputData = new ImageData(new Uint8ClampedArray(rgba.data), rgba.cols, rgba.rows);

      src.delete(); result.delete(); rgba.delete();

      const outCanvas = new OffscreenCanvas(outputData.width, outputData.height);
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) throw new Error('Failed to create output canvas');
      outCtx.putImageData(outputData, 0, 0);

      return await outCanvas.convertToBlob({ type: 'image/png' });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Unknown error');
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
      case 'posterize': return 4;
      case 'edges': return 100;
      case 'blur': return 5;
      case 'threshold': return 128;
      case 'adaptive_threshold': return 11;
      case 'bilateral': return 9;
      case 'invert': return 0;
      case 'contrast': return 50;
      case 'median': return 5;
      case 'contours': return 128;
      case 'pencil_sketch': return 80;
      case 'watercolor': return 60;
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
      case 'adaptive_threshold': return { min: 3, max: 99, label: 'Block Size' };
      case 'bilateral': return { min: 1, max: 15, label: 'Diameter' };
      case 'invert': return { min: 0, max: 0, label: '' };
      case 'contrast': return { min: 0, max: 200, label: 'Contrast' };
      case 'median': return { min: 1, max: 21, label: 'Kernel Size' };
      case 'contours': return { min: 0, max: 255, label: 'Threshold' };
      case 'pencil_sketch': return { min: 20, max: 150, label: 'Intensity' };
      case 'watercolor': return { min: 20, max: 100, label: 'Smoothness' };
    }
  }
}

