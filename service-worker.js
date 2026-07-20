const CACHE_NAME = 'consulta-aquisicoes-v1.0.3-process-dv99';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png?v=2',
  './icon-512.png?v=2',
  './comprasgov.png',
  './sipac-ufpb.webp',
  './portal-transparencia.webp',
  './pra-ufpb.png',
  './uasgs.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    const navigationUrl = new URL(event.request.url);
    if (navigationUrl.pathname.endsWith('/pncp-resolver.html')) {
      event.respondWith(fetch(event.request, { cache: 'no-store' }));
      return;
    }
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', response.clone()));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  const requestUrl = new URL(event.request.url);
  const needsFreshCopy = requestUrl.origin === self.location.origin && (
    event.request.destination === 'script' ||
    event.request.destination === 'style' ||
    requestUrl.pathname.endsWith('/manifest.json') ||
    requestUrl.pathname.endsWith('/uasgs.json')
  );
  if (needsFreshCopy) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
