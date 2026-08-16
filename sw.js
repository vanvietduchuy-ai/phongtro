/* Service worker v4.7.0 Supabase Realtime: network-first, fallback index.html CHỈ cho điều hướng,
 * không cache API/sync, chỉ cache response hợp lệ, dọn cache cũ khi lên phiên bản. */
const CACHE = 'huy-rooms-v4.6.7-fast-sync-v4.7.0-supabase-realtime';
const SHELL = ['./', './index.html', './styles.css', './mobile.css', './config.js', './sync.js', './realtime.js', './p2.js', './app.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;                    // sync POST đi thẳng
  if (url.origin !== location.origin) return;                // ảnh Drive, font: trình duyệt tự lo
  if (url.pathname.startsWith('/api/')) return;              // KHÔNG cache API (dữ liệu nhạy cảm)
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && (res.type === 'basic' || res.type === 'default')) {
        const copy = res.clone();
        e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copy)));
      }
      return res;                                            // lỗi 4xx/5xx: trả thẳng, KHÔNG cache
    }).catch(() =>
      caches.match(e.request).then(r => {
        if (r) return r;
        // fallback index.html CHỈ cho điều hướng trang — JS/CSS/ảnh lỗi thì lỗi thật
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })
    )
  );
});
