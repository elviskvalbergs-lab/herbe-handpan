// Offline for accounts (docs/free-to-play.md §4). Registered by js/offline.js
// only while an account is on the device, as /sw.js?v=<build hash>: a new
// build is a new worker with its own cache, and the old cache is deleted.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `oakhum-${VERSION}`;
// Must match the pinned supabase-js in build.py.
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js';
// The app's home (one domain: the website is at /, the app at /play).
const APP_HOME = '/play';
const PRECACHE = [
  APP_HOME, '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png', '/icon-180.png',
  '/fonts/oakhum-text-400.woff2', '/fonts/oakhum-text-500.woff2', '/fonts/oakhum-text-600.woff2', '/fonts/oakhum-text-700.woff2',
  SUPABASE_JS,
];

// Sign-out (js/offline.js disable): this worker keeps the open page until it
// closes, so it stops caching at once, before its caches are deleted.
let off = false;
self.addEventListener('message', e => { if (e.data?.type === 'oakhum-off') off = true; });

// Pages that are the app. '/' is the app on its own Vercel address and the
// website's home on the shared domain: online the network answers either
// way, and offline the app is the best we have.
const APP_PAGES = /^\/(play|handpan|tongue-drum|kalimba|ocarina|flute|s)?(\/|$)/;
function isAppPage(url) { return url.origin === self.location.origin && APP_PAGES.test(url.pathname); }
// Files of the app (not the website's /_next/… or images).
const APP_FILES = /^\/(manifest\.json|icon[^/]*|fonts\/[^/]+|og\/[^/]+)$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(PRECACHE.map(url =>
    c.add(new Request(url, { cache: 'reload', mode: url.startsWith('http') ? 'cors' : 'same-origin' })).catch(() => {}),
  ))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || off) return;
  const url = new URL(req.url);
  // Opening the app, deep links included (/play, /handpan/…, /s/…): network
  // first, then the cached app, which reads the path itself. The website's
  // own pages on the same domain are left alone.
  if (req.mode === 'navigate') {
    if (!isAppPage(url)) return;
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok && url.pathname === APP_HOME) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(APP_HOME, copy));
          }
          return res;
        })
        .catch(() => caches.match(APP_HOME)),
    );
    return;
  }
  // The app's own files, fonts and the pinned supabase-js: cache first.
  const cacheable = (url.origin === self.location.origin && APP_FILES.test(url.pathname))
    || req.url === SUPABASE_JS || url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';
  if (!cacheable) return; // Supabase API, analytics, Sentry: always the network
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })),
  );
});
