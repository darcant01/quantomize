// Quantomize Service Worker
const CACHE = 'quantomize-v1';
const APP_SHELL = [
  '/app',
  '/login',
  '/signup',
  '/landing.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install — pre-cache the app shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - API calls: always network (never cache dynamic data)
// - Pages/assets: network-first, fall back to cache when offline
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never cache API or auth requests
  if (url.pathname.startsWith('/api/')) {
    return; // let it hit the network normally
  }

  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Cache successful same-origin GETs
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/app')))
  );
});
