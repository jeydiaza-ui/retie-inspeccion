/*
 * sw.js — Service worker de la aplicación de inspección.
 *
 * Estrategia: los archivos propios se sirven desde caché y se actualizan en
 * segundo plano (stale-while-revalidate); las navegaciones intentan la red y
 * caen a index.html cuando no hay conexión.
 *
 * IMPORTANTE: al publicar cambios en cualquiera de los archivos de ASSETS,
 * suba el número de CACHE para que los clientes reciban la versión nueva.
 */
const CACHE = 'retie-v3.0.1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './js/calc.js',
  './js/data.js',
  './js/report.js',
  './js/app.js',
  './manifest.json',
  './icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(hit => {
      const red = fetch(req).then(res => {
        if (res && res.ok && res.type === 'basic') {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || red;
    })
  );
});
