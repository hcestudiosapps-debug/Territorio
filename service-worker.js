const CACHE = 'territoria-gis-v4.2';
const ASSETS = [
  './',
  './index.html',
  './css/estilos.css',
  './js/config.js',
  './js/auth.js',
  './js/gps.js',
  './js/entrevistas.js',
  './js/mapa.js',
  './js/admin.js',
  './js/reportes.js',
  './js/sync.js',
  './js/app.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('Fallo en precaché de assets:', err))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  
  e.respondWith(
    caches.match(e.request).then(cachedResponse => {
      // Retornar recurso en caché si existe, e intentar actualizar en segundo plano
      const fetchPromise = fetch(e.request).then(networkResponse => {
        const isExternalCacheable = 
          e.request.url.includes('fonts.googleapis.com') ||
          e.request.url.includes('fonts.gstatic.com') ||
          e.request.url.includes('unpkg.com') ||
          e.request.url.includes('jsdelivr.net');
          
        if (networkResponse.ok && (e.request.url.startsWith(self.location.origin) || isExternalCacheable)) {
          const clone = networkResponse.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return networkResponse;
      }).catch(() => {
        // En caso de estar sin conexión completa y no estar en caché
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
