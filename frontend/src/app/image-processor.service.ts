import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProcessingOptions {
  levels: number;
  blur_radius: number;
  threshold: number;
  mode: 'posterize' | 'edges' | 'both';
}

@Injectable({
  providedIn: 'root'
})
export class ImageProcessorService {
  private apiUrl = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  processImage(file: Blob, options: ProcessingOptions): Observable<Blob> {
    const formData = new FormData();
    formData.append('file', file, 'capture.png');
    formData.append('levels', options.levels.toString());
    formData.append('blur_radius', options.blur_radius.toString());
    formData.append('threshold', options.threshold.toString());
    formData.append('mode', options.mode);

    return this.http.post(`${this.apiUrl}/process`, formData, {
      responseType: 'blob'
    });
  }

  checkHealth(): Observable<{ status: string; service: string }> {
    return this.http.get<{ status: string; service: string }>(`${this.apiUrl}/health`);
  }
}

