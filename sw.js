const CACHE = 'couple-house-v1';
const ASSETS = ['/couple-house/', '/couple-house/index.html', '/couple-house/styles.css', '/couple-house/app.js', '/couple-house/manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => { if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return; event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }))); });
