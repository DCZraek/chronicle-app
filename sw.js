// ═══════════════════════════════════════════════════════════════
// THE CHRONICLE — Service Worker v2
// Fixes corrupted cache responses by rebuilding clean responses
// with correct headers when serving from cache.
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'chronicle-kokoro-v2';

const CACHE_HOSTS = [
  'huggingface.co',
  'cdn-lfs.huggingface.co',
  'cdn-lfs-us-1.huggingface.co',
  'cdn-lfs-eu-1.huggingface.co',
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing v2');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activated v2');
  // Delete old cache versions
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (!CACHE_HOSTS.some(host => url.hostname.includes(host))) {
    return;
  }

  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(handleHuggingFaceFetch(event.request));
});

async function handleHuggingFaceFetch(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    // Rebuild a fresh Response from the cached bytes with clean headers
    // This avoids the negative duration / corrupted response bug
    const body = await cached.arrayBuffer();
    const contentType = cached.headers.get('content-type') || 'application/octet-stream';

    console.log(`[SW] Serving from cache: ${request.url.split('/').pop()} (${(body.byteLength/1024/1024).toFixed(1)}MB)`);

    return new Response(body, {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': contentType,
        'Content-Length': body.byteLength.toString(),
        'Cache-Control': 'no-transform',
        'X-Chronicle-Cache': 'hit',
      },
    });
  }

  // Not in cache — fetch from network
  try {
    console.log(`[SW] Fetching from network: ${request.url.split('/').pop()}`);
    const response = await fetch(request);

    if (response && response.status === 200) {
      // Clone before consuming
      const responseToCache = response.clone();
      cache.put(request, responseToCache);
      console.log(`[SW] Cached: ${request.url.split('/').pop()}`);
    }

    return response;
  } catch (err) {
    console.error('[SW] Fetch failed:', err);
    throw err;
  }
}

self.addEventListener('message', (event) => {
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[SW] Cache cleared');
      event.source.postMessage({ type: 'CACHE_CLEARED' });
    });
  }
  if (event.data === 'CACHE_SIZE') {
    caches.open(CACHE_NAME).then(async (cache) => {
      const keys = await cache.keys();
      event.source.postMessage({ type: 'CACHE_SIZE', count: keys.length });
    });
  }
});
