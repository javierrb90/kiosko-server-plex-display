const CACHE = 'bbq-v7-4-1';
const SHELL = ['/', '/index.html', '/style.css?v=7.4.2', '/app.js?v=7.4.2', '/manifest.webmanifest', '/core/socket-client.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/webhook')) return;
  event.respondWith(fetch(req).catch(() => caches.match(req).then(match => match || caches.match('/'))));
});
