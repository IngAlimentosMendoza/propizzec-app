// PROPIZZEC — service worker
// Cachea el shell de la app (el HTML) para que abra rápido y funcione
// aunque la conexión falle momentáneamente. Los datos siempre se piden
// en vivo a Supabase — esto NO guarda información de producción offline.

const CACHE_NAME = 'propizzec-shell-v1';
const SHELL_FILES = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // nunca cachear escrituras

  // El HTML principal: red primero (para tener siempre la última versión),
  // con el caché como respaldo si no hay conexión.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Nunca interceptar llamadas a Supabase u otros dominios externos —
  // esos siempre deben ir en vivo, no cacheados.
  if (new URL(req.url).origin !== self.location.origin) return;

  // Otros archivos propios (íconos, manifest): caché primero, red de respaldo.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
