// Quantomize Service Worker — v2 (stale-while-revalidate for speed)
const CACHE = 'quantomize-v2';
const APP_SHELL = [
  '/app',
  '/login',
  '/signup',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // API + auth: always network, never cache (fresh data)
  if (url.pathname.startsWith('/api/')) return;
  if (e.request.method !== 'GET') return;
  // Skip cross-origin (fonts, CDN libs handle their own caching)
  if (url.origin !== self.location.origin) return;

  // Stale-while-revalidate: serve from cache INSTANTLY, update in background.
  // This makes the app open immediately on repeat visits.
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((cached) => {
        const network = fetch(e.request)
          .then((res) => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          })
          .catch(() => cached);
        // Return cached immediately if we have it, else wait for network
        return cached || network;
      })
    )
  );
});
