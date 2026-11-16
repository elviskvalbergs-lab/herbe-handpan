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
    if (k && /^sb-.*-auth-token$/.test(k)) { ls.setItem(ACCOUNT_FLAG, '1'); return; }
  }
})();

export function setAccountOnDevice(on) {
  const ls = dsLocal();
  if (!ls) return;
  if (on) ls.setItem(ACCOUNT_FLAG, '1'); else ls.removeItem(ACCOUNT_FLAG);
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
      ls.setItem(key, JSON.stringify(list));
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
