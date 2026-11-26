// Guest storage, carry-over and the save gate (docs/free-to-play.md §2, §3, §5).
import { test } from 'node:test';
import assert from 'node:assert/strict';

function memStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k),
    key: i => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}
globalThis.localStorage = memStorage();
globalThis.sessionStorage = memStorage();

const ds = await import('../js/datastore.js');
const store = await import('../js/store.js');

test('a guest keeps saved lists in this tab; an account on the device', () => {
  assert.equal(ds.hasAccountOnDevice(), false);
  assert.equal(ds.dataStore(), sessionStorage);
  ds.setAccountOnDevice(true);
  assert.equal(ds.dataStore(), localStorage);
  ds.setAccountOnDevice(false);
});

test('mergeVisitList keeps both on an id clash and joins Favourites', () => {
  const account = [{ id: 'favorites', chords: [{ id: 'a' }] }, { id: 'oc-1', name: 'Mine' }];
  const visit = [{ id: 'favorites', chords: [{ id: 'b' }, { id: 'a' }] }, { id: 'oc-1', name: 'Visit' }, { id: 'oc-2', name: 'New' }, { id: 'oc-3', deletedAt: 'x' }];
  const { list, moved } = ds.mergeVisitList(account, visit, id => id + '-v');
  assert.deepEqual(list.find(x => x.id === 'favorites').chords.map(c => c.id), ['b', 'a']);
  assert.deepEqual(list.map(x => x.id), ['favorites', 'oc-1', 'oc-1-v', 'oc-2']);
  assert.deepEqual(moved.map(x => x.name), ['Visit', 'New']);
});

test('carryOverVisit moves the tab\'s work into the account and clears the tab', () => {
  sessionStorage.setItem('hp-instruments', JSON.stringify([{ id: 'oc-9', name: 'Clay G' }]));
  assert.equal(ds.visitHasWork(), true);
  const moved = ds.carryOverVisit();
  assert.equal(ds.hasAccountOnDevice(), true);
  assert.deepEqual(moved['hp-instruments'].map(i => i.name), ['Clay G']);
  assert.equal(sessionStorage.getItem('hp-instruments'), null);
  assert.equal(JSON.parse(localStorage.getItem('hp-instruments'))[0].name, 'Clay G');
  ds.clearAccountData();
  assert.equal(localStorage.getItem('hp-instruments'), null);
  assert.equal(ds.hasAccountOnDevice(), false);
});

test('the save gate: only guests, only saving actions', () => {
  assert.equal(store.saveIntentFor('save-layout', { guest: true }), 'instrument');
  assert.equal(store.saveIntentFor('save-layout', { guest: false }), null);
  assert.equal(store.saveIntentFor('play-chord', { guest: true }), null);
  // A pasted chord sheet plays for a guest; keeping it is the save moment.
  assert.equal(store.saveIntentFor('cs-save', { guest: true }), null);
  assert.equal(store.saveIntentFor('prog-keep', { guest: true }), 'song');
  for (const what of Object.values(store.SAVE_ACTIONS)) assert.ok(store.SAVE_TEXTS[what], `text for ${what}`);
});

test('the started save survives in this tab, once', () => {
  store.keepPendingSave({ what: 'chord', entry: { id: 'x' }, path: '/handpan/d-kurd' });
  assert.equal(store.peekPendingSave().what, 'chord');
  assert.deepEqual(store.takePendingSave().entry, { id: 'x' });
  assert.equal(store.takePendingSave(), null);
  store.keepPendingSave({ what: 'song' });
  assert.equal(store.takePendingSave(Date.now() + 2 * 3600000), null, 'an hour later it is dropped');
});

test('alsoSavedText', () => {
  assert.equal(store.alsoSavedText(['Low D']), 'Also saved: Low D');
  assert.equal(store.alsoSavedText(['A', 'B', 'C', 'D']), 'Also saved: A, B and C and 1 more');
  assert.equal(store.alsoSavedText([]), '');
});

// ── Whose things are on this device (js/datastore.js) ───────────────────────
import { accountMatch, safeSetItem } from '../js/datastore.js';

test('a different person signing in is told apart from the account on the device', () => {
  assert.equal(accountMatch('u1', 'u1'), 'same');
  assert.equal(accountMatch('u1', 'u2'), 'other');
  assert.equal(accountMatch(null, 'u2'), 'adopt', 'an account from before the id was kept');
});

test('a write that fails (full device) returns false instead of throwing', () => {
  const full = { setItem() { throw new Error('QuotaExceededError'); } };
  const ok = { v: null, setItem(k, v) { this.v = v; } };
  assert.equal(safeSetItem(full, 'k', 'v'), false);
  assert.equal(safeSetItem(ok, 'k', 'v'), true);
  assert.equal(ok.v, 'v');
});
