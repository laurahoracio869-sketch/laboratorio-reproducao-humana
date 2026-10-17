/* Service worker: guarda todos os arquivos do jogo para uso offline. Sem rede, sem telemetria. */
var CACHE = 'lab-reproducao-v4';
var FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './media/introducao-caso07.mp4'];
/* Opcionais (apresentação da banca + legenda): se faltarem no pacote, a instalação do cache NÃO falha. */
var OPTIONAL = ['./media/apresentacao-banca.mp4', './media/apresentacao-banca.vtt'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(FILES).then(function () {
      return Promise.all(OPTIONAL.map(function (u) { return c.add(u).catch(function () {}); }));
    });
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
/* Vídeo no Safari/iOS exige respostas 206 (Range): fatiamos o arquivo guardado em cache. */
function rangeFromCache(req) {
  return caches.match(req.url, { ignoreSearch: true }).then(function (hit) {
    if (hit) { return hit; }
    /* fora do cache (1o acesso): baixa o arquivo inteiro, guarda e responde por fatias, pois alguns servidores ignoram Range */
    return fetch(req.url).then(function (r) {
      if (r.status === 200) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(req.url, cp); }); }
      return r;
    });
  }).then(function (hit) {
    if (hit.status !== 200) { return hit; }
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
