import { brandLogo } from './brand.js';
import {
  SCALES, CHORD_TYPES, CHORD_CATEGORIES, createLayoutFromScale,
  getAllNotes, NOTE_NAMES, notePC, getNoteName, noteToMidi, displayNote, preferFlats,
} from './data.js';
import {
  getSavedLayouts, saveLayout, deleteLayout,
  getFavorites, isFavorite,
  getPlaylists, addPlaylist, renamePlaylist, deletePlaylist,
  addChordToPlaylist, removeChordFromPlaylist, reorderChordInPlaylist,
  isChordBookmarkedAnyVoicing, updatePlaylistChordVoicing, mergePlaylistsIntoProgressions,
  PROG_DEFAULTS, PROG_LIMITS, newProgressionStep, progressionStepMs, progressionTotals,
  nextProgressionStep, getProgressions, getProgressionsRaw, writeProgressionsRaw,
  addProgression, renameProgression, deleteProgression, setProgressionTiming, addStepToProgression,
  duplicateProgressionStep, moveProgressionStep, removeProgressionStep, setProgressionStepBars,
  progressionStepBeats, progressionLevel, setProgressionLevel, fillProgression,
} from './storage.js';
import {
  parseChordSheet, matchSheetChord, rankTranspositions, sheetCoverage, coverageBand, transposeChordSymbol,
  stepLength, stackVoicing, strikePattern, strikeNumbers, PLAY_LEVELS, WIND_PLAY_LEVELS, windPlayLevel, windPattern,
} from './chordsheet.js';
import { findAllChords, getRelatedChords, identifyChord, mainChordsInKey } from './chords.js';
import { instrumentKey, goesWellWith } from './harmony.js';
import { songFit, songsInOrder, songLoopTap, songInLoop, songNextIndex, songWaitTarget, songWaitHeard, songCoverage, SONGS, SONG_ORIGINS, SONG_LICENCE, songNotes, playableSongs, songKeyOn, songsThatGoTogether, christmasSongs, christmasSeason, songsForFilter, SONG_COLLECTION_ORIGINS, songBars, songHands, songTimeLabel, songLyrics } from './songs.js';
import { icon } from './icons.js';
import { initAudio, playNote, playChord, playScale, playSequence, playClick, setPlaybackTempo, ensureAudioOutput, setVoice, onFirstSound } from './audio.js';
import { kalimbaNumbers } from './kalimbas.js';
import { renderPan, panPlaces, PAN_SVG_ID, updatePanHighlight, updatePanShellMode, updatePanPlaying, settlePanPlace } from './pan.js';
import { noteWindows, chambersNeeded, scaleToMidis } from './ocarina.js';
import {
  renderFingering, renderHandLegend, fingeringMoves, playableMidis, fingeringFor,
  ocarinaToLayout, arpeggioOrder, fitChordToInstrument, nextVoicing,
} from './ocarina-ui.js';
import { playablePairs, centsBetween, midiToHz, hzToMidi, pitchLabel, parsePitch, predictFingeringHz } from './ocarina.js';
import { startTuner, yinPitch, openMic, drawMicWave, recordMic, micTakes, clearMicTakes, micRecordingSupported } from './tuner.js';
import {
  listenTracker, listenOverallConfidence, listenChordOnNotes, LISTEN_DEFAULTS,
} from './listen-detect.js';
import { startListening } from './listen-audio.js';
import { rankScalesByNotes, addHeardNote, heardNoteName } from './scalefinder.js';
import { setupRoots, setupScalesFor, setupTopScales, setupFirstChord, setupHeardEnough, setupKeyNote, chartSetupTunings, preferCommonChart, tuningOffsetCents, noteOnTuning, a4ForOffset, collectHeardNote, setupMatch, scaleFits } from './setup.js';
import {
  STAGE_ORDER, STAGE_TITLES, buildShrink, chamberBuild, stageTargets, noteAdvice,
  leatherHolePlan, bodyPlan, nextStage, finishBuild, updateClayBody,
  defaultCustomHoles, calibrateChamber, withHoleCount, holeSpot, usesHoleMap, withFixedFingerings, reverseHandFingers, holeDisplayOrder, holeLabel, cropRect, duplicateFingers, withSubLayout, SUB_LAYOUTS, fluteHoles, fluteStepStates, fluteChamberFromReadings,
} from './builder.js';
import { buildScaleChambers, OC_FINGER_ORDER, applyHoleSizes } from './ocarina.js';
import { chartsForFamily, getChart, instrumentFromChart, chartDefaultKey, chartKeyFor, detectChartKey, detectLowestKey, CHART_ROOTS } from './charts.js';
import { parseLink, linkFor, linkSlug, linkTitle, linkPreview, APP_NAME, layoutFromCustomParams, panPosToParam } from './links.js';
import { TONGUE_DRUMS, isTongueDrumId } from './tonguedrums.js';
import { LAYOUT_FAMILIES, findTuning, layoutInstrument, isLayoutFamily, layoutFamilyInfo, safeLayout } from './layoutfamilies.js';
import {
  INSTRUMENT_FAMILIES, isTubeFamily, windWord, getInstruments, getInstrument, saveInstrument, deleteInstrument,
  touchInstrument, syncHandpanInstruments, isOnboarded, setOnboarded, handpanInstrumentId, usesLayout,
  createScaleOcarina, createCustomOcarina, createCustomFlute, instrumentStatus, midiToNoteName,
  getClayBodies, saveClayBodies, getInstrumentsRaw, writeInstrumentsRaw,
  newPublicId, copySharedInstrument,
} from './instruments.js';
import { dataStore, DATA_KEYS, hasAccountOnDevice, carryOverVisit, clearAccountData, visitHasWork, safeSetItem, accountUserOnDevice, setAccountUserOnDevice, accountMatch } from './datastore.js';
import { syncRound, syncKey, pendingChanges } from './sync.js';
import {
  initSupabase, isLoggedIn, getUserEmail, sendOtp, verifyOtp, signOut, scheduleSave, logEvent,
  getAuthProviders, signInWithProvider, deviceKind, syncApi, touchLastSeen, importLegacyData, fetchAccountCounts, exportAccountRows,
  deleteMyAccount, saveCloudInstruments, fetchSharedInstrument, fetchAccess, getUserId, hasStoredSession,
} from './auth.js';
import { syncBases } from './localdb.js';
import { offline } from './offline.js';
import { saveIntentFor, saveText, keepPendingSave, takePendingSave, dropPendingSave, plainDataset, alsoSavedText } from './store.js';

