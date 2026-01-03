import { Component, OnInit, inject, signal } from '@angular/core';
import { SharedImageService } from './shared-image.service';

interface CacheEntryInfo {
  url: string;
  contentType: string | null;
  filename: string | null;
  timestamp: string | null;
  sizeBytes: number | null;
}

interface ShareDiagnostics {
  hasWindowCaches: boolean;
  cacheEntries: CacheEntryInfo[];
  sharedImagePending: boolean;
  hasServiceWorker: boolean;
  serviceWorkerInfo: {
    scriptURL: string;
    scope: string;
    state: string;
  } | null;
  errors: string[];
}

@Component({
  selector: 'app-share-debug',
  standalone: true,
  templateUrl: './share-debug.component.html',
  styleUrl: './share-debug.component.scss'
})
export class ShareDebugComponent implements OnInit {
  private sharedImageService = inject(SharedImageService);

  diagnostics = signal<ShareDiagnostics | null>(null);

  ngOnInit() {
    void this.runDiagnostics();
  }

  async runDiagnostics() {
    const result: ShareDiagnostics = {
      hasWindowCaches: typeof caches !== 'undefined',
      cacheEntries: [],
      sharedImagePending: false,
      hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
      serviceWorkerInfo: null,
      errors: []
    };

    try {
      result.sharedImagePending = this.sharedImageService.hasSharedImage();
    } catch (e) {
      result.errors.push('Error checking SharedImageService: ' + (e instanceof Error ? e.message : String(e)));
    }

    if (result.hasWindowCaches) {
      try {
        const cache = await caches.open('share-target-cache-v1');
        const requests = await cache.keys();

        for (const req of requests) {
          const res = await cache.match(req);
          if (!res) continue;

          let sizeBytes: number | null = null;
          try {
            const blob = await res.clone().blob();
            sizeBytes = blob.size;
          } catch {
            // ignore size errors
          }

          result.cacheEntries.push({
            url: req.url,
            contentType: res.headers.get('Content-Type'),
            filename: res.headers.get('X-Shared-Filename'),
            timestamp: res.headers.get('X-Shared-Timestamp'),
            sizeBytes
          });
        }
      } catch (e) {
        result.errors.push('Error reading share-target-cache-v1: ' + (e instanceof Error ? e.message : String(e)));
      }
    }

    if (result.hasServiceWorker) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sw = reg.active || reg.waiting || reg.installing;
        if (sw) {
          result.serviceWorkerInfo = {
            scriptURL: sw.scriptURL,
            scope: reg.scope,
            state: (sw as any).state ?? 'unknown'
          };
        }
      } catch (e) {
        result.errors.push('Error reading service worker registration: ' + (e instanceof Error ? e.message : String(e)));
      }
    }

    this.diagnostics.set(result);
  }

  trackByUrl(_: number, entry: CacheEntryInfo) {
    return entry.url;
  }
}

