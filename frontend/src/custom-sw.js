/**
 * Custom Service Worker for drawKISS
 * Wraps Angular's ngsw-worker.js and adds Web Share Target support
 */

// Import Angular's service worker
importScripts('./ngsw-worker.js');

// Cache name for shared files
const SHARE_CACHE = 'share-target-cache-v1';

/**
 * Handle share target POST requests
 * When a user shares an image to drawKISS, the OS sends a POST to /share
 * We intercept it, cache the file, and redirect to the app
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only handle POST requests to /share
  if (event.request.method === 'POST' && url.pathname === '/share') {
    event.respondWith(handleShareTarget(event.request));
    return;
  }
  
  // Let Angular's service worker handle everything else
  // (it's already registered via importScripts)
});

/**
 * Process the shared file and redirect to the app
 */
async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('image');
    
    if (files.length > 0) {
      const file = files[0];
      
      // Store the shared file in cache
      const cache = await caches.open(SHARE_CACHE);
      
      // Create a response from the file to store in cache
      const response = new Response(file, {
        headers: {
          'Content-Type': file.type,
          'X-Shared-Filename': file.name,
          'X-Shared-Timestamp': Date.now().toString()
        }
      });
      
      // Store with a known key so the app can retrieve it
      await cache.put('/shared-image', response);
      
      // Redirect to the share handler page
      return Response.redirect('/share?received=true', 303);
    }
    
    // No file received, redirect to capture page
    return Response.redirect('/capture', 303);
    
  } catch (error) {
    console.error('Share target error:', error);
    // On error, redirect to capture page
    return Response.redirect('/capture?error=share-failed', 303);
  }
}

/**
 * Clean up old shared files on activation
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.open(SHARE_CACHE).then(cache => {
      // Clear any stale shared files
      return cache.delete('/shared-image');
    }).catch(() => {
      // Ignore errors during cleanup
    })
  );
});

