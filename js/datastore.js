// Where saved things live on this device (docs/free-to-play.md §2, §5).
//
// With an account on this device, playlists, layouts, instruments and
// progressions are kept in localStorage (and synced, js/sync.js). A guest
// keeps nothing between visits: the same keys live in sessionStorage, so
// the work of this visit survives a reload or the sign-in redirect in this
// tab, and is gone when the tab closes. On sign-in it is carried over into
// the account (carryOverVisit). Settings and clay bodies stay in
// localStorage for everyone; they aren't save actions.

export const DATA_KEYS = ['hp-playlists', 'hp-layouts', 'hp-instruments', 'hp-progressions'];
const ACCOUNT_FLAG = 'hp-account';
// Whose things this device holds: the account's user id, kept beside the
// flag. Saved data and the sync bases (js/localdb.js) belong to that one
// account, never to "whoever is signed in".
const ACCOUNT_USER = 'hp-account-user';

function dsLocal() { try { return globalThis.localStorage ?? null; } catch { return null; } }
function dsSession() { try { return globalThis.sessionStorage ?? null; } catch { return null; } }

// An account is on this device: set at sign-in, cleared at sign-out. It
// stays set while offline or while a token refreshes, so a signed-in
// person never loses their things to a dropped connection.
export function hasAccountOnDevice() {
  return dsLocal()?.getItem(ACCOUNT_FLAG) === '1';
}

// A session from before this flag existed (supabase-js keeps it under
// sb-…-auth-token) counts as an account on this device. Checked once, as
// the page loads, before supabase-js can write a new session: a sign-in in
// this tab goes through carryOverVisit instead.
(function adoptEarlierSession() {
  const ls = dsLocal();
  if (!ls || ls.getItem(ACCOUNT_FLAG) === '1') return;
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && /^sb-.*-auth-token$/.test(k)) { try { ls.setItem(ACCOUNT_FLAG, '1'); } catch { /* full: stays a guest */ } return; }
  }
})();

export function setAccountOnDevice(on) {
  const ls = dsLocal();
  if (!ls) return;
  if (on) safeSetItem(ls, ACCOUNT_FLAG, '1'); else { ls.removeItem(ACCOUNT_FLAG); ls.removeItem(ACCOUNT_USER); }
}

// Every write to localStorage or sessionStorage goes through here. A full
// device (QuotaExceededError), a private window or blocked storage throws on
// setItem; uncaught, that stopped whatever the tap was doing with nothing
// said. Returns false when the value was not stored, and tells the app
// ('hp-storage-full', js/app.js shows the message).
export function safeSetItem(store, key, value) {
  try {
    store.setItem(key, value);
    return true;
  } catch (err) {
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('hp-storage-full', { detail: { key } }));
    } catch { /* nobody to tell */ }
    return false;
  }
}

// The user id of the account on this device; null for a guest, and for an
// account from before the id was kept (adopted at its next sign-in).
export function accountUserOnDevice() {
  return dsLocal()?.getItem(ACCOUNT_USER) || null;
}
export function setAccountUserOnDevice(id) {
  const ls = dsLocal();
  if (ls && id) safeSetItem(ls, ACCOUNT_USER, id);
}

// Who signed in, compared with whose things are here:
//   'same'  — the account on this device (carry on)
//   'adopt' — the device has an account but no id yet (older versions): it
//             is taken to be this one
//   'other' — a different person: the device must forget the previous
//             account's things and sync bases before anything syncs
export function accountMatch(onDevice, signedIn) {
  if (!onDevice) return 'adopt';
  return onDevice === signedIn ? 'same' : 'other';
}

// The storage the data keys use right now.
export function dataStore() {
  const ls = dsLocal();
  if (hasAccountOnDevice()) return ls;
  return dsSession() ?? ls;
}

// Did this visit build or keep anything (a guest's unsaved work)?
export function visitHasWork() {
  if (hasAccountOnDevice()) return false;
  const ss = dsSession();
  if (!ss) return false;
  return ['hp-layouts', 'hp-instruments', 'hp-progressions'].some(k => {
    try { return (JSON.parse(ss.getItem(k) || '[]') || []).some(x => !x.deletedAt); } catch { return false; }
  });
}

// Pure: merges a visit's list into the account's. An item whose id the
// account already has is kept as well, under a new id (§5: both are kept),
// except Favourites, whose chords join the account's.
export function mergeVisitList(account = [], visit = [], newId = id => `${id}-${Math.random().toString(36).slice(2, 6)}`) {
  const out = account.map(x => ({ ...x }));
  const moved = [];
  for (const item of visit) {
    if (item.deletedAt) continue;
    const same = out.find(x => x.id === item.id);
    if (!same) { out.push({ ...item }); moved.push(item); continue; }
    if (item.id === 'favorites' && Array.isArray(item.chords)) {
      const have = new Set((same.chords || []).map(c => c.id));
      const add = item.chords.filter(c => !have.has(c.id));
      if (add.length) { same.chords = [...add, ...(same.chords || [])]; same.updatedAt = item.updatedAt; }
      continue;
    }
    if (JSON.stringify(same) === JSON.stringify(item)) continue;
    const copy = { ...item, id: newId(item.id) };
    out.push(copy);
    moved.push(copy);
  }
  return { list: out, moved };
}

// Moves everything this tab built into the account's storage and marks
// the device as having an account. Returns the moved items by key.
export function carryOverVisit() {
  const ls = dsLocal(), ss = dsSession();
  const moved = {};
  if (ls && ss && ss !== ls) {
    for (const key of DATA_KEYS) {
      let visit = [];
      try { visit = JSON.parse(ss.getItem(key) || '[]') || []; } catch { visit = []; }
      if (!visit.length) continue;
      let account = [];
      try { account = JSON.parse(ls.getItem(key) || '[]') || []; } catch { account = []; }
      // A handpan layout keeps its id: its instrument id is made from it.
      const { list, moved: m } = mergeVisitList(account, visit, key === 'hp-layouts' ? id => `c-${Date.now()}-${id}` : undefined);
      // Only leaves the tab once it is safely in the account's storage.
      if (!safeSetItem(ls, key, JSON.stringify(list))) continue;
      ss.removeItem(key);
      moved[key] = m;
    }
  }
  setAccountOnDevice(true);
  return moved;
}

// Sign-out and account deletion: this device forgets the account's things.
export function clearAccountData() {
  const ls = dsLocal(), ss = dsSession();
  for (const key of DATA_KEYS) { ls?.removeItem(key); ss?.removeItem(key); }
  ls?.removeItem('hp-updated-at');
  setAccountOnDevice(false);
}