// ── Accounts: save, sync and offline (docs/free-to-play.md) ─────────────────
// A guest plays everything and keeps nothing between visits (js/datastore.js
// puts their work in this tab only). Saving opens the save sheet; signing in
// moves this visit's work into the account, completes the started save,
// syncs item by item (js/sync.js) and turns offline on (js/offline.js).

const BUILD_HASH = 'dev'; // build.py writes the build's hash: the offline cache version
const PRIVACY_URL = '/privacy'; // the website's, on the same domain (vercel.json sends the app's own address there)
const FEEDBACK_URL = '/request?kind=feedback'; // the website's request form, opened on "Feedback"
const PRIVACY_VERSION = '2026-11';

function accountOn() { return hasAccountOnDevice(); }

// Building ocarinas (the "I'm making one" path, the Build tab, clay bodies)
// is for chosen accounts only: profiles.can_build, ticked by the owner in
// Supabase. Kept on the device so it works offline; cleared at sign-out.
function canBuild() {
  try { return accountOn() && localStorage.getItem('hp-can-build') === '1'; } catch { return false; }
}
function refreshAccess() {
  fetchAccess().then(a => {
    if (!a || !accountOn()) return; // offline or not set up: keep what we knew
    const before = canBuild();
    if (a.canBuild) safeSetItem(localStorage, 'hp-can-build', '1'); else localStorage.removeItem('hp-can-build');
    if (canBuild() !== before) render();
  });
}

// Every saved list read again (after a sync, a carry-over or a sign-out).
function reloadSaved() {
  state.savedLayouts = getSavedLayouts();
  // A playlist that came in from sync (another device, an older version of
  // the app) moves into the one kind of list too.
  mergePlaylistsIntoProgressions();
  state.playlists = getPlaylists();
  state.favorites = getFavorites();
  state.progressions = getProgressions();
  refreshInstruments();
}

// ── The save sheet (§3, §6) ─────────────────────────────────────────────────
// state.saveSheet = { what, step: 'start' | 'code', email, error, busy, providers }

// A guest's save: keep what they started (it survives the Google redirect
// in this tab) and show the sheet. Returns true when it went ahead.
function guestSave(intent) {
  if (accountOn()) return true;
  logEvent('save_tap', { what: intent.what, account: 'guest' });
  keepPendingSave({ ...intent, path: location.pathname + location.search + location.hash });
  openSaveSheet(intent.what);
  return false;
}

function openSaveSheet(what) {
  state.saveSheet = { what, step: 'start', email: state.authEmail || '', error: '', busy: false, providers: null };
  logEvent('signup_shown', { what });
  getAuthProviders().then(p => { if (state.saveSheet) { state.saveSheet.providers = p; render(); } });
  render();
}

// The playlist picker for a guest becomes the save sheet; after sign-in the
// chord goes into Favourites. Called at the start of render().
function guestPickerToSave() {
  if (accountOn() || !state.pickerChordFavId || !state.pickerChordObj || state.saveSheet) return;
  const entry = playlistEntryFor(state.pickerChordObj, state.pickerChordFavId);
  Object.assign(state, { pickerChordFavId: null, pickerChordObj: null, pickerNewPlaylist: false, pickerNewProgression: false });
  guestSave({ what: 'chord', entry });
}

