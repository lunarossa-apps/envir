const CACHE = 'gruppo-vacanze-shell-v1';
const ASSETS = ['/', '/manifest.webmanifest', '/assets/app.js', '/assets/styles.css'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => undefined));
});

self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
