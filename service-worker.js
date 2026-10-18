
/* Laboratorio de Reproducao Humana — service worker v5
 * Atualiza paginas com a rede primeiro e preserva uma copia offline.
 * Videos e pedidos HTTP Range ficam a cargo do navegador/servidor,
 * evitando downloads pesados na instalacao e respostas 206 incorretas.
 */
const CACHE_NAME = 'lab-reproducao-v5';
const APP_SHELL = [
  './',
  './index.html',
  './portal/',
  './portal/index.html',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  // Nao bloqueie a ativacao caso algum arquivo opcional esteja indisponivel.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await Promise.all(APP_SHELL.map(async (url) => {
          try {
            const response = await fetch(new Request(url, { cache: 'reload' }));
            if (response.ok) await cache.put(url, response);
          } catch (_) { /* Sem rede: a instalacao pode continuar. */ }
        }));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('lab-reproducao-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Range e videos: use a rede normalmente.
  const pathname = new URL(request.url).pathname;
  if (request.headers.has('range') || /\.(mp4|webm|mov|m4v|mp3|m4a|ogg)$/i.test(pathname)) return;

  // Rede primeiro: impede que a pagina antiga fique presa no cache.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});
