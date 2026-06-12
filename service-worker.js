const CACHE_NAME = 'balloon-pwa-v1';
const ASSETS_TO_CACHE = [
  './',
  './Balloon-Pop.html',
  './balloon.js',
  './styles.css',
  './index.html',
  './img/assets/Gumdramon.png',
  './img/assets/Red Balloon.png',
  './img/assets/Blue Balloon.png',
  './img/assets/Green Balloon.png',
  './img/assets/Yellow Balloon.png',
  './img/assets/background.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => { if (key !== CACHE_NAME) return caches.delete(key); })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // For navigation requests, try network first then cache fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        return caches.open(CACHE_NAME).then(cache => { cache.put(req, res.clone()); return res; });
      }).catch(() => caches.match('./Balloon-Pop.html'))
    );
    return;
  }

  // For other requests, respond from cache first, then network, then fallback
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(networkRes => {
        // Optionally cache fetched resources
        if (req.url.startsWith(self.location.origin)) {
          caches.open(CACHE_NAME).then(cache => cache.put(req, networkRes.clone()));
        }
        return networkRes;
      }).catch(() => {
        // If request is for an image, optionally return a generic fallback
        if (req.destination === 'image') return caches.match('./img/assets/background.png');
      });
    })
  );
});
