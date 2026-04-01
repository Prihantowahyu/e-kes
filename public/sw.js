// public/sw.js — Service Worker untuk PWA
const CACHE_NAME = 'kesiswaan-v1';
const ASSETS = [
  '/css/style.css',
  '/js/app.js',
  '/login',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Hanya cache GET request untuk asset statis
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Jangan cache API/form POST
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/laporan/backup')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