function saveSheetHtml() {
  const s = state.saveSheet;
  const t = saveText(s.what);
  const p = s.providers ?? {};
  const legal = `<p class="save-legal">Free. We only keep your email and what you save. <a href="${PRIVACY_URL}" target="_blank" rel="noopener">Privacy notice</a></p>`;
  let body;
  if (s.step === 'code') {
    body = `
      <p class="sheet-text">We sent a code to <strong>${escHtml(s.email)}</strong>. Type it here, or open the link in the same email.</p>
      ${uiField({
        label: 'Code from the email', id: 'save-code-input', error: s.error,
        control: `<input class="input" id="save-code-input" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="8"
          placeholder="6–8 digits" value="${escHtml(state.authCode)}" autocomplete="one-time-code">`,
      })}
      <button type="button" class="btn btn-primary btn-block" data-action="save-verify"${s.busy ? ' disabled' : ''}>${s.busy ? 'Checking…' : 'Continue'}</button>
      <button type="button" class="btn btn-ghost btn-block" data-action="save-other-email">Use another email</button>`;
  } else {
    const providers = [
      p.google ? `<button type="button" class="btn btn-secondary btn-block" data-action="save-provider" data-provider="google">Continue with Google</button>` : '',
      p.apple ? `<button type="button" class="btn btn-secondary btn-block" data-action="save-provider" data-provider="apple">Continue with Apple</button>` : '',
    ].join('');
    body = `
      <p class="sheet-text save-line">${escHtml(t.line)}</p>
      <p class="save-free">Free · takes seconds · also lets you play offline</p>
      ${providers}
      ${providers ? '<div class="save-or" role="separator"><span>or</span></div>' : ''}
      ${uiField({
        label: 'Email', id: 'save-email-input', error: s.error,
        control: `<input class="input" id="save-email-input" type="email" autocomplete="email" placeholder="you@example.com" value="${escHtml(s.email)}">`,
      })}
      <button type="button" class="btn btn-primary btn-block" data-action="save-send-code"${s.busy ? ' disabled' : ''}>${s.busy ? 'Sending…' : 'Send code'}</button>
      ${legal}`;
  }
  return uiSheet({
    key: 'save', title: t.title, close: 'save-not-now', body,
    footer: `<button type="button" class="btn btn-ghost" data-action="save-not-now">Not now</button>`,
  });
}

