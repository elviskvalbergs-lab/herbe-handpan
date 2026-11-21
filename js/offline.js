// Offline, for accounts only (docs/free-to-play.md §4).
//
// The service worker (sw.js) is registered only while an account is on
// this device. A guest's browser never keeps it: on every start as a guest
// any registration is removed and its caches deleted, which also covers
// guests from the old version (when everyone got one) and a sign-out in
// another tab. The page itself works offline either way once loaded,
// because everything is worked out on the device.

export const offline = {
  // 'online' | 'offline'
  get status() { return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online'; },

  // Registers sw.js (its ?v= is the build's hash, so a new build installs a
  // new worker with a new precache). Resolves true only when a worker is
  // active AND the app's page is in its cache, which is what "Ready: the app
  // opens without a connection" promises. A worker whose install failed (the
  // page could not be fetched) resolves false; the next start tries again.
  async enable(version = '', { timeoutMs = 20000 } = {}) {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.register(`/sw.js${version ? `?v=${version}` : ''}`);
      const active = await new Promise(resolve => {
        const timer = setTimeout(() => resolve(false), timeoutMs);
        const done = ok => { clearTimeout(timer); resolve(ok); };
        const worker = reg.installing || reg.waiting;
        // A failed install ends as 'redundant', and serviceWorker.ready
        // would then wait for ever.
        if (worker) worker.addEventListener('statechange', () => { if (worker.state === 'redundant' && !reg.active) done(false); });
        navigator.serviceWorker.ready.then(() => done(true), () => done(false));
      });
      return active && await this.cached();
    } catch { return false; }
  },

  // Is the app's page in a cache of this site?
  async cached(path = '/play') {
    try { return !!(await caches.match(path)); } catch { return false; }
  },

  // Unregisters every service worker of this site and deletes their caches.
  async disable() {
    // The worker controlling this page keeps it until it closes: tell it to
    // stop caching first, so nothing is written after the caches go.
    try { navigator.serviceWorker?.controller?.postMessage({ type: 'oakhum-off' }); } catch { /* none */ }
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
      await Promise.all(regs.map(r => r.unregister()));
    } catch { /* nothing registered */ }
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch { /* no Cache API */ }
  },

  // Is a worker controlling or installed for this page (offline "Ready")?
  async ready() {
    try { return !!(await navigator.serviceWorker?.getRegistration?.())?.active && await this.cached(); } catch { return false; }
  },
};
