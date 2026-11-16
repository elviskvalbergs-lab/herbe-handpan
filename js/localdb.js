// The sync bases in IndexedDB (docs/free-to-play.md, Phase 3 "Storage and
// sync"): for every saved item, the copy and version the server last
// confirmed. What differs from it is the outbox (js/sync.js), so it has to
// outlive a reload or a week offline. IndexedDB, not localStorage, because
// instrument photos would make two copies of everything too big for
// localStorage. Without IndexedDB (some private windows) it falls back to
// memory: sync still works, a reload just merges everything once more.

const LDB_NAME = 'oakhum';
const LDB_STORE = 'bases';
const LDB_META = '__meta';

let _ldb = null;
function ldbOpen() {
  if (_ldb) return _ldb;
  _ldb = new Promise(resolve => {
    try {
      const req = indexedDB.open(LDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(LDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return _ldb;
}

const _ldbMemory = new Map();

function ldbReq(mode, fn) {
  return ldbOpen().then(db => new Promise(resolve => {
    if (!db) { resolve(fn(null)); return; }
    try {
      const tx = db.transaction(LDB_STORE, mode);
      const r = fn(tx.objectStore(LDB_STORE));
      tx.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
      tx.onerror = tx.onabort = () => resolve(undefined);
    } catch { resolve(undefined); }
  }));
}

// The bases adapter syncRound() uses.
export const syncBases = {
  async getAll() {
    const db = await ldbOpen();
    if (!db) return new Map([..._ldbMemory].filter(([k]) => k !== LDB_META));
    const keys = await ldbReq('readonly', s => s.getAllKeys());
    const vals = await ldbReq('readonly', s => s.getAll());
    const out = new Map();
    (keys || []).forEach((k, i) => { if (k !== LDB_META) out.set(k, vals[i]); });
    return out;
  },
  async put(key, rec) {
    const db = await ldbOpen();
    if (!db) { _ldbMemory.set(key, rec); return; }
    await ldbReq('readwrite', s => s.put(rec, key));
  },
  async getMeta() {
    const db = await ldbOpen();
    if (!db) return _ldbMemory.get(LDB_META) ?? {};
    return (await ldbReq('readonly', s => s.get(LDB_META))) ?? {};
  },
  async setMeta(meta) {
    const db = await ldbOpen();
    if (!db) { _ldbMemory.set(LDB_META, meta); return; }
    await ldbReq('readwrite', s => s.put(meta, LDB_META));
  },
  // Sign-out and account deletion.
  async clear() {
    _ldbMemory.clear();
    const db = await ldbOpen();
    if (db) await ldbReq('readwrite', s => s.clear());
  },
};