// The sheet's buttons. Returns true when it handled the action.
function saveSheetAction(action, el) {
  const s = state.saveSheet;
  if (action === 'open-sign-in' || action === 'account-sign-in-again') { openSaveSheet('signin'); return true; }
  if (!s) return false;
  if (action === 'save-not-now') {
    // Nothing is lost: the screen stays as it was.
    state.saveSheet = null;
    state.authCode = '';
    dropPendingSave();
    render();
    return true;
  }
  if (action === 'save-send-code') {
    const email = (document.getElementById('save-email-input')?.value || s.email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { s.error = 'Type your email address'; render(); return true; }
    Object.assign(s, { email, error: '', busy: true });
    state.authEmail = email;
    logEvent('signup_method', { what: s.what, method: 'email' });
    render();
    sendOtp(email).then(err => {
      if (state.saveSheet !== s) return;
      s.busy = false;
      if (err) { s.error = navigator.onLine === false ? 'You\'re offline. Try again when you\'re connected.' : err; render(); return; }
      s.step = 'code';
      state.authCode = '';
      render();
    });
    return true;
  }
  if (action === 'save-verify') {
    const code = (document.getElementById('save-code-input')?.value || state.authCode).replace(/\D/g, '');
    if (code.length < 6) { s.error = 'Type the code from the email'; render(); return true; }
    Object.assign(s, { error: '', busy: true });
    _signInMethod = 'email';
    render();
    verifyOtp(s.email, code).then(err => {
      if (state.saveSheet !== s) return;
      s.busy = false;
      if (err) { s.error = 'That code didn\'t work. Check it, or send a new one.'; render(); }
      // On success handleLogin() takes over.
    });
    return true;
  }
  if (action === 'save-other-email') { Object.assign(s, { step: 'start', error: '' }); render(); return true; }
  if (action === 'save-provider') {
    const provider = el.dataset.provider;
    logEvent('signup_method', { what: s.what, method: provider });
    try { sessionStorage.setItem('hp-signin-method', provider); } catch { /* fine */ }
    signInWithProvider(provider).then(err => { if (err) { s.error = err; render(); } });
    return true;
  }
  return false;
}

let _signInMethod = null;

// Completes the started save after sign-in: a chord into Favourites, or the
// tapped action once more (now with an account, so it goes through).
function completePendingSave(pending) {
  if (!pending) return false;
  if (pending.what === 'chord' && pending.entry) {
    const added = addChordToPlaylist('favorites', pending.entry);
    reloadSaved();
    scheduleSave();
    showToast(added === false ? 'Already in Favourites' : 'Saved to Favourites');
    return true;
  }
  if (!pending.action) return false;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.hidden = true;
  btn.dataset.action = pending.action;
  Object.assign(btn.dataset, pending.data || {});
  document.getElementById('app').appendChild(btn);
  btn.click();
  btn.remove();
  return true;
}

// ── Signing in ──────────────────────────────────────────────────────────────
// A guest who signs in (this tab, a magic link or back from Google): their
// visit moves into the account (§5), the started save completes, and the
// account starts syncing. An account that was already here just starts.
async function handleLogin(event, session) {
  if (!session) {
    // The session is gone and nobody pressed Sign out here (it expired or
    // was revoked): everything stays on the device, and Settings offers
    // "Sign in again". While a session is still stored it may come back by
    // itself (offline, a token refresh), so that is not "lost".
    const lost = accountOn() && !_signingOut && !hasStoredSession();
    // "No session" as the page loads changes nothing for a guest: no render
    // (it would empty a field someone has started typing in).
    if (event === 'INITIAL_SESSION' && lost === state.sessionLost) return;
    if (lost) state.sessionLost = true;
    render();
    return;
  }
  const wasLost = state.sessionLost;
  state.sessionLost = false;
  if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') { if (wasLost) render(); return; }
  const uid = session.user?.id ?? null;
  if (!accountOn()) becomeAccount(session);
  else {
    // An account is on this device already. Someone else signing in must
    // not see its things, or sync from where it left off.
    if (accountMatch(accountUserOnDevice(), uid) === 'other') {
      _syncHold = true;
      try { await switchAccountOnDevice(); } finally { _syncHold = false; }
    }
    if (state.saveSheet) { state.saveSheet = null; state.authCode = ''; dropPendingSave(); showToast('Signed in'); }
    render();
  }
  setAccountUserOnDevice(uid);
  startAccount();
  syncSoon(0);
  refreshAccess();
  makerRefresh(); // the maker role and profile (js/makers-ui.js)
}

// A different person signed in on a device that held someone else's
// account: the previous account's saved things, its sync bases and its
// last-pull mark go (as at sign-out), so the new account pulls everything
// of its own from the start and nothing of the old one is pushed into it.
async function switchAccountOnDevice() {
  clearTimeout(_syncTimer);
  for (const key of DATA_KEYS) { try { localStorage.removeItem(key); } catch { /* no storage */ } }
  try { localStorage.removeItem('hp-can-build'); } catch { /* no storage */ }
  await syncBases.clear();
  _sharedPushed = new Map();
  Object.assign(state, { syncPending: 0, lastSynced: null, syncError: null, accountCounts: null });
  reloadSaved();
  if (state.view !== 'settings') { goHome({ push: false }); navReplace('/'); }
}
let _signingOut = false; // Sign out or Delete account is running: the session ending is expected
let _syncHold = false;   // nothing syncs while the device changes hands

function becomeAccount(session) {
  const pending = takePendingSave();
  const what = state.saveSheet?.what ?? pending?.what ?? 'signin';
  let method = _signInMethod;
  try { method = method ?? sessionStorage.getItem('hp-signin-method') ?? 'link'; sessionStorage.removeItem('hp-signin-method'); } catch { method = method ?? 'link'; }
  state.saveSheet = null;
  state.authCode = '';
  const moved = carryOverVisit();
  reloadSaved();
  const fresh = Date.now() - Date.parse(session.user?.created_at || 0) < 10 * 60 * 1000;
  logEvent('signup_done', { what, method, account: fresh ? 'new' : 'returning' });
  const done = completePendingSave(pending);
  if (done) logEvent('save_completed', { what });
  else render();
  // Everything else built in this visit came along too.
  const names = (moved['hp-instruments'] || []).map(i => i.name)
    .concat((moved['hp-progressions'] || []).map(p => p.name));
  const also = alsoSavedText(names.filter(n => !(pending?.what === 'instrument' && n === currentInstrument()?.name)));
  if (also) setTimeout(() => showToast(also), done ? 3200 : 0);
  else if (!done) showToast('Signed in');
  touchLastSeen({ privacyVersion: PRIVACY_VERSION, source: measurePathOf(pending?.path ?? location.pathname), intent: what });
}

let _accountStarted = false;
function startAccount() {
  if (_accountStarted) return;
  _accountStarted = true;
  touchLastSeen().then(refreshAccess);
  // An account from the first app versions: its instruments, playlists and
  // progressions are brought over once, then arrive with the first sync.
  importLegacyData().then(n => {
    if (n > 0) state.legacyImported = n;
    syncSoon(0);
  });
  startSyncPoll();
  enableOffline();
  render();
}

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

// ── Settings › Account (§7, §8) ─────────────────────────────────────────────
// What the account holds on the server and what this device holds, side by
// side, so a difference between two devices can be seen (and told to us).
function refreshAccountCounts() {
  if (!accountOn() || !isLoggedIn()) return;
  fetchAccountCounts().then(c => { state.accountCounts = c ?? 'error'; if (state.view === 'settings') render(); });
}
// Playlists are kept as kind 'progression' (the old kind 'playlist' holds only
// the backups of lists moved over, mergePlaylistsIntoProgressions).
const COUNT_WORDS = [['layout', 'handpan/drum/kalimba', 'handpans, drums and kalimbas'], ['instrument', 'ocarina or flute', 'ocarinas and flutes'], ['progression', 'playlist', 'playlists']];
function countsText(c) {
  const parts = COUNT_WORDS.map(([k, one, many]) => c[k] ? `${c[k]} ${c[k] === 1 ? one : many}` : '').filter(Boolean);
  return parts.length ? parts.join(' · ') : 'nothing yet';
}
function deviceCounts() {
  const c = {};
  for (const { kind, data } of syncLocal.items().values()) if (kind !== 'prefs' && !data?.deletedAt) c[kind] = (c[kind] ?? 0) + 1;
  return c;
}

function accountSettingsHtml() {
  if (!accountOn()) {
    return `
      ${uiRow({ lead: 'user', title: 'Sign in', meta: 'Save your instruments, chords and songs, on every device and offline. Free.', action: 'open-sign-in', chevron: true })}
      ${uiRow({ lead: 'shield', title: 'Privacy notice', meta: 'What we keep and why', action: 'open-privacy', chevron: true })}`;
  }
  const n = state.syncPending;
  const status = state.isOffline
    ? (n ? `${n} change${n !== 1 ? 's' : ''} will sync when you're online` : 'Offline · everything is on this device')
    : state.sessionLost ? 'Signed out on this device · your things are still here'
    : !isLoggedIn() ? 'Connecting…'
    : state.syncError === 'error' ? 'Couldn’t sync just now · tap ⟳ to try again'
    : n ? `${n} change${n !== 1 ? 's' : ''} waiting to sync`
    : state.lastSynced ? 'Everything is synced' : 'Getting your things…';
  const lost = state.sessionLost && !isLoggedIn();
  return `
    ${lost
      ? uiRow({ lead: 'user', title: 'Sign in again', meta: escHtml(`${status}. Sign in to sync ${n ? `${n} change${n !== 1 ? 's' : ''}` : 'again'}; nothing is lost.`), action: 'account-sign-in-again', chevron: true })
      : uiRow({ lead: 'user', title: getUserEmail() ?? 'Your account', meta: escHtml(status), trail: isLoggedIn() ? uiIconBtn('refresh', 'Sync now', { action: 'account-sync' }) : '' })}
    ${lost ? '' : uiRow({ lead: 'cloud', title: 'In your account', meta: state.accountCounts === 'error' ? 'Couldn’t be read just now' : state.accountCounts ? escHtml(countsText(state.accountCounts)) : 'Checking…' })}
    ${uiRow({ lead: 'smartphone', title: 'On this device', meta: escHtml(countsText(deviceCounts())) })}
    ${uiRow({ lead: 'cloud-off', title: 'Offline', meta: state.offlineReady ? 'Ready: the app opens without a connection on this device' : 'Getting ready on this device…' })}
    ${uiRow({ lead: 'download', title: 'Export my data', meta: 'Everything in your account, as one file', action: 'account-export', chevron: true })}
    ${uiRow({ lead: 'shield', title: 'Privacy notice', meta: 'What we keep and why', action: 'open-privacy', chevron: true })}
    ${uiRow({ lead: 'log-out', title: 'Sign out', meta: 'This device forgets your things; your account keeps them', action: 'account-signout' })}
    ${uiRow({ lead: 'trash-2', title: 'Delete account', meta: 'Deletes your account and everything in it', action: 'account-delete', cls: 'is-danger' })}`;
}

// Sign out or delete: confirm first (state.accountConfirm = 'signout' | 'delete').
function accountConfirmSheet() {
  const kind = state.accountConfirm;
  if (kind === 'delete') {
    return uiSheet({
      key: 'account-delete', title: 'Delete your account?', close: 'account-confirm-cancel', variant: 'confirm',
      body: `
        <p class="sheet-text">Your instruments, playlists and settings are deleted from the server and this device. This can't be undone. Export your data first if you want a copy.</p>
        ${uiField({ label: 'Type DELETE to confirm', id: 'account-delete-input', error: state.accountError ?? '',
          control: '<input class="input" id="account-delete-input" autocomplete="off" autocapitalize="characters">' })}`,
      footer: `
        <button type="button" class="btn btn-ghost" data-action="account-confirm-cancel">Cancel</button>
        <button type="button" class="btn btn-danger" data-action="account-delete-ok">Delete account</button>`,
    });
  }
  const n = state.syncPending;
  return uiSheet({
    key: 'account-signout', title: 'Sign out?', close: 'account-confirm-cancel', variant: 'confirm',
    body: `<p class="sheet-text">${n
      ? `${n} change${n !== 1 ? 's haven\'t' : ' hasn\'t'} synced yet${state.isOffline ? ' (you\'re offline)' : ''}. If you sign out now, ${n !== 1 ? 'they\'re' : 'it\'s'} lost.`
      : 'Your things stay in your account. This device forgets them, and the app no longer opens offline here.'}</p>`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="account-confirm-cancel">${n ? 'Wait' : 'Cancel'}</button>
      <button type="button" class="btn ${n ? 'btn-danger' : 'btn-primary'}" data-action="account-signout-ok">${n ? 'Sign out anyway' : 'Sign out'}</button>`,
  });
}

// This device forgets the account: saved data, sync bases, the offline
// cache and the service worker (§4 "On sign-out", §8).
async function forgetAccountOnDevice() {
  stopSyncPoll();
  clearTimeout(_syncTimer);
  _accountStarted = false;
  clearAccountData();
  localStorage.removeItem('hp-can-build');
  makerKeepAccess(null);
  if (state.mk) state.mk.info = null;
  await syncBases.clear();
  await offline.disable();
  Object.assign(state, { syncPending: 0, lastSynced: null, offlineReady: false, accountConfirm: null, accountError: null, sessionLost: false, accountCounts: null });
  _signingOut = false;
  reloadSaved();
  goHome({ push: false });
  navReplace('/');
  render();
}

async function exportMyData() {
  if (!isLoggedIn() || state.isOffline) { showToast('Export needs a connection'); return; }
  await syncNow();
  const rows = await exportAccountRows();
  if (!rows) { showToast('Couldn\'t export right now. Try again in a moment.'); return; }
  const file = { exportedAt: new Date().toISOString(), app: APP_NAME, ...rows };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `oakhum-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast('Exported');
}

function accountAction(action) {
  if (action === 'open-privacy') { window.open(PRIVACY_URL, '_blank', 'noopener'); return true; }
  if (action === 'open-feedback') { window.open(FEEDBACK_URL, '_blank', 'noopener'); return true; }
  if (action === 'account-sync') {
    syncNow().then(() => {
      refreshAccountCounts();
      showToast(state.syncError === 'error' ? 'Couldn’t sync just now' : state.syncPending ? 'Some changes are still waiting' : 'Synced');
    });
    return true;
  }
  if (action === 'account-export') { exportMyData(); return true; }
  if (action === 'account-signout') {
    pendingCount().then(n => { state.syncPending = n; state.accountConfirm = 'signout'; render(); });
    return true;
  }
  if (action === 'account-delete') {
    if (!isLoggedIn() || state.isOffline) { showToast('Deleting your account needs a connection'); return true; }
    state.accountConfirm = 'delete'; state.accountError = null; render(); return true;
  }
  if (action === 'account-confirm-cancel') { state.accountConfirm = null; state.accountError = null; render(); return true; }
  if (action === 'account-signout-ok') {
    state.accountConfirm = null;
    _signingOut = true;
    signOut().then(forgetAccountOnDevice).then(() => showToast('Signed out'));
    return true;
  }
  if (action === 'account-delete-ok') {
    const typed = (document.getElementById('account-delete-input')?.value || '').trim().toUpperCase();
    if (typed !== 'DELETE') { state.accountError = 'Type DELETE'; render(); return true; }
    _signingOut = true;
    deleteMyAccount().then(err => {
      if (err) { _signingOut = false; state.accountError = `Couldn't delete it: ${err}`; render(); return; }
      forgetAccountOnDevice().then(() => showToast('Your account is deleted'));
    });
    return true;
  }
  if (action === 'offline-remind') { state.remindSignup = true; state.guestOfflineCard = false; logEvent('guest_offline', { step: 'remind' }); refreshStatusUi(); return true; }
  if (action === 'offline-card-ok') { state.guestOfflineCard = false; refreshStatusUi(); return true; }
  return false;
}

// ── Leaving unsaved work (§3) ───────────────────────────────────────────────
// A guest who built something and goes back to Home or Play sees the save
// sheet once; closing the tab gets the browser's own "Leave site?".
function guestLeaving() {
  if (accountOn() || state.leaveWarned || !visitHasWork()) return false;
  state.leaveWarned = true;
  logEvent('save_tap', { what: 'leave-unsaved', account: 'guest' });
  openSaveSheet('leave');
  return true;
}
window.addEventListener('beforeunload', e => {
  if (!accountOn() && visitHasWork()) { e.preventDefault(); e.returnValue = ''; }
});

// ── Bootstrap ────────────────────────────────────────────────────────────────
loadPrefs();
refreshInstruments();
state.isOffline = navigator.onLine === false;
// Guests never keep a service worker (§4): one left from the old version,
// or from a sign-out in another tab, is removed.
if (!accountOn()) offline.disable();
if (urlIsLink()) loadFromUrl();
else openStartView();
render();

// Pre-warm AudioContext on the very first user touch.
// Both pointerdown and touchstart are registered: iOS Chrome (WKWebView) requires
// a user-gesture-initiated ctx.resume(); touchstart is the historically reliable
// trigger on older iOS while pointerdown covers desktop and modern iOS.
// initAudio() is idempotent so firing both for the same touch is harmless.
initSupabase(handleLogin);
// An account works offline before (or without) its session coming back.
if (accountOn()) startAccount();
measureOpen();

// The Content-Security-Policy is report-only for now (vercel.json): what it
// would have blocked is counted here, by directive and host only, so the
// policy can be enforced once this stays quiet.
const _cspSeen = new Set();
document.addEventListener('securitypolicyviolation', e => {
  let host = e.blockedURI || '';
  try { host = new URL(host).host || host; } catch { /* 'inline', 'eval', 'data' */ }
  const key = `${e.effectiveDirective}|${host}`;
  if (_cspSeen.has(key) || _cspSeen.size >= 10) return;
  _cspSeen.add(key);
  logEvent('csp_violation', { directive: e.effectiveDirective, host: String(host).slice(0, 80), enforced: e.disposition === 'enforce' });
});

// Sync when the user brings the app back to the foreground (tab switch, PWA resume).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && state.tuner.on) toggleTuner();
  if (document.visibilityState === 'visible') syncSoon(0);
});

document.addEventListener('pointerdown', () => initAudio(), { once: true });
document.addEventListener('touchstart', () => initAudio(), { once: true, passive: true });

// Every tap first picks the sound for whatever it may play (capture phase,
// so it runs before the handlers below).
document.addEventListener('click', () => setVoice(voiceForState()), true);

// ── Global click delegation ───────────────────────────────────────────────────
document.addEventListener('click', e => {
  // ── Pan note click — must be checked BEFORE the data-action early return ──
  const noteEl = e.target.closest('.pan-note');
  // The guided setup: tapping a place says "this is the one I'm playing".
  if (noteEl && state.view === 'setup' && state.setup?.guide && noteEl.closest('.setup-guide-pan')) {
    const id = noteEl.dataset.noteId;
    const g = state.setup.guide;
    const i = id === 'ding' ? 0 : id?.startsWith('ring-') ? parseInt(id.slice(5), 10) + 1 : id?.startsWith('gu-') ? g.count + parseInt(id.slice(3), 10) : -1;
    if (i >= 0 && i < guideTotal(g)) {
      g.active = i;
      Object.assign(g, { msg: g.notes[i] != null ? `Play ${setupSlotLabel(state.setup.family, i)} again to change it.` : '', tone: '' });
      render();
    }
    return;
  }
  if (noteEl && edArranging() && noteEl.closest('.ed-pan')) return; // moving, not editing
  if (noteEl && state.layout) {
    const noteId = noteEl.dataset.noteId;
    const isEmpty = noteEl.classList.contains('empty');
    const isCustom = state.layout.isCustom;

    if (!isEmpty) {
      const noteToPlay = noteEl.dataset.note;
      if (noteToPlay) {
        initAudio();
        playNote(noteToPlay);
        setTimeout(() => updatePanPlaying([noteToPlay]), 0);
      }
    }

    if (state.view !== 'editor') return;
    if (!isCustom) return;

    if (isEmpty) {
      if (noteId === 'ding') state.pendingSlot = { shell: 'ding', index: -1 };
      else if (noteId?.startsWith('ring-')) state.pendingSlot = { shell: 'top', index: parseInt(noteId.split('-')[1]) };
      else if (noteId?.startsWith('gu-')) state.pendingSlot = { shell: 'bottom', index: parseInt(noteId.split('-')[1]) };
      render();
      return;
    }

    if (noteId === 'ding') { state.pendingSlot = { shell: 'ding', index: -1 }; render(); return; }
    if (noteId?.startsWith('ring-') && (state.shellMode === 'top' || state.shellMode === 'both')) {
      const idx = parseInt(noteId.split('-')[1]);
      state.layout.top.slots[idx].note = null;
      state.chords = findAllChords(state.layout);
      render();
      return;
    }
    if (noteId?.startsWith('gu-') && (state.shellMode === 'bottom' || state.shellMode === 'both')) {
      const idx = parseInt(noteId.split('-')[1]);
      if (state.layout.bottom.slots[idx]) { state.layout.bottom.slots[idx].note = null; state.chords = findAllChords(state.layout); render(); }
      return;
    }
    return;
  }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  measureFeature(action, el);
  // The save moment (§3): a guest's save opens the save sheet instead, and
  // the tap is completed after sign-in.
  const saveWhat = saveIntentFor(action, { guest: !accountOn() });
  if (saveWhat) { guestSave({ what: saveWhat, action, data: plainDataset(el.dataset) }); return; }
  if (el.matches('.tab[aria-selected="true"]')) return; // already on that tab
  if (!el.closest('.sheet-root')) _lastTrigger = focusKeyOf(el);
  // The actions each screen registers (js/app/actions.js). These come before
  // the steps below that close a sheet when one of its rows is tapped.
  if (runAction(action, el, e, EARLY_ACTIONS)) return;
  if (makerClick(action, el)) return; // makers and "Made by" (js/makers-ui.js)
  // A menu row closes the menu, then does what it says.
  if (state.menu && el.closest('.sheet-menu, .sheet-rowmenu')) { state.menu = false; render(); }
  if (state.hpMore && el.closest('.sheet-hpmore') && action !== 'hp-more-close') { state.hpMore = false; render(); }
  if (state.plRowMenu != null && el.closest('.sheet-plrow') && action !== 'pl-row-close') { state.plRowMenu = null; render(); }
  if (state.progRowMenu != null && el.closest('.sheet-progrow') && action !== 'prog-row-close') { state.progRowMenu = null; render(); }
  if (runAction(action, el, e)) return;
  // Screens that handle a group of actions in one function.
  if (songAction(action, el)) return;
  if (listenReportAction(action)) return;
  if (goesWithAction(action, el)) return;
  if (setupAction(action, el)) return;
  if (saveSheetAction(action, el)) return;
  if (accountAction(action)) return;
});

// ── Pan note clicks (Discover mode note-picking + voicing swap) ────────────────
// Pan circles are plain SVG, not [data-action] elements, so they get their own
// delegation rather than going through the action router above.
document.addEventListener('click', e => {
  const noteEl = e.target.closest('.pan-note');
  if (!noteEl || state.view !== 'chords') return;
  const note = noteEl.dataset.note;
  if (!note) return; // empty slot

  if (state.discoverMode) {
    const idx = state.discoverNotes.indexOf(note);
    if (idx >= 0) state.discoverNotes.splice(idx, 1);
    else state.discoverNotes.push(note);
    render();
    initAudio();
    playNote(note);
    return;
  }

  if (noteEl.classList.contains('alt-highlight') && state.selectedChord) {
    stopAutoplay();
    state.selectedChord = swapChordNoteVoicing(state.selectedChord, note);
    navReplace(stateToHash());
    render();
    initAudio();
    playNote(note);
  }
});

// ── Change delegation (selects) ───────────────────────────────────────────────
document.addEventListener('change', e => {
  if (makerChange(e.target)) return; // the maker profile form (js/makers-ui.js)
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action } = el.dataset;
  runAction(action, el, e, CHANGE_ACTIONS);
});

