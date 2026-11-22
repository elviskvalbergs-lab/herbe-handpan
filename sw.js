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
const APP_PAGES = /^\/(play|handpan|tongue-drum|kalimba|ocarina|flute|recorder|s)?(\/|$)/;
function isAppPage(url) { return url.origin === self.location.origin && APP_PAGES.test(url.pathname); }
// Files of the app (not the website's /_next/… or images).
const APP_FILES = /^\/(manifest\.json|icon[^/]*|fonts\/[^/]+|og\/[^/]+)$/;

// Install succeeds only when the app's page is in the cache: without it there
// is nothing to open offline, and a worker that claimed otherwise would say
// "Ready" over an empty cache. A failed install is dropped by the browser and
// tried again at the next start (js/offline.js enable). Everything else in
// PRECACHE is best effort: the app opens without an icon or a font weight.
self.addEventListener('install', e => {
  const request = url => new Request(url, { cache: 'reload', mode: url.startsWith('http') ? 'cors' : 'same-origin' });
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.add(request(APP_HOME)); // rejects on a network error or a response that isn't ok
    await Promise.all(PRECACHE.filter(url => url !== APP_HOME).map(url => c.add(request(url)).catch(() => {})));
    await self.skipWaiting();
  }));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// A connection that is there but going nowhere (a train, a lift, a captive
// portal) must not leave a blank page while the app sits in the cache: the
// network gets this long, then the cached app opens. With nothing cached the
// network is all there is, however long it takes.
const NAV_TIMEOUT_MS = 4000;
async function openApp(req, url) {
  const cached = await caches.match(APP_HOME);
  const network = fetch(req).then(res => {
    if (res.ok && url.pathname === APP_HOME) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(APP_HOME, copy)).catch(() => {});
    }
    return res;
  });
  if (!cached) return network;
  const slow = new Promise(resolve => setTimeout(resolve, NAV_TIMEOUT_MS, null));
  try {
    return (await Promise.race([network, slow])) ?? cached;
  } catch {
    return cached; // offline
  } finally {
    network.catch(() => {}); // a late failure after the cached app was served
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || off) return;
  const url = new URL(req.url);
  // Opening the app, deep links included (/play, /handpan/…, /s/…): network
  // first, then the cached app, which reads the path itself. The website's
  // own pages on the same domain are left alone.
  if (req.mode === 'navigate') {
    if (!isAppPage(url)) return;
    e.respondWith(openApp(req, url));
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
