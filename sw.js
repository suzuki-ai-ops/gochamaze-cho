const cachePrefix = 'gochamaze-cho-shell-';
const cacheName = cachePrefix + '1';
const scope = self.registration.scope;
const indexURL = new URL('index.html', scope).href;
const sdkBase = 'https://www.gstatic.com/firebasejs/10.14.1/';
const sdkURLs = ['app', 'auth', 'firestore'].map(name => sdkBase + 'firebase-' + name + '-compat.js');

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll([indexURL, ...sdkURLs].map(url => new Request(url, {cache: 'reload'})))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (sdkURLs.includes(request.url)) {
    event.respondWith(caches.open(cacheName).then(async cache =>
      (await cache.match(request)) || fetch(request)
    ));
    return;
  }

  const url = new URL(request.url);
  if (request.mode !== 'navigate' || ![scope, indexURL].includes(url.origin + url.pathname)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && !response.redirected) {
        const copy = response.clone();
        event.waitUntil(caches.open(cacheName).then(cache => cache.put(indexURL, copy)).catch(error => {
          console.warn('アプリのオフライン用キャッシュを更新できませんでした。', error);
        }));
      }
      return response;
    } catch {
      const cache = await caches.open(cacheName);
      return (await cache.match(indexURL)) || Response.error();
    }
  })());
});
