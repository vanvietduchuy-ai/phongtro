/* Service worker tối giản: ưu tiên mạng, có bản dự phòng khi mất sóng */
const CACHE = 'huy-rooms-v3';
const SHELL = ['./', './index.html', './styles.css', './mobile.css', './config.js', './sync.js', './app.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;                 // đồng bộ luôn đi thẳng ra mạng
  if (url.origin !== location.origin) return;             // ảnh Drive, font: để trình duyệt tự lo
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
