/* Qaza Namaz Tracker — offline support
   ------------------------------------------------------------
   Without this file, the site cannot load at all with no internet
   connection (a normal browser HTTP cache is not reliable enough for
   full offline use, especially for the very first "navigation"
   request). A service worker sits between the page and the network
   for every request the page makes, so we can:
     1. Save a copy of every file the app needs the first time it's
        fetched (including the Tailwind CDN script and Google Fonts,
        which the app's styling depends on).
     2. Serve that saved copy instantly — and offline — from then on,
        while still refreshing the copy in the background whenever
        the internet is available (so updates still reach everyone).
   The actual family data (Marhoom records, prayer counts, etc.) was
   already being saved to localStorage regardless of this file — that
   part always worked offline. This file is what makes the *app
   itself* (its HTML/CSS/JS/fonts) load without internet too.
   ------------------------------------------------------------ */

const CACHE_NAME = 'qaza-tracker-v1';

// Bump CACHE_NAME (e.g. 'qaza-tracker-v2') any time you update app.js /
// styles.css / index.html, so every device picks up the new version
// instead of continuing to serve an old cached copy forever.

const PRECACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  'https://cdn.tailwindcss.com',
  'https://accounts.google.com/gsi/client',
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Inter:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        PRECACHE_URLS.map((url) => {
          // 'no-cors' lets us cache cross-origin resources (Tailwind, fonts,
          // Google's sign-in script) even though we can't read their
          // response bodies — we can still store and replay them offline.
          const req = new Request(url, { mode: 'no-cors' });
          return fetch(req).then((res) => cache.put(url, res)).catch(() => {});
        })
      );
    })
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
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          // Save a fresh copy for next time (opaque cross-origin responses
          // have status 0 but type 'opaque' — those are cacheable too).
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached); // offline and not cached yet — nothing we can do for this one request

      // Serve the cached copy immediately if we have one (fast + works offline);
      // otherwise wait for the network.
      return cached || network;
    })
  );
});