// ── Input delegation ──────────────────────────────────────────────────────────
document.addEventListener('input', e => {
  if (makerInput(e.target)) return; // the maker profile form (js/makers-ui.js)
  if (e.target.classList?.contains('tempo-slider')) { setTempo(e.target.value); return; }
  if (e.target.classList?.contains('ld-slider')) {
    const L = listenUi();
    const key = e.target.dataset.key;
    L.tune[key] = parseFloat(e.target.value);
    const v = document.getElementById(`ld-v-${key}`);
    if (v) v.textContent = e.target.value;
    _listenTrack = listenTracker(L.tune);   // the chroma side reads L.tune live
    return;
  }
  if (e.target.classList?.contains('crop-zoom') && state.photoCrop) {
    state.photoCrop.zoom = parseFloat(e.target.value) || 1;
    layoutCrop();
    return;
  }
  if (e.target.id === 'scale-search-input') {
    state.scaleSearch = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const input = document.getElementById('scale-search-input');
    if (input) { input.focus(); input.setSelectionRange(pos, pos); }
    return;
  }
  if (e.target.id === 'wizard-search-input' && state.wizard) {
    state.wizard.search = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const input = document.getElementById('wizard-search-input');
    if (input) { input.focus(); input.setSelectionRange(pos, pos); }
    return;
  }
  if (e.target.id === 'wizard-fl-name' && state.wizard) {
    state.wizard.fl.name = e.target.value;
    return;
  }
  if (e.target.id === 'wizard-oc-name' && state.wizard) {
    state.wizard.oc.name = e.target.value;
    return;
  }
  if (e.target.id === 'custom-name-input' && state.layout) {
    state.layout.name = e.target.value;
    const barName = document.querySelector('.appbar-switcher-name');
    if (barName) barName.textContent = e.target.value;
    const actions = document.querySelector('.ed-actions');
    if (actions) actions.innerHTML = edActionsHtml();
  }
  if (e.target.id === 'pl-name-input' && state.plName) { state.plName.value = e.target.value; return; }
  if (e.target.id === 'cs-text' && state.chordSheet) {
    state.chordSheet.text = e.target.value;
    if (state.chordSheet.error) { // the error goes once there's something new to read
      state.chordSheet.error = '';
      const field = e.target.closest('.field');
      field?.classList.remove('has-error');
      field?.querySelector('.field-error')?.remove();
    }
    return;
  }
  if (e.target.id === 'cs-name' && state.chordSheet) { state.chordSheet.name = e.target.value; return; }
  if (e.target.id === 'clay-name-input' && state.clayEdit) { state.clayEdit.name = e.target.value; return; }
  if (e.target.id === 'clay-pct-input' && state.clayEdit) { state.clayEdit.pct = e.target.value; return; }
  if (e.target.id === 'save-email-input' && state.saveSheet) {
    state.saveSheet.email = e.target.value;
    state.authEmail = e.target.value;
  }
  if (e.target.id === 'save-code-input') {
    state.authCode = e.target.value.replace(/\D/g, '').slice(0, 8);
    e.target.value = state.authCode;
    if (state.authCode.length === 8) {
      document.querySelector('[data-action="save-verify"]')?.click();
    }
  }
});

