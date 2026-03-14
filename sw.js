// ═══════════════════════════════════════════════════════════════
// THE CHRONICLE — Service Worker
// Intercepts Hugging Face fetch requests and caches them
// permanently in Cache Storage so voices never re-download.
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'chronicle-kokoro-v1';

// Domains we want to cache aggressively
const CACHE_HOSTS = [
  'huggingface.co',
  'cdn-lfs.huggingface.co',
  'cdn-lfs-us-1.huggingface.co',
  'cdn-lfs-eu-1.huggingface.co',
];

// Install — claim clients immediately so the SW activates
// without needing a page reload
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Chronicle Service Worker');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activated — ready to cache Kokoro files');
  event.waitUntil(self.clients.claim());
});

// Fetch — intercept every network request
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only intercept requests to Hugging Face CDN domains
  if (!CACHE_HOSTS.some(host => url.hostname.includes(host))) {
    return; // Let everything else pass through normally
  }

  // Cache-first strategy for HuggingFace files:
  // 1. Check cache first
  // 2. If found, return immediately (instant)
  // 3. If not found, fetch from network, cache it, return it
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);

      if (cached) {
        // Serve from cache — instant, no network
        return cached;
      }

      // Not cached — fetch from network
      try {
        const response = await fetch(event.request);

        // Only cache successful responses
        if (response && response.status === 200) {
          // Clone the response — one copy goes to cache, one to app
          cache.put(event.request, response.clone());
          console.log(`[SW] Cached: ${url.pathname.split('/').pop()}`);
        }

        return response;
      } catch (err) {
        console.error('[SW] Fetch failed:', err);
        throw err;
      }
    })
  );
});

// Listen for a message to clear the cache (useful for debugging)
self.addEventListener('message', (event) => {
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[SW] Cache cleared');
    });
  }
  if (event.data === 'CACHE_SIZE') {
    caches.open(CACHE_NAME).then(async (cache) => {
      const keys = await cache.keys();
      event.source.postMessage({ type: 'CACHE_SIZE', count: keys.length });
    });
  }
});
