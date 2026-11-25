// Sync and offline, as the app shows them.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { icon } from '../icons.js';
import { accountMatch, accountUserOnDevice, dataStore, safeSetItem } from '../datastore.js';
import { pendingChanges, syncKey, syncRound } from '../sync.js';
import { getInstrumentsRaw, usesLayout } from '../instruments.js';
import { deviceKind, getUserId, isLoggedIn, logEvent, saveCloudInstruments, syncApi } from '../auth.js';
import { syncBases } from '../localdb.js';
import { offline } from '../offline.js';

// ── Sync ────────────────────────────────────────────────────────────────────
// The items on this device, for syncRound (js/sync.js). Handpan instruments
// are left out: they're made from the saved layouts, which sync themselves.
const SYNC_LISTS = { playlist: 'hp-playlists', progression: 'hp-progressions', layout: 'hp-layouts', instrument: 'hp-instruments' };
const SYNC_PREFS = ['ringRotated', 'useFlats', 'noteNames', 'useSolfege', 'autoplaySeconds', 'tempo', 'showFingers', 'showSizes', 'chordsAll', 'showLyrics', 'closeUp', 'ocLegendSeen', 'handLegendSeen', 'theme', 'lastPath', 'updatedAt'];

function syncReadList(key) {
  try { const v = JSON.parse(dataStore().getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function syncReadPrefs() {
  try { return JSON.parse(localStorage.getItem('hp-prefs') || '{}') || {}; } catch { return {}; }
}

const syncLocal = {
  items() {
    const m = new Map();
    for (const [kind, key] of Object.entries(SYNC_LISTS)) {
      for (const data of syncReadList(key)) {
        if (!data?.id || (kind === 'instrument' && usesLayout(data))) continue;
        m.set(syncKey(kind, data.id), { kind, id: data.id, data });
      }
    }
    const p = syncReadPrefs();
    if (p.updatedAt) {
      const data = { id: 'prefs' };
      for (const f of SYNC_PREFS) if (p[f] !== undefined) data[f] = p[f];
      m.set(syncKey('prefs', 'prefs'), { kind: 'prefs', id: 'prefs', data });
    }
    return m;
  },
  write(kind, id, data) {
    if (kind === 'prefs') {
      const { id: _id, ...rest } = data;
      safeSetItem(localStorage, 'hp-prefs', JSON.stringify({ ...syncReadPrefs(), ...rest }));
      return;
    }
    const key = SYNC_LISTS[kind];
    if (!key) return;
    const list = syncReadList(key);
    const i = list.findIndex(x => x.id === id);
    if (i >= 0) list[i] = data; else list.push(data);
    safeSetItem(dataStore(), key, JSON.stringify(list));
  },
  add(kind, data) { this.write(kind, data.id, data); },
};

let _syncTimer = null;
const _syncRejectedTold = new Set();
let _syncRunning = false;
let _syncAgain = false;

function syncSoon(ms = 2000) {
  if (!accountOn()) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(syncNow, ms);
}

async function syncNow() {
  if (!accountOn()) return;
  if (!isLoggedIn()) { state.syncPending = await pendingCount(); return; }
  // Only ever with the account this device's things belong to.
  if (_syncHold || accountMatch(accountUserOnDevice(), getUserId()) === 'other') return;
  if (_syncRunning) { _syncAgain = true; return; }
  _syncRunning = true;
  const before = state.syncPending;
  try {
    const r = await syncRound({ local: syncLocal, bases: syncBases, api: syncApi, device: deviceKind() });
    state.syncPending = r.pending;
    state.syncError = null;
    state.lastSynced = Date.now();
    if (r.pulled || r.copies.length) {
      const prevTheme = state.theme;
      loadPrefs();
      if (state.theme !== prevTheme) applyTheme();
      reloadSaved();
      render();
    } else if (before !== r.pending) render();
    if (state.legacyImported && r.pulled) {
      showToast(`Brought over ${state.legacyImported} item${state.legacyImported !== 1 ? 's' : ''} from your earlier account`);
      state.legacyImported = 0;
    } else if (r.copies.length) showToast(`Changed on two devices, so both are kept: ${r.copies[0]}`);
    else if (before > 0 && r.pending === 0 && r.pushed) showToast('Synced');
    if (r.pushed) pushSharedInstruments();
    // An item over the server's size cap stays on this device: said once.
    const big = r.rejected.find(x => !_syncRejectedTold.has(`${x.kind}:${x.id}`));
    if (big) {
      _syncRejectedTold.add(`${big.kind}:${big.id}`);
      showToast(`${big.name ? `“${big.name}”` : 'One item'} is too large to sync, so it stays on this device only. A smaller photo usually fixes it.`);
    }
  } catch (err) {
    state.syncError = navigator.onLine === false ? 'offline' : 'error';
    state.syncPending = await pendingCount();
  } finally {
    _syncRunning = false;
    if (_syncAgain) { _syncAgain = false; syncSoon(500); }
  }
}

// Changes waiting for the server (Settings › Account, the Offline pill).
async function pendingCount() {
  try { return pendingChanges(syncLocal.items(), await syncBases.getAll()).length; } catch { return 0; }
}

// A shared code is read from the instruments table, so shared instruments
// are written there as well after they change (docs/free-to-play.md, data model).
let _sharedPushed = new Map();
function pushSharedInstruments() {
  const shared = getInstrumentsRaw().filter(i => i.publicId && _sharedPushed.get(i.id) !== i.updatedAt);
  if (!shared.length) return;
  saveCloudInstruments(shared).then(ok => { if (ok === true) shared.forEach(i => _sharedPushed.set(i.id, i.updatedAt)); });
}

for (const ev of ['hp-data-changed', 'hp-instruments-changed', 'hp-progressions-changed']) {
  window.addEventListener(ev, () => {
    if (!accountOn()) return;
    pendingCount().then(n => { if (n !== state.syncPending) { state.syncPending = n; if (state.view === 'settings') render(); else refreshStatusUi(); } });
    syncSoon();
  });
}

// A write to this device's storage failed (js/datastore.js safeSetItem):
// say so once, instead of a save that silently did nothing.
let _storageFullAt = 0;
window.addEventListener('hp-storage-full', () => {
  if (Date.now() - _storageFullAt < 5000) return;
  _storageFullAt = Date.now();
  logEvent('storage_full');
  // After the tap's own handler, so its "Saved" doesn't cover this.
  setTimeout(() => showToast('This device is out of space for saved things, so that wasn’t saved. Remove an instrument photo or something you no longer use, then try again.'), 0);
});

let _syncPoll = null;
function startSyncPoll() {
  if (_syncPoll) return;
  _syncPoll = setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 30000);
}
function stopSyncPoll() {
  if (_syncPoll) { clearInterval(_syncPoll); _syncPoll = null; }
}

// ── Offline (§4) ────────────────────────────────────────────────────────────
function enableOffline() {
  if (!accountOn()) return;
  offline.enable(BUILD_HASH).then(ok => { state.offlineReady = ok; if (state.view === 'settings') render(); });
}

// The Offline pill in the app bar, accounts only: quiet, never covering anything.
function offlinePillHtml() {
  if (!state.isOffline || !accountOn()) return '';
  const n = state.syncPending;
  return `<span class="offline-pill" role="status" title="${n ? `${n} change${n !== 1 ? 's' : ''} will sync when you're online` : 'Everything you saved works offline'}">${icon('cloud-off')}<span>Offline</span></span>`;
}

// A guest who loses the connection: a friendly card, once per drop.
function guestOfflineCardHtml() {
  if (!state.guestOfflineCard || accountOn()) return '';
  return `
    <div class="card offline-card" role="status">
      <div class="tip-title">You're offline</div>
      <div class="tip-body">You can keep playing here. To open the app offline any time, create a free account; it takes seconds.</div>
      <div class="set-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-action="offline-remind">Remind me when I'm back online</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="offline-card-ok">OK</button>
      </div>
    </div>`;
}

// The pill and card change without a full render (they don't move focus).
function refreshStatusUi() {
  const right = document.querySelector('.appbar-right');
  if (right) {
    right.querySelector('.offline-pill')?.remove();
    const pill = offlinePillHtml();
    if (pill) right.insertAdjacentHTML('afterbegin', pill);
  }
  document.querySelector('.offline-card')?.remove();
  const card = guestOfflineCardHtml();
  if (card) document.getElementById('app')?.insertAdjacentHTML('beforeend', card);
}

window.addEventListener('offline', () => {
  state.isOffline = true;
  if (!accountOn()) { state.guestOfflineCard = true; logEvent('guest_offline', { step: 'shown' }); }
  else if (!_offlineSessionLogged) { _offlineSessionLogged = true; logEvent('offline_session'); }
  refreshStatusUi();
});
window.addEventListener('online', () => {
  state.isOffline = false;
  state.guestOfflineCard = false;
  refreshStatusUi();
  if (state.remindSignup && !accountOn()) { state.remindSignup = false; openSaveSheet('offline'); }
  syncSoon(0);
});
let _offlineSessionLogged = false;