document.addEventListener('keydown', e => {
  // Rows that hold buttons of their own are divs with role=button: let the
  // keyboard activate them like real buttons.
  // A note of the pan, drum or kalimba picture (js/pan.js): Enter or Space
  // is a tap on it.
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.pan-note[role="button"]')) {
    e.preventDefault();
    e.target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role="button"][data-action]')) {
    e.preventDefault();
    e.target.click();
    return;
  }
  const enterAction = { 'save-email-input': 'save-send-code', 'save-code-input': 'save-verify', 'account-delete-input': 'account-delete-ok', 'clay-name-input': 'clay-save', 'clay-pct-input': 'clay-save', 'pl-name-input': 'pl-name-save', 'cs-name': 'cs-save' }[e.target.id];
  if (e.key === 'Enter' && enterAction) {
    e.preventDefault();
    document.querySelector(`[data-action="${enterAction}"]`)?.click();
    return;
  }
  if (e.key === 'Enter' && e.target.id === 'new-progression-input') {
    e.preventDefault();
    document.querySelector('[data-action="confirm-new-progression"]')?.click();
  }
  if (e.key === 'Enter' && e.target.id === 'new-playlist-input') {
    // preventDefault: focus moves back to the heart button as the sheet
    // closes, and Enter's default action would press it again.
    e.preventDefault();
    document.querySelector('[data-action="confirm-new-playlist"]')?.click();
  }
  const sheet = document.querySelector('.sheet-root .sheet');
  if (!sheet) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    sheet.querySelector('[data-sheet-close]')?.click();
    return;
  }
  if (e.key === 'Tab') {
    const items = [...sheet.querySelectorAll('button:not([disabled]), input, select, textarea, [tabindex="0"]')]
      .filter(x => x.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0], last = items[items.length - 1];
    if (!sheet.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// ── Browser back/forward ──────────────────────────────────────────────────────
window.addEventListener('popstate', () => {
  Object.assign(state, {
    view: 'home', layout: null, selectedChord: null,
    pendingSlot: null, chords: [], shellMode: 'both',
    chordFilter: { category: 'All', root: 'All', playlist: 'All' },
    currentInstrumentId: null, wizard: null, chordSheet: null,
  });
  refreshInstruments();
  if (urlIsLink()) loadFromUrl();
  else state.view = state.instruments.length ? 'home' : 'play';
  const hpTab = history.state?.hpTab;
  if ((hpTab === 'playlists' || hpTab === 'songs') && state.layout && (state.view === 'editor' || state.view === 'chords')) state.view = hpTab === 'songs' ? 'hp-songs' : 'hp-playlists';
  render();
});
