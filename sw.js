
/* سرویس‌ورکر میز کار */
const VERSION = 'v2';
const CACHE = 'desk-' + VERSION;
const BASE = self.registration.scope;
const BASE_PATH = new URL(BASE).pathname;
const INDEX = new URL('./index.html', BASE).href;

const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('desk-') && key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function notifyUpdated() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((client) => {
    client.postMessage({ type: 'updated' });
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isPage =
    url.pathname === BASE_PATH ||
    url.pathname === BASE_PATH + 'index.html';

  const key = isPage ? INDEX : request.url;

  const work = (async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key, { ignoreSearch: true });
    const oldPage = cached && isPage ? cached.clone() : null;

    const refresh = fetch(key, { cache: 'no-cache' })
      .then(async (response) => {
        if (response && response.ok) {
          if (oldPage) {
            const oldText = await oldPage.text();
            const newText = await response.clone().text();
            if (oldText !== newText) await notifyUpdated();
          }

          await cache.put(key, response.clone());
        }
        return response;
      })
      .catch(() => null);

    return { cached, refresh };
  })();

  event.waitUntil(work.then((result) => result.refresh));

  event.respondWith(
    work.then(async (result) =>
      result.cached || (await result.refresh) || Response.error()
    )
  );
});
