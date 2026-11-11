/* سرویس‌ورکر میز کار
   - همهٔ فایل‌های برنامه در حافظهٔ گوشی ذخیره می‌شوند؛ بدون اینترنت (حتی بدون اینترنت ملی) هم باز می‌شود.
   - هر بار برنامه باز شود، در پس‌زمینه نسخهٔ تازه را می‌گیرد؛ نسخهٔ جدید دفعهٔ بعد نمایش داده می‌شود.
   - فقط وقتی عددِ VERSION را عوض کن که آیکون یا manifest را تغییر داده‌ای. */
const VERSION = 'v1';
const CACHE = 'desk-' + VERSION;
const BASE = self.registration.scope;
const INDEX = new URL('./index.html', BASE).href;
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('desk-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function notifyUpdated() {
  const list = await self.clients.matchAll({ includeUncontrolled: true });
  list.forEach((c) => c.postMessage({ type: 'updated' }));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // قیمت‌ها، آیکون سایت‌ها و ... دست‌نخورده می‌مانند
  const isPage = req.mode === 'navigate' || url.pathname === new URL(BASE).pathname || url.pathname.endsWith('/index.html');
  const key = isPage ? INDEX : req.url;

  const work = (async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key, { ignoreSearch: true });
    const old = cached && isPage ? cached.clone() : null;
    const refresh = fetch(key, { cache: 'no-cache' }).then(async (res) => {
      if (res && res.ok) {
        if (old) {
          const same = (await old.text()) === (await res.clone().text());
          if (!same) notifyUpdated();
        }
        await cache.put(key, res.clone());
      }
      return res;
    }).catch(() => null);
    return { cached, refresh };
  })();
  e.waitUntil(work.then((w) => w.refresh));
  e.respondWith(work.then(async (w) => w.cached || (await w.refresh) || Response.error()));
});
