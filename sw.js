// Service worker: caches the app shell so the app works offline.
// Own files: network first (so edits to content.json show up), cache when offline.
// Firebase SDK from gstatic: cache first (the URLs are versioned).
const CACHE = 'angludarzs-v2';
const SHELL = [
  './',
  'index.html',
  'krista.html',
  'css/app.css',
  'css/krista.css',
  'config.js',
  'content.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/main.js',
  'js/krista.js',
  'js/store.js',
  'js/content.js',
  'js/speech.js',
  'js/check.js',
  'js/srs.js',
  'js/garden.js',
  'js/sync.js',
  'js/fb.js',
  'js/util.js',
  'js/validate.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const hit = await caches.match(req, { ignoreSearch: true });
          if (hit) return hit;
          if (req.mode === 'navigate') return caches.match('index.html');
          return Response.error();
        }),
    );
    return;
  }

  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) => hit || fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
      ),
    );
  }
});
