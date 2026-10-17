/* Service worker: guarda todos os arquivos do jogo para uso offline. Sem rede, sem telemetria. */
var CACHE = 'lab-reproducao-v2';
var FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './media/introducao-caso07.mp4'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
/* Vídeo no Safari/iOS exige respostas 206 (Range): fatiamos o arquivo guardado em cache. */
function rangeFromCache(req) {
  return caches.match(req.url, { ignoreSearch: true }).then(function (hit) {
    if (!hit) { return fetch(req); }
    return hit.arrayBuffer().then(function (buf) {
      var m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || ''), size = buf.byteLength;
      var s = m && m[1] ? parseInt(m[1], 10) : 0, en = m && m[2] ? parseInt(m[2], 10) : size - 1;
      if (en >= size) { en = size - 1; }
      return new Response(buf.slice(s, en + 1), { status: 206, statusText: 'Partial Content', headers: {
        'Content-Type': hit.headers.get('Content-Type') || 'video/mp4', 'Content-Length': String(en - s + 1), 'Content-Range': 'bytes ' + s + '-' + en + '/' + size } });
    });
  });
}
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') { return; }
  if (e.request.headers.get('range')) { e.respondWith(rangeFromCache(e.request)); return; }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request).then(function (r) {
      var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return r;
    }).catch(function () { return caches.match('./index.html'); });
  }));
});
