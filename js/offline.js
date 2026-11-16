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
  // new worker with a new precache). Resolves true when it is ready.
  async enable(version = '') {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
    try {
      await navigator.serviceWorker.register(`/sw.js${version ? `?v=${version}` : ''}`);
      await navigator.serviceWorker.ready;
      return true;
    } catch { return false; }
  },

  // Unregisters every service worker of this site and deletes their caches.
  async disable() {
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
    try { return !!(await navigator.serviceWorker?.getRegistration?.()); } catch { return false; }
  },
};
