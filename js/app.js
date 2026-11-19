import { brandLogo } from './brand.js';
import {
  SCALES, CHORD_TYPES, CHORD_CATEGORIES, createLayoutFromScale,
  getAllNotes, NOTE_NAMES, notePC, getNoteName, noteToMidi, displayNote,
} from './data.js';
import {
  getSavedLayouts, saveLayout, deleteLayout,
  getFavorites, isFavorite,
  getPlaylists, addPlaylist, renamePlaylist, deletePlaylist,
  addChordToPlaylist, removeChordFromPlaylist, reorderChordInPlaylist,
  isChordBookmarkedAnyVoicing, updatePlaylistChordVoicing,
  PROG_DEFAULTS, PROG_LIMITS, newProgressionStep, progressionStepMs, progressionTotals,
  nextProgressionStep, getProgressions, getProgressionsRaw, writeProgressionsRaw,
  addProgression, renameProgression, deleteProgression, setProgressionTiming, addStepToProgression,
  duplicateProgressionStep, moveProgressionStep, removeProgressionStep, setProgressionStepBars,
  progressionStepBeats, progressionLevel, setProgressionLevel, fillProgression,
} from './storage.js';
import {
  parseChordSheet, matchSheetChord, rankTranspositions, sheetCoverage, coverageBand, transposeChordSymbol,
  stepLength, stackVoicing, strikePattern, strikeNumbers, PLAY_LEVELS,
} from './chordsheet.js';
import { findAllChords, getRelatedChords, identifyChord } from './chords.js';
import { icon } from './icons.js';
import { initAudio, playNote, playChord, playScale, playSequence, playClick, setPlaybackSpeed, ensureAudioOutput, setVoice, onFirstSound } from './audio.js';
import { renderPan, PAN_SVG_ID, updatePanHighlight, updatePanShellMode, updatePanPlaying } from './pan.js';
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
import { parseLink, linkFor, linkSlug, linkTitle, APP_NAME, layoutFromCustomParams } from './links.js';
import { TONGUE_DRUMS, isTongueDrumId } from './tonguedrums.js';
import { LAYOUT_FAMILIES, findTuning, layoutInstrument, isLayoutFamily, layoutFamilyInfo } from './layoutfamilies.js';
import {
  INSTRUMENT_FAMILIES, getInstruments, getInstrument, saveInstrument, deleteInstrument,
  touchInstrument, syncHandpanInstruments, isOnboarded, setOnboarded, handpanInstrumentId, usesLayout,
  createScaleOcarina, createCustomOcarina, createCustomFlute, instrumentStatus, midiToNoteName,
  getClayBodies, saveClayBodies, getInstrumentsRaw, writeInstrumentsRaw,
  newPublicId, copySharedInstrument,
} from './instruments.js';
import { dataStore, hasAccountOnDevice, carryOverVisit, clearAccountData, visitHasWork } from './datastore.js';
import { syncRound, syncKey, pendingChanges } from './sync.js';
import {
  initSupabase, isLoggedIn, getUserEmail, sendOtp, verifyOtp, signOut, scheduleSave, logEvent,
  getAuthProviders, signInWithProvider, deviceKind, syncApi, touchLastSeen, importLegacyData, fetchAccountCounts, exportAccountRows,
  deleteMyAccount, saveCloudInstruments, fetchSharedInstrument, fetchAccess,
} from './auth.js';
import { syncBases } from './localdb.js';
import { offline } from './offline.js';
import { saveIntentFor, saveText, keepPendingSave, takePendingSave, dropPendingSave, plainDataset, alsoSavedText } from './store.js';

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  view: 'selector',        // 'home' | 'wizard' | 'instrument' | 'selector' | 'editor' | 'chords' | 'playlist'
  instruments: [],         // My instruments (instruments.js), most recently played first
  currentInstrumentId: null, // instrument being played; null = browsing the catalogue
  wizard: null,            // add-instrument wizard state, see viewWizard()
  tuner: { on: false, reading: null, error: null, lastAdvance: 0 }, // microphone tuner
  rec: newRecState(),      // the armed record field, see uiHzField()
  theme: 'auto',           // 'dark' | 'light' | 'auto' (follows the OS; the default)
  clayEdit: null,          // { id, name, pct, error } while a clay body is edited
  shared: null,            // instrument opened from a share link (#p/<code>), read-only
  sharedStatus: null,      // 'loading' | 'missing' while a share link loads
  shareModal: null,        // { code, url, qr } while the share dialog is open
  installHelp: false,      // the "Add to home screen" steps sheet (no install prompt on this browser)
  menu: false,             // the instrument's ⋯ menu is open
  confirm: null,           // { kind: 'instrument' | 'playlist', id, title, body, ok } while confirming
  oc: newOcState(),        // ocarina / flute views, see newOcState()
  showFingers: false,      // finger labels (R4, L1…) inside ocarina holes
  showSizes: false,        // hole sizes in mm on ocarina diagrams
  ocLegendSeen: false,     // the hole-state legend line has been dismissed
  handLegendSeen: false,   // the finger legend has been shown once
  layout: null,            // current Layout object
  shellMode: 'both',       // 'top' | 'bottom' | 'both'
  ringRotated: false,      // false = standard; true = rotated half-slot
  noteCountFilter: 'all',     // 'all' | '9' | '10' | '11+'
  scaleSearch: '',            // filter text for scale selector
  selectedChord: null,        // ChordResult or null
  chords: [],                 // computed from layout
  chordFilter: { category: 'All', root: 'All', playlist: 'All' },
  useFlats: false,           // false = sharp (C#, F#, G#…); true = flat (Db, Gb, Ab…)
  useSolfege: false,         // false = letters (C, D, E…); true = solfège (Do, Re, Mi…)
  savedLayouts: getSavedLayouts(),
  favorites: getFavorites(),
  playlists: getPlaylists(),
  activePlaylistId: null,
  pickerChordFavId: null,
  pickerChordObj: null,
  pickerNewPlaylist: false,
  chordCountSet: new Set(), // empty = all; values: '2','3','4','5+'
  pendingSlot: null,       // { shell: 'top'|'bottom'|'ding', index: number }
  pickListen: null,        // the note picker's "Play it": { listening, startedTuner, startedAt, heardAt, error }
  authEmail: '',
  authCode: '',
  saveSheet: null,         // the save sheet (§3): { what, step, email, error, busy, providers }, see saveSheetHtml()
  accountConfirm: null,    // 'signout' | 'delete' while Settings › Account confirms
  accountError: null,
  accountCounts: null,     // Settings › Account: what the server holds, by kind (or 'error')
  legacyImported: 0,       // items brought over from the first app versions, for the toast
  syncPending: 0,          // changes waiting for the server
  lastSynced: null,
  syncError: null,
  offlineReady: false,     // the service worker is installed (accounts only)
  isOffline: false,
  guestOfflineCard: false, // "You're offline" card for a guest
  remindSignup: false,     // show the save sheet when the connection is back
  leaveWarned: false,      // the "leaving unsaved work" sheet was shown this visit
  autoplayOn: false,
  autoplayPlaylistId: null,
  autoplaySeconds: 4,
  playbackSpeed: 'normal',   // arpeggios, scales and sequences: 'slow' | 'normal' | 'fast'
  discoverMode: false,
  hpListen: false,         // handpan Chords: the Listen segment (Browse / Identify / Listen)
  listenUi: null,          // the Listen session, see newListenUi()
  discoverNotes: [],       // ordered note-with-octave strings clicked on the pan
  sourcePlaylistId: null,  // playlist the current chord was opened from, if any
  sourceEntryId: null,     // that entry's id at load time — lets "update" find it after a swap
  hpFilters: false,        // the handpan Chords Filters sheet is open
  hpMore: false,           // the selected chord's More sheet is open (phones)
  pickerInstrumentId: null, // instrument of the ocarina card whose ♡ opened the picker
  plMode: 'chords',        // playlist detail: 'chords' (cards) | 'order' (reorder rows)
  plRowMenu: null,         // index of the playlist entry whose ⋯ menu is open
  instEdit: null,          // id of the instrument in the Edit instrument sheet
  photoCrop: null,
  recLast: null,           // { path, label, text, at }: the set-up reading just recorded, for the guide         // { id, src, iw, ih, ratio, zoom, cx, cy } while fitting a new photo
  plName: null,            // { mode: 'new' | 'rename' | 'prog-new' | 'prog-rename', id, value, error } while naming a playlist or progression
  progressions: getProgressions(), // chord progressions (storage.js): ordered steps, repeats allowed
  activeProgressionId: null, // progression detail (#prog/<id>)
  progMode: 'steps',       // progression detail: 'steps' | 'order' (reorder rows)
  progRowMenu: null,       // index of the step whose ⋯ menu is open
  progPlay: null,          // { id, idx, beat } while a progression plays on the handpan
  pickerMode: 'playlist',  // the ♡ sheet adds to a 'playlist' or a 'progression'
  pickerNewProgression: false, // the ♡ sheet's "New progression" field is open
  chordSheet: null,        // the "Paste a chord sheet" sheet: { step: 'paste' | 'fit', text, target, semis, name, progId, error }
  listen: null,            // Listen (find a scale by ear): { where: 'selector' | 'wizard', listening, notes: [midi], lastSince, startedTuner, error, stopped }
};

// ── Render ───────────────────────────────────────────────────────────────────
let _lastScreen = null;
// The height the page really has. Some Android browsers (Vivaldi, Samsung
// Internet) with the address bar at the bottom report a 100dvh that isn't
// what's on screen, and the two-column Chords screen, sized from it, scrolled
// or left a gap. --app-h is the visible height, kept up to date as the
// browser's bars come and go; the CSS falls back to 100dvh without it.
function trackAppHeight() {
  const set = () => {
    const h = Math.round(window.visualViewport?.height ?? window.innerHeight);
    if (h > 0) document.documentElement.style.setProperty('--app-h', `${h}px`);
  };
  set();
  window.addEventListener('resize', set);
  window.visualViewport?.addEventListener('resize', set);
  window.addEventListener('orientationchange', () => setTimeout(set, 300));
}
trackAppHeight();

function render() {
  guestPickerToSave();
  const app = document.getElementById('app');
  const screen = [state.view, state.wizard?.step, state.wizard?.oc?.path, state.view === 'instrument' ? state.oc.tab : '', state.currentInstrumentId].join('|');
  if (screen !== _lastScreen && !_toastFresh) hideToast();
  _lastScreen = screen;
  const prevSheet = app.querySelector('.sheet-root')?.dataset.sheet ?? null;
  const focusKey = focusKeyOf(document.activeElement);
  let html = '';
  if (state.view === 'home' && homeIsEmpty()) { state.view = 'setup'; state.setup ??= newSetup(); }
  if (state.view === 'home') html = viewHome();
  else if (state.view === 'setup') html = viewBeginnerSetup();
  else if (state.view === 'play') html = viewPlay();
  else if (state.view === 'wizard') html = viewWizard();
  else if (state.view === 'instrument') html = viewInstrument();
  else if (state.view === 'selector') html = viewSelector();
  else if (state.view === 'editor') html = viewEditor();
  else if (state.view === 'chords') html = viewChords();
  else if (state.view === 'hp-playlists') html = viewHandpanPlaylists();
  else if (state.view === 'playlist') html = viewPlaylist();
  else if (state.view === 'progression') html = viewProgression();
  else if (state.view === 'settings') html = viewSettings();
  else if (state.view === 'clay') html = viewClayBodies();
  else if (state.view === 'listen-debug') html = viewListenDebug();
  // Everything after the app bar goes into <main>, the page's content column.
  // The tab title names the instrument on screen (preview cards: middleware.js).
  const titled = state.layout?.name ?? (state.view === 'instrument' ? currentInstrument()?.name : null);
  document.title = titled ? `${titled} · ${APP_NAME}` : APP_NAME;
  const cut = html.indexOf('<!--appbar-end-->');
  app.innerHTML = cut < 0 ? `<main class="main">${html}</main>`
    : `${html.slice(0, cut)}<main class="main">${html.slice(cut)}</main>`;
  if (state.view === 'setup' && state.setup?.guide && !state.setup.guide.order) setupGuideOrder();
  // One listening bar whenever the microphone is on: the tuner, or Listen.
  if (state.tuner.on || listenUi().on) app.insertAdjacentHTML('beforeend', tunerStripHtml());
  ensureMicWave();
  const guide = recGuideHtml();
  if (guide) app.insertAdjacentHTML('beforeend', guide);
  document.body.classList.toggle('rec-guide-on', !!guide);
  app.insertAdjacentHTML('beforeend', sheetHtml());
  const offlineCard = guestOfflineCardHtml();
  if (offlineCard) app.insertAdjacentHTML('beforeend', offlineCard);
  rememberLastPath();
  document.body.classList.toggle('has-tabbar', !!app.querySelector('.tabbar'));
  document.body.classList.toggle('tuner-on', state.tuner.on || listenUi().on);
  document.body.classList.toggle('has-actionbar', !!app.querySelector('.actionbar'));
  // A record field stays armed only while it is on screen.
  if (state.rec.armed && !app.querySelector('.rec-field.is-armed')) disarmRecord();
  // So does a wizard key detection.
  // Listen stops when its screen goes; the wizard's notes go with it, and
  // Try a scale's when the user is back on Home.
  if (state.listen && listenScreen() !== state.listen.where) {
    const L = state.listen;
    if (state.view === 'home' || L.where === 'wizard' || state.view === 'wizard') state.listen = null;
    if (L.listening) {
      clearTimeout(_listenTimer);
      L.listening = false;
      if (L.startedTuner && state.tuner.on && !state.tuner.error) { L.startedTuner = false; toggleTuner(); return; }
    }
  }
  const det = _chartDetecting;
  if (det?.t.detect?.listening && (wizardChartTarget(det.fam) !== det.t || !chartDetectOnScreen(det.fam))) {
    stopFluteDetect(null, det.fam);
    return;
  }
  watchChordsStage(app);
  if (state.listenUi?.on && !listenScreenOn()) listenStop();
  if (state.photoCrop) { const img = app.querySelector('.crop-img'); if (img?.complete) layoutCrop(); else img?.addEventListener('load', layoutCrop, { once: true }); }
  settleFocus(app, prevSheet, focusKey);
}

// Chords on a phone: the list's head (filters) sticks right under the
// sticky stage, so it needs the stage's height, which depends on the
// instrument picture and the chord card. Kept in --chords-stage-h.
let _stageObserver = null;
function watchChordsStage(app) {
  _stageObserver?.disconnect();
  const stage = app.querySelector('.hp-chords > .hp-stage');
  if (!stage || typeof ResizeObserver === 'undefined') return;
  const screen = stage.parentElement;
  _stageObserver = new ResizeObserver(() => screen.style.setProperty('--chords-stage-h', `${Math.ceil(stage.getBoundingClientRect().height)}px`));
  _stageObserver.observe(stage);
}

// ── Focus across re-renders ──────────────────────────────────────────────────
// Every render replaces the DOM, so focus is put back on the equivalent
// element afterwards. A sheet that opens takes focus; when it closes, focus
// returns to the control that opened it.
let _lastTrigger = null;     // focus key of the last clicked control
let _sheetReturnFocus = null;

function focusKeyOf(el) {
  if (!el || el === document.body || !el.closest?.('#app')) return null;
  if (el.id) return '#' + CSS.escape(el.id);
  if (!el.dataset?.action) return null;
  const scope = el.closest('.sheet') ? '.sheet ' : el.closest('.appbar') ? '.appbar ' : '.main ';
  return scope + Object.entries(el.dataset)
    .map(([k, v]) => `[data-${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${CSS.escape(v)}"]`).join('');
}

function focusByKey(key) {
  if (!key) return false;
  const el = document.querySelector(key);
  if (!el) return false;
  el.focus({ preventScroll: true });
  return true;
}

function settleFocus(app, prevSheet, focusKey) {
  const root = app.querySelector('.sheet-root');
  const sheet = root?.dataset.sheet ?? null;
  if (sheet && sheet !== prevSheet) {
    root.classList.add('is-entering');
    if (!prevSheet) _sheetReturnFocus = _lastTrigger;
    const first = ['.sheet-body [data-action]:not([disabled])', '.sheet-foot .btn-primary', '.sheet-body input', '.sheet-foot .btn']
      .map(sel => root.querySelector(sel)).find(Boolean);
    (first ?? root.querySelector('.sheet')).focus({ preventScroll: true });
    return;
  }
  if (!sheet && prevSheet) {
    focusByKey(_sheetReturnFocus);
    _sheetReturnFocus = null;
    return;
  }
  const active = document.activeElement;
  if (focusKey && (!active || active === document.body) && !/^#/.test(focusKey)) focusByKey(focusKey);
}

// ── Navigation ───────────────────────────────────────────────────────────────
// Entries the app pushes carry { hp: 1 }, so the app bar's back button knows
// it can step back through the browser history; without one (a deep link)
// it goes to the screen's logical parent instead.
// URLs are paths (deep links, docs/free-to-play.md) or '#…' screens, which
// always hang off the root so a deep-link path never sticks to them.
// One domain (docs/free-to-play.md): the website is at /, the app's home at
// /play, its deep links at the root (/handpan/…). '/' still opens the app on
// its own Vercel address, so both count as home.
const APP_HOME = '/play';
function isAppHome(path = location.pathname) { return path === '/' || path === APP_HOME || path === APP_HOME + '/'; }
function navUrl(url) { return !url || url === '/' ? APP_HOME : url[0] === '#' ? APP_HOME + url : url; }
function navPush(url) { history.pushState({ hp: 1 }, '', navUrl(url)); }
function navReplace(url, extra = {}) { history.replaceState({ ...(history.state ?? {}), ...extra }, '', navUrl(url)); }

function goHome({ push = true } = {}) {
  stopAutoplay();
  Object.assign(state, {
    view: 'home', layout: null, selectedChord: null, pendingSlot: null,
    sourcePlaylistId: null, sourceEntryId: null, currentInstrumentId: null,
    wizard: null, discoverMode: false, discoverNotes: [], shared: null, sharedStatus: null, shareModal: null,
    menu: false, confirm: null, pickerChordFavId: null, pickerChordObj: null, hpFilters: false, hpMore: false,
  });
  refreshInstruments();
  if (!push) return;
  navPush('/');
  render();
}

function goSelector() {
  stopAutoplay();
  state.view = 'selector';
  state.layout = null;
  state.selectedChord = null;
  state.pendingSlot = null;
  state.sourcePlaylistId = null;
  state.sourceEntryId = null;
  state.currentInstrumentId = null;
  navPush('#scales');
  render();
}

function openSettings({ push = true } = {}) {
  stopAutoplay();
  Object.assign(state, { view: 'settings', clayEdit: null, menu: false });
  refreshAccountCounts();
  state.oc.handLegend = false;
  if (push) navPush('#settings'); else navReplace('#settings');
  render();
}

// Removes an instrument once confirmed. A handpan instrument is its saved
// layout, so removing one removes both. Leaves the instrument if it is open.
function removeInstrument(id) {
  const inst = getInstrument(id);
  if (!inst) { render(); return; }
  if (usesLayout(inst)) {
    deleteLayout(inst.layoutId);
    state.savedLayouts = getSavedLayouts();
    scheduleSave();
  } else {
    deleteInstrument(inst.id);
  }
  refreshInstruments();
  if (state.currentInstrumentId === id) { goHome(); return; }
  render();
}

function removePlaylist(id) {
  if (id === 'favorites') { render(); return; }
  deletePlaylist(id);
  state.playlists = getPlaylists();
  if (state.view === 'playlist' && state.activePlaylistId === id) {
    state.view = 'home';
    state.activePlaylistId = null;
    navPush('/');
  }
  scheduleSave();
  render();
}

// App-bar buttons shared by many screens.
function tunerAppBtn() {
  return uiIconBtn('mic', state.tuner.on ? 'Stop the tuner' : 'Tuner', { action: 'tuner-toggle', pressed: state.tuner.on });
}
function settingsAppBtn() { return uiIconBtn('settings', 'Settings', { action: 'open-settings' }); }

// App bar of a deeper screen: back (history, else the logical parent) + title.
function backAppBar(title, { fallback = 'home', actions = [] } = {}) {
  return uiAppBar({ title, back: { action: 'nav-back', data: { fallback }, label: 'Back' }, actions });
}

// App bar of a handpan (Chords, Pan): the switcher shows its name. An unsaved
// one (from Try a scale) switches back to the catalogue and says it isn't saved.
function handpanAppBar(tabs = '') {
  const saved = !!state.currentInstrumentId;
  return uiAppBar({
    switcher: saved
      ? { name: state.layout.name, action: 'back-home', title: 'My instruments' }
      : { name: state.layout.name, action: 'open-play', data: { family: layoutInstrument(state.layout) }, title: layoutInstrument(state.layout) === 'handpan' ? 'Other scales' : 'Other tunings' },
    badge: saved ? '' : uiBadge('Not saved'),
    actions: [tunerAppBtn(), menuAppBtn()],
    tabs,
  });
}

// Settings (#settings): everything that is set once (docs/design-system.md
// §6.19). Every row writes an existing pref through savePrefs(), so it
// persists and syncs as before.
const AUTOPLAY_SECONDS = [3, 4, 5, 6, 8, 10];

function viewSettings() {
  const secIdx = AUTOPLAY_SECONDS.indexOf(state.autoplaySeconds);
  const clays = getClayBodies();
  return `${backAppBar('Settings')}
    <div class="settings">
      <h2 class="list-title">Display</h2>
      <div class="list">
        ${uiSetRow({ label: 'Theme', control: uiSeg([
          { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'auto', label: 'Auto' },
        ], state.theme, { action: 'set-theme', label: 'Theme' }) })}
        ${uiSetRow({ label: 'Note names', control: uiSeg([
          { value: 'sharps', label: 'C#' }, { value: 'flats', label: 'D♭' },
        ], state.useFlats ? 'flats' : 'sharps', { action: 'set-flats', label: 'Note names' }) })}
        ${uiSetRow({ label: 'Note style', control: uiSeg([
          { value: 'letters', label: 'C D E' }, { value: 'solfege', label: 'Do Re Mi' },
        ], state.useSolfege ? 'solfege' : 'letters', { action: 'set-solfege', label: 'Note style' }) })}
      </div>

      <h2 class="list-title">Sound</h2>
      <div class="list">
        ${uiSetRow({ label: 'Playback speed', help: 'How fast arpeggios, scales and note sequences play', control: uiSeg([
          { value: 'slow', label: 'Slow' }, { value: 'normal', label: 'Normal' }, { value: 'fast', label: 'Fast' },
        ], state.playbackSpeed, { action: 'set-speed', label: 'Playback speed' }) })}
      </div>

      <h2 class="list-title">Handpan</h2>
      <div class="list">
        ${uiSetRow({ label: 'Ring orientation', help: 'Rotated puts the two lowest notes towards you', control: uiSeg([
          { value: 'standard', label: 'Standard' }, { value: 'rotated', label: 'Rotated' },
        ], state.ringRotated ? 'rotated' : 'standard', { action: 'set-rotation', label: 'Ring orientation' }) })}
        ${uiSetRow({ label: 'Seconds per chord in autoplay', control: uiStepper({
          value: `${state.autoplaySeconds} s`, label: 'Seconds per chord', action: 'set-autoplay-step',
          min: secIdx === 0, max: secIdx === AUTOPLAY_SECONDS.length - 1,
        }) })}
      </div>

      <h2 class="list-title">Fingering diagrams</h2>
      <div class="list">
        ${uiSwitchRow({ label: 'Finger labels in holes', help: 'R4, L1, LT inside each hole', on: state.showFingers, action: 'oc-toggle-fingers' })}
        ${uiSwitchRow({ label: 'Hole sizes in mm', help: 'The builder always shows sizes', on: state.showSizes, action: 'oc-toggle-sizes' })}
        ${uiRow({ title: 'Which finger is which', action: 'oc-hand-open', chevron: true })}
        ${uiRow({ title: 'Show the diagram legend again', meta: 'The hole and finger legends show once more', action: 'reset-legends' })}
      </div>

      <h2 class="list-title">Listen</h2>
      <div class="list">
        ${uiRow({ title: 'Listen debug', meta: 'What the microphone hears: note strengths, chord guesses, confidence, thresholds', action: 'open-listen-debug', chevron: true })}
      </div>

      ${canBuild() ? `<h2 class="list-title">Tuning</h2>
      <div class="list">
        ${uiRow({ title: 'Clay bodies', meta: `${clays.length} clay bod${clays.length === 1 ? 'y' : 'ies'} · shrinkage used by the builder`, action: 'open-clay-bodies', chevron: true })}
      </div>
` : ''}
      <h2 class="list-title">Account</h2>
      <div class="list">${accountSettingsHtml()}</div>

      <h2 class="list-title">About</h2>
      <div class="list">
        <div class="brand-about">${brandLogo()}<span class="brand-about-line">Notes, chords and scales for handpan, tongue drum, kalimba, ocarina and flute.</span></div>
        ${uiRow({ title: 'Send feedback', meta: 'Something confusing, wrong or missing? Tell us, it really helps', action: 'open-feedback', lead: 'message-square', chevron: true })}
        ${uiRow({ title: 'Check for updates', meta: 'Reloads the latest app version and synced data', action: 'check-updates', lead: 'refresh' })}
      </div>
    </div>`;
}

// Settings › Clay bodies (#settings/clay): name and shrinkage of each clay
// body the builder offers. A row opens a sheet to edit it.
function viewClayBodies() {
  const clays = getClayBodies();
  return `${backAppBar('Clay bodies', { fallback: 'settings' })}
    <div class="settings">
      <p class="settings-intro">The builder lowers each hole's target by the clay's shrinkage, and learns it from every finished build.</p>
      <div class="list">
        ${clays.map(c => uiRow({
          lead: 'circle-dot', title: c.name, chevron: true, action: 'clay-edit', data: { id: c.id },
          meta: `${Number(c.shrinkPct).toFixed(1)}% shrinkage${c.builds ? ` · learned from ${c.builds} build${c.builds !== 1 ? 's' : ''}` : ''}`,
        })).join('')}
        ${uiRow({ lead: 'plus', title: 'Add a clay body', action: 'clay-edit', data: { id: '__new__' } })}
      </div>
    </div>`;
}

// The edit sheet of a clay body (state.clayEdit = { id, name, pct, error }).
function clayEditSheet() {
  const c = state.clayEdit;
  const isNew = c.id === '__new__';
  return uiSheet({
    key: 'clay', title: isNew ? 'Add a clay body' : 'Edit clay body', close: 'clay-cancel',
    body: `
      <div class="set-form is-sheet">
        ${uiField({ label: 'Name', id: 'clay-name-input', error: c.error === 'name' ? 'Give it a name' : '',
          control: `<input class="input" id="clay-name-input" value="${escHtml(c.name)}" placeholder="Stoneware, Earthenware…">` })}
        ${uiField({ label: 'Shrinkage, leather-hard to fired', id: 'clay-pct-input', error: c.error === 'pct' ? 'Between 0 and 30%' : '',
          help: 'From the clay\'s data sheet, or 11% if you don\'t know it',
          control: `<span class="input-unit"><input class="input" id="clay-pct-input" type="number" inputmode="decimal" step="0.1" min="0" max="30" value="${escHtml(c.pct)}"><span class="input-unit-label">%</span></span>` })}
      </div>`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="clay-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" data-action="clay-save">${isNew ? 'Add' : 'Save'}</button>`,
  });
}

// ── UI primitives ────────────────────────────────────────────────────────────
// Render helpers for the design-system components (docs/design-system.md §5).
// Like the views, they return HTML strings. `attrs` is pre-escaped markup.

// data-* attributes from a plain object, escaped.
function uiData(data = {}) {
  return Object.entries(data)
    .filter(([, v]) => v != null && v !== false)
    .map(([k, v]) => ` data-${k}="${escHtml(v)}"`).join('');
}

// Icon-only button: 44×44, always labelled.
function uiIconBtn(name, label, { action, data, pressed, cls = '', attrs = '', disabled = false } = {}) {
  return `<button type="button" class="icon-btn ${cls}"${action ? ` data-action="${action}"` : ''}${uiData(data)}
    aria-label="${escHtml(label)}" title="${escHtml(label)}"${pressed != null ? ` aria-pressed="${pressed ? 'true' : 'false'}"` : ''}
    ${disabled ? 'disabled' : ''} ${attrs}>${icon(name)}</button>`;
}

function uiBadge(text, variant = '') {
  return `<span class="badge ${variant ? 'badge-' + variant : ''}">${escHtml(text)}</span>`;
}

// The sticky app bar. Left slot: a back button and title, a plain title, or
// the instrument switcher. Middle: the tab bar (moved to the bottom on
// phones by CSS). Right: up to three icon buttons. The trailing comment
// lets render() put everything after the bar into <main>.
function uiAppBar({ title = '', back = null, switcher = null, badge = '', actions = [], tabs = '' } = {}) {
  let left;
  if (switcher) {
    left = `
      <button type="button" class="appbar-switcher" data-action="${switcher.action}"${uiData(switcher.data)}
        title="${escHtml(switcher.title ?? 'My instruments')}">
        <span class="appbar-switcher-name">${escHtml(switcher.name)}</span>${icon('chevron-down')}
      </button>${badge}`;
  } else {
    left = `
      ${back ? uiIconBtn(back.icon ?? 'chevron-left', back.label ?? 'Back', { action: back.action, data: back.data }) : ''}
      <h1 class="appbar-title${back ? '' : ' no-back'}">${escHtml(title)}</h1>${badge}`;
  }
  return `
    <header class="appbar">
      <div class="appbar-inner">
        <div class="appbar-left">${left}</div>
        <div class="appbar-mid">${tabs}</div>
        <div class="appbar-right">${offlinePillHtml()}${actions.join('')}</div>
      </div>
    </header><!--appbar-end-->`;
}

// Tabs of an instrument: [{ id, label, icon, action, data }], one selected.
// Rendered inside the app bar; fixed to the bottom of the screen <1024px.
function uiTabBar(tabs, current) {
  if (tabs.length < 2) return '';
  return `
    <nav class="tabbar" role="tablist" aria-label="Instrument views">
      ${tabs.map(t => `
        <button type="button" class="tab" role="tab" aria-selected="${t.id === current ? 'true' : 'false'}"
          data-action="${t.action}"${uiData(t.data)}>
          <span class="tab-inner">${icon(t.icon)}<span class="tab-label">${escHtml(t.label)}</span></span>
        </button>`).join('')}
    </nav>`;
}

// Bottom sheet (phone) / centred modal (≥600px). `close` is the action that
// closes it (scrim, close button and Esc all use it). variant: '' | 'menu' | 'confirm'.
function uiSheet({ key, title, body, footer = '', close, closeData, variant = '' }) {
  const id = `sheet-${key}`;
  return `
    <div class="sheet-root${variant ? ' sheet-' + variant : ''}" data-sheet="${escHtml(key)}">
      <div class="sheet-scrim" data-action="${close}"${uiData(closeData)}></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="${id}-title" tabindex="-1">
        <div class="sheet-handle" aria-hidden="true"></div>
        <div class="sheet-head">
          <h2 class="sheet-title" id="${id}-title">${escHtml(title)}</h2>
          ${uiIconBtn('x', 'Close', { action: close, data: closeData, attrs: 'data-sheet-close' })}
        </div>
        <div class="sheet-body">${body}</div>
        ${footer ? `<div class="sheet-foot">${footer}</div>` : ''}
      </div>
    </div>`;
}

// A list row. `lead` is an icon name (shown in a tile) or markup; `trail`
// markup; `chevron` adds the navigation chevron. With an action the row is a
// <button>, unless it holds buttons of its own (then a div with role=button).
function uiRow({ lead = '', title, meta = '', meta2 = '', trail = '', chevron = false, action = '', data, cls = '', titleHtml = false } = {}) {
  const leadHtml = !lead ? '' : /^[a-z0-9-]+$/.test(lead)
    ? `<span class="row-lead tile">${icon(lead)}</span>` : `<span class="row-lead">${lead}</span>`;
  const inner = `
    ${leadHtml}
    <span class="row-text">
      <span class="row-title">${titleHtml ? title : escHtml(title)}</span>
      ${meta ? `<span class="row-meta">${meta}</span>` : ''}
      ${meta2 ? `<span class="row-meta">${meta2}</span>` : ''}
    </span>
    <span class="row-trail">${trail}${chevron ? icon('chevron-right') : ''}</span>`;
  const classes = `row ${lead ? '' : 'no-lead'} ${cls}`;
  if (!action) return `<div class="${classes}">${inner}</div>`;
  if (/<button/.test(trail)) {
    return `<div class="${classes}" role="button" tabindex="0" data-action="${action}"${uiData(data)}>${inner}</div>`;
  }
  return `<button type="button" class="${classes}" data-action="${action}"${uiData(data)}>${inner}</button>`;
}

// Label + control + optional helper or error text.
function uiField({ label, control, help = '', error = '', id = '' }) {
  return `
    <div class="field ${error ? 'has-error' : ''}">
      ${label ? `<label class="field-label"${id ? ` for="${id}"` : ''}>${escHtml(label)}</label>` : ''}
      ${control}
      ${error ? `<div class="field-error">${escHtml(error)}</div>` : help ? `<div class="field-help">${help}</div>` : ''}
    </div>`;
}

// Segmented control: options [{ value, label }], one checked.
function uiSeg(options, value, { action, key = 'value', label = '' } = {}) {
  return `
    <div class="seg" role="radiogroup"${label ? ` aria-label="${escHtml(label)}"` : ''}>
      ${options.map(o => `
        <button type="button" class="seg-opt" role="radio" aria-checked="${o.value === value ? 'true' : 'false'}"
          data-action="${action}" data-${key}="${escHtml(o.value)}">${o.label}</button>`).join('')}
    </div>`;
}

// Empty state: icon, title, body and one optional button (markup).
function uiEmpty({ icon: ico = 'info', title, body = '', action = '' }) {
  return `
    <div class="empty">
      ${icon(ico)}
      <div class="empty-title">${escHtml(title)}</div>
      ${body ? `<div class="empty-body">${body}</div>` : ''}
      ${action}
    </div>`;
}

// A switch row: the whole row is the control (role=switch), the track is
// drawn at the right. `help` is a meta line under the label.
function uiSwitchRow({ label, help = '', on, action, data }) {
  return `
    <button type="button" class="row no-lead set-row" role="switch" aria-checked="${on ? 'true' : 'false'}"
      data-action="${action}"${uiData(data)}>
      <span class="row-text"><span class="row-title">${escHtml(label)}</span>${help ? `<span class="row-meta">${escHtml(help)}</span>` : ''}</span>
      <span class="switch${on ? ' is-on' : ''}" aria-hidden="true"></span>
    </button>`;
}

// A settings row with a control at the right (it drops below the label on
// narrow phones): a segmented control, a stepper or a field.
function uiSetRow({ label, help = '', control, wide = false }) {
  return `
    <div class="row no-lead set-row${wide ? ' is-wide' : ''}">
      <span class="row-text"><span class="row-title">${escHtml(label)}</span>${help ? `<span class="row-meta">${help}</span>` : ''}</span>
      <div class="set-control">${control}</div>
    </div>`;
}

// Number stepper [−] value [+]; the buttons carry data-delta -1 / 1.
function uiStepper({ value, label, action, data, min = false, max = false, help = '' }) {
  return `
    <div class="stepper-num">
      <div class="stepper-num-row" role="group" aria-label="${escHtml(label)}">
        ${uiIconBtn('minus', `Less (${label})`, { action, data: { ...data, delta: -1 }, cls: 'tonal', disabled: min })}
        <span class="stepper-num-val" aria-live="polite">${escHtml(value)}</span>
        ${uiIconBtn('plus', `More (${label})`, { action, data: { ...data, delta: 1 }, cls: 'tonal', disabled: max })}
      </div>
      ${help ? `<div class="stepper-num-help">${help}</div>` : ''}
    </div>`;
}

// Searchable picker: a field that looks like a select (.select, chevron,
// the chosen option's label) but opens a sheet with a search box and the
// options as rows, grouped under headers. For lists that can be long.
//   options: [{ value, label, group?, meta?, keywords? }]; groups: the group
//   names in order (default: order of first appearance; ungrouped first).
//   action + data: what choosing runs. A choice dispatches a change event
//   from an input carrying data-action=action and the data, with the chosen
//   value, so the change delegation below handles it exactly as it handled
//   the <select> this replaced.
// The sheet lives outside #app and filters in place as you type, so a
// render() never runs per keystroke.
const _pickerDefs = {};
let _pickerOpen = null; // { id, root, rows, active }

function uiPicker({ id, value, label, placeholder = 'Choose…', options, groups = null, action, data = {}, cls = '', hint = '' }) {
  _pickerDefs[id] = { id, value, label, options, groups, action, data };
  const cur = options.find(o => o.value === value);
  return `<button type="button" class="select picker-btn ${cls}" id="${escHtml(id)}" data-action="picker-open" data-picker="${escHtml(id)}"
    aria-haspopup="dialog" aria-label="${escHtml(label)}: ${escHtml(cur ? cur.label : placeholder)}"
    title="${escHtml(hint || (cur ? cur.label : label))}"><span class="picker-val${cur ? '' : ' is-placeholder'}">${escHtml(cur ? cur.label : placeholder)}</span></button>`;
}

// Options for the handpan scales, grouped by family in catalogue order.
// A scale is also found by its ding in any spelling and its note count.
function scalePickerOptions(lead = []) {
  return [...lead, ...SCALES.map(sc => {
    const n = 1 + sc.top.notes.length + sc.bottom.notes.length;
    return {
      value: sc.id, label: sc.name, group: sc.family, meta: `${n} notes`,
      keywords: [...noteSearchWords(sc.top.ding), ...noteSearchWords(sc.top.ding.replace(/\d+$/, ''))],
    };
  })];
}

function pickerSheetHtml(def) {
  const order = def.groups ?? [...new Set(def.options.map(o => o.group).filter(Boolean))];
  const rowHtml = (o, i) => {
    const on = o.value === def.value;
    return `<button type="button" class="row no-lead picker-row${on ? ' is-selected' : ''}" role="option" tabindex="-1"
      id="pick-opt-${i}" data-pick-index="${i}" data-value="${escHtml(o.value)}" aria-selected="${on ? 'true' : 'false'}">
      <span class="row-text"><span class="row-title">${escHtml(o.label)}</span>${o.meta ? `<span class="row-meta">${escHtml(o.meta)}</span>` : ''}</span>
      <span class="row-trail">${on ? icon('check') : ''}</span>
    </button>`;
  };
  const indexed = def.options.map((o, i) => [o, i]);
  const loose = indexed.filter(([o]) => !o.group || !order.includes(o.group));
  const sections = [];
  if (loose.length) sections.push(`<div class="picker-group" role="group" aria-label="${escHtml(def.label)}"><div class="list">${loose.map(([o, i]) => rowHtml(o, i)).join('')}</div></div>`);
  order.forEach((g, gi) => {
    const rows = indexed.filter(([o]) => o.group === g);
    if (!rows.length) return;
    sections.push(`<div class="picker-group" role="group" aria-labelledby="pick-g-${gi}">
      <div class="list-title picker-group-title" id="pick-g-${gi}">${escHtml(g)}</div>
      <div class="list">${rows.map(([o, i]) => rowHtml(o, i)).join('')}</div></div>`);
  });
  const tall = def.options.length > 8 ? ' is-tall' : '';
  return `
    <div class="sheet-root sheet-pick${tall} is-entering" data-sheet="pick">
      <div class="sheet-scrim" data-pick-close></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="pick-title" tabindex="-1">
        <div class="sheet-handle" aria-hidden="true"></div>
        <div class="sheet-head">
          <h2 class="sheet-title" id="pick-title">${escHtml(def.label)}</h2>
          ${uiIconBtn('x', 'Close', { attrs: 'data-pick-close' })}
        </div>
        <div class="picker-search">
          ${icon('search')}
          <input class="input" id="pick-search" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"
            placeholder="Search" aria-label="Search ${escHtml(def.label)}" role="combobox" aria-expanded="true"
            aria-controls="pick-list" aria-autocomplete="list">
        </div>
        <div class="sheet-body picker-body">
          <div id="pick-list" role="listbox" aria-label="${escHtml(def.label)}">${sections.join('')}</div>
          <div class="picker-empty" hidden>${uiEmpty({ icon: 'search', title: 'No matches', body: 'Try fewer letters, or another spelling.' })}</div>
        </div>
      </div>
    </div>`;
}

function openPicker(id) {
  const def = _pickerDefs[id];
  if (!def) return;
  closePicker(false);
  document.body.insertAdjacentHTML('beforeend', pickerSheetHtml(def));
  const root = document.body.lastElementChild;
  // Rows are in group order, which need not be the options' order.
  const rows = [...root.querySelectorAll('.picker-row')];
  const index = rows.map(r => pickIndex(def.options[parseInt(r.dataset.pickIndex, 10)]));
  _pickerOpen = { id, def, root, rows, index, active: -1 };
  const input = root.querySelector('#pick-search');
  const cur = rows.find(r => r.classList.contains('is-selected'));
  pickerSetActive(cur ? rows.indexOf(cur) : -1, 'center');
  // Fine pointers (mouse, trackpad) type straight away. On touch screens the
  // keyboard would cover half the list, so search waits for a tap.
  if (matchMedia('(pointer: fine)').matches) input.focus({ preventScroll: true });
  else root.querySelector('.sheet').focus({ preventScroll: true });
  root.addEventListener('keydown', pickerKeydown);
  root.addEventListener('click', pickerClick);
  input.addEventListener('input', pickerFilterRows);
  setTimeout(() => root.classList.remove('is-entering'), 400);
}

// Closes the picker; focus goes back to its field.
function closePicker(refocus = true) {
  const p = _pickerOpen;
  if (!p) return;
  _pickerOpen = null;
  p.root.remove();
  if (refocus) document.getElementById(p.id)?.focus({ preventScroll: true });
}

function pickerVisible() {
  return _pickerOpen ? _pickerOpen.rows.filter(r => !r.hidden) : [];
}

function pickerSetActive(i, block = 'nearest') {
  const p = _pickerOpen;
  p.rows.forEach(r => r.classList.remove('is-active'));
  p.active = i;
  const input = p.root.querySelector('#pick-search');
  const row = p.rows[i];
  if (!row) { input.removeAttribute('aria-activedescendant'); return; }
  row.classList.add('is-active');
  input.setAttribute('aria-activedescendant', row.id);
  // Keep the row clear of the sticky group header above it.
  const body = p.root.querySelector('.picker-body');
  const head = row.closest('.picker-group')?.querySelector('.picker-group-title');
  const hh = head ? head.offsetHeight : 0;
  const top = row.getBoundingClientRect().top - body.getBoundingClientRect().top;
  if (block === 'center') body.scrollTop += top - (body.clientHeight - row.offsetHeight) / 2;
  else if (top < hh) body.scrollTop += top - hh;
  else if (top + row.offsetHeight > body.clientHeight) body.scrollTop += top + row.offsetHeight - body.clientHeight;
}

function pickerFilterRows() {
  const p = _pickerOpen;
  if (!p) return;
  const q = p.root.querySelector('#pick-search').value;
  p.rows.forEach((r, i) => { r.hidden = !pickMatches(q, p.index[i]); });
  p.root.querySelectorAll('.picker-group').forEach(g => { g.hidden = !g.querySelector('.picker-row:not([hidden])'); });
  const vis = pickerVisible();
  p.root.querySelector('.picker-empty').hidden = vis.length > 0;
  p.root.querySelector('.picker-body').scrollTop = 0;
  // While searching, Enter picks the first match.
  pickerSetActive(vis.length ? p.rows.indexOf(vis[0]) : -1);
}

function pickerKeydown(e) {
  const p = _pickerOpen;
  if (!p) return;
  // The picker handles its own keys; the app's sheet keys (Esc closes the
  // sheet under it, Tab cycles) must not see them.
  e.stopPropagation();
  const input = p.root.querySelector('#pick-search');
  const vis = pickerVisible();
  const pos = vis.indexOf(p.rows[p.active]);
  if (e.key === 'Escape') { e.preventDefault(); closePicker(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!vis.length) return;
    const next = e.key === 'ArrowDown' ? Math.min(vis.length - 1, pos + 1) : Math.max(0, pos < 0 ? 0 : pos - 1);
    pickerSetActive(p.rows.indexOf(vis[next]));
    if (document.activeElement !== input) input.focus({ preventScroll: true });
    return;
  }
  if (e.key === 'Home' || e.key === 'End') {
    if (document.activeElement === input && input.value) return; // caret moves in the text
    e.preventDefault();
    if (vis.length) pickerSetActive(p.rows.indexOf(vis[e.key === 'Home' ? 0 : vis.length - 1]));
    return;
  }
  if (e.key === 'Enter') {
    if (e.target.closest?.('[data-pick-close]')) return;
    e.preventDefault();
    if (pos >= 0) pickerChoose(p.active);
    return;
  }
  if (e.key === 'Tab') {
    const items = [p.root.querySelector('.sheet-head [data-pick-close]'), input];
    e.preventDefault();
    const i = items.indexOf(document.activeElement);
    items[(i + (e.shiftKey ? items.length - 1 : 1)) % items.length].focus();
    return;
  }
  // Typing anywhere in the sheet goes to the search box.
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement !== input) input.focus();
}

function pickerClick(e) {
  if (e.target.closest('[data-pick-close]')) { closePicker(); return; }
  const row = e.target.closest('.picker-row');
  if (row) pickerChoose(_pickerOpen.rows.indexOf(row));
}

// Chooses an option: closes the sheet, puts focus back on the field and,
// if the value changed, runs the field's change action.
function pickerChoose(i) {
  const p = _pickerOpen;
  const opt = p?.rows[i] && p.def.options[parseInt(p.rows[i].dataset.pickIndex, 10)];
  if (!opt) return;
  closePicker();
  const btn = document.getElementById(p.id);
  if (opt.value === p.def.value) return;
  p.def.value = opt.value;
  if (btn) {
    const val = btn.querySelector('.picker-val');
    val.textContent = opt.label;
    val.classList.remove('is-placeholder');
    btn.title = opt.label;
    btn.setAttribute('aria-label', `${p.def.label}: ${opt.label}`);
  }
  const el = document.createElement('input');
  el.type = 'hidden';
  el.dataset.action = p.def.action;
  for (const [k, v] of Object.entries(p.def.data ?? {})) if (v != null) el.setAttribute(`data-${k}`, v);
  el.value = opt.value;
  (btn?.parentNode ?? document.body).appendChild(el);
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.remove();
  document.getElementById(p.id)?.focus({ preventScroll: true });
}

// Browser back closes the picker with the screen it was on.
window.addEventListener('popstate', () => closePicker(false));

// ── View 1: Scale Selector ───────────────────────────────────────────────────
// Scales matching a search and a note-count filter ('all' | '9' | '10' | '11+').
function filterScales(query, count, { inDesc = true } = {}) {
  const q = query.trim().toLowerCase();
  return SCALES.filter(s => {
    const total = 1 + s.top.notes.length + s.bottom.notes.length;
    if (count === '9' && total !== 9) return false;
    if (count === '10' && total !== 10) return false;
    if (count === '11+' && total < 11) return false;
    if (q && !s.name.toLowerCase().includes(q) && !s.family.toLowerCase().includes(q)
      && !(inDesc && s.desc.toLowerCase().includes(q))) return false;
    return true;
  });
}

// Search field and note-count chips, sticky under the app bar.
function scaleToolsHtml({ inputId, value, placeholder, count, action }) {
  return `
    <div class="scale-tools">
      <div class="search-field">
        ${icon('search')}
        <input class="input" id="${inputId}" type="search" placeholder="${escHtml(placeholder)}"
          value="${escHtml(value)}" aria-label="${escHtml(placeholder)}" autocomplete="off">
      </div>
      <div class="chips-scroll" role="group" aria-label="Number of notes">
        ${['all', '9', '10', '11+'].map(f => `
          <button type="button" class="chip" data-action="${action}" data-val="${f}" aria-pressed="${count === f ? 'true' : 'false'}">
            ${f === 'all' ? 'All' : f === '9' ? '9 notes' : f}</button>`).join('')}
      </div>
    </div>`;
}

// Scales grouped under their family (in SCALES order), one row each.
function scaleGroupsHtml(scales, rowHtml) {
  const groups = new Map();
  for (const sc of scales) {
    if (!groups.has(sc.family)) groups.set(sc.family, []);
    groups.get(sc.family).push(sc);
  }
  return [...groups].map(([family, list]) => `
    <h2 class="list-title">${escHtml(family)}</h2>
    <div class="list scale-list">${list.map(rowHtml).join('')}</div>`).join('');
}

function viewSelector() {
  const filtered = filterScales(state.scaleSearch, state.noteCountFilter);
  const uf = state.useFlats, us = state.useSolfege;
  return `
    ${uiAppBar({ title: 'Try a scale', back: { action: 'back-home', label: 'My instruments' }, actions: [tunerAppBtn()] })}
    <p class="screen-intro">Try any handpan scale without saving it. Save it from the Pan tab to add it to My instruments.</p>
    ${scaleToolsHtml({ inputId: 'scale-search-input', value: state.scaleSearch, placeholder: 'Search scales by name or family…', count: state.noteCountFilter, action: 'filter-notes' })}
    ${listenPanelHtml('selector')}
    ${listenHasNotes('selector') ? listenMatchesHtml(filtered, 'select-scale')
      : filtered.length === 0
      ? uiEmpty({ icon: 'search', title: 'No scales match your search', body: 'Try another name, or All.' })
      : scaleGroupsHtml(filtered, s => uiRow({
        title: s.name, chevron: true, action: 'select-scale', data: { id: s.id }, cls: 'scale-row',
        meta: `${1 + s.top.notes.length} notes · ${escHtml(displayNote(s.top.ding, uf, us))} ding`,
        meta2: escHtml(s.desc),
      }))}`;
}

// ── Listen: find a handpan scale by ear ──────────────────────────────────────
// On Try a scale and the wizard's handpan step. The player strikes the ding,
// then the other notes; each new steady note from the tuner is collected
// (scalefinder.js) and the scales are ranked live. Listening stops on Stop,
// on picking a scale, on leaving the screen, or after 60 s without a new
// note; the tuner goes back to how it was.
const LISTEN_IDLE_MS = 60000;
let _listenTimer = null;

// Which Listen screen is showing: 'selector', 'wizard' or null.
function listenScreen() {
  if (state.view === 'selector') return 'selector';
  if (state.view === 'wizard' && state.wizard?.step === 'handpan') return 'wizard';
  if (state.view === 'setup' && state.setup?.step === 'listen') return 'setup';
  return null;
}

function listenHasNotes(where) {
  return state.listen?.where === where && state.listen.notes.length > 0;
}

function startListen() {
  const where = listenScreen();
  if (!where) return;
  const notes = state.listen?.where === where ? state.listen.notes : [];
  const raw = state.listen?.where === where ? state.listen.raw : undefined;
  state.listen = { where, listening: true, notes, raw, lastSince: null, startedTuner: !state.tuner.on || !!state.tuner.error, error: null, stopped: '', startedAt: performance.now(), heardAt: null };
  recordMic(true);
  armListenIdle();
  if (state.listen.startedTuner) {
    if (state.tuner.error) { if (_tunerStop) { _tunerStop(); _tunerStop = null; } state.tuner.on = false; }
    toggleTuner().then(() => {
      if (state.tuner.error && state.listen?.listening) stopListen({ error: state.tuner.error });
    });
    return;
  }
  render();
}

function armListenIdle() {
  clearTimeout(_listenTimer);
  _listenTimer = setTimeout(() => {
    if (state.listen?.listening) stopListen({ stopped: 'Stopped: no new note for a minute.' });
  }, LISTEN_IDLE_MS);
}

// Stops listening (the notes stay) and turns the tuner off if Listen
// turned it on.
function stopListen(extra = {}) {
  clearTimeout(_listenTimer);
  const L = state.listen;
  recordMic(false);
  if (!L?.listening) return;
  const startedTuner = L.startedTuner;
  Object.assign(L, { listening: false, startedTuner: false }, extra);
  if (startedTuner && state.tuner.on && !state.tuner.error) { toggleTuner(); return; }
  render();
}

// What the microphone hears right now, under the listening status: a level
// meter and the note, or what to do when nothing comes through. Updated in
// place about 20 times a second (no re-render).
function listenLiveHtml(reading = state.tuner.reading, L = state.listen) {
  if (!L?.listening) return '';
  const level = reading?.level ?? 0;
  const now = performance.now();
  let text;
  if (reading?.hz > 0) text = `Hearing ${escHtml(displayNote(midiToNoteName(Math.round(reading.midi)), state.useFlats, state.useSolfege))}`;
  else if (level >= TUNER_MIN_RMS) text = 'Hearing sound · strike one note and let it ring';
  else if (now - (L.heardAt ?? L.startedAt) > 5000) text = 'Can’t hear anything. Hold the phone closer, about a hand away, and check that this site may use the microphone.';
  else text = 'Waiting for a note…';
  return `<span class="listen-live-text">${text}</span>`;
}

function updateListenLive(reading, L = state.listen) {
  const el = document.getElementById('listen-live');
  if (el) el.innerHTML = listenLiveHtml(reading, L);
}

// A tuner reading while listening: a steady note that began after the last
// one collected and isn't one already collected (a ringing note heard again)
// is added.
function onListenReading(reading) {
  const L = state.listen;
  if (!reading.stable || !(reading.hz > 0) || reading.since === L.lastSince) return false;
  L.lastSince = reading.since;
  if (L.where === 'setup' && state.setup?.windGuide && state.setup.step === 'listen') {
    armListenIdle();
    setupWindOnNote(reading.midi);
    return true;
  }
  if (L.where === 'setup' && state.setup?.guide && state.setup.step === 'listen') {
    armListenIdle();
    setupGuideOnNote(reading.midi);
    return true;
  }
  // Named on the instrument's own tuning, as in the guided round.
  const next = collectHeardNote(L, reading.midi, { tuned: L.where === 'setup' });
  if (!next) return false;
  L.raw = next.raw;
  L.notes = next.notes;
  if (L.where === 'setup' && state.setup) state.setup.tuningCents = next.offset;
  armListenIdle();
  render();
  setupOnHeard();
  return true;
}

// The Listen button, or while Listen is in use: status, Stop / Listen again,
// the notes heard as removable chips, Clear and the tip.
function listenPanelHtml(where) {
  const L = state.listen?.where === where ? state.listen : null;
  if (!L) {
    return `
      <div class="listen is-idle">
        <button type="button" class="btn btn-secondary" data-action="listen-start">${icon('mic')} Listen</button>
        <p class="listen-hint">Play your handpan to find its scale: strike the ding first.</p>
      </div>`;
  }
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const status = L.error ? `<span class="is-danger">${escHtml(L.error)}</span>`
    : L.listening ? (L.notes.length ? 'Listening… keep playing, one note at a time' : 'Listening… strike the ding')
    : L.stopped ? escHtml(L.stopped) : 'Stopped listening.';
  const chips = L.notes.map((m, i) => `
    <button type="button" class="chip listen-chip" data-action="listen-remove" data-midi="${m}" aria-label="Remove ${escHtml(nn(m))}" title="Remove ${escHtml(nn(m))}">
      ${escHtml(nn(m))}${i === 0 ? '<span class="listen-ding">ding</span>' : ''}${icon('x')}</button>`).join('');
  return `
    <section class="listen card${L.listening ? ' is-listening' : ''}" aria-label="Listen">
      <div class="listen-head">
        <p class="listen-status" aria-live="polite">${L.listening ? '<span class="listen-dot" aria-hidden="true"></span>' : ''}${status}</p>
        <div class="listen-actions">
          ${L.notes.length ? '<button type="button" class="btn btn-ghost" data-action="listen-clear">Clear</button>' : ''}
          ${L.listening
            ? `<button type="button" class="btn btn-secondary" data-action="listen-stop">${icon('square')} Stop</button>`
            : `<button type="button" class="btn btn-secondary" data-action="listen-start">${icon('mic')} ${L.notes.length ? 'Listen again' : 'Listen'}</button>`}
        </div>
      </div>
      ${chips ? `<div class="chips listen-notes" aria-label="Notes heard">${chips}</div>` : ''}
      <p class="listen-hint">Most reliable: damp each note with your palm before playing the next one.</p>
      ${!L.listening && L.notes.length ? listenReportLinkHtml('Heard a note wrong?') : ''}
    </section>`;
}

// Scales ranked by the notes heard, among those the search and note-count
// chips leave. One note heard: every scale with that ding, then those with
// the ding an octave away. More: the best few, with why.
function listenMatchesHtml(scales, action) {
  const L = state.listen;
  const uf = state.useFlats, us = state.useSolfege;
  const name = m => displayNote(midiToNoteName(m), uf, us);
  const ranked = rankScalesByNotes(L.notes, scales, { name });
  const shown = L.notes.length === 1 ? ranked.filter(r => r.ding !== 'none') : ranked.slice(0, 6);
  const rows = shown.map(r => uiRow({
    title: r.scale.name, chevron: true, action, data: { id: r.scale.id }, cls: 'scale-row listen-match',
    meta: escHtml(`${r.total} notes · ${displayNote(r.scale.top.ding, uf, us)} ding`),
    meta2: escHtml(r.reasons.join(' · ')),
  })).join('');
  const title = L.notes.length === 1 ? `Scales with a ${name(L.notes[0])} ding` : 'Best matches';
  return shown.length
    ? `<h2 class="list-title">${escHtml(title)}</h2><div class="list listen-list">${rows}</div>`
    : uiEmpty({ icon: 'search', title: `No scale here has a ${name(L.notes[0])} ding`, body: 'Keep playing, or Clear and strike the ding first.' });
}

// ── Listening reports ────────────────────────────────────────────────────────
// Hearing an instrument right is what setup by ear rests on, so every time
// Oakhum shows what it heard it asks whether that was right. "Yes" is counted
// (PostHog, listen_check); "not quite" offers to send what it heard and the
// recording of it (js/tuner.js keeps the last takes in memory) to the website
// (POST /api/listen-report), where it becomes a report in the Studio and a
// Jira issue. We replay it (scripts/replay-listen.mjs), fix it, and write back
// if they left their email. docs/design-system.md, "Listening to real instruments".
const listenReportUrl = () => (/(^|\.)oakhum\.com$/.test(location.hostname) ? '/api/listen-report' : 'https://oakhum.com/api/listen-report');
const LISTEN_REPORT_MAX_BYTES = 4_000_000; // the website takes up to 4.5 MB

// What Oakhum heard and made of it, for the report and the PostHog event.
function listenReportContext() {
  const L = state.listen;
  const st = state.view === 'setup' ? state.setup : null;
  const g = st?.guide, w = st?.windGuide;
  const family = st?.family ?? (state.view === 'wizard' || state.view === 'selector' ? 'handpan' : null);
  let matched = null;
  if (st && L?.notes?.length && !w) {
    const { best } = setupMatchFor(st, L.notes);
    if (best) matched = { id: best.scale.id, name: best.scale.name };
  }
  const notes = g ? g.notes.map(m => (m == null ? null : midiToNoteName(m))) : (L?.notes ?? []).map(midiToNoteName);
  return {
    where: st ? 'setup' : (L?.where ?? state.view),
    family,
    mode: w ? 'wind-guided' : g ? 'guided' : 'free',
    heard: notes,
    raw: (g ? g.raw : L?.raw ?? []).filter(x => x != null).map(x => Math.round(x * 100) / 100),
    places: g ? g.count : null,
    windChart: w ? `${w.chartId}/${w.keyId}` : null,
    tuningCents: st?.tuningCents ?? 0,
    a4: st?.tuningCents ? a4ForOffset(st.tuningCents) : 440,
    matched,
  };
}

function listenCheckEvent(result, ctx = listenReportContext()) {
  logEvent('listen_check', {
    result, where: ctx.where, family: ctx.family, mode: ctx.mode,
    notes: ctx.heard.filter(Boolean).length, a4: ctx.a4, matched: ctx.matched?.id ?? null,
  });
}

// Opens the report sheet. `then` is the setup step to go on to afterwards.
function openListenReport({ then = null } = {}) {
  stopListen();
  const ctx = listenReportContext();
  listenCheckEvent('wrong', ctx);
  state.listenReport = { ctx, then, takes: null, withAudio: true, comment: '', email: getUserEmail() ?? '', sending: false, sent: false, error: '' };
  render();
  micTakes().then(takes => {
    const R = state.listenReport;
    if (!R) return;
    // The newest takes that fit in one upload.
    let bytes = 0;
    R.takes = takes.reverse().filter(t => (bytes += t.blob.size) <= LISTEN_REPORT_MAX_BYTES).reverse()
      .map(t => ({ ...t, url: URL.createObjectURL(t.blob) }));
    render();
  });
}

function closeListenReport() {
  const R = state.listenReport;
  if (!R) return;
  R.takes?.forEach(t => URL.revokeObjectURL(t.url));
  state.listenReport = null;
  if (R.then && state.view === 'setup' && state.setup) setupGo(R.then);
  else render();
}

// Typed text survives a re-render (the switch, Send).
function listenReportKeepFields() {
  const R = state.listenReport;
  const c = document.getElementById('lr-comment'), e = document.getElementById('lr-email');
  if (R && c) R.comment = c.value;
  if (R && e) R.email = e.value.trim();
}

function listenReportSheet() {
  const R = state.listenReport;
  const close = 'lr-close';
  if (R.sent) {
    return uiSheet({
      key: 'listen-report', title: 'Thank you', close,
      body: `<p class="sheet-text">We’ll listen to it and work out what Oakhum got wrong.${R.email ? ' We’ll write to you when it’s fixed, so you can try again.' : ''}</p>`,
      footer: `<button type="button" class="btn btn-primary" data-action="${close}">${R.then ? 'Choose it myself' : 'Done'}</button>`,
    });
  }
  const ctx = R.ctx;
  const heard = ctx.heard.map(n => (n ? displayNote(n, state.useFlats, state.useSolfege) : '–')).join(' · ');
  const secs = (R.takes ?? []).reduce((a, t) => a + t.seconds, 0);
  const rec = !micRecordingSupported() ? ''
    : R.takes == null ? '<p class="field-help">Getting the recording…</p>'
    : !R.takes.length ? '<p class="field-help">There’s no recording this time: this browser didn’t record, or the microphone wasn’t on.</p>'
    : `${uiSwitchRow({ label: `Send the recording (${secs} s)`, help: 'It helps most: we hear what Oakhum heard. It may also catch voices in the room.', on: R.withAudio, action: 'lr-audio' })}
       ${R.withAudio ? `<div class="lr-takes">${R.takes.map(t => `<audio class="lr-audio" controls preload="metadata" src="${t.url}"></audio>`).join('')}</div>` : ''}`;
  return uiSheet({
    key: 'listen-report', title: 'Help us hear it right', close,
    body: `
      <p class="sheet-text">Tell us what Oakhum got wrong. We’ll listen, fix it and let you know.</p>
      ${heard ? `<p class="lr-heard"><span class="lr-heard-label">Oakhum heard</span> ${escHtml(heard)}${ctx.a4 !== 440 ? ` <span class="lr-heard-label">· A = ${ctx.a4} Hz</span>` : ''}</p>` : ''}
      ${uiField({ label: 'What was wrong?', id: 'lr-comment',
        control: `<textarea class="input" id="lr-comment" rows="3" maxlength="2000" placeholder="For example: it didn’t hear my lowest note. Mine is a C major with 8 notes.">${escHtml(R.comment)}</textarea>` })}
      ${rec}
      ${uiField({ label: 'Your email (if you’d like to hear back)', id: 'lr-email',
        control: `<input class="input" id="lr-email" type="email" inputmode="email" autocomplete="email" maxlength="200" value="${escHtml(R.email)}" placeholder="you@example.com">`,
        help: 'We keep the report until it’s fixed, at most a year. <a href="/privacy" target="_blank" rel="noopener">Privacy</a>' })}
      ${R.error ? `<p class="field-error" role="alert">${escHtml(R.error)}</p>` : ''}`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="${close}">${R.then ? 'Skip' : 'Not now'}</button>
      <button type="button" class="btn btn-primary" data-action="lr-send"${R.sending ? ' disabled' : ''}>${R.sending ? 'Sending…' : 'Send'}</button>`,
  });
}

async function sendListenReport() {
  const R = state.listenReport;
  if (!R || R.sending) return;
  listenReportKeepFields();
  if (R.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(R.email)) { R.error = 'That email doesn’t look right. Leave it empty if you’d rather not hear back.'; render(); return; }
  Object.assign(R, { sending: true, error: '' });
  render();
  const takes = R.withAudio ? (R.takes ?? []) : [];
  const meta = {
    ...R.ctx, comment: R.comment.trim(), email: R.email || null,
    takes: takes.map(t => ({ seconds: t.seconds, type: t.type })),
    app: BUILD_HASH, host: location.host, ua: navigator.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight}`, lang: navigator.language,
  };
  const form = new FormData();
  form.append('meta', JSON.stringify(meta));
  takes.forEach((t, i) => form.append('audio', t.blob, `take-${i + 1}.${/mp4/.test(t.type) ? 'm4a' : /ogg/.test(t.type) ? 'ogg' : 'webm'}`));
  try {
    const res = await fetch(listenReportUrl(), { method: 'POST', body: form });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
    Object.assign(R, { sending: false, sent: true });
    listenCheckEvent('reported', R.ctx);
  } catch (e) {
    Object.assign(R, { sending: false, error: navigator.onLine === false ? 'You’re offline. Try again when you’re back online.' : `We couldn’t send it just now (${e.message}). Please try again.` });
  }
  if (state.listenReport === R) render();
}

function listenReportAction(action) {
  if (action === 'lr-open') { openListenReport(); return true; }
  if (!state.listenReport) return false;
  if (action === 'lr-close') { if (!state.listenReport.sent) listenCheckEvent('skipped', state.listenReport.ctx); closeListenReport(); return true; }
  if (action === 'lr-audio') { listenReportKeepFields(); state.listenReport.withAudio = !state.listenReport.withAudio; render(); return true; }
  if (action === 'lr-send') { sendListenReport(); return true; }
  return false;
}

// The line under a result that opens the report sheet.
function listenReportLinkHtml(text = 'Did Oakhum mishear something?') {
  return `<p class="wizard-foot lr-link">${escHtml(text)} <button type="button" class="link-btn" data-action="lr-open">Send us the recording</button></p>`;
}

// ── My instruments ───────────────────────────────────────────────────────────

function refreshInstruments() {
  syncHandpanInstruments(getSavedLayouts());
  state.instruments = getInstruments();
  if (state.instruments.length > 0) setOnboarded();
}

const FAMILY_ICONS = { handpan: 'family-handpan', 'tongue-drum': 'family-tongue-drum', kalimba: 'family-kalimba', ocarina: 'family-ocarina', flute: 'family-flute' };
function familyName(id) { return INSTRUMENT_FAMILIES.find(f => f.id === id)?.name ?? id; }

// One instrument on Home: family glyph, name, what it is, and its ⋯ menu.
function instrumentRowHtml(inst) {
  let meta;
  if (usesLayout(inst)) {
    const notes = state.savedLayouts.find(l => l.id === inst.layoutId)?.noteCount;
    meta = escHtml([instrumentStatus(inst), notes ? `${notes} notes` : ''].filter(Boolean).join(' · '));
  } else if (inst.kind === 'scale' && inst.build && inst.build.stage !== 'done') {
    const idx = STAGE_ORDER.indexOf(inst.build.stage);
    meta = `${uiBadge(`Building ${idx + 1}/${STAGE_ORDER.length}`, 'warning')} ${escHtml(`${STAGE_TITLES[inst.build.stage].split(' (')[0]} · ${inst.notes.length} notes`)}`;
  } else {
    meta = escHtml(`${familyName(inst.family)} · ${instrumentStatus(inst)}`);
  }
  return uiRow({
    lead: inst.photo?.src ? `<img class="row-avatar" src="${inst.photo.src}" alt="">` : FAMILY_ICONS[inst.family] ?? 'music', title: inst.name, meta,
    action: 'open-instrument', data: { id: inst.id },
    trail: uiIconBtn('ellipsis', `More: ${inst.name}`, { action: 'row-menu', data: { id: inst.id }, attrs: 'aria-haspopup="dialog"' }),
  });
}

// ── Setup: the beginner flow (js/setup.js, viewBeginnerSetup; the approved mock-up) ────────────
// "What do you play?" as plain tiles. A handpan then goes "Play my notes"
// (Listen works out the scale) or "I know my scale" (middle note, then the
// common scales, the rest behind Show all), and ends on a ready screen with
// a first chord. Ocarinas and flutes go on into the add-instrument wizard.
// state.setup = { step: 'what' | 'how' | 'listen' | 'match' | 'know' | 'scales' | 'done',
//   root, showAll, scaleId, history }
const SETUP_REQUEST_URL = '/request'; // the website's, on the same domain
// Each tile shows its instrument's picture from the brand kit (brand/instruments).
const SETUP_TILES = [
  { family: 'handpan', name: 'Handpan', hint: 'Round steel drum with dents', picture: '/brand/instruments/handpan.webp' },
  { family: 'tongue-drum', name: 'Tongue drum', hint: 'Steel drum with cut tongues', picture: '/brand/instruments/tongue-drum.webp' },
  { family: 'kalimba', name: 'Kalimba', hint: 'Wooden box with metal keys', picture: '/brand/instruments/kalimba.webp' },
  { family: 'ocarina', name: 'Ocarina', hint: 'Clay, with finger holes', picture: '/brand/instruments/ocarina.webp' },
  { family: 'flute', name: 'Flute or whistle', hint: 'Wooden flute, tin whistle, Native American flute', picture: '/brand/instruments/native-american-flute.webp' },
];

function newSetup() { return { step: 'what', family: 'handpan', root: null, showAll: false, scaleId: null, history: [] }; }

// Every instrument goes through the same steps, each with its own tunings
// and words: handpans, tongue drums and kalimbas from js/layoutfamilies.js,
// ocarinas and flutes from their published charts (setup.js
// chartSetupTunings), with their own words here.
const SETUP_WIND_WORDS = {
  ocarina: {
    word: 'ocarina', voice: 'ocarina', first: 'lowest note: every hole covered, thumb holes too', firstShort: 'the lowest note',
    each: 'note up the scale, lifting one finger at a time', thing: 'note', firstRoot: 0,
    knowTitle: 'What key is it in?', knowSub: 'It’s usually written on the ocarina or its box, like the C in “12-hole ocarina in C”.',
  },
  flute: {
    word: 'flute', voice: 'flute', first: 'lowest note: every hole covered', firstShort: 'the lowest note',
    each: 'note up the scale, lifting one finger at a time', thing: 'note', firstRoot: 2,
    knowTitle: 'What key is it in?', knowSub: 'It’s usually marked on the flute: D on most tin whistles, often A or F# on a Native American flute.',
  },
};
// How each kind is played and named in the setup's sentences.
const SETUP_PLAY = {
  struck: { sound: 'Strike it once and let it ring.', next: 'Damp each note before the next.', again: 'striking each note once', pick: 'scale', knowBtn: 'I know my scale' },
  blown: { sound: 'Blow it gently and hold it for a second.', next: 'Hold each note for a second.', again: 'holding each note for a second', pick: 'key', knowBtn: 'I know my key' },
};
function setupFamilyInfo(family) {
  if (SETUP_WIND_WORDS[family]) return { ...SETUP_WIND_WORDS[family], ...SETUP_PLAY.blown, wind: true, tunings: chartSetupTunings(family) };
  const f = layoutFamilyInfo(family);
  const plucked = family === 'kalimba' ? { sound: 'Pluck it once and let it ring.', next: 'Damp each key before the next.', again: 'plucking each key once', knowBtn: 'I know my key', pick: 'key' } : {};
  return { ...f, ...SETUP_PLAY.struck, ...plucked, firstRoot: 2, wind: false };
}

// "My instrument isn't one of these": the notes as heard become a handpan,
// tongue drum or kalimba of your own; an ocarina or flute is set up note by
// note (its holes, then each fingering) in the add-instrument wizard.
function setupOwnRowHtml(st, n) {
  const fi = setupFamilyInfo(st.family);
  return fi.wind
    ? uiRow({ lead: 'pencil', title: `Set up my ${fi.word} note by note`, meta: 'For one that isn’t in the list, or made by hand: its holes, then each fingering with the tuner.', chevron: true, action: 'setup-own-wind' })
    : uiRow({ lead: 'pencil', title: `Use the ${n} notes I played`, meta: `Your own ${fi.word}, exactly as heard. You can change any note later.`, chevron: true, action: 'setup-use-heard' });
}
// When the notes played aren't a tuning Oakhum knows: which common scale
// they are, or are closest to (setup.js scaleFits), the notes that don't fit
// it, and a button to play just those places again. A drum sold as
// pentatonic but heard with two notes off is most likely two notes misheard
// or out of tune, not a new scale.
function setupScaleFitHtml(st, notes) {
  const g = st.guide;
  const devCents = {};
  if (g?.raw) g.raw.forEach((x, i) => { if (x != null && g.notes[i] != null) devCents[g.notes[i]] = Math.round((x - (st.tuningCents ?? 0) / 100 - g.notes[i]) * 100); });
  const fit = scaleFits(notes, { devCents });
  if (!fit) return '';
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const scale = f => `${displayNote(NOTE_NAMES[f.root], uf, us)} ${f.type.name}`;
  const list = ms => ms.map(m => `<b>${escHtml(nn(m))}</b>`).join(ms.length > 2 ? ', ' : ' and ');
  const lines = [];
  const five = fit.five, seven = fit.seven;
  const exact = five && !five.off.length ? five : seven && !seven.off.length ? seven : null;
  // Close to a scale: one or two notes off, not a note heard in two octaves,
  // and smaller than the scale they already are (a drum sold as pentatonic).
  const near = [five, seven].find(f => f && f !== exact && f.off.length >= 1 && f.off.length <= 2 && !f.repeated
    && (!exact || f.type.steps.length < exact.type.steps.length));
  if (exact) lines.push(`<p class="setup-fit-line">Your notes are <b>${escHtml(scale(exact))}</b>.</p>`);
  let redo = '';
  if (near) {
    const maybe = near.off.filter(m => near.instead[m] != null).map(m => `${nn(m)} may be ${nn(near.instead[m])}`);
    lines.push(`<p class="setup-fit-line">Close to <b>${escHtml(scale(near))}</b>, except ${list(near.off)}${maybe.length ? ` (${escHtml(maybe.join('; '))})` : ''}. If yours is ${escHtml(scale(near))}, ${near.off.length > 1 ? 'those were' : 'that one was'} misheard or ${near.off.length > 1 ? 'are' : 'is'} out of tune.</p>`);
    const places = g ? near.off.map(m => g.notes.indexOf(m)).filter(i => i >= 0) : [];
    if (places.length) redo = `<button type="button" class="btn btn-secondary" data-action="setup-guide-redo" data-places="${places.join(',')}">${icon('mic')} Play ${near.off.length > 1 ? 'those two' : 'it'} again</button>`;
  }
  return lines.length ? `<div class="setup-fit">${lines.join('')}${redo}</div>` : '';
}

// The match after listening (setup.js setupMatch): with the guided round's
// count, only a tuning of that size with every note played.
function setupMatchFor(st, notes) {
  const tunings = setupTunings(st);
  const fi = setupFamilyInfo(st.family);
  const ranked = fi.wind ? preferCommonChart(rankScalesByNotes(notes, tunings), st.family) : rankScalesByNotes(notes, tunings);
  const g = st.guide;
  return { ...setupMatch(ranked, g ? { count: g.count, heard: notes.length } : {}), ranked };
}
function setupTunings(st) { return setupFamilyInfo(st?.family).tunings; }
function setupWord(st) { return setupFamilyInfo(st?.family).word; }
function setupFindTuning(st, id) { return setupTunings(st).find(t => t.id === id) ?? null; }

function setupGo(step, extra = {}) {
  const st = state.setup;
  st.history.push(st.step);
  Object.assign(st, { step }, extra);
  render();
}

function setupRootName(pc) {
  return displayNote(NOTE_NAMES[pc] + '4', state.useFlats, state.useSolfege).replace(/-?\d+$/, '');
}

// The handpan drawing of a scale, or of the notes heard so far (empty
// places up to eight around the middle note while listening).
function setupPanHtml({ scale = null, heard = null, highlight = [], family = 'handpan', guide = null }) {
  // A tongue drum's tuning drawn as the drum was described (a round note in
  // the middle or not), when the guided round asked.
  if (scale && !scale.chartId && family === 'tongue-drum' && state.setup?.guide) {
    const layout = createLayoutFromScale(scale);
    layout.centre = !!state.setup.guide.centre;
    return `<div class="setup-pan pan-wrap">${renderPan(layout, { highlightNotes: highlight, rotated: state.ringRotated, useFlats: state.useFlats })}</div>`;
  }
  // The guided round: every note of the instrument as a place, the ones heard
  // filled in where they were played, the one to play next lit.
  if (guide && isLayoutFamily(family)) {
    const names = guide.notes.map(m => (m == null ? 'null' : midiToNoteName(m)));
    const rest = names.slice(1);
    const layout = layoutFromCustomParams(new URLSearchParams({
      ding: names[0] === 'null' ? 'D3' : names[0], top: rest.join(','), bottom: '', tc: String(rest.length), bc: '0',
      ...(guide.centre ? { centre: '1' } : {}),
    }), family);
    if (guide.notes[0] == null) layout.top.ding = null;
    let svg = renderPan(layout, { highlightNotes: highlight, rotated: false, useFlats: state.useFlats });
    const id = guide.active === 0 ? 'ding' : `ring-${guide.active - 1}`;
    svg = svg.replace(`data-note-id="${id}"`, `data-note-id="${id}" data-next="1"`);
    return `<div class="setup-pan pan-wrap setup-guide-pan">${svg}</div>`;
  }
  // An ocarina or flute: its picture and the notes, the ones to play lit.
  if (SETUP_WIND_WORDS[family]) {
    // A chord to play: the fingering of each of its notes, in playing order,
    // as the Chords screen shows them (the picture of an ocarina or flute).
    if (scale?.chartId && highlight.length) {
      const inst = instrumentFromChart(scale.chartId, scale.keyId);
      const midis = highlight.map(noteToMidi);
      return `<div class="setup-wind setup-wind-chord">${midis.map((m, i) => `<div class="setup-wind-step"><span class="setup-wind-step-n">${i + 1}</span>${renderFingering(inst, m, { size: 'medium', useFlats: state.useFlats, useSolfege: state.useSolfege, previousMidi: midis[i - 1] ?? null })}</div>`).join('')}</div>`;
    }
    const tile = SETUP_TILES.find(t => t.family === family);
    // Heard notes, or the notes to play (a chord); a whole chart is its range.
    const names = highlight.length ? highlight : scale ? [] : (heard ?? []).map(heardNoteName);
    const lit = new Set(highlight.map(noteToMidi));
    return `<div class="setup-wind">
      ${tile ? `<img class="setup-wind-pic" src="${tile.picture}" width="160" height="160" alt="">` : ''}
      ${names.length ? `<div class="chips setup-wind-notes">${names.map(n => `<span class="chip${lit.has(noteToMidi(n)) ? ' is-selected' : ''}">${escHtml(displayNote(n, state.useFlats, state.useSolfege))}</span>`).join('')}</div>` : ''}
    </div>`;
  }
  let layout;
  if (scale) layout = createLayoutFromScale(scale);
  else {
    const names = heard.map(heardNoteName);
    const top = names.slice(1);
    const cap = Math.max(8, top.length);
    layout = layoutFromCustomParams(new URLSearchParams({
      ding: names[0] ?? 'D3', top: [...top, ...Array(cap - top.length).fill('null')].join(','), bottom: '', tc: String(cap), bc: '0',
    }), family);
    if (!names.length) layout.top.ding = null;
  }
  return `<div class="setup-pan pan-wrap">${renderPan(layout, { highlightNotes: highlight, rotated: state.ringRotated, useFlats: state.useFlats })}</div>`;
}

// A tuning's notes for the setup's lists: every note of a drum or kalimba;
// an ocarina's or flute's range (a chart can have twenty).
function setupNotesText(s) {
  const notes = setupScaleNotes(s).map(n => displayNote(n, state.useFlats, state.useSolfege));
  return s.chartId ? `${notes[0]} to ${notes.at(-1)} · ${notes.length} notes` : notes.join(' ');
}

// ── The guided round (Play my notes on a handpan, tongue drum or kalimba) ──
// st.guide = { count, centre, notes: [midi|null] (0: the lowest note, then
// the places around it), active, order: [index] (the playing order: round
// the drum clockwise from the bottom, or a kalimba's keys left to right),
// msg, tone }.
const SETUP_GUIDE_DEFAULT = { handpan: 9, 'tongue-drum': 9, kalimba: 17 };
function newSetupGuide(family, count = SETUP_GUIDE_DEFAULT[family] ?? 9, centre = false) {
  return { count, centre, notes: Array(count).fill(null), active: 0, order: null, msg: '', tone: '' };
}
// A place by its number in the playing order (1 the lowest, then round).
function setupSlotLabel(family, i) {
  if (i === 0) return family === 'handpan' ? 'the ding' : 'the lowest note';
  const order = state.setup?.guide?.order;
  const n = order ? order.indexOf(i) + 1 : i + 1;
  return `${setupFamilyInfo(family).thing} ${n}`;
}
// The playing order, read from the drawing on screen: the lowest note first,
// then round the drum clockwise from the bottom (a kalimba: left to right).
function setupGuideOrder() {
  const g = state.setup?.guide;
  const svg = document.querySelector('.setup-guide-pan svg');
  if (!g || !svg) return;
  const box = svg.getBoundingClientRect();
  const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
  const places = [...svg.querySelectorAll('[data-note-id^="ring-"]')].map(el => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2 - cx, y = r.top + r.height / 2 - cy;
    const a = Math.atan2(-x, y);
    return { i: parseInt(el.dataset.noteId.slice(5), 10) + 1, key: state.setup.family === 'kalimba' ? x : (a < 0 ? a + 2 * Math.PI : a) };
  });
  g.order = [0, ...places.sort((p, q) => p.key - q.key).map(p => p.i)];
}
function setupGuideNextEmpty(g) {
  const order = g.order ?? g.notes.map((_, i) => i);
  const from = order.indexOf(g.active);
  for (let k = 1; k <= order.length; k++) {
    const i = order[(from + k) % order.length];
    if (g.notes[i] == null) return i;
  }
  return -1;
}
// The notes heard, the lowest place first, for matching.
function setupGuideHeard(g) {
  const filled = g.notes.filter(m => m != null);
  if (g.notes[0] != null) return [g.notes[0], ...g.notes.slice(1).filter(m => m != null)];
  return [...filled].sort((a, b) => a - b);
}
// A steady note heard during the guided round: it fills the lit place, or
// says why not.
function setupGuideOnNote(midi) {
  const st = state.setup;
  const g = st.guide;
  // Named on the instrument's own tuning (A = 432 Hz drums): the offset
  // from every place heard so far and this note.
  g.raw ??= Array(g.count).fill(null);
  const others = g.raw.filter((x, i) => x != null && i !== g.active);
  const off = tuningOffsetCents([...others, midi]);
  const m = noteOnTuning(midi, off);
  const name = displayNote(midiToNoteName(m), state.useFlats, state.useSolfege);
  const twin = g.notes.findIndex((x, i) => x === m && i !== g.active);
  if (twin >= 0) {
    Object.assign(g, { msg: `Heard ${name}: that’s already ${setupSlotLabel(st.family, twin)}. Play a different one, or tap ${setupSlotLabel(st.family, twin)} to play it again.`, tone: 'warn' });
    render();
    return;
  }
  g.raw[g.active] = midi;
  // The offset can change with a new note: every place heard is named again.
  const was = st.tuningCents ?? 0;
  st.tuningCents = tuningOffsetCents(g.raw.filter(x => x != null));
  g.notes = g.raw.map(x => (x == null ? null : noteOnTuning(x, st.tuningCents)));
  const done = setupSlotLabel(st.family, g.active);
  const tuned = st.tuningCents && !was ? ` · tuned to A = ${a4ForOffset(st.tuningCents)} Hz` : '';
  Object.assign(g, { msg: `${done[0].toUpperCase()}${done.slice(1)}: ${name} ✓${tuned}`, tone: 'ok' });
  state.listen.notes = setupGuideHeard(g);
  const next = setupGuideNextEmpty(g);
  if (next < 0) { stopListen(); setupGo('match'); return; }
  g.active = next;
  render();
}

// ── The guided round for ocarinas and flutes ───────────────────────────────
// st.windGuide = { group: [chartId], chartId, keyId, offset, seq: [midi],
// idx, msg, tone }. The first note (every hole covered) gives the key; then
// the fingering of each next note up is shown and checked against what's
// heard. offset: octaves between the chart's written notes and the sound
// (a tin whistle sounds an octave above its chart).
// The types asked about. With a published chart (group): the fingerings are
// shown and checked. Without one yet (holes): the type is set up note by note
// with the tuner in the add-instrument wizard, its holes filled in.
const SETUP_WIND_TYPES = {
  ocarina: [
    { name: '12 holes', hint: 'Transverse (“sweet potato”), the most common', group: ['ocarina-12-stl-c'] },
    { name: '4 holes', hint: 'Small pendant', holes: 4 },
    { name: '6 holes', hint: 'Pendant, English system (4 on top, 2 thumbs)', group: ['ocarina-6-stl-c'] },
    { name: '7 holes', hint: 'Pendant', holes: 7 },
    { name: '8 holes', hint: 'Pendant', holes: 8 },
    { name: '10 holes', hint: 'Transverse', holes: 10 },
    { name: 'Another number, or made by hand', holes: 12 },
  ],
  flute: [
    { name: 'Tin whistle', hint: '6 holes, in D', group: ['tin-whistle-d'] },
    { name: 'Native American flute, 6 holes', hint: 'Any key', group: ['naf6-a', 'naf6-fs', 'naf6-penta'] },
    { name: 'Native American flute, 5 holes', hint: 'Any key', group: ['naf5-a', 'naf5-fs', 'naf5-penta'] },
    { name: 'Another flute', hint: 'A recorder, a bansuri, one made by hand', holes: 6 },
  ],
};
const SETUP_WIND_STEPS = 7;
function newWindGuide(group) {
  return { group, chartId: group[0], keyId: null, offset: 0, seq: [], idx: 0, msg: '', tone: '' };
}
// The key of a chart whose lowest note (every hole covered) is the one heard,
// in any octave: { key, offset } or null.
function windKeyFor(chart, midi) {
  const pc = n => ((n % 12) + 12) % 12;
  let best = null;
  for (const k of chart.keys) {
    const low = noteToMidi(k.lowest);
    if (pc(low) !== pc(midi)) continue;
    if (!best || Math.abs(low - midi) < Math.abs(noteToMidi(best.key.lowest) - midi)) best = { key: k, offset: midi - low };
  }
  return best;
}
function windGuideInst(g) {
  const chart = getChart(g.chartId);
  return instrumentFromChart(g.chartId, g.keyId ?? chartDefaultKey(chart));
}
function windNoteName(m) { return displayNote(midiToNoteName(m), state.useFlats, state.useSolfege); }
// A steady note during the guided round.
function setupWindOnNote(midi) {
  const st = state.setup;
  const g = st.windGuide;
  const m = Math.round(midi);
  if (g.idx === 0) {
    // The lowest note: which chart of the type, and its key.
    for (const id of g.group) {
      const found = windKeyFor(getChart(id), m);
      if (!found) continue;
      const inst = instrumentFromChart(id, found.key.id);
      const notes = inst.chambers[0].notes;
      // The notes of its own scale, from the lowest up: the major scale of
      // its key (an ocarina, a whistle), a Native American flute's minor
      // pentatonic. No half-holed notes in between.
      const root = noteToMidi(`${found.key.root ?? found.key.lowest.replace(/-?\d+$/, '')}4`) % 12;
      const steps = id.startsWith('naf') ? [0, 3, 5, 7, 10] : [0, 2, 4, 5, 7, 9, 11];
      const inScale = notes.filter(n => steps.includes((((n - root) % 12) + 12) % 12));
      const seq = (inScale[0] === notes[0] ? inScale : [notes[0], ...inScale]).slice(0, SETUP_WIND_STEPS);
      Object.assign(g, { chartId: id, keyId: found.key.id, offset: found.offset, seq, idx: 1,
        msg: (t => `Lowest note ${windNoteName(m)} ✓: ${/^[AEIOU]/i.test(t) ? 'an' : 'a'} ${t}`)(linkTitle(parseLink(linkFor({ chartId: id, keyId: found.key.id })))), tone: 'ok' });
      state.listen.notes = [m];
      render();
      return;
    }
    Object.assign(g, { msg: `Heard ${windNoteName(m)}: that isn’t the lowest note of this type. Cover every hole, thumb holes too, and blow gently.`, tone: 'warn' });
    render();
    return;
  }
  const want = g.seq[g.idx] + g.offset;
  if (m === want) {
    g.idx++;
    state.listen.notes = g.seq.slice(0, g.idx).map(x => x + g.offset);
    if (g.idx >= g.seq.length) {
      // On to Ready first: stopping redraws the screen it's on.
      st.scaleId = `chart:${g.chartId}/${g.keyId}`;
      setupGo('done');
      stopListen();
      return;
    }
    Object.assign(g, { msg: `${windNoteName(m)} ✓`, tone: 'ok' });
  } else if (g.seq.slice(0, g.idx).some(x => x + g.offset === m)) {
    Object.assign(g, { msg: `That’s ${windNoteName(m)} again. Now play ${windNoteName(want)}: the fingering shown.`, tone: 'warn' });
  } else {
    Object.assign(g, { msg: `Heard ${windNoteName(m)}, expected ${windNoteName(want)}. Check that the covered holes are fully closed, and blow gently.`, tone: 'warn' });
  }
  render();
}

function setupScaleNotes(scale) {
  return [scale.top.ding, ...scale.top.notes, ...scale.bottom.notes].sort((a, b) => noteToMidi(a) - noteToMidi(b));
}

function viewBeginnerSetup() {
  const st = state.setup ?? (state.setup = newSetup());
  const first = homeIsEmpty();
  const header = st.step === 'what'
    ? (first ? uiAppBar({ title: 'Welcome', actions: [settingsAppBtn()] }) : backAppBar('Add instrument'))
    : uiAppBar({ title: st.step === 'done' ? 'Ready' : `Your ${setupWord(st)}`, back: { action: 'setup-back', label: 'Back' } });
  const word = setupWord(st);
  const fi = setupFamilyInfo(st.family);
  const tunings = setupTunings(st);
  const count = n => `Step ${n} of 4`;
  const uf = state.useFlats, us = state.useSolfege;
  const nn = n => displayNote(n, uf, us);

  if (st.step === 'what') {
    return stepFrame({
      header, hero: first, title: 'What do you play?', sub: 'Tap your instrument. You can add more later.',
      body: `${installBannerHtml()}
        <div class="setup-tiles">
          ${SETUP_TILES.map(t => `
            <button type="button" class="setup-tile" data-action="setup-family" data-family="${t.family}">
              <img class="setup-tile-pic" src="${t.picture}" width="72" height="72" alt="">
              <span class="setup-tile-name">${escHtml(t.name)}</span>
              <span class="setup-tile-hint">${escHtml(t.hint)}</span>
            </button>`).join('')}
        </div>
        <p class="wizard-foot">Something else? <a class="link-btn" href="${SETUP_REQUEST_URL}">Ask for your instrument</a>. Just looking? <button type="button" class="link-btn" data-action="open-play">Play a popular tuning</button>.</p>`,
    });
  }

  if (st.step === 'how') {
    return stepFrame({
      header, count: count(2), title: `Let’s find out which ${word} you have`,
      sub: `No need to know its ${fi.pick}. Play it to your phone and Oakhum works it out.`,
      body: `
        <ol class="setup-how">
          <li>Put your phone next to the ${word}, somewhere quiet.</li>
          <li>Play the <strong>${fi.first}</strong>. ${fi.sound}</li>
          <li>Then play each ${fi.each}, one by one. Any order is fine.</li>
        </ol>`,
      bar: {
        help: 'Oakhum only listens while this screen is open. Nothing is recorded.',
        left: `<button type="button" class="btn btn-secondary" data-action="setup-know">${fi.knowBtn}</button>`,
        right: `<button type="button" class="btn btn-primary" data-action="setup-listen">${icon('mic')} Play my notes</button>`,
      },
    });
  }

  if (st.step === 'count') {
    const g = st.guide ?? (st.guide = newSetupGuide(st.family));
    const max = fi.maxNotes + 1;
    const what = st.family === 'handpan' ? 'Count the notes on top, the ding in the middle too. Leave out any underneath.'
      : st.family === 'kalimba' ? 'Count every key.' : 'Count every tongue, a round one in the middle too.';
    return stepFrame({
      header, count: count(3), title: `How many notes does your ${word} have?`, sub: what,
      body: `
        <div class="setup-count">
          ${uiStepper({ value: g.count, label: 'Notes', action: 'setup-count', min: g.count <= 3, max: g.count >= max })}
          ${st.family === 'tongue-drum' ? uiSwitchRow({ label: 'A round note in the middle', help: g.centre ? 'The lowest note is in the middle' : 'Every tongue is round the edge', on: g.centre, action: 'setup-centre' }) : ''}
        </div>
        ${setupPanHtml({ guide: g, family: st.family })}`,
      bar: {
        left: '<button type="button" class="btn btn-ghost" data-action="setup-listen-free">Not sure · just listen</button>',
        right: `<button type="button" class="btn btn-primary" data-action="setup-guide-start">${icon('mic')} Start</button>`,
      },
    });
  }

  if (st.step === 'windtype') {
    return stepFrame({
      header, count: count(3), title: `Which ${word} do you have?`, sub: 'Then Oakhum shows each fingering to play and listens.',
      body: `<div class="list">${(SETUP_WIND_TYPES[st.family] ?? []).map((t, i) => uiRow({ title: t.name, meta: escHtml(t.group ? (t.hint ?? '') : t.hint ? `${t.hint} · set up note by note with the tuner` : 'Set up note by note with the tuner'), chevron: true, action: 'setup-windtype', data: { i } })).join('')}</div>`,
      bar: { left: '<button type="button" class="btn btn-ghost" data-action="setup-listen-free">Not sure · just listen</button>' },
    });
  }

  if (st.step === 'listen' && st.windGuide) {
    const L = state.listen?.where === 'setup' ? state.listen : { notes: [], listening: false };
    const g = st.windGuide;
    const inst = windGuideInst(g);
    const chart = getChart(g.chartId);
    const want = g.idx === 0 ? inst.chambers[0].notes[0] : g.seq[Math.min(g.idx, g.seq.length - 1)];
    const prev = g.idx > 0 ? g.seq[g.idx - 1] : null;
    const steps = g.idx === 0 ? '' : `<div class="chips setup-wind-steps">${g.seq.map((m, i) => `<button type="button" class="chip${i < g.idx ? ' is-done' : i === g.idx ? ' is-selected' : ''}" data-action="setup-wind-step" data-i="${i}"${i > g.idx ? ' disabled' : ''}>${i < g.idx ? `${icon('check')} ` : ''}${escHtml(windNoteName(m + g.offset))}</button>`).join('')}</div>`;
    const status = L.error ? `<p class="setup-status is-danger">${escHtml(L.error)}</p>`
      : `<p class="setup-status" aria-live="polite">${L.listening ? '<span class="listen-dot" aria-hidden="true"></span>' : ''}${L.listening ? (g.idx === 0 ? 'Listening' : `${g.idx} of ${g.seq.length} · listening`) : (L.stopped ? escHtml(L.stopped) : 'Stopped listening.')}</p>`;
    return stepFrame({
      header, count: count(3),
      title: g.idx === 0 ? 'Cover every hole and blow gently' : `Now play ${windNoteName(want + g.offset)}`,
      sub: g.idx === 0 ? `The lowest note${chart.holes.some(h => h.side === 'bottom') ? ', thumb holes covered too' : ''}. Oakhum works out the key from it.` : 'Open the holes shown open, keep the others covered. Tap a note above to play it again.',
      body: `${steps}
        <div class="setup-wind setup-wind-finger">${renderFingering(inst, want, { size: 'large', useFlats: state.useFlats, useSolfege: state.useSolfege, previousMidi: prev })}</div>
        ${g.msg ? `<p class="setup-guide-msg is-${g.tone}" aria-live="polite">${escHtml(g.msg)}</p>` : ''}
        ${status}${L.listening ? `<div class="listen-live" id="listen-live">${listenLiveHtml()}</div>` : ''}`,
      bar: {
        left: `<button type="button" class="btn btn-ghost" data-action="setup-know">Choose my key instead</button>`,
        right: L.listening
          ? (g.idx > 0 ? '<button type="button" class="btn btn-secondary" data-action="setup-wind-skip">Skip this note</button>' : '')
          : `<button type="button" class="btn btn-primary" data-action="setup-listen">${icon('mic')} Listen again</button>`,
      },
    });
  }

  if (st.step === 'listen' && st.guide) {
    const L = state.listen?.where === 'setup' ? state.listen : { notes: [], listening: false };
    const g = st.guide;
    const filled = g.notes.filter(m => m != null).length;
    const label = setupSlotLabel(st.family, g.active);
    const status = L.error ? `<p class="setup-status is-danger">${escHtml(L.error)}</p>`
      : `<p class="setup-status" aria-live="polite">${L.listening ? '<span class="listen-dot" aria-hidden="true"></span>' : ''}${L.listening ? `${filled} of ${g.count} · listening` : (L.stopped ? escHtml(L.stopped) : 'Stopped listening.')}</p>`;
    return stepFrame({
      header, count: count(3),
      title: g.notes[g.active] != null ? `Play ${label} again` : `Play ${label}`,
      sub: `${fi.sound} The one to play is lit; tap another if you’re playing that one instead.`,
      body: `${setupPanHtml({ guide: g, family: st.family })}
        ${g.msg ? `<p class="setup-guide-msg is-${g.tone}" aria-live="polite">${escHtml(g.msg)}</p>` : ''}
        ${status}${L.listening ? `<div class="listen-live" id="listen-live">${listenLiveHtml()}</div>` : ''}`,
      bar: {
        left: `<button type="button" class="btn btn-ghost" data-action="setup-know">Choose my ${fi.pick} instead</button>`,
        right: L.listening || filled >= 3
          ? `<button type="button" class="btn btn-primary" data-action="setup-heard-done"${filled >= 3 ? '' : ' disabled'}>${filled >= g.count ? 'Next' : 'That’s all my notes'}</button>`
          : `<button type="button" class="btn btn-primary" data-action="setup-listen">${icon('mic')} Listen again</button>`,
      },
    });
  }

  if (st.step === 'listen') {
    const L = state.listen?.where === 'setup' ? state.listen : { notes: [], listening: false };
    const n = L.notes.length;
    const status = L.error ? `<p class="setup-status is-danger">${escHtml(L.error)}</p>`
      : `<p class="setup-status" aria-live="polite">${L.listening ? '<span class="listen-dot" aria-hidden="true"></span>' : ''}${L.listening ? `Listening · ${n} note${n !== 1 ? 's' : ''} heard` : (L.stopped ? escHtml(L.stopped) : 'Stopped listening.')}</p>`;
    return stepFrame({
      header, count: count(3),
      title: n === 0 ? `Play ${fi.firstShort}` : 'Now the next note',
      sub: n === 0 ? fi.sound : `Heard ${escHtml(nn(heardNoteName(L.notes[n - 1])).replace(/-?\d+$/, ''))}. Keep going, any order. ${fi.next}`,
      body: `${setupPanHtml({ heard: L.notes, highlight: n ? [heardNoteName(L.notes[n - 1])] : [], family: st.family })}${status}${L.listening ? `<div class="listen-live" id="listen-live">${listenLiveHtml()}</div>` : ''}`,
      bar: {
        left: `<button type="button" class="btn btn-ghost" data-action="setup-know">Choose my ${fi.pick} instead</button>`,
        right: L.listening || n >= 3
          ? `<button type="button" class="btn btn-primary" data-action="setup-heard-done"${n >= 3 ? '' : ' disabled'}>That’s all my notes</button>`
          : `<button type="button" class="btn btn-primary" data-action="setup-listen">${icon('mic')} Listen again</button>`,
      },
    });
  }

  if (st.step === 'match') {
    const notes = state.listen?.notes ?? [];
    const { best, close: sameSize, ranked } = setupMatchFor(st, notes);
    // The guided round knew how many notes: none of that size has them all.
    if (!best && st.guide && notes.length >= 3) {
      const closeLinks = sameSize.map(r => `<button type="button" class="link-btn" data-action="setup-scale" data-id="${escHtml(r.scale.id)}">${escHtml(r.scale.name)}</button>`).join(', ');
      return stepFrame({
        header, count: count(3), title: `We heard ${notes.length} notes`,
        body: `
          <div class="setup-result card">
            <p class="setup-result-lead">Your ${word}</p>
            <p class="setup-result-name">${escHtml([...notes].sort((a, b) => a - b).map(m => nn(midiToNoteName(m))).join(' '))}</p>
            <p class="setup-result-desc">None of the ${st.guide.count}-note ${escHtml(word)}s Oakhum knows has exactly these notes, so it’ll use them as you played them. You can change any note later.</p>
            ${setupScaleFitHtml(st, notes)}
            ${st.tuningCents ? `<p class="setup-result-desc">Tuned to A = ${a4ForOffset(st.tuningCents)} Hz, not the usual 440: Oakhum names its notes on that tuning.</p>` : ''}
            ${setupPanHtml({ guide: { ...st.guide, active: -1 }, family: st.family })}
          </div>
          ${closeLinks ? `<p class="wizard-foot">Closest with ${st.guide.count} notes: ${closeLinks}</p>` : ''}
          ${listenReportLinkHtml('Did Oakhum mishear a note?')}`,
        bar: {
          left: '<button type="button" class="btn btn-ghost" data-action="setup-not-right">Not quite, let me choose</button>',
          right: `<button type="button" class="btn btn-primary" data-action="setup-use-heard">Use my ${notes.length} notes</button>`,
        },
      });
    }
    if (!best) {
      return stepFrame({
        header, count: count(3), title: `We couldn’t tell which ${fi.pick} that is`,
        sub: `Try again in a quieter spot, ${fi.again}, or choose it yourself.`,
        body: `${notes.length >= 3 ? `<div class="list">${setupOwnRowHtml(st, notes.length)}</div>` : ''}${listenReportLinkHtml('Is something not right?')}`,
        bar: {
          left: `<button type="button" class="btn btn-secondary" data-action="setup-know">Choose my ${fi.pick}</button>`,
          right: `<button type="button" class="btn btn-primary" data-action="setup-listen">${icon('mic')} Listen again</button>`,
        },
      });
    }
    const s = best.scale;
    const close = ranked.filter(r => r.ding !== 'none' && r.scale.family !== s.family && (!st.guide || r.total === st.guide.count)).slice(0, 2).map(r => `<button type="button" class="link-btn" data-action="setup-scale" data-id="${escHtml(r.scale.id)}">${escHtml(r.scale.name)}</button>`).join(', ');
    return stepFrame({
      header, count: count(3), title: `We heard ${notes.length} notes`,
      body: `
        <div class="setup-result card">
          <p class="setup-result-lead">Your ${word} is ${/^[AEIOU]/i.test(s.name) ? 'an' : 'a'}</p>
          <p class="setup-result-name">${escHtml(s.name)}</p>
          ${s.desc ? `<p class="setup-result-desc">${escHtml(s.desc)}</p>` : ''}
          <p class="setup-result-notes">${escHtml(setupNotesText(s))}</p>
          ${st.tuningCents ? `<p class="setup-result-desc">Tuned to A = ${a4ForOffset(st.tuningCents)} Hz, not the usual 440: Oakhum names its notes on that tuning.</p>` : ''}
          ${setupPanHtml({ scale: s, family: st.family })}
          <button type="button" class="btn btn-secondary" data-action="setup-hear" data-id="${escHtml(s.id)}">${icon('play')} Hear it</button>
        </div>
        ${close ? `<p class="wizard-foot">Also close: ${close}</p>` : ''}
        <p class="wizard-foot">Not this one? ${fi.wind
          ? `<button type="button" class="link-btn" data-action="setup-own-wind">Set up my ${escHtml(word)} note by note</button>.`
          : `<button type="button" class="link-btn" data-action="setup-use-heard">Use the ${notes.length} notes I played</button> as your own ${escHtml(word)}.`}</p>
        ${listenReportLinkHtml()}`,
      bar: {
        left: '<button type="button" class="btn btn-ghost" data-action="setup-not-right">Not quite, let me choose</button>',
        right: `<button type="button" class="btn btn-primary" data-action="setup-scale" data-id="${escHtml(s.id)}">Yes, that’s it</button>`,
      },
    });
  }

  if (st.step === 'know') {
    const roots = setupRoots(tunings, { first: fi.firstRoot });
    return stepFrame({
      header, count: count(3), title: fi.knowTitle,
      sub: fi.knowSub,
      body: `
        <div class="setup-roots">
          ${roots.map((r, i) => `<button type="button" class="setup-root${i === 0 ? ' is-first' : ''}" data-action="setup-root" data-pc="${r.pc}">${escHtml(setupRootName(r.pc))}</button>`).join('')}
        </div>
        <p class="wizard-foot">Most ${word}s are in ${escHtml(setupRootName(roots[0]?.pc ?? 2))}, so it’s first. Not sure? <button type="button" class="link-btn" data-action="setup-listen">Let Oakhum listen</button>.</p>`,
    });
  }

  if (st.step === 'scales') {
    let all = setupScalesFor(tunings, st.root);
    // An ocarina's or flute's keys: all of them, the popular ones first.
    if (fi.wind) {
      const rank = t => { const i = (PLAY_POPULAR[st.family] ?? []).findIndex(p => p.chartId === t.chartId && p.keyId === t.keyId); return i < 0 ? 99 : i; };
      all = [...all].sort((a, b) => rank(a) - rank(b));
    }
    const shown = st.showAll || fi.wind ? all : setupTopScales(all);
    const root = setupRootName(st.root);
    return stepFrame({
      header, count: count(3), title: fi.wind ? `Which ${root} ${word}?` : `Which ${root} scale?`, sub: 'The most common ones first.',
      body: `
        <div class="list">
          ${shown.map(s => uiRow({
            title: s.name, chevron: true, action: 'setup-scale', data: { id: s.id }, cls: 'scale-row',
            meta: escHtml(setupNotesText(s)), meta2: escHtml(s.desc ?? ''),
          })).join('')}
          ${!st.showAll && all.length > shown.length ? uiRow({ lead: 'chevron-down', title: fi.wind ? `Show all ${all.length} in ${root}` : `Show all ${all.length} scales in ${root}`, action: 'setup-all' }) : ''}
        </div>`,
    });
  }

  // done
  const s = setupFindTuning(st, st.scaleId);
  if (!s) { st.step = 'what'; return viewBeginnerSetup(); }
  const chord = setupFirstChord(findAllChords(createLayoutFromScale(s)), setupKeyNote(s), { prefer: s.chartId ? 'maj' : 'min' });
  const chordName = chord ? `${displayNote(chord.rootName + '4', uf, us).replace(/-?\d+$/, '')} ${chord.type.name.toLowerCase()}` : '';
  return stepFrame({
    header, count: count(4), title: fi.wind ? `Your ${s.name} is ready` : `Your ${s.name.replace(/ \(\d+\)$/, '')} ${word} is ready`,
    sub: chord ? (fi.wind ? `Start with this chord. Your ${word} plays one note at a time, so Oakhum shows the fingering of each note and plays them in turn.`
      : `Start with this chord. Oakhum lights its notes on your ${word}, and plays them for you.`) : '',
    body: `
      ${chord ? `<div class="setup-result card">
        <p class="setup-result-name">${escHtml(chordName)}</p>
        <p class="setup-result-notes">${chord.notes.map(x => escHtml(nn(x))).join(' · ')}</p>
        ${setupPanHtml({ scale: s, highlight: chord.notes, family: st.family })}
      </div>` : ''}
      ${st.windGuide ? listenReportLinkHtml('Did Oakhum mishear a note?') : ''}`,
    bar: {
      left: `<button type="button" class="btn btn-secondary" data-action="setup-save">${accountOn() ? 'Save' : 'Save for next time'}</button>`,
      right: `<button type="button" class="btn btn-primary" data-action="setup-first-chord">${chord ? 'Play my first chord' : 'Start playing'}</button>`,
    },
  });
}

// Moves on by itself once every note of the best match was heard.
function setupOnHeard() {
  if (state.view !== 'setup' || state.setup?.step !== 'listen') return;
  const notes = state.listen?.notes ?? [];
  if (setupHeardEnough(rankScalesByNotes(notes, setupTunings(state.setup)), notes.length)) {
    stopListen();
    setupGo('match');
  }
}

// The setup's buttons. Returns true when it handled the action.
function setupAction(action, el) {
  const st = state.setup;
  if (action === 'setup-open') {
    Object.assign(state, { view: 'setup', setup: newSetup(), wizard: null });
    clearMicTakes();
    navPush('#setup');
    render();
    return true;
  }
  if (!st || !action.startsWith('setup-')) return false;
  if (action === 'setup-family') {
    const fam = el.dataset.family;
    logEvent('setup', { step: 'family', family: fam });
    if (isLayoutFamily(fam) || SETUP_WIND_WORDS[fam]) { setupGo('how', { family: fam }); return true; }
    return true;
  }
  if (action === 'setup-own-wind') {
    // An ocarina or flute that isn't one of the charts: set it up note by
    // note in the add-instrument wizard (its holes, then each fingering).
    stopListen();
    const fam = st.family;
    const w = newWizard(homeIsEmpty());
    Object.assign(w, { families: [fam], step: fam, queue: [], history: [] });
    // From "Which ocarina?": straight to charting your own, its holes filled in.
    const holes = parseInt(el?.dataset?.holes ?? '', 10);
    if (fam === 'ocarina') Object.assign(w.oc, { path: 'have', chartId: 'custom', ...(holes ? { holeCount: holes } : {}) });
    if (fam === 'flute' && holes) Object.assign(w.fl, { chartId: 'custom', holeCount: holes });
    Object.assign(state, { wizard: w, view: 'wizard' });
    render();
    return true;
  }
  // Play my notes on a handpan, tongue drum or kalimba: first how many
  // notes, then a guided round.
  if (action === 'setup-listen' && st.step === 'how' && isLayoutFamily(st.family)) {
    setupGo('count', { guide: newSetupGuide(st.family) });
    return true;
  }
  if (action === 'setup-count') {
    const g = st.guide;
    const n = Math.max(3, Math.min(setupFamilyInfo(st.family).maxNotes + 1, g.count + parseInt(el.dataset.delta, 10)));
    st.guide = newSetupGuide(st.family, n, g.centre);
    render();
    return true;
  }
  if (action === 'setup-centre') { st.guide = newSetupGuide(st.family, st.guide.count, !st.guide.centre); render(); return true; }
  if (action === 'setup-listen-free') { st.guide = null; st.windGuide = null; return setupAction('setup-listen', el); }
  // Play my notes on an ocarina or flute: which type (one type: straight on),
  // then each fingering shown and checked.
  if (action === 'setup-listen' && st.step === 'how' && SETUP_WIND_TYPES[st.family]) {
    setupGo('windtype');
    return true;
  }
  if (action === 'setup-windtype') {
    const t = SETUP_WIND_TYPES[st.family]?.[parseInt(el.dataset.i, 10)];
    if (!t) return true;
    if (!t.group) { el.dataset.holes = String(t.holes); return setupAction('setup-own-wind', el); }
    st.windGuide = newWindGuide(t.group);
    st.history.push(st.step); st.step = 'listen';
    stopListen(); state.listen = null; startListen();
    return true;
  }
  if (action === 'setup-wind-step') {
    const g = st.windGuide;
    const i = parseInt(el.dataset.i, 10);
    if (g && i >= 0 && i <= g.idx) { g.idx = Math.max(1, i); Object.assign(g, { msg: '', tone: '' }); render(); }
    return true;
  }
  if (action === 'setup-wind-skip') {
    const g = st.windGuide;
    if (!g || g.idx === 0) return true;
    g.idx++;
    if (g.idx >= g.seq.length) { st.scaleId = `chart:${g.chartId}/${g.keyId}`; setupGo('done'); stopListen(); return true; }
    Object.assign(g, { msg: '', tone: '' });
    render();
    return true;
  }
  // Play some places of the guided round again (the notes that didn't fit).
  if (action === 'setup-guide-redo' && st.guide) {
    const g = st.guide;
    const places = (el.dataset.places ?? '').split(',').map(Number).filter(i => i >= 0 && i < g.count);
    if (!places.length) return true;
    for (const i of places) { g.notes[i] = null; if (g.raw) g.raw[i] = null; }
    st.tuningCents = tuningOffsetCents((g.raw ?? []).filter(x => x != null));
    Object.assign(g, { active: places[0], msg: '', tone: '' });
    stopListen();
    state.listen = null;
    st.history.push(st.step); st.step = 'listen';
    startListen();
    return true;
  }
  if (action === 'setup-guide-start') {
    st.tuningCents = 0;
    st.guide = newSetupGuide(st.family, st.guide.count, st.guide.centre);
    return setupAction('setup-listen', el);
  }
  if (action === 'setup-listen') {
    stopListen();
    state.listen = null;
    if (st.guide) st.guide = newSetupGuide(st.family, st.guide.count, st.guide.centre);
    if (st.windGuide) st.windGuide = newWindGuide(st.windGuide.group);
    if (st.step !== 'listen') { st.history.push(st.step); st.step = 'listen'; }
    logEvent('setup', { step: 'listen' });
    startListen();
    return true;
  }
  if (action === 'setup-know') { stopListen(); setupGo('know'); return true; }
  if (action === 'setup-heard-done') { stopListen(); setupGo('match'); return true; }
  if (action === 'setup-root') { setupGo('scales', { root: parseInt(el.dataset.pc, 10), showAll: false }); return true; }
  if (action === 'setup-all') { st.showAll = true; render(); return true; }
  if (action === 'setup-not-right') { openListenReport({ then: 'know' }); return true; }
  if (action === 'setup-scale') {
    if (st.step === 'match') listenCheckEvent('right');
    stopListen();
    logEvent('setup', { step: 'scale', how: st.step === 'match' ? 'listened' : 'chose' });
    setupGo('done', { scaleId: el.dataset.id });
    return true;
  }
  if (action === 'setup-use-heard') {
    // The notes as heard, as the instrument's own: the lowest first, the
    // rest up from it. It opens on its own tab, ready to save.
    const fam = st.family;
    let params;
    if (st.guide) {
      // The guided round: every note where it was played, places not heard left empty to set.
      const g = st.guide;
      const ding = g.notes[0] ?? setupGuideHeard(g)[0];
      if (ding == null) return true;
      const rest = g.notes.slice(1).map(m => (m == null ? 'null' : midiToNoteName(m)));
      params = new URLSearchParams({ ding: midiToNoteName(ding), top: rest.join(','), bottom: '', tc: String(rest.length), bc: '0', name: `My ${layoutFamilyInfo(fam).word}`, ...(g.centre ? { centre: '1' } : {}) });
    } else {
      const heard = [...new Set(state.listen?.notes ?? [])].sort((a, b) => a - b).map(midiToNoteName);
      if (heard.length < 2) return true;
      const rest = heard.slice(1, 1 + layoutFamilyInfo(fam).maxNotes);
      params = new URLSearchParams({ ding: heard[0], top: rest.join(','), bottom: '', tc: String(rest.length), bc: '0', name: `My ${layoutFamilyInfo(fam).word}` });
    }
    stopListen();
    logEvent('setup', { step: 'scale', how: 'heard-notes' });
    state.setup = null;
    openLink(parseLink(`/${fam}/custom`, '?' + params));
    state.view = 'editor';
    navPush(stateToHash());
    render();
    return true;
  }
  if (action === 'setup-hear') {
    const s = setupFindTuning(st, el.dataset.id);
    if (s) { initAudio(); playScale(setupScaleNotes(s), () => {}); }
    return true;
  }
  if (action === 'setup-back') {
    stopListen();
    const prev = st.history.pop();
    if (!prev) { goHome(); return true; }
    st.step = prev;
    render();
    return true;
  }
  if (action === 'setup-first-chord' || action === 'setup-save') {
    const s = setupFindTuning(st, st.scaleId);
    if (!s) return true;
    const chord = setupFirstChord(findAllChords(createLayoutFromScale(s)), setupKeyNote(s), { prefer: s.chartId ? 'maj' : 'min' });
    if (s.chartId) {
      // An ocarina or flute: it opens on its Chords tab, the first chord
      // open with its fingerings, and plays it one note at a time.
      const path = linkFor({ chartId: s.chartId, keyId: s.keyId }, { tab: 'chords' });
      state.setup = null;
      openLink(parseLink(path, ''));
      navPush(path);
      if (chord) state.oc.expanded = chord.id;
      render();
      if (action === 'setup-save') { completePendingSave({ action: 'shared-add' }); return true; }
      if (chord) { initAudio(); playSequence(chord.notes, () => {}, 0.55); }
      return true;
    }
    let path = linkFor({ scaleId: s.id }, action === 'setup-first-chord' && chord ? { chord: chord.id } : {});
    // A tongue drum described with or without a round middle note opens drawn that way.
    if (st.family === 'tongue-drum' && st.guide && !!st.guide.centre !== !!s.centre) path += `?centre=${st.guide.centre ? 1 : 0}`;
    state.setup = null;
    const [pathname, search = ''] = path.split('?');
    openLink(parseLink(pathname, search ? `?${search}` : ''));
    navPush(path);
    render();
    if (action === 'setup-save') { completePendingSave({ action: 'save-layout' }); return true; }
    if (chord && state.selectedChord) {
      initAudio();
      playChord(state.selectedChord.notes, note => updatePanPlaying([note]), notes => updatePanPlaying(notes));
    }
    return true;
  }
  return false;
}

// ── Play (docs/free-to-play.md, "2. Guest experience") ─────────────────────
// Where the app opens with nothing saved: pick a family, then a tuning, and
// it opens ready to play through its deep link. Also "Play something else"
// on My instruments.
const PLAY_POPULAR = {
  handpan: ['D-Kurd', 'D-Celtic-Minor', 'F-Low-Pygmy', 'D-Integral', 'D-Hijaz', 'E-Equinox'].map(scaleId => ({ scaleId })),
  'tongue-drum': ['TD-D-Kurd-9', 'TD-D-Amara-9', 'TD-C-Major-Pentatonic-8', 'TD-A-Minor-Pentatonic-8', 'TD-G-Major-Pentatonic-8', 'TD-C-Major-Pentatonic-6'].map(scaleId => ({ scaleId })),
  kalimba: ['KL-C-Major-17', 'KL-C-Major-21', 'KL-C-Major-10', 'KL-C-Major-8', 'KL-G-Alto-15', 'KL-A-Minor-9'].map(scaleId => ({ scaleId })),
  ocarina: ['C-A4', 'G-E4', 'F-D4', 'C-A5', 'G-E5', 'C-A3'].map(keyId => ({ chartId: 'ocarina-12-stl-c', keyId })),
  flute: chartsForFamily('flute').map(c => ({ chartId: c.id, keyId: c.defaultKey ?? c.keys[0].id })),
};

// Home has nothing on it yet: show Play instead.
function homeIsEmpty() {
  return state.instruments.length === 0 && !state.playlists.some(p => p.chords.length) && state.progressions.length === 0;
}

function playRowHtml(target) {
  const path = linkFor(target);
  const link = parseLink(path);
  if (!link) return '';
  const scale = target.scaleId ? findTuning(target.scaleId) : null;
  return uiRow({
    lead: FAMILY_ICONS[link.family], title: linkTitle(link).replace(/ handpan$/, ''),
    meta: scale ? scale.desc ?? '' : '', chevron: true, action: 'open-link', data: { path },
  });
}

function viewPlay() {
  const fam = state.playFamily ?? 'handpan';
  const n = state.playNotice;
  const notice = n ? `
    <div class="card play-notice" role="status">
      <div class="tip-title">We couldn't find “${escHtml(n.slug)}”</div>
      <div class="tip-body">Is it one of these?</div>
      <div class="list">${n.closest.map(p => { const l = parseLink(p); return uiRow({ lead: FAMILY_ICONS[l.family], title: linkTitle(l), chevron: true, action: 'open-link', data: { path: p } }); }).join('')}</div>
    </div>` : '';
  const popular = new Set(PLAY_POPULAR[fam]?.map(t => t.scaleId));
  const more = fam === 'handpan'
    ? uiRow({ lead: 'search', title: `All ${SCALES.length} scales`, meta: 'Every scale, by notes and name', chevron: true, action: 'other-instrument' })
      + uiRow({ lead: 'pencil', title: 'Your own notes', meta: 'Set the notes of your handpan', chevron: true, action: 'play-custom-handpan' })
    : isLayoutFamily(fam)
    ? LAYOUT_FAMILIES[fam].tunings.filter(t => !popular.has(t.id)).map(t => playRowHtml({ scaleId: t.id })).join('')
      + uiRow({ lead: 'pencil', title: 'Your own notes', meta: `Set the notes of your ${LAYOUT_FAMILIES[fam].word}`, chevron: true, action: 'play-custom-handpan', data: { family: fam } })
    : uiRow({ lead: 'plus', title: fam === 'ocarina' ? 'Other keys, or your own ocarina' : 'Other keys, or your own flute', meta: fam === 'ocarina' ? 'Every key, ocarinas you made, building one from a scale' : 'Every key, and flutes you made', chevron: true, action: 'add-instrument' });
  // Back goes to the start screen (My instruments, or the setup when nothing
  // is saved), not to the instrument that was being tried.
  const bar = uiAppBar({ title: 'Play something else', back: { action: 'back-home', label: 'My instruments' }, actions: [tunerAppBtn(), settingsAppBtn()] });
  return `
    ${bar}
    <div class="play">
      ${homeIsEmpty() ? `<div class="brand-about play-brand">${brandLogo()}<span class="brand-about-line">Notes, chords and scales for handpan, tongue drum, kalimba, ocarina and flute. Free, no sign-up to play.</span></div>` : ''}
      ${installBannerHtml()}
      ${notice}
      ${uiSeg(INSTRUMENT_FAMILIES.map(f => ({ value: f.id, label: escHtml(f.name) })), fam, { action: 'play-family', label: 'Instrument' })}
      <h2 class="list-title">Popular</h2>
      <div class="list">${PLAY_POPULAR[fam].map(playRowHtml).join('')}</div>
      <div class="list">${more}</div>
    </div>`;
}

function viewHome() {
  const insts = state.instruments;
  const playlists = state.playlists.map(pl => {
    const n = pl.chords.length;
    const where = new Set(pl.chords.map(c => c.instrumentId || c.layoutId)).size;
    return uiRow({
      lead: 'list-music', title: pl.name, chevron: true, action: 'open-playlist', data: { id: pl.id },
      meta: `${n} chord${n !== 1 ? 's' : ''}${n ? ` · ${where} instrument${where !== 1 ? 's' : ''}` : ''}`,
      trail: n ? uiIconBtn('play', `Play ${pl.name}`, { action: 'open-playlist-chords', data: { id: pl.id } }) : '',
    });
  }).join('');
  // A guest's instruments are this visit's only (§2): say so, and offer Save.
  const tip = !accountOn() && visitHasWork() ? `
    <div class="card tip-card">
      <div class="tip-text"><div class="tip-title">Not saved yet</div><div class="tip-body">What you set up here is gone when you close this page. Saving is free.</div></div>
      <button type="button" class="btn btn-primary btn-sm" data-action="visit-save">Save</button>
    </div>` : '';

  return `
    ${uiAppBar({ title: 'My instruments', actions: [tunerAppBtn(), settingsAppBtn()] })}
    <div class="home">
      <section class="home-main" aria-label="Instruments">
        ${installBannerHtml()}
        ${insts.length === 0
          ? uiEmpty({
            icon: 'family-handpan', title: 'Add the instruments you play',
            body: 'Handpans and tongue drums by scale, ocarinas and flutes.',
            action: `<button type="button" class="btn btn-primary btn-lg" data-action="add-instrument">${icon('plus')} Add instrument</button>`,
          })
          : `<div class="list home-instruments">${insts.map(instrumentRowHtml).join('')}</div>
             <button type="button" class="btn btn-secondary btn-block home-add" data-action="add-instrument">${icon('plus')} Add instrument</button>`}
        <div class="list home-try">
          ${uiRow({ lead: 'search', title: 'Play something else', meta: 'Any handpan, tongue drum, kalimba, ocarina or flute, without saving it', chevron: true, action: 'open-play' })}
        </div>
      </section>
      <section class="home-side" aria-label="Playlists">
        ${state.playlists.length ? `<h2 class="list-title">Playlists</h2><div class="list">${playlists}</div>` : ''}
        ${state.progressions.length ? `<h2 class="list-title">Progressions</h2><div class="list">${progressionRowsHtml(null, { home: true })}</div>` : ''}
        ${tip}
      </section>
    </div>`;
}

// ⋯ menu of an instrument row on Home: Edit, Share… and Remove, the same for every instrument.
function rowMenuSheet(id) {
  const inst = getInstrument(id);
  if (!inst) return '';
  const rows = [];
  rows.push(uiRow({ lead: 'pencil', title: 'Edit instrument', meta: instEditMeta(inst), action: 'inst-edit-open', data: { id: inst.id } }));
  rows.push(uiRow({ lead: 'share-2', title: 'Share…', meta: 'Code, link and QR code', action: 'share-instrument', data: { id: inst.id } }));
  rows.push(uiRow({ lead: 'trash-2', title: 'Remove instrument', action: 'delete-instrument', data: { id: inst.id }, cls: 'is-danger' }));
  return uiSheet({ key: 'row-menu', variant: 'rowmenu', title: inst.name, close: 'menu-close', body: `<div class="list">${rows.join('')}</div>` });
}

// ── Add-instrument wizard ────────────────────────────────────────────────────
// First run asks which families the user plays, then walks through one step
// per ticked family. Instruments added on the way are toasted on Home.
function newWizard(firstRun) {
  return {
    firstRun,
    step: 'families',
    families: [],
    queue: [],
    history: [],       // steps behind this one, for Back
    added: [],         // [{ id, name }] added in this wizard
    notice: null,      // "D Kurd added." on the step after adding it
    search: '',
    noteFilter: 'all',
    oc: { path: null, scaleId: 'D-Kurd', transpose: 0, includeGu: true, chambers: null, windowStart: null, name: '', holeCount: 12, chartId: 'custom', keyId: null, detect: null },
    fl: { chartId: chartsForFamily('flute')[0]?.id ?? null, keyId: null, name: '', holeCount: 6, detect: null },
  };
}

function wizardNext() {
  const w = state.wizard;
  const next = w.queue.shift();
  w.notice = null;
  if (next) { w.history.push(w.step); w.step = next; render(); return; }
  setOnboarded();
  state.wizard = null;
  refreshInstruments();
  state.view = 'home';
  navReplace('/');
  render();
  if (w.added.length) {
    const names = w.added.map(a => a.name);
    const msg = `${names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]} added`;
    const only = w.added.length === 1 ? w.added[0] : null;
    showToast(msg, only ? { action: { label: 'Open', run: () => { if (openInstrument(only.id)) render(); } } } : {});
  }
}

// An instrument was added: remember it for Home, say so on the next step.
function wizardAdded(id, name) {
  const w = state.wizard;
  w.added.push({ id, name });
  wizardNext();
  if (state.wizard) state.wizard.notice = `${name} added.`;
  render();
}

// Notes for the ocarina being designed in the wizard, with the chamber and
// note-window choice applied.
function wizardOcarinaPlan() { return planOcarina(state.wizard.oc); }

// Notes of a scale-built ocarina from its design choices: scale, transpose,
// gu notes, chamber count (with the note window when fewer chambers than
// the full scale needs) and single notes switched off.
function planOcarina(oc) {
  const scale = findTuning(oc.scaleId);
  const all = scaleToMidis(scale, { transpose: oc.transpose, includeGu: oc.includeGu });
  const needed = chambersNeeded(all);
  const chambers = Math.min(oc.chambers ?? needed, needed);
  let windows = [];
  let notes = all;
  if (chambers < needed) {
    windows = noteWindows(all, chambers);
    const ding = noteToMidi(scale.top.ding) + oc.transpose;
    const chosen = windows.find(win => win.start === oc.windowStart)
      ?? windows.find(win => win.start === ding)
      ?? windows[0];
    notes = chosen.notes;
    windows = windows.map(win => ({ ...win, chosen: win === chosen, fromDing: win.start === ding }));
  }
  const excluded = oc.excluded ?? [];
  const kept = notes.filter(m => !excluded.includes(m));
  if (kept.length >= 2) notes = kept;
  return { scale, all, needed, chambers, windows, notes, excluded };
}

// The wizard's frame: step count, question, content and the action bar.
// bar = { left: markup, right: markup, help: text above the bar }.
function wizardFrame(w, { title, sub = '', body, bar }) {
  const order = INSTRUMENT_FAMILIES.map(f => f.id).filter(f => w.families.includes(f));
  const total = 1 + order.length;
  const at = w.step === 'families' ? 1 : order.indexOf(w.step) + 2;
  const header = w.firstRun
    ? uiAppBar({ title: 'Welcome' })
    : uiAppBar({ title: 'Add instrument', back: { action: 'back-home', label: 'My instruments' } });
  return stepFrame({ header, hero: w.firstRun && at === 1, notice: w.notice, count: `Step ${Math.max(1, at)} of ${Math.max(total, at)}`, title, sub, body, bar });
}

// A step of a guided flow (the add-instrument wizard, the beginner setup):
// app bar, optional brand hero and notice, "Step n of m", title, text, the
// step's content and the action bar. bar = { left, right, help }.
function stepFrame({ header, hero = false, notice = '', count = '', title, sub = '', body, bar = {} }) {
  // The quiet hero (artwork, then the logo), docs/design-system.md "Brand".
  const heroHtml = hero ? `
      <div class="brand-hero">
        <img class="brand-hero-art" src="/brand/hero-wide-800.webp" srcset="/brand/hero-wide-800.webp 800w, /brand/hero-wide.webp 1600w"
          sizes="(min-width: 640px) 640px, 100vw" width="800" height="450" alt="">
        ${brandLogo()}
        <p class="brand-hero-line">Notes, chords and scales for handpan, tongue drum, kalimba, ocarina and flute.</p>
      </div>` : '';
  const hasBar = bar.left || bar.right || bar.help;
  return `${header}
    <div class="wizard">
      ${heroHtml}
      ${notice ? `<p class="wizard-notice">${icon('check')} ${escHtml(notice)}</p>` : ''}
      ${count ? `<div class="wizard-count">${escHtml(count)}</div>` : ''}
      <h2 class="wizard-title">${escHtml(title)}</h2>
      ${sub ? `<p class="wizard-sub">${sub}</p>` : ''}
      ${body}
      ${hasBar ? `<div class="actionbar">
        ${bar.help ? `<div class="actionbar-help">${escHtml(bar.help)}</div>` : ''}
        <div class="actionbar-start">${bar.left ?? ''}</div>
        <div class="actionbar-end">${bar.right ?? ''}</div>
      </div>` : ''}
    </div>`;
}

const WIZARD_BACK = '<button type="button" class="btn btn-ghost" data-action="wizard-back">Back</button>';
const WIZARD_SKIP = '<button type="button" class="btn btn-secondary" data-action="wizard-skip-step">Skip</button>';

function viewWizard() {
  const w = state.wizard;
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);

  if (w.step === 'families') {
    const meta = {
      handpan: 'Pick yours by scale',
      ocarina: 'Bought, or one you\'re making',
      flute: 'Tin whistle or Native American flute',
    };
    // The old multi-family step (unused since the beginner setup): the families with a wizard step.
    const tiles = INSTRUMENT_FAMILIES.filter(f => !isLayoutFamily(f.id) || f.id === 'handpan').map(f => {
      const unavailable = f.id === 'flute' && chartsForFamily('flute').length === 0;
      const on = w.families.includes(f.id);
      return `
        <button type="button" class="row family-tile${on ? ' is-on' : ''}${unavailable ? ' is-disabled' : ''}" role="checkbox"
          aria-checked="${on ? 'true' : 'false'}" data-action="wizard-family" data-family="${f.id}"
          ${unavailable ? 'disabled title="Flute fingering charts are still being sourced"' : ''}>
          <span class="row-lead tile">${icon(FAMILY_ICONS[f.id])}</span>
          <span class="row-text"><span class="row-title">${escHtml(f.name)}</span><span class="row-meta">${unavailable ? 'Coming soon' : meta[f.id]}</span></span>
          <span class="row-trail">${unavailable ? uiBadge('Soon') : `<span class="checkbox" aria-hidden="true">${on ? icon('check') : ''}</span>`}</span>
        </button>`;
    }).join('');
    return wizardFrame(w, {
      title: 'Which instruments do you play?',
      sub: 'Pick all that apply. You can add more later.',
      body: `<div class="list">${tiles}</div>`,
      bar: {
        help: w.families.length ? '' : 'Tick at least one',
        left: w.firstRun ? '<button type="button" class="btn btn-ghost" data-action="wizard-skip">Just browse scales</button>' : '',
        right: `<button type="button" class="btn btn-primary btn-lg" data-action="wizard-families-next" ${w.families.length ? '' : 'disabled'}>Next ${icon('chevron-right')}</button>`,
      },
    });
  }

  if (w.step === 'handpan') {
    const list = filterScales(w.search, w.noteFilter, { inDesc: false });
    return wizardFrame(w, {
      title: 'Which handpan do you have?',
      body: `
        ${scaleToolsHtml({ inputId: 'wizard-search-input', value: w.search, placeholder: 'Search scales…', count: w.noteFilter, action: 'wizard-filter-notes' })}
        ${listenPanelHtml('wizard')}
        ${listenHasNotes('wizard') ? listenMatchesHtml(list, 'wizard-pick-handpan')
          : list.length === 0 ? uiEmpty({ icon: 'search', title: 'No scales match your search' })
          : scaleGroupsHtml(list, sc => uiRow({
            title: sc.name, chevron: true, action: 'wizard-pick-handpan', data: { id: sc.id },
            meta: `${1 + sc.top.notes.length + sc.bottom.notes.length} notes · ${escHtml(displayNote(sc.top.ding, uf, us))} ding`,
          }))}
        <p class="wizard-foot">Custom layout? Add it later from “Try another scale” → Pan → Clone &amp; Customize.</p>`,
      bar: { left: w.history.length ? WIZARD_BACK : '', right: WIZARD_SKIP },
    });
  }

  if (w.step === 'ocarina') {
    const oc = w.oc;
    // Making a clay ocarina is for builders only (canBuild): everyone else
    // goes straight to "I have one".
    if (!oc.path && !canBuild()) oc.path = 'have';
    if (!oc.path) {
      return wizardFrame(w, {
        title: 'Add an ocarina',
        body: `<div class="list wizard-paths">
          ${uiRow({ lead: 'family-ocarina', title: 'I have one', meta: 'A bought ocarina. You\'ll chart it with the tuner, so the maker doesn\'t matter.', chevron: true, action: 'wizard-oc-path', data: { path: 'have' } })}
          ${uiRow({ lead: 'hammer', title: 'I\'m making one', meta: 'A clay ocarina tuned to a handpan scale.', chevron: true, action: 'wizard-oc-path', data: { path: 'make' } })}
        </div>`,
        bar: { left: w.history.length ? WIZARD_BACK : '', right: WIZARD_SKIP },
      });
    }
    const back = canBuild() ? '<button type="button" class="btn btn-ghost" data-action="wizard-oc-path" data-path="">Back</button>' : (w.history.length ? WIZARD_BACK : '');
    if (oc.path === 'have') {
      const chart = oc.chartId !== 'custom' ? getChart(oc.chartId) : null;
      return wizardFrame(w, {
        title: 'Your ocarina',
        body: `<div class="wizard-form">
          ${uiField({ label: 'Name', id: 'wizard-oc-name', control: `<input class="input" id="wizard-oc-name" value="${escHtml(oc.name)}" placeholder="My ocarina">` })}
          ${chartsForFamily('ocarina').length ? uiField({ label: 'Type', id: 'wizard-oc-chart', control: `
            <select class="select" id="wizard-oc-chart" data-action="wizard-chart" data-fam="oc">
              <option value="custom" ${oc.chartId === 'custom' ? 'selected' : ''}>Unknown or other: chart it with the tuner</option>
              ${chartsForFamily('ocarina').map(c => `<option value="${c.id}" ${oc.chartId === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}
            </select>` }) : ''}
          ${chart ? (chart.tonicOffset != null ? wizardOcKeyHtml(chart, oc) : wizardKeySelect('oc', chart, oc.keyId)) : uiField({
            label: 'Holes, thumb holes included',
            control: uiStepper({ value: oc.holeCount, label: 'Holes', action: 'wizard-oc-holes-step', min: oc.holeCount <= 4, max: oc.holeCount >= 13 }),
            help: 'Its chart is worked out from the instrument: you blow it into the tuner with all holes closed, then with each hole open on its own.',
          })}
        </div>`,
        bar: { left: back, right: '<button type="button" class="btn btn-primary btn-lg" data-action="wizard-oc-create">Add ocarina</button>' },
      });
    }
    const plan = wizardOcarinaPlan();
    const hasGu = plan.scale.bottom.notes.length > 0;
    const holes = plan.notes.length - plan.chambers;
    let preview = '';
    try {
      const draft = createScaleOcarina({ scaleId: oc.scaleId, transpose: oc.transpose, includeGu: oc.includeGu, notes: plan.notes, name: 'Preview' });
      preview = `<div class="wizard-preview" aria-hidden="true">${renderFingering(draft, draft.chambers[0].notes[0], { size: 'medium', useFlats: uf, useSolfege: us })}</div>`;
    } catch { /* the preview is optional */ }
    return wizardFrame(w, {
      title: 'Design an ocarina',
      body: `<div class="wizard-design">
        <div class="wizard-form">
          ${uiField({ label: 'Handpan scale', id: 'wizard-oc-scale', control: uiPicker({
            id: 'wizard-oc-scale', value: oc.scaleId, label: 'Handpan scale', options: scalePickerOptions(), action: 'wizard-oc-scale',
          }) })}
          <div class="list">
            ${uiSetRow({ label: 'Transpose', control: uiStepper({
              value: oc.transpose > 0 ? '+' + oc.transpose : String(oc.transpose), label: 'Transpose', action: 'wizard-oc-transpose-step',
              min: oc.transpose <= -6, max: oc.transpose >= 6, help: 'semitones',
            }) })}
            ${hasGu ? uiSwitchRow({ label: 'Gu notes', help: 'Include the bottom-shell notes', on: oc.includeGu, action: 'wizard-oc-gu-toggle' }) : ''}
          </div>
          <div class="field">
            <div class="field-label">Chambers</div>
            <p class="wizard-sub">The full scale needs ${plan.needed} chamber${plan.needed !== 1 ? 's' : ''}.</p>
            ${uiSeg(Array.from({ length: plan.needed }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })), String(plan.chambers), { action: 'wizard-oc-chambers', key: 'n', label: 'Chambers' })}
          </div>
          ${plan.windows.length ? `
            <div class="field">
              <div class="field-label">Which notes?</div>
              <p class="wizard-sub">${plan.chambers === 1 ? 'One chamber holds' : `${plan.chambers} chambers hold`} ${plan.notes.length}.</p>
              ${noteStripHtml(plan, nn, { win: start => `data-action="wizard-oc-window" data-start="${start}"` })}
            </div>` : `<div class="chips note-strip">${plan.notes.map(m => `<span class="chip is-selected">${nn(m)}</span>`).join('')}</div>`}
          <p class="wizard-summary">${plan.notes.length} notes · ${holes} hole${holes !== 1 ? 's' : ''} · ${plan.chambers} chamber${plan.chambers !== 1 ? 's' : ''}</p>
          ${uiField({ label: 'Name', id: 'wizard-oc-name', control: `<input class="input" id="wizard-oc-name" value="${escHtml(oc.name)}" placeholder="${escHtml(plan.scale.name)} ocarina">` })}
        </div>
        ${preview}
      </div>`,
      bar: { left: back, right: '<button type="button" class="btn btn-primary btn-lg" data-action="wizard-oc-create">Start building</button>' },
    });
  }

  if (w.step === 'flute') {
    const fl = w.fl;
    const charts = chartsForFamily('flute');
    const custom = fl.chartId === 'custom';
    const chart = custom ? null : getChart(fl.chartId) ?? charts[0];
    const placeholder = custom ? 'My flute' : chart ? wizardFluteName(chart, fl.keyId) : 'My flute';
    return wizardFrame(w, {
      title: 'Your flute',
      sub: 'A Native American flute in a key not listed: pick an “any key” type and set its key. Another flute, or not sure what it is? Pick “Other flute: record its notes” and blow each fingering into the tuner.',
      body: `<div class="wizard-form">
        ${uiField({ label: 'Name', id: 'wizard-fl-name', control: `<input class="input" id="wizard-fl-name" value="${escHtml(fl.name)}" placeholder="${escHtml(placeholder)}">` })}
        ${uiField({ label: 'Type', id: 'wizard-fl-chart', control: `
          <select class="select" id="wizard-fl-chart" data-action="wizard-chart" data-fam="fl">
            ${charts.map(c => `<option value="${c.id}" ${chart?.id === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}
            <option value="custom" ${custom ? 'selected' : ''}>Other flute: record its notes</option>
          </select>` })}
        ${custom ? uiField({
          label: 'Finger holes',
          control: uiStepper({ value: fl.holeCount, label: 'Finger holes', action: 'wizard-fl-holes-step', min: fl.holeCount <= 3, max: fl.holeCount >= 8 }),
          help: 'Its chart comes from the flute itself: on Set up you blow it into the tuner with all holes closed, then lift the holes one at a time from the bottom.',
        }) : chart?.octaves ? wizardFluteKeyHtml(chart, fl) : chart ? wizardKeySelect('fl', chart, fl.keyId) : ''}
      </div>`,
      bar: {
        left: w.history.length ? WIZARD_BACK : '',
        right: `<button type="button" class="btn btn-ghost" data-action="wizard-skip-step">Skip</button>
          <button type="button" class="btn btn-primary btn-lg" data-action="wizard-fl-create" ${chart || custom ? '' : 'disabled'}>Add flute</button>`,
      },
    });
  }
  return wizardFrame(w, { title: '', body: '', bar: {} });
}

// Name a flute from a chart gets unless the user types one: any-key charts
// say the key in the user's note spelling ("… in Bb (Bb3)").
function wizardFluteName(chart, keyId) {
  const key = chart.keys.find(k => k.id === (keyId ?? chartDefaultKey(chart))) ?? chart.keys[0];
  if (!chart.octaves) return chart.keys.length > 1 ? `${chart.name} (${key.lowest})` : chart.name;
  const uf = state.useFlats, us = state.useSolfege;
  return `${chart.shortName ?? chart.name} in ${displayNote(key.root, uf, us)} (${displayNote(key.lowest, uf, us)})`;
}

const FLUTE_OCTAVE_NAMES = { 3: 'Low', 4: 'Mid', 5: 'High' };

// Key and octave of an any-key flute chart: a Key select (12 roots in the
// user's spelling), Low · Mid · High, and Detect with tuner.
function wizardFluteKeyHtml(chart, fl) {
  const uf = state.useFlats, us = state.useSolfege;
  const key = chart.keys.find(k => k.id === (fl.keyId ?? chartDefaultKey(chart))) ?? chart.keys[0];
  const d = fl.detect;
  return `
    <div class="fl-key">
      ${uiField({
        label: 'Key', id: 'wizard-fl-root',
        control: uiPicker({
          id: 'wizard-fl-root', value: key.root, label: 'Key', action: 'wizard-fl-root',
          options: CHART_ROOTS.map(r => ({ value: r, label: displayNote(r, uf, us), keywords: noteSearchWords(r) })),
        }),
      })}
      <div class="field">
        <div class="field-label" id="wizard-fl-octave-label">Octave</div>
        ${uiSeg(chart.octaves.map(o => ({ value: String(o), label: FLUTE_OCTAVE_NAMES[o] ?? String(o) })), String(key.octave), { action: 'wizard-fl-octave', key: 'octave', label: 'Octave' })}
      </div>
    </div>
    ${chartDetectHtml('fl', d, 'Cover all holes and blow a steady note')}
    <p class="field-help">All holes closed sounds ${escHtml(displayNote(key.lowest, uf, us))}. Not sure which octave? Detect it, or check with the tuner.</p>
    ${chart.sourceName ? `<p class="field-help">Chart: ${escHtml(chart.sourceName)}</p>` : ''}`;
}

// Detect with tuner: the first steady reading sets the key (and octave) of
// the wizard's flute ('fl') or ocarina ('oc') chart. The tuner is turned on
// if it is off, and off again afterwards if the detection turned it on.
let _flDetectTimer = null;
let _chartDetecting = null; // { fam, t }: the target listening, kept if the wizard closes
function wizardChartTarget(fam) {
  return (fam === 'oc' ? state.wizard?.oc : state.wizard?.fl) ?? (_chartDetecting?.fam === fam ? _chartDetecting.t : null);
}
function startFluteDetect(fam = 'fl') {
  const t = wizardChartTarget(fam);
  if (!t) return;
  clearTimeout(_flDetectTimer);
  t.detect = { listening: true, startedTuner: !state.tuner.on || !!state.tuner.error };
  _chartDetecting = { fam, t };
  _flDetectTimer = setTimeout(() => {
    if (!wizardChartTarget(fam)?.detect?.listening) return;
    stopFluteDetect({ error: 'No steady note: blow a little longer' }, fam);
  }, 10000);
  if (t.detect.startedTuner) {
    if (state.tuner.error) { if (_tunerStop) { _tunerStop(); _tunerStop = null; } state.tuner.on = false; }
    toggleTuner().then(() => {
      if (state.tuner.error && wizardChartTarget(fam)?.detect?.listening) stopFluteDetect({ error: state.tuner.error }, fam);
    });
    return;
  }
  render();
}

// Ends a detection with a result or an error; turns the tuner off again
// if the detection turned it on.
function stopFluteDetect(result, fam = 'fl') {
  clearTimeout(_flDetectTimer);
  const t = wizardChartTarget(fam);
  if (!t?.detect) return;
  const startedTuner = t.detect.startedTuner;
  t.detect = result;
  if (_chartDetecting?.t === t) _chartDetecting = null;
  if (startedTuner && state.tuner.on && !state.tuner.error) { toggleTuner(); return; }
  render();
}

// The wizard step a chart detection belongs to is still on screen.
function chartDetectOnScreen(fam) {
  const w = state.wizard;
  return state.view === 'wizard' && !!w && (fam === 'oc' ? w.step === 'ocarina' && w.oc.path === 'have' : w.step === 'flute');
}

function onFluteDetectReading(hz, fam = 'fl') {
  if (fam === 'oc') { onOcarinaDetectReading(hz); return; }
  const fl = state.wizard.fl;
  const chart = getChart(fl.chartId);
  if (!chart?.octaves) { stopFluteDetect(null); return; }
  const r = detectChartKey(hz, { octaves: chart.octaves });
  fl.keyId = chartKeyFor(chart, r.root, r.octave).id;
  const uf = state.useFlats, us = state.useSolfege;
  const heard = displayNote(r.root + r.heardOctave, uf, us);
  const off = r.cents === 0 ? 'in tune' : `${Math.abs(r.cents)} ¢ ${r.cents > 0 ? 'sharp' : 'flat'}`;
  const oct = FLUTE_OCTAVE_NAMES[r.octave] ?? String(r.octave);
  let text = `Heard ${heard}, ${off}: key ${displayNote(r.root, uf, us)}, ${oct}`;
  if (r.outOfRange) text += ` (the nearest octave offered; your flute sounds ${r.heardOctave < r.octave ? 'lower' : 'higher'})`;
  stopFluteDetect({ text, warn: Math.abs(r.cents) > 30 ? 'This flute may not be tuned to A=440' : '' });
}

// Ocarina from a transposing chart: the note heard with every hole closed is
// the chart's lowest note, which sets the key.
function onOcarinaDetectReading(hz) {
  const oc = state.wizard.oc;
  const r = detectLowestKey(getChart(oc.chartId), hz);
  if (!r) { stopFluteDetect(null, 'oc'); return; }
  oc.keyId = r.key.id;
  const uf = state.useFlats, us = state.useSolfege;
  const heard = displayNote(r.root + r.heardOctave, uf, us);
  const off = r.cents === 0 ? 'in tune' : `${Math.abs(r.cents)} ¢ ${r.cents > 0 ? 'sharp' : 'flat'}`;
  let text = `Heard ${heard}, ${off}: key ${ocKeyLabel(r.key)}`;
  if (r.outOfRange) text += ` (the nearest octave offered; your ocarina sounds ${r.heardOctave < r.octave ? 'lower' : 'higher'})`;
  stopFluteDetect({ text, warn: Math.abs(r.cents) > 30 ? 'This ocarina may not be tuned to A=440' : '' }, 'oc');
}

// Group of a transposing chart's key in the Key picker: the octave of its
// lowest note, in the user's spelling ("Lowest note C4–B4").
function ocKeyOctaveName(key) {
  const o = parseInt(key.lowest.replace(/^\D+/, ''), 10);
  const uf = state.useFlats, us = state.useSolfege;
  return `Lowest note ${displayNote('C' + o, uf, us)}–${displayNote('B' + o, uf, us)}`;
}

// "G (lowest E4)" in the user's note spelling.
function ocKeyLabel(key) {
  const uf = state.useFlats, us = state.useSolfege;
  return `${displayNote(key.root, uf, us)} (lowest ${displayNote(key.lowest, uf, us)})`;
}

// Detect with tuner: the button and its status line.
function chartDetectHtml(fam, d, listeningText) {
  const status = !d ? ''
    : d.listening ? `<span>${icon('mic')} ${escHtml(listeningText)}</span>`
    : d.error ? `<span class="is-warning">${escHtml(d.error)}</span>`
    : `<span>${escHtml(d.text)}</span>${d.warn ? `<br><span class="is-warning">${escHtml(d.warn)}</span>` : ''}`;
  return `
    <div class="fl-detect">
      <button type="button" class="btn btn-secondary btn-sm" data-action="wizard-${fam}-detect" aria-pressed="${d?.listening ? 'true' : 'false'}">
        ${icon('mic')} ${d?.listening ? 'Listening…' : 'Detect with tuner'}</button>
      <div class="fl-detect-status field-help" aria-live="polite">${status}</div>
    </div>`;
}

// Key of a transposing ocarina chart (the 12-hole C chart in any key): a Key
// select named by tonic and lowest note, and Detect with tuner.
function wizardOcKeyHtml(chart, oc) {
  const key = chart.keys.find(k => k.id === (oc.keyId ?? chartDefaultKey(chart))) ?? chart.keys[0];
  return `
    ${uiField({
      label: 'Key', id: 'wizard-oc-key',
      control: uiPicker({
        id: 'wizard-oc-key', value: key.id, label: 'Key', action: 'wizard-key', data: { fam: 'oc' },
        options: chart.keys.map(k => ({
          value: k.id, label: ocKeyLabel(k), group: ocKeyOctaveName(k),
          keywords: [...noteSearchWords(k.root), ...noteSearchWords(k.lowest)],
        })),
      }),
      help: key.root === chart.writtenKey ? `The published chart is for ${escHtml(chart.writtenKey)}.`
        : `Same fingerings as the ${escHtml(chart.writtenKey)} chart, shifted to this key.`,
    })}
    ${chartDetectHtml('oc', oc.detect, 'Cover every hole, sub-holes too, and blow a steady note')}
    <p class="field-help">Not sure of the key? Detect it: every hole closed sounds the lowest note, ${escHtml(displayNote(key.lowest, state.useFlats, state.useSolfege))} in this key.</p>
    ${chart.sourceName ? `<p class="field-help">Chart: ${escHtml(chart.sourceName)}</p>` : ''}`;
}

function wizardKeySelect(fam, chart, keyId) {
  return uiField({
    label: 'Key', id: `wizard-${fam}-key`,
    control: `
      <select class="select" id="wizard-${fam}-key" data-action="wizard-key" data-fam="${fam}">
        ${chart.keys.map(k => `<option value="${k.id}" ${(keyId ?? chartDefaultKey(chart)) === k.id ? 'selected' : ''}>${escHtml(k.name)}</option>`).join('')}
      </select>`,
    help: chart.sourceName ? `Chart: ${escHtml(chart.sourceName)}` : '',
  });
}

// Pitch classes of a scale from data.js, for the Notes and Chords filter.
function scalePitchClasses(scaleId) {
  const scale = findTuning(scaleId);
  if (!scale) return null;
  return new Set(scaleToMidis(scale).map(m => ((m % 12) + 12) % 12));
}

// Tabs of an ocarina or flute: [id, label, icon]. Notes, Chords and
// Playlists need a playable chart; a shared instrument is read-only.
function ocTabs(inst) {
  const tabs = [];
  const playable = playableMidis(inst).length > 0;
  if (playable) tabs.push(['notes', 'Notes', 'layout-grid'], ['chords', 'Chords', 'music']);
  // Playlists on every instrument, saved or opened from a link (as on a
  // handpan); not on someone's instrument shared by code, which is read-only.
  if (playable && (inst.id !== SHARED_ID || inst.link)) tabs.push(['playlists', 'Playlists', 'list-music']);
  if (inst.id === SHARED_ID) return tabs;
  if (inst.kind === 'scale' && canBuild()) tabs.push(['builder', 'Build', 'hammer']);
  if (inst.kind === 'custom' || inst.kind === 'traditional') tabs.push(['setup', 'Set up', 'wrench']);
  return tabs;
}

// An instrument being tried, not in My instruments: the same banner on every
// instrument (a handpan scale or custom notes, an ocarina or flute opened
// from a link), with its Save.
function notSavedBannerHtml(action) {
  // visit-save: a guest's own instrument, built in this visit (§2).
  const text = action === 'visit-save' ? 'Not saved · gone when you close this page' : 'Not saved · try it, then keep it in My instruments';
  return `
      <div class="banner">
        <span>${text}</span>
        <button type="button" class="btn btn-primary btn-sm" data-action="${action}">Save</button>
      </div>`;
}

// App bar of an ocarina or flute, with its tabs (none in practice mode).
function ocHeader(inst, view, { practice = false } = {}) {
  const shared = inst.id === SHARED_ID;
  const tabs = practice ? '' : uiTabBar(ocTabs(inst).map(([id, label, ic]) => ({ id, label, icon: ic, action: 'oc-tab', data: { tab: id } })), view);
  return `
    ${uiAppBar({
      switcher: inst.link ? { name: inst.name, action: 'open-play', data: { family: inst.family }, title: inst.family === 'flute' ? 'Other flutes' : 'Other ocarinas' } : { name: inst.name, action: 'back-home', title: 'My instruments' },
      badge: inst.link ? uiBadge('Not saved') : shared ? uiBadge(inst.publicId) : '',
      actions: [tunerAppBtn(), menuAppBtn()],
      tabs,
    })}
    ${inst.link && !practice ? notSavedBannerHtml('shared-add') : !shared && !practice && !accountOn() ? notSavedBannerHtml('visit-save') : shared && !inst.link ? `
      <div class="banner">
        <span>Shared instrument ${escHtml(inst.publicId)} · read-only</span>
        <button type="button" class="btn btn-primary btn-sm" data-action="shared-add">${icon('plus')} Add to My instruments</button>
      </div>` : ''}`;
}

// Tabs of a handpan: Chords and Pan are the existing chords and editor views.
function handpanTabs(current) {
  return uiTabBar([
    { id: 'chords', label: 'Chords', icon: 'music', action: 'go-chords' },
    { id: 'editor', label: layoutFamilyInfo(layoutInstrument(state.layout)).tab, icon: 'circle-dot', action: 'back-editor' },
    { id: 'playlists', label: 'Playlists', icon: 'list-music', action: 'hp-playlists' },
  ], current);
}

// The Playlists tab: the user's playlists, with how many of each one's
// chords belong to this instrument. A row opens the playlist; on a handpan
// Play opens it in Chords and auto-plays it, on an ocarina Practice starts.
function playlistsTabHtml(inst) {
  return `
    <section class="pl-section" aria-labelledby="pl-sec-playlists">
      <h2 class="list-title" id="pl-sec-playlists">Playlists</h2>
      ${playlistsListHtml(inst)}
    </section>
    <section class="pl-section" aria-labelledby="pl-sec-progressions">
      <h2 class="list-title" id="pl-sec-progressions">Progressions</h2>
      ${state.progressions.length
        ? `<div class="list">${progressionRowsHtml(inst)}</div>`
        : '<p class="pl-section-hint">Chords in order, and the same chord as often as you like (Am – Dm – Am). Start one here, from any chord\'s ♡, or copy a playlist.</p>'}
      <div class="pl-new-row">
        <button type="button" class="btn btn-ghost pl-new" data-action="prog-new-open">${icon('plus')} New progression</button>
        <button type="button" class="btn btn-ghost pl-new" data-action="cs-open">${icon('clipboard-paste')} Paste a chord sheet</button>
      </div>
    </section>`;
}

function playlistsListHtml(inst) {
  const newBtn = `<button type="button" class="btn btn-ghost pl-new" data-action="pl-new-open">${icon('plus')} New playlist</button>`;
  if (state.playlists.length === 0) {
    return uiEmpty({
      icon: 'list-music', title: 'No playlists yet', body: 'Tap ♡ on any chord to start one.',
      action: `<button class="btn btn-secondary" data-action="${inst ? 'oc-tab' : 'go-chords'}" data-tab="chords">Go to Chords</button>`,
    }) + newBtn;
  }
  const layoutId = !inst ? hpCurrentLayoutId() : null;
  return `
    <div class="list">
      ${state.playlists.map(pl => {
        const here = pl.chords.filter(c => (inst ? entryIsFor(c, inst) : !c.instrumentId && c.layoutId === layoutId)).length;
        const trail = inst
          ? `<button type="button" class="btn btn-primary btn-sm" data-action="oc-practice-start" data-id="${escHtml(pl.id)}" ${here ? '' : 'disabled'}>${icon('play')} Practice</button>`
          : `<button type="button" class="btn btn-primary btn-sm" data-action="hp-play-playlist" data-id="${escHtml(pl.id)}" ${here ? '' : 'disabled'}>${icon('play')} Play</button>`;
        return uiRow({
          lead: 'list-music', title: pl.name, chevron: true, action: 'open-playlist', data: { id: pl.id }, trail,
          meta: `${here} chord${here !== 1 ? 's' : ''} here · ${pl.chords.length} in total`,
        });
      }).join('')}
    </div>
    ${newBtn}`;
}

// Id that playlist entries of the handpan on screen carry, or null.
function hpCurrentLayoutId() {
  const l = state.layout;
  return l ? (l.isCustom ? (l.savedId || l.id) : l.id) : null;
}

function viewHandpanPlaylists() {
  return `${handpanAppBar(handpanTabs('playlists'))}${playlistsTabHtml(null)}`;
}

function viewOcarinaPlaylists(inst) {
  return `${ocHeader(inst, 'playlists')}${playlistsTabHtml(inst)}`;
}

// State of the ocarina / flute views; reset when switching instrument.
function newOcState() {
  return {
    tab: 'notes', selected: null, previous: null, scaleFilter: 'All', handLegend: false,
    category: 'All', playlistId: 'All', expanded: null, voicings: {}, practice: null,
    missingOpen: false, buildChamber: 0, fingersSheet: false, chordMore: false,
    filtersOpen: false, root: 'All', counts: [],
    holeMap: null,         // { sel } while marking where the holes are on the photo
    fgEdit: null,          // { midi, states } while changing a note's fingering by hand
  };
}

// Playlist-entry identity for an ocarina chord, mirroring favIdForChord():
// the plain form for the default voicing, a notes suffix for any other.
function ocLayoutId(inst) { return 'oc:' + entryInstId(inst); }

// The instrument id a playlist or progression entry carries. A saved
// instrument's own id; an ocarina or flute opened from a link (not saved)
// gets its chart and key, as a handpan scale is known by its scale id, so
// what is added to a playlist finds it again: opened from the link later,
// or saved from that chart.
function entryInstId(inst) {
  return inst.id === SHARED_ID && inst.link ? `chart:${inst.link.chartId}/${inst.link.keyId}` : inst.id;
}
function chartEntryId(inst) { return inst.kind === 'traditional' && inst.type ? `chart:${inst.type}/${inst.key}` : null; }
function entryIsFor(en, inst) {
  return !!en?.instrumentId && !!inst && (en.instrumentId === entryInstId(inst) || en.instrumentId === chartEntryId(inst));
}
// The instrument an entry plays on: the saved one, else a saved one from the
// same chart and key, else that chart opened as a visiting instrument.
function entryInstrument(en) {
  const id = en?.instrumentId;
  if (!id) return null;
  const own = getInstrument(id);
  if (own) return own;
  const m = /^chart:([^/]+)\/(.+)$/.exec(id);
  if (!m) return null;
  const saved = getInstruments().find(i => chartEntryId(i) === id);
  if (saved) return saved;
  try {
    const link = { chartId: m[1], keyId: m[2] };
    return { ...instrumentFromChart(m[1], m[2], { name: linkTitle(parseLink(linkFor(link))) }), id: SHARED_ID, link };
  } catch { return null; }
}
function ocFavId(inst, chordId, noteNames, canonicalNames) {
  const base = `${ocLayoutId(inst)}-${chordId}`;
  const sorted = names => [...names].sort((a, b) => noteToMidi(a) - noteToMidi(b)).join(',');
  return canonicalNames && sorted(canonicalNames) === sorted(noteNames) ? base : `${base}-${noteNames.join(',')}`;
}

// Chords playable on the instrument (through the scale filter), each with
// its current voicing as MIDI notes, plus the source scale's chords that
// don't fit. Source scale = the filter, or the scale an ocarina was built from.
function ocChordModel(inst) {
  const oc = state.oc;
  const pcs = oc.scaleFilter !== 'All' ? scalePitchClasses(oc.scaleFilter) : null;
  const layout = ocarinaToLayout(inst, pcs);
  const chords = layout.top.ding ? findAllChords(layout) : [];
  const counts = new Set(oc.counts ?? []);
  const items = chords
    .filter(c => oc.category === 'All' || c.type.category === oc.category)
    .filter(c => !counts.size || counts.has(chordCountKey(c.noteCount)))
    .filter(c => !oc.root || oc.root === 'All' || notePC(c.rootNote) === NOTE_NAMES.indexOf(oc.root))
    .sort((a, b) => notePC(a.rootNote) - notePC(b.rootNote) || b.noteCount - a.noteCount)
    .map(c => ({ chord: c, midis: oc.voicings[c.id] ?? c.notes.map(noteToMidi).sort((a, b) => a - b) }));
  const sourceId = oc.scaleFilter !== 'All' ? oc.scaleFilter : inst.scaleId;
  const source = findTuning(sourceId);
  const have = new Set(chords.map(c => `${notePC(c.rootNote)}-${c.type.id}`));
  const missing = !source ? [] : findAllChords(createLayoutFromScale(source))
    .filter(c => !have.has(`${notePC(c.rootNote)}-${c.type.id}`))
    .filter(c => oc.category === 'All' || c.type.category === oc.category)
    .map(c => ({ chord: c, fit: fitChordToInstrument(inst, c.notes) }))
    .filter(x => x.fit.missing.length > 0);
  return { chords, items, missing, source };
}

// The moves line (§5.14): "Lift R3 and R2", with "lift …" and "cover …" in
// the colours of their arrows. Built from fingeringMoves(), so the words are
// the same as its text. lower: start in lower case (after "Next: ").
function ocMovesHtml(moves, { lower = false } = {}) {
  if (!moves?.text) return '';
  if (moves.text === 'No change') return lower ? 'same fingering' : 'No change';
  const join = l => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`);
  const parts = [];
  const chamber = moves.text.match(/^Blow chamber \d+/);
  if (chamber) parts.push(['', chamber[0].toLowerCase()]);
  if (moves.cover.length) parts.push(['move-cover', `cover ${join(moves.cover)}`]);
  if (moves.lift.length) parts.push(['move-lift', `lift ${join(moves.lift)}`]);
  if (moves.half?.length) parts.push(['move-cover', `half-cover ${join(moves.half)}`]);
  return parts.map(([cls, text], i) => {
    const t = i === 0 && !lower ? text[0].toUpperCase() + text.slice(1) : text;
    return cls ? `<span class="${cls}">${escHtml(t)}</span>` : escHtml(t);
  }).join(', ');
}

// The handpan-scale filter of the ocarina Notes and Chords tabs.
function ocScaleSelect(title) {
  return uiPicker({
    id: 'oc-scale-filter', value: state.oc.scaleFilter, label: 'Scale', hint: title, action: 'oc-scale-filter',
    options: scalePickerOptions([{ value: 'All', label: 'All notes', keywords: ['none', 'off'] }]),
  });
}

// While a chord's arpeggio plays: the step being played is highlighted
// (no re-render; the list may not be on screen). The last one clears itself.
let _ocStepTimer = null;
function ocShowStep(key, i) {
  (state.oc.chordStep ??= {})[key] = i;
  for (const box of document.querySelectorAll('.oc-player')) {
    if (box.dataset.key !== key) continue;
    box.querySelectorAll('.oc-pnote').forEach((b, k) => { b.classList.toggle('is-current', k === i); b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
    box.querySelectorAll('.oc-pstage, .oc-pmove').forEach(st => st.classList.toggle('is-current', Number(st.dataset.i) === i));
  }
}
function ocHighlightStep(key, i, last) {
  clearTimeout(_ocStepTimer);
  ocShowStep(key, i);
  document.querySelectorAll('.oc-player.is-playing').forEach(b => b.classList.remove('is-playing'));
  for (const box of document.querySelectorAll('.oc-player')) if (box.dataset.key === key) box.classList.add('is-playing');
  if (last) _ocStepTimer = setTimeout(() => document.querySelectorAll('.oc-player.is-playing').forEach(b => b.classList.remove('is-playing')), 900);
}

// What a chord card shows, worked out once for the row and its detail.
function ocChordParts(inst, { key, chordId, midis, rootPC }) {
  const names = midis.map(midiToNoteName);
  const rootName = names.find(n => notePC(n) === rootPC) ?? names[0];
  return {
    arp: arpeggioOrder(names, rootName),
    inAny: isChordBookmarkedAnyVoicing(ocLayoutId(inst), chordId),
    pairs: inst.chambers.length > 1 ? playablePairs(inst.chambers, midis) : [],
    key,
  };
}




function viewOcarinaChords(inst) {
  const oc = state.oc;
  const uf = state.useFlats, us = state.useSolfege;
  const model = ocChordModel(inst);
  const cardArgs = ({ chord, midis }) => ({
    key: chord.id, chordId: chord.id, canonical: chord.notes,
    title: `${displayNote(chord.rootName, uf, us)} ${escHtml(chord.type.name)}`, sub: escHtml(chord.type.category),
    midis, rootPC: notePC(chord.rootNote),
    favId: ocFavId(inst, chord.id, midis.map(midiToNoteName), chord.notes),
  });
  // Same pattern as the handpan's Chords: the instrument and the chord on
  // top (sticky on phones), the chord list under it. A chord is always
  // shown: the first one until another is picked.
  const selected = model.items.find(x => x.chord.id === oc.expanded) ?? model.items[0] ?? null;
  if (selected && oc.expanded !== selected.chord.id) oc.expanded = selected.chord.id;
  const rows = model.items.length === 0
    ? uiEmpty({ icon: 'music', title: 'No chords match these filters', action: oc.category !== 'All' || oc.scaleFilter !== 'All' || oc.counts?.length || (oc.root && oc.root !== 'All') ? '<button type="button" class="btn btn-secondary" data-action="oc-filters-clear" data-all="1">Clear filters</button>' : '' })
    : `<div class="list chord-rows">${model.items.map(x => {
      const a = cardArgs(x);
      const parts = ocChordParts(inst, a);
      return chordRowHtml({
        title: a.title, titleHtml: true,
        meta: `${parts.pairs.length ? uiBadge('Together', 'accent') + ' ' : ''}${a.sub}`,
        action: 'oc-chord-select', data: { key: a.key }, current: x === selected,
        trail: `${hpHeartBtn(parts.inAny, { action: 'oc-show-playlist-picker', data: { key: a.key } })}<span class="chord-count">${x.midis.length}</span>`,
      });
    }).join('')}</div>`;
  const missing = model.missing.length ? `
    <details class="oc-missing" ${oc.missingOpen ? 'open' : ''}>
      <summary data-action="oc-missing-toggle">${icon('chevron-right')} Not on this ${inst.family === 'flute' ? 'flute' : 'ocarina'} (${model.missing.length})</summary>
      ${model.source ? `<p class="oc-hint">Chords of ${escHtml(model.source.name)} that need a note it doesn't have.</p>` : ''}
      <div class="list">
        ${model.missing.map(({ chord, fit }) => uiRow({
          title: `${displayNote(chord.rootName, uf, us)} ${chord.type.name}`,
          meta: `missing ${fit.missing.map(n => displayNote(n, uf, us)).join(', ')}`,
        })).join('')}
      </div>
    </details>` : '';
  const nFilters = (oc.counts?.length ? 1 : 0) + (oc.category !== 'All' ? 1 : 0) + (oc.scaleFilter !== 'All' ? 1 : 0);
  const listHead = `
    ${chordFilterRowHtml({ open: 'oc-filters-open', count: nFilters, roots: chordRootsOf(model.chords), root: oc.root ?? 'All', rootAction: 'oc-filter-root' })}
    <div class="hp-count">${model.items.length} chord${model.items.length !== 1 ? 's' : ''}</div>`;
  const stage = oc.listen ? listenOcStageParts(inst)
    : oc.identify ? ocIdentifyParts(inst, model)
    : selected ? ocChordStageParts(inst, cardArgs(selected)) : { picture: '', card: '', key: '' };
  const modeSeg = uiSeg([{ value: 'browse', label: 'Browse' }, { value: 'identify', label: 'Identify' }, { value: 'listen', label: 'Listen' }],
    oc.listen ? 'listen' : oc.identify ? 'identify' : 'browse', { action: 'oc-listen-mode', label: 'Find chords by' });
  return `${ocHeader(inst, 'chords')}${chordsScreenHtml({
    cls: ` oc-chords${oc.identify ? ' is-identify' : ''}`, stageCls: ' oc-stage oc-player', stageAttrs: ` data-key="${stage.key}"`,
    picture: stage.picture, card: stage.card,
    listHead: `${modeSeg}${oc.listen || oc.identify ? '' : listHead}`,
    list: oc.listen ? listenHistoryHtml() : oc.identify ? stage.list : rows + missing,
  })}`;
}

// Identify on an ocarina or flute, as on a handpan: tap notes, see the
// chords they make. The picture is the instrument's own notes to tap, with
// the fingering of the last one; a chord found opens in Browse, where its
// fingerings, playlists and octaves are.
function ocIdentifyParts(inst, model) {
  const oc = state.oc;
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const picked = oc.idNotes ?? [];
  const last = picked[picked.length - 1];
  const picture = `
      <div class="oc-id">
        ${last != null ? `<div class="oc-id-fg">${renderFingering(inst, last, { size: 'medium', useFlats: uf, useSolfege: us })}</div>` : ''}
        <div class="chips oc-id-notes" role="group" aria-label="Notes of this instrument">
          ${playableMidis(inst).map(m => `<button type="button" class="chip${picked.includes(m) ? ' is-selected' : ''}" data-action="oc-id-note" data-midi="${m}" aria-pressed="${picked.includes(m)}">${escHtml(nn(m))}</button>`).join('')}
        </div>
      </div>`;
  const card = chordCardHtml({
    title: picked.length ? picked.map(nn).join(' · ') : 'Tap notes to name a chord',
    metas: [[picked.length < 2 ? 'Tap two or more notes. Tap again to remove one.' : `${picked.length} notes`]],
    actions: picked.length ? `
          <button type="button" class="btn btn-primary hp-play" data-action="oc-id-play"${picked.length < 2 ? ' disabled' : ''}>${icon('play')} Play</button>
          <button type="button" class="btn btn-secondary" data-action="oc-id-clear">Clear</button>` : '',
  });
  const matches = picked.length >= 2 ? identifyChord(picked.map(midiToNoteName)) : [];
  const known = new Set(model.items.map(x => x.chord.id));
  const list = picked.length < 2 ? '<p class="hp-hint">Select 2 or more notes to identify a chord.</p>'
    : !matches.length ? `<div class="list">${uiRow({ title: 'Custom combination', meta: `Not a recognized chord type · ${picked.length} notes` })}</div>`
    : `<div class="list">${matches.map(m => uiRow({
      title: `${displayNote(m.rootName, uf, us)} ${escHtml(m.type.name)}`,
      meta: `${escHtml(m.type.category)} · ${m.notes.map(n => escHtml(displayNote(n, uf, us))).join(', ')}`,
      ...(known.has(m.id) ? { chevron: true, action: 'oc-id-open', data: { id: m.id } } : {}),
    })).join('')}</div>`;
  return { picture, card, list, key: 'identify' };
}

// What ocarina / flute put into the shared Chords screen: the picture (one
// fingering, the note on show or being played) and the chord card with the
// notes in playing order and what to change for each.
function ocChordStageParts(inst, a) {
  const parts = ocChordParts(inst, a);
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const key = escHtml(a.key);
  const sel = Math.min(state.oc.chordStep?.[a.key] ?? 0, parts.arp.length - 1);
  const opts = { useFlats: uf, useSolfege: us, size: 'medium', showFingers: true, noteLabel: false };
  const picture = `
      <div class="oc-stage-fg">
        ${parts.arp.map((m, i) => `
          <div class="oc-pstage${i === sel ? ' is-current' : ''}" data-i="${i}">
            <button type="button" class="oc-pstage-fg" data-action="oc-play-note" data-midi="${m}" aria-label="Play ${escHtml(nn(m))}">
              ${renderFingering(inst, m, { ...opts, previousMidi: i > 0 ? parts.arp[i - 1] : null })}</button>
          </div>`).join('')}
      </div>`;
  const card = chordCardHtml({
    title: a.title,
    metas: [[`${a.sub} · ${a.midis.map(nn).join(' · ')}`]],
    actions: `
          ${hpHeartBtn(parts.inAny, { action: 'oc-show-playlist-picker', data: { key: a.key } })}
          <button type="button" class="btn btn-primary hp-play" data-action="oc-play-arp" data-key="${key}">${icon('play')} Chord</button>
          ${uiIconBtn('ellipsis', 'More: octaves, what the holes mean', { action: 'oc-more-open', attrs: 'aria-haspopup="dialog"' })}`,
    // One note at a time: the notes in playing order, and what to change
    // for the one on show.
    below: `
        <div class="oc-player-notes" role="group" aria-label="Notes of the chord, in playing order">
          ${parts.arp.map((m, i) => `
            <button type="button" class="oc-pnote${i === sel ? ' is-current' : ''}" data-action="oc-step" data-key="${key}" data-i="${i}" data-midi="${m}"
              aria-pressed="${i === sel ? 'true' : 'false'}"><span class="oc-pnote-num">${i + 1}</span>${escHtml(nn(m))}</button>
            ${i < parts.arp.length - 1 ? `<span class="oc-pnote-sep" aria-hidden="true">${icon('chevron-right')}</span>` : ''}`).join('')}
        </div>
        ${parts.arp.map((m, i) => `
          <div class="oc-pmove${i === sel ? ' is-current' : ''}" data-i="${i}"><strong>${escHtml(nn(m))}</strong> · ${i === 0 ? 'start with this fingering' : ocMovesHtml(fingeringMoves(inst, parts.arp[i - 1], m), { lower: true })}</div>`).join('')}`,
  });
  return { picture, card, key };
}

// Filters of ocarina / flute Chords: the same sheet as the handpan's, with
// the handpan-scale filter in place of the playlist.
function ocFiltersSheet() {
  const oc = state.oc;
  return uiSheet({
    key: 'oc-filters', title: 'Filters', close: 'oc-filters-close',
    body: `
    <div class="hp-sheet-form">
      ${chordCountField(new Set(oc.counts ?? []), 'oc-toggle-count')}
      ${chordTypeField(oc.category, 'oc-category')}
      ${uiField({ label: 'Scale', id: 'oc-scale-filter', control: ocScaleSelect('Only chords made of this scale\'s notes'), help: 'Only chords made of the scale\'s notes.' })}
    </div>`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="oc-filters-clear">Clear all</button>
      <button type="button" class="btn btn-primary" data-action="oc-filters-close">Done</button>`,
  });
}

// ⋯ of the chord on top: its octaves, the two-note pairs of a
// multi-chamber ocarina, and what the hole pictures mean.
function ocChordMoreSheet() {
  const inst = currentInstrument();
  if (!inst) return '';
  const key = state.oc.expanded;
  const card = key && ocCardData(inst, key);
  if (!card) return '';
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const pairs = inst.chambers.length > 1 ? playablePairs(inst.chambers, card.midis) : [];
  const hasHalf = card.midis.some(m => fingeringFor(inst, m)?.states?.includes('h'));
  return uiSheet({
    key: 'oc-more', variant: 'menu', title: `${displayNote(card.rootName, uf, us)} ${card.typeName}`, close: 'oc-more-close',
    body: `
      <div class="field">
        <span class="field-label">Octaves</span>
        <div class="chips">${card.midis.map(m => `<button type="button" class="chip" data-action="oc-voicing" data-key="${escHtml(key)}" data-midi="${m}"
          aria-label="Move ${nn(m)} to another octave">${nn(m)}</button>`).join('')}</div>
        <div class="field-help">Tap a note to move it to another octave.</div>
      </div>
      ${pairs.map(p => `
        <button type="button" class="oc-pair" data-action="oc-play-pair" data-a="${p.a.midi}" data-b="${p.b.midi}">
          <span class="oc-pair-text">${uiBadge('Together', 'accent')} <span>${nn(p.a.midi)} + ${nn(p.b.midi)}: blow both chambers</span></span>
          <span class="fg-mini">${renderFingering(inst, p.a.midi, { useFlats: uf, useSolfege: us, size: 'mini', blowBoth: p.b.midi })}</span>
        </button>`).join('')}
      <div class="fg-legend oc-steps-legend">
        <span>${legendHole('c')} covered</span><span>${legendHole('o')} open</span>
        ${hasHalf ? `<span>${legendHole('h')} half</span>` : ''}
        <span>${legendHole('x')} changes</span>
      </div>
      <div class="list">${uiRow({ lead: 'hand', title: 'Which finger is which', action: 'oc-hand-open', chevron: true })}</div>`,
  });
}

// Practice mode: autoplay on an ocarina playlist or progression, one
// arpeggio note at a time. The large diagram shows the current note with
// arrows for what to lift or cover to reach the next one; tap to move on.

// What is being practised (state.oc.practice is { playlistId, idx } or
// { progressionId, idx }): its name, what one entry is called, and the
// entries for this instrument, each with an id (a progression step's id is
// its stepId, so a repeated chord is still its own entry). null when gone.
function practiceSource(inst, pr = state.oc.practice) {
  if (!inst || !pr) return null;
  if (pr.progressionId) {
    const prog = state.progressions.find(p => p.id === pr.progressionId);
    if (!prog) return null;
    return { name: prog.name, unit: 'Step', entries: prog.steps.filter(s => entryIsFor(s, inst) && !s.missing).map(s => ({ ...s, id: s.stepId })) };
  }
  const pl = state.playlists.find(p => p.id === pr.playlistId);
  if (!pl) return null;
  return { name: pl.name, unit: 'Chord', entries: pl.chords.filter(c => entryIsFor(c, inst)) };
}

function practiceSteps(entries) {
  const steps = [];
  for (const en of entries) {
    const rootName = en.notes.find(n => notePC(n) === notePC(en.rootName + '4')) ?? en.notes[0];
    for (const m of arpeggioOrder(en.notes, rootName)) steps.push({ entryId: en.id, midi: m });
  }
  return steps;
}

// Practice (§6.12): a full-screen focus view with no tab bar. ✕ stops, the
// mic turns on the tuner (which moves on by itself), Back and Next sit at
// the bottom.
function viewOcarinaPractice(inst) {
  const pr = state.oc.practice;
  const src = practiceSource(inst, pr);
  const steps = src ? practiceSteps(src.entries) : [];
  if (steps.length === 0) { state.oc.practice = null; return viewInstrument(); }
  const idx = Math.min(pr.idx, steps.length - 1);
  const cur = steps[idx];
  const next = steps[(idx + 1) % steps.length];
  const entries = src.entries;
  const en = entries.find(c => c.id === cur.entryId);
  const chordNo = entries.indexOf(en) + 1;
  const ofChord = steps.filter(s => s.entryId === cur.entryId);
  const noteNo = idx - steps.indexOf(ofChord[0]) + 1;
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const opts = { useFlats: uf, useSolfege: us, showFingers: state.showFingers, showSizes: state.showSizes };
  const moves = fingeringMoves(inst, cur.midi, next.midi);
  const nextEn = entries.find(c => c.id === next.entryId);
  const progress = Math.round(((idx + 1) / steps.length) * 100);
  return `
    ${uiAppBar({
      title: `Practice · ${src.name}`,
      back: { action: 'oc-practice-stop', label: 'Stop practice', icon: 'x' },
      actions: [tunerAppBtn()],
    })}
    <div class="practice">
      <div class="practice-head">
        <h2 class="practice-title">${displayNote(en.rootName, uf, us)} ${escHtml(en.typeName)}</h2>
        <div class="practice-sub">${src.unit} ${chordNo} of ${entries.length} · note ${noteNo} of ${ofChord.length}</div>
        <div class="practice-progress" role="progressbar" aria-label="Practice progress" aria-valuemin="1" aria-valuemax="${steps.length}" aria-valuenow="${idx + 1}">
          <span style="width:${progress}%"></span>
        </div>
      </div>
      <div class="fg-stage is-practice">
        <button type="button" class="fg-stage-play" data-action="oc-practice-next" title="Tap for the next note">
          ${renderFingering(inst, cur.midi, { ...opts, size: 'large', nextMidi: next.midi })}
        </button>
        <div class="fg-moves-row">
          <span></span>
          <div class="fg-moves">Next: ${ocMovesHtml(moves, { lower: true })}</div>
          ${state.showFingers ? uiIconBtn('hand', 'Which finger is which', { action: 'oc-hand-open' }) : '<span></span>'}
        </div>
      </div>
      <div class="practice-next">
        <span class="fg-mini is-next" aria-hidden="true">${renderFingering(inst, next.midi, { ...opts, size: 'mini' })}</span>
        <span>Up next: ${nn(next.midi)}${nextEn && nextEn.id !== en.id ? ` · ${displayNote(nextEn.rootName, uf, us)} ${escHtml(nextEn.typeName)}` : ''}</span>
      </div>
      <p class="practice-status">${state.tuner.on ? `Listening for ${nn(cur.midi)} · play the note` : 'Tap the diagram or Next to move on'}</p>
      <div class="actionbar practice-bar">
        <button type="button" class="btn btn-secondary btn-lg" data-action="oc-practice-prev">${icon('chevron-left')} Back</button>
        <button type="button" class="btn btn-primary btn-lg" data-action="oc-practice-next">Next ${icon('chevron-right')}</button>
      </div>
    </div>`;
}

function handLegendModal() {
  if (!state.oc.handLegend) return '';
  return uiSheet({
    key: 'hand', title: 'Which finger is which', close: 'oc-hand-close',
    body: `<p class="sheet-text">As you hold the instrument, looking at the backs of your hands.</p>${renderHandLegend()}`,
    footer: `<button class="btn btn-secondary" data-action="oc-hand-close">Close</button>`,
  });
}

// An ocarina or flute: the Notes view (fingering chart), or the tab chosen.
function viewInstrument() {
  if (state.currentInstrumentId === SHARED_ID && !state.shared) {
    return `
      ${backAppBar('Shared instrument')}
      ${state.sharedStatus === 'loading'
        ? uiEmpty({ icon: 'share-2', title: 'Opening the shared instrument…' })
        : uiEmpty({ icon: 'share-2', title: 'No shared instrument has that code', body: 'Check the code and try again.' })}`;
  }
  const inst = currentInstrument();
  if (!inst) return viewHome();
  const uf = state.useFlats, us = state.useSolfege;
  const midis = playableMidis(inst);
  if (state.oc.tab === 'builder' && !canBuild()) state.oc.tab = 'notes';
  if (state.oc.tab === 'builder' && inst.kind === 'scale') return viewBuilder(inst);
  if (state.oc.tab === 'setup' || (inst.kind === 'custom' && midis.length === 0)) return viewSetup(inst);

  if (midis.length === 0) {
    return `${ocHeader(inst, 'notes')}
      ${uiEmpty({ icon: 'family-ocarina', title: 'No fingering chart yet', body: escHtml(instrumentStatus(inst)) })}`;
  }

  const oc = state.oc;
  if (oc.practice) return viewOcarinaPractice(inst);
  if (oc.tab === 'chords') return viewOcarinaChords(inst);
  if (oc.tab === 'playlists') return viewOcarinaPlaylists(inst);
  if (!midis.includes(oc.selected)) { oc.selected = midis[0]; oc.previous = null; }
  const pcs = oc.scaleFilter !== 'All' ? scalePitchClasses(oc.scaleFilter) : null;
  const inScale = m => !pcs || pcs.has(((m % 12) + 12) % 12);
  const opts = { useFlats: uf, useSolfege: us, showFingers: state.showFingers, showSizes: state.showSizes };
  const moves = oc.previous != null && oc.previous !== oc.selected ? fingeringMoves(inst, oc.previous, oc.selected) : null;

  return `${ocHeader(inst, 'notes')}
    <div class="oc-notes">
      <div class="oc-notes-side">
        <div class="oc-context">
          ${ocScaleSelect('Dim notes outside a scale')}
          <button type="button" class="btn btn-secondary" data-action="oc-play-scale">${icon('play')} Scale</button>
        </div>
        <div class="fg-stage-wrap">
          ${oc.fgEdit?.midi === oc.selected ? fgEditStageHtml(inst, opts) : `
          <div class="fg-stage">
            <button type="button" class="fg-stage-play" data-action="oc-play-selected" title="Play this note">
              ${renderFingering(inst, oc.selected, { ...opts, size: 'large', previousMidi: oc.previous })}
            </button>
            <div class="fg-moves-row">
              <span></span>
              <div class="fg-moves">${moves ? ocMovesHtml(moves) : ''}</div>
              ${state.showFingers ? uiIconBtn('hand', 'Which finger is which', { action: 'oc-hand-open' }) : '<span></span>'}
            </div>
            ${inst.setup?.fixed?.[oc.selected] ? `<p class="fg-yours">${uiBadge('Your fingering', 'accent')}</p>` : ''}
            ${fgEditable(inst) ? `<button type="button" class="btn btn-ghost btn-sm fg-edit-open" data-action="fg-edit-open">${icon('pencil')} ${inst.setup?.fixed?.[oc.selected] ? 'Change your fingering' : 'Not how you play it? Change the fingering'}</button>` : ''}
          </div>`}
        </div>
        ${recordedCentsHtml(inst, oc.selected)}
        ${state.ocLegendSeen ? '' : `
          <div class="fg-legend">
            <span>${legendHole('c')} covered</span><span>${legendHole('o')} open</span><span>${legendHole('h')} half</span>
            <button type="button" class="btn btn-ghost btn-sm" data-action="oc-legend-dismiss">Got it</button>
          </div>`}
      </div>
      <div class="oc-notes-main">
        <div class="fg-grid">
          ${midis.map(m => `
            <button type="button" class="fg-cell${inScale(m) ? '' : ' is-dim'}" aria-pressed="${m === oc.selected ? 'true' : 'false'}" data-action="oc-select-note" data-midi="${m}">
              ${renderFingering(inst, m, { ...opts, size: 'medium' })}
            </button>`).join('')}
        </div>
        <p class="oc-count">${escHtml(instrumentStatus(inst))}</p>
      </div>
    </div>`;
}

// A recorded flute: how far the note it plays is from the charted note.
function recordedCentsHtml(inst, midi) {
  const c = inst.family === 'flute' && inst.kind === 'custom' ? inst.calibration?.cents?.[midi] : null;
  if (c == null) return '';
  const off = c === 0 ? 'in tune' : `${c > 0 ? '+' : '−'}${Math.abs(c)} ¢ (${c > 0 ? 'sharp' : 'flat'})`;
  return `<p class="b-meta fl-recorded">Your flute played this ${off} when you recorded it.</p>`;
}

function legendHole(state) {
  const body = state === 'x' ? '<g class="fg-changed"><circle class="fg-o" cx="8" cy="8" r="5.5"/></g>'
    : state === 'c' ? '<circle class="fg-c" cx="8" cy="8" r="6"/>'
    : state === 'o' ? '<circle class="fg-o" cx="8" cy="8" r="6"/>'
    : '<circle class="fg-o" cx="8" cy="8" r="6"/><path class="fg-c" d="M 2 8 A 6 6 0 0 0 14 8 Z"/>';
  return `<svg class="fingering" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${body}</svg>`;
}


// Everything a chord card's buttons need, looked up by its key: a chord id
// in the plain list, or 'e:' + entry id when a playlist is selected.
// The instrument a chord card belongs to: an entry's own (cards in a
// playlist), otherwise the instrument on screen.
function ocCardInstrument(key) {
  const en = key?.startsWith('e:') ? state.playlists.flatMap(p => p.chords).find(c => 'e:' + c.id === key) : null;
  return (en?.instrumentId && entryInstrument(en)) || currentInstrument();
}

function ocCardData(inst, key) {
  if (key.startsWith('e:')) {
    const en = state.playlists.flatMap(p => p.chords).find(c => 'e:' + c.id === key);
    if (!en) return null;
    return {
      entry: en, chordId: en.chordId, rootName: en.rootName, typeName: en.typeName, category: en.category,
      midis: (state.oc.voicings[key] ?? en.notes.map(noteToMidi)).sort((a, b) => a - b),
      rootPC: notePC(en.rootName + '4'), canonical: null,
    };
  }
  const item = ocChordModel(inst).items.find(x => x.chord.id === key);
  if (!item) return null;
  const c = item.chord;
  return {
    chordId: c.id, rootName: c.rootName, typeName: c.type.name, category: c.type.category,
    midis: item.midis, rootPC: notePC(c.rootNote), canonical: c.notes,
  };
}

// Which sound the next notes use: the open ocarina or flute sounds like
// one (a whistle-bodied flute like a tin whistle); everything else, the
// handpan screens included, keeps the handpan sound.
function voiceForState() {
  // A handpan, tongue drum or kalimba on screen sounds like itself.
  if (state.layout && ['editor', 'chords', 'hp-playlists', 'progression', 'playlist'].includes(state.view)) return layoutInstrument(state.layout);
  if (state.view === 'setup') return setupFamilyInfo(state.setup?.family).voice;
  if (!['instrument', 'progression', 'playlist'].includes(state.view) || !state.currentInstrumentId) return 'handpan';
  const inst = currentInstrument();
  if (!inst) return 'handpan';
  if (usesLayout(inst)) return inst.family;
  if (inst.family === 'ocarina') return 'ocarina';
  return String(inst.type ?? '').startsWith('tin-whistle') ? 'whistle' : 'flute';
}

function playPracticeStep() {
  setVoice(voiceForState());
  const inst = currentInstrument();
  const src = practiceSource(inst);
  if (!src) return;
  const steps = practiceSteps(src.entries);
  const step = steps[state.oc.practice.idx % steps.length];
  if (step) { initAudio(); playNote(midiToNoteName(step.midi)); }
}

// An ocarina or flute entry opens its instrument, showing the playlist with
// that instrument's chord cards (entry expanded) and Practice.
function openPlaylistEntryOnInstrument(pl, entry) {
  const inst = entryInstrument(entry);
  if (inst?.id === SHARED_ID) openChartLink(inst.link);
  else if (!inst || !openInstrument(inst.id, { push: false })) { showToast('That instrument is no longer in My instruments'); return false; }
  // Like a handpan entry: the chord opens on the instrument's Chords screen,
  // in the voicing saved in the playlist, with the filters cleared so it's there.
  Object.assign(state.oc, { tab: 'chords', scaleFilter: 'All', category: 'All', expanded: entry.chordId, chordStep: {}, practice: null });
  state.oc.voicings[entry.chordId] = entry.notes.map(noteToMidi).sort((a, b) => a - b);
  navPush(instUrl(state.currentInstrumentId, 'chords'));
  return true;
}

// ── Sharing ──────────────────────────────────────────────────────────────────
// A shared instrument (#p/<code>) opens read-only under this id.
const SHARED_ID = '__shared__';

function currentInstrument() {
  return state.currentInstrumentId === SHARED_ID ? state.shared : getInstrument(state.currentInstrumentId);
}

function openSharedLink(code, tab = null) {
  stopAutoplay();
  Object.assign(state, {
    view: 'instrument', layout: null, currentInstrumentId: SHARED_ID,
    shared: null, sharedStatus: 'loading', oc: newOcState(),
  });
  // Supabase is initialised just after the first render, so fetch next tick.
  setTimeout(async () => {
    const data = await fetchSharedInstrument(code);
    if (state.currentInstrumentId !== SHARED_ID) return;
    // A shared handpan, tongue drum or kalimba opens like any visiting one:
    // its notes on its own screens, ready to save.
    if (data && usesLayout(data) && data.layout) {
      openSharedLayout(data, tab);
      render();
      return;
    }
    state.shared = data ? { ...data, id: SHARED_ID, publicId: code.toUpperCase() } : null;
    state.sharedStatus = data ? null : 'missing';
    render();
  }, 0);
}

let _qrLib = null;
function loadQrLib() {
  if (_qrLib) return _qrLib;
  _qrLib = new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    sc.onload = () => resolve(window.qrcode);
    sc.onerror = () => { _qrLib = null; reject(new Error('QR library unavailable')); };
    document.head.appendChild(sc);
  });
  return _qrLib;
}

async function shareInstrument(id = null) {
  const inst = id ? getInstrument(id) : currentInstrument();
  if (!inst || inst.id === SHARED_ID) return;
  // A guest got the save sheet first (store.js); an account needs the connection.
  if (!isLoggedIn()) { showToast('Sharing needs a connection'); return; }
  // A handpan, tongue drum or kalimba shares a copy of its notes, kept up to
  // date each time it is shared (its layout lives in the saved layouts).
  if (usesLayout(inst)) {
    const saved = getSavedLayouts().find(l => l.id === inst.layoutId);
    if (!saved) return;
    inst.layout = JSON.parse(JSON.stringify(saved.layout));
    saveInstrument(inst);
    if (inst.publicId && await saveCloudInstruments([getInstrument(inst.id)]) !== true) { showToast('Sharing needs a connection'); return; }
  }
  if (!inst.publicId) {
    let ok = false;
    for (let attempt = 0; attempt < 3 && ok !== true; attempt++) {
      inst.publicId = newPublicId();
      saveInstrument(inst);
      ok = await saveCloudInstruments([getInstrument(inst.id)]);
      if (ok !== '23505') break; // anything but a public-ID clash: stop retrying
    }
    if (ok !== true) {
      delete inst.publicId;
      saveInstrument(inst);
      showToast('Sharing isn\'t available on the server yet');
      return;
    }
  }
  const url = `${location.origin}${linkFor({ code: inst.publicId })}`;
  const what = usesLayout(inst) ? 'its notes and chords' : 'its fingering chart and chords';
  const tip = inst.family === 'ocarina' ? ' Stamp the code into the clay or tie the QR code to it.' : ' Print the QR code and keep it with the instrument.';
  state.shareModal = { code: inst.publicId, url, qr: null, text: `Anyone with the code, link or QR code sees ${what}, read-only, and can add it to their own instruments.${tip}` };
  render();
  try {
    const qrcode = await loadQrLib();
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    if (state.shareModal?.code === inst.publicId) { state.shareModal.qr = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); render(); }
  } catch { /* the link and code still work without the QR image */ }
}

function shareModalHtml() {
  const m = state.shareModal;
  if (!m) return '';
  return uiSheet({
    key: 'share', title: 'Share this instrument', close: 'share-close',
    body: `
      <p class="sheet-text">${escHtml(m.text)}</p>
      <div class="share-code">${escHtml(m.code)}</div>
      <div class="share-qr">${m.qr ?? '<span class="share-loading">QR code loading…</span>'}</div>
      <input class="input share-url" readonly value="${escHtml(m.url)}" aria-label="Share link">`,
    footer: `
      <button class="btn btn-ghost" data-action="share-close">Close</button>
      <button class="btn btn-primary" data-action="share-copy">${icon('link')} Copy link</button>`,
  });
}

// ── Builder ──────────────────────────────────────────────────────────────────
// A step-by-step project per scale-built ocarina. Each instrument remembers
// its stage; readings are kept per stage, so going back loses nothing.

// Record field (§5.3): [ input Hz ][ mic ]. The mic arms the field and turns
// the tuner on if needed; the first steady reading fills it (onTunerReading).
// Typing still works as before (b-input).
function uiHzField(path, value, { label = 'Reading in Hz' } = {}) {
  const r = state.rec;
  const armed = r.armed === path;
  const captured = r.captured === path;
  const help = r.error?.path === path ? `<span class="is-error">${escHtml(r.error.msg)}</span>`
    : armed && r.slow ? '<span class="is-warning">No steady note yet: keep blowing, or type the value</span>'
    : armed ? '<span class="sr-only">Listening for a steady note</span>' : '';
  // Shown as the nearest note in the user's notation and how far off it is
  // ("D4 −3 ¢"); the exact frequency is what's stored and what the maths
  // uses, so it stays visible underneath. Typing accepts a note or Hz.
  const pitch = value > 0 ? pitchLabel(value, { useFlats: state.useFlats, useSolfege: state.useSolfege }) : null;
  const hzLine = pitch && !help ? `<span class="rec-hz">${(Math.round(value * 10) / 10).toFixed(1)} Hz</span>` : '';
  return `
    <div class="rec-field${armed ? ' is-armed' : ''}" data-rec="${escHtml(path)}">
      <div class="rec">
        <input class="rec-input" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false"
          data-action="b-input" data-kind="pitch" data-path="${path}"
          value="${pitch ? escHtml(pitch.text) : ''}" placeholder="${armed ? 'Listening…' : 'Note, e.g. ' + escHtml(displayNote('D4', state.useFlats, state.useSolfege))}"
          aria-label="${escHtml(label.replace(/ in Hz$/, ''))}: a note such as D4, or a frequency in Hz">
        <button type="button" class="rec-btn${captured ? ' is-captured' : ''}" data-action="b-record" data-path="${path}"
          aria-pressed="${armed ? 'true' : 'false'}" aria-label="${armed ? 'Stop listening' : 'Fill in from the tuner'}"
          title="${armed ? 'Stop listening' : 'Fill in from the tuner'}">${armed ? '<span class="rec-dot" aria-hidden="true"></span>' : ''}${icon(captured ? 'check' : 'mic')}</button>
      </div>
      <div class="rec-help" aria-live="polite">${help}${hzLine}</div>
    </div>`;
}

// Stage name without its qualifier ("Voice and drill"), and the qualifier ("leather-hard").
function stageName(st) { return STAGE_TITLES[st].split(' (')[0]; }
function stageQualifier(st) { return STAGE_TITLES[st].match(/\(([^)]+)\)/)?.[1] ?? ''; }

// The builder stepper (§5.11): seven numbered steps joined by lines, then
// "Step 3 of 7" and the stage title. Every step can be tapped (b-stage).
function bStepsHtml(stage) {
  const idx = STAGE_ORDER.indexOf(stage);
  return `
    <ol class="bsteps" aria-label="Build steps">
      ${STAGE_ORDER.map((st, i) => `
        <li class="bstep${i < idx ? ' is-done' : i === idx ? ' is-current' : ''}">
          <button type="button" class="bstep-btn" data-action="b-stage" data-stage="${st}"
            aria-label="Step ${i + 1}: ${escHtml(stageName(st))}${i < idx ? ', done' : ''}"${i === idx ? ' aria-current="step"' : ''}>
            <span class="bstep-dot" aria-hidden="true">${i < idx ? icon('check') : i + 1}</span>
            <span class="bstep-label" aria-hidden="true">${escHtml(stageName(st))}</span>
          </button>
        </li>`).join('')}
    </ol>
    <div class="b-count">Step ${idx + 1} of ${STAGE_ORDER.length}</div>
    <h2 class="b-title">${escHtml(stageName(stage))}${stageQualifier(stage) ? ` <span class="b-qual">${escHtml(stageQualifier(stage))}</span>` : ''}</h2>`;
}

function shapeIcon(shape) {
  const body = shape === 'round' ? '<circle cx="12" cy="12" r="7"/>'
    : shape === 'oval' ? '<ellipse cx="12" cy="12" rx="9" ry="6"/>'
    : '<rect x="3" y="7" width="18" height="10" rx="1"/>';
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${body}</svg>`;
}

// Earlier builds with readings, offered as a starting point.
function earlierBuilds(inst) {
  return state.instruments.filter(i => i.kind === 'scale' && i.id !== inst.id);
}

// The note strip of a design (§6.4): every note of the scale as a chip, the
// notes in the chosen window selected and the rest static, then Lower /
// Higher and "Start on the ding" to move the window. win(start) gives the
// attributes of a button that picks the window starting at `start`.
// toggle(m), when given, makes the window's notes buttons that leave a
// note out (Build › Design); in the wizard they're plain chips.
function noteStripHtml(plan, nn, { win, toggle = null }) {
  const chosen = plan.windows.find(w => w.chosen);
  const inWin = m => !chosen || chosen.notes.includes(m);
  const chips = plan.all.map(m => {
    if (!inWin(m)) return `<span class="chip is-static">${nn(m)}</span>`;
    const on = plan.notes.includes(m);
    if (!toggle) return `<span class="chip is-selected">${nn(m)}</span>`;
    return `<button type="button" class="chip${on ? '' : ' is-off'}" aria-pressed="${on ? 'true' : 'false'}" ${toggle(m)}
      aria-label="${nn(m)}${on ? '' : ', left out'}" title="${on ? 'Leave this note out' : 'Put this note back'}">${nn(m)}</button>`;
  }).join('');
  if (!chosen) return `<div class="chips note-strip">${chips}</div>`;
  const i = plan.windows.indexOf(chosen);
  const prev = plan.windows[i - 1], next = plan.windows[i + 1];
  const ding = plan.windows.find(w => w.fromDing);
  return `
    <div class="chips note-strip">${chips}</div>
    <div class="window-nav">
      <button type="button" class="btn btn-secondary" ${prev ? win(prev.start) : 'disabled'}>${icon('chevron-left')} Lower</button>
      ${ding ? `<button type="button" class="chip" ${win(ding.start)} aria-pressed="${ding.chosen ? 'true' : 'false'}">Start on the ding</button>` : ''}
      <button type="button" class="btn btn-secondary" ${next ? win(next.start) : 'disabled'}>Higher ${icon('chevron-right')}</button>
    </div>`;
}

// The chamber shown on the per-chamber steps (view state only).
function bChamberIdx(inst) { return Math.max(0, Math.min(state.oc.buildChamber ?? 0, inst.chambers.length - 1)); }

// ( Chamber 1 · D3 | Chamber 2 · E4 ) when an ocarina has two or more chambers.
function bChamberSwitch(inst, nn) {
  if (inst.chambers.length < 2) return '';
  const short = inst.chambers.length > 2;
  return uiSeg(inst.chambers.map((ch, i) => ({ value: String(i), label: `${short ? '' : 'Chamber '}${i + 1} · ${nn(ch.notes[0])}` })),
    String(bChamberIdx(inst)), { action: 'b-chamber', key: 'ci', label: 'Chamber' });
}

// A hole in the build steps: its finger, or "R2 sub-hole".
function bHoleName(h) { return h.sub ? `${h.finger} sub-hole` : h.finger; }

// Has every hole and reading of a chamber been filled in at this stage?
function bChamberComplete(inst, ci, stage) {
  const ch = inst.chambers[ci];
  const cb = chamberBuild(inst, ci);
  const r = cb.readings[stage] ?? {};
  if (stage === 'leather') {
    const plan = leatherHolePlan(ch, { f0: r.f0, d: r.d ?? cb.testHoleMm, f1: r.f1 }, buildShrink(inst), inst.build.a4);
    return !!plan && plan.holes.every(h => cb.holesDone.includes(h.index) && r.notes?.[ch.notes[h.index + 1]] > 0);
  }
  if (['boneDry', 'bisque', 'final'].includes(stage)) return ch.notes.every(m => r.notes?.[m] > 0);
  return false;
}

// Once the chamber on screen is complete, move on to the next one.
function bAdvanceChamber(inst) {
  const ci = bChamberIdx(inst);
  if (inst.chambers.length < 2 || ci >= inst.chambers.length - 1 || !bChamberComplete(inst, ci, inst.build.stage)) return;
  state.oc.buildChamber = ci + 1;
  showToast(`Chamber ${ci + 1} is done. Now chamber ${ci + 2}.`);
}

// "✓ in tune" / "12 cents flat: open it slightly" under a reading (§5.3).
function recStatus(stage, adv, text = adv.text) {
  const tone = adv.status === 'ok' ? 'is-ok' : adv.status === 'sharp' && stage !== 'leather' ? 'is-danger' : 'is-warning';
  return `<div class="rec-status ${tone}">${adv.status === 'ok' ? icon('check') : ''}${escHtml(text)}</div>`;
}

// A number field with its unit at the right.
function unitInput({ value, unit, label, attrs, step = '0.5', min = '1', max = '' }) {
  return `<span class="input-unit"><input class="input" type="number" inputmode="decimal" step="${step}" min="${min}"${max ? ` max="${max}"` : ''}
    value="${value}" aria-label="${escHtml(label)}" ${attrs}><span class="input-unit-label" aria-hidden="true">${unit}</span></span>`;
}

// The desktop preview panel: the chamber's diagram with hole sizes, as a
// drilling map, and the step's summary.
function bPreviewHtml(inst, stage, nn) {
  const ci = stage === 'design' || stage === 'body' ? 0 : bChamberIdx(inst);
  const ch = inst.chambers[ci];
  // Until the build is finished, the sizes drawn are the leather-hard plan's.
  const drawn = stage === 'done' ? inst : {
    ...inst,
    chambers: inst.chambers.map((c, i) => {
      const cb = chamberBuild(inst, i);
      const lr = cb.readings.leather ?? {};
      const plan = leatherHolePlan(c, { ...lr, d: lr.d ?? cb.testHoleMm }, buildShrink(inst), inst.build.a4);
      return plan ? applyHoleSizes(c, plan.holes.map(h => h.mm)) : c;
    }),
  };
  let summary = '';
  if (stage === 'design') {
    summary = inst.chambers.map((c, i) => `Chamber ${i + 1}: ${c.notes.map(nn).join(' ')} · ${c.holes.length} holes`).join('<br>');
  } else if (stage === 'body') {
    summary = bodyPlan(inst).map((p, i) => `Chamber ${i + 1}: ${Math.round(p.volume)} ml · ball ${Math.round(p.ballDiameter)} mm`).join('<br>');
  } else if (stage === 'leather') {
    const cb = chamberBuild(inst, ci);
    summary = `Holes drilled: ${cb.holesDone.length}/${ch.holes.length}`;
  } else if (stage !== 'done') {
    const r = chamberBuild(inst, ci).readings[stage]?.notes ?? {};
    summary = `Notes recorded: ${ch.notes.filter(m => r[m] > 0).length}/${ch.notes.length}`;
  }
  return `
    <aside class="b-aside" aria-label="Preview">
      <div class="card">
        <div class="overline">${inst.chambers.length > 1 ? `Chamber ${ci + 1} · ` : ''}${stage === 'design' || stage === 'body' ? 'preview' : 'drilling map'}</div>
        ${renderFingering(drawn, ch.notes[0], { size: 'medium', showSizes: true, useFlats: state.useFlats, useSolfege: state.useSolfege })}
        ${summary ? `<p class="b-aside-sum">${summary}</p>` : ''}
      </div>
    </aside>`;
}

// One reading block of the bone-dry, bisque and final checks: note and
// target, the record field, its status and how it compares.
function bNoteReading(inst, ci, stage, midi, targets, nn, from) {
  const cb = chamberBuild(inst, ci);
  const measured = cb.readings[stage]?.notes?.[midi];
  const leather = cb.readings.leather?.notes ?? {};
  const old = from?.build?.perChamber?.[ci]?.readings?.[stage]?.notes ?? {};
  const adv = measured > 0 ? noteAdvice(stage, measured, targets[midi]) : null;
  const rise = stage === 'boneDry' && measured > 0 && leather[midi] > 0 ? Math.round(centsBetween(measured, leather[midi])) : null;
  return `
    <div class="b-reading">
      <div class="b-reading-head"><span class="b-note">${nn(midi)}</span><span class="b-target">${targets[midi].toFixed(1)} Hz</span></div>
      ${uiHzField(`${ci}:${stage}:n:${midi}`, measured, { label: `${nn(midi)}, Hz` })}
      ${adv ? recStatus(stage, adv, adv.status === 'ok' ? 'in tune' : adv.text) : ''}
      ${rise != null ? `<div class="b-meta">rose ${rise >= 0 ? '+' : ''}${rise} ¢ since leather-hard</div>` : ''}
      ${old[midi] ? `<div class="b-meta">last build ${old[midi].toFixed(1)}</div>` : ''}
    </div>`;
}

function viewBuilder(inst) {
  const b = inst.build;
  const stage = b.stage;
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const shrink = buildShrink(inst);
  const from = b.fromId ? getInstrument(b.fromId) : null;
  const ci = bChamberIdx(inst);
  const perChamber = ['leather', 'boneDry', 'bisque', 'final'].includes(stage);
  let body = '';

  if (stage === 'design') {
    const d = inst.design ?? { scaleId: inst.scaleId, transpose: inst.transpose, includeGu: inst.includeGu };
    const plan = planOcarina(d);
    const hasGu = plan.scale.bottom.notes.length > 0;
    const transpose = d.transpose ?? 0;
    body = `
      <div class="card b-card">
        ${uiField({ label: 'Handpan scale', id: 'b-scale', control: uiPicker({
          id: 'b-scale', value: plan.scale.id, label: 'Handpan scale', options: scalePickerOptions(), action: 'b-design', data: { key: 'scaleId' },
        }) })}
        <div class="list b-inset">
          ${uiSetRow({ label: 'Transpose', control: uiStepper({
            value: transpose > 0 ? '+' + transpose : String(transpose), label: 'Transpose', action: 'b-design-transpose',
            min: transpose <= -6, max: transpose >= 6, help: 'semitones',
          }) })}
          ${hasGu ? uiSwitchRow({ label: 'Gu notes', help: 'Include the bottom-shell notes', on: d.includeGu ?? true, action: 'b-design-gu' }) : ''}
        </div>
        <div class="field">
          <div class="field-label">Chambers</div>
          <p class="b-text">The full scale needs ${plan.needed} chamber${plan.needed !== 1 ? 's' : ''}.</p>
          ${uiSeg(Array.from({ length: plan.needed }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })), String(plan.chambers), { action: 'b-design-chambers', key: 'n', label: 'Chambers' })}
        </div>
        ${(() => {
          // Notes added inside big steps (not the scale's own, not sub-holes).
          const subNotes = inst.chambers[0].notes.slice(0, d.subHoles ?? 0);
          const fill = inst.chambers.flatMap(ch => ch.notes).filter(m => !plan.notes.includes(m) && !subNotes.includes(m));
          return `<div class="list b-inset">${uiSwitchRow({
            label: 'Fill big gaps', help: 'Notes of the key inside steps bigger than a tone',
            on: !!d.fillGaps, action: 'b-design-fill',
          })}</div>
          <p class="b-meta">Smaller steps make smaller, easier holes. Every note of the scale stays; up to ${DESIGN_MAX_HOLES} holes a chamber (8 fingers and 2 thumbs).${d.fillGaps ? (fill.length ? ` Adds ${fill.map(nn).join(', ')}.` : ' No step here is bigger than a tone.') : ''}</p>`;
        })()}
        ${(() => {
          // Sub-holes: notes added below the scale, a semitone or a tone
          // each, played by a finger sliding over its own hole and the
          // small one beside it. The scale stays on the finger holes.
          const subs = d.subHoles ?? 0;
          const ch0 = inst.chambers[0];
          const added = ch0.notes.slice(0, subs);
          const steps = ch0.notes.slice(0, subs + 1).map((m, i, a) => (i ? m - a[i - 1] : null)).slice(1);
          const stepName = n => (n === 1 ? 'a semitone' : 'a tone');
          return `
        <div class="field">
          <div class="field-label">Sub-holes</div>
          <p class="b-text">Small holes beside a finger's hole that add notes below the scale, as on 12-hole ocarinas: the finger slides forward to cover both. The scale itself stays on the finger holes.</p>
          ${uiSeg([{ value: '0', label: 'None' }, { value: '1', label: '1' }, { value: '2', label: '2' }], String(subs), { action: 'b-design-subs', key: 'n', label: 'Sub-holes' })}
          ${subs ? `<p class="b-meta">Adds ${added.map(nn).join(' and ')} below ${nn(ch0.notes[subs])}: ${steps.reverse().map(stepName).join(', then ')} down, in the scale's key where it can.</p>` : ''}
          ${subs === 2 ? `<div class="b-subs-layout">${uiSeg([{ value: 'taiwanese', label: 'Beside R2 and L2' }, { value: 'japanese', label: 'Beside R1 and R2' }], d.subLayout ?? 'taiwanese', { action: 'b-design-sublayout', key: 'v', label: 'Sub-hole layout' })}</div>` : ''}
          ${subs === 1 ? '<p class="b-meta">Beside the left middle finger (L2), which shares the work between the hands.</p>' : ''}
        </div>`;
        })()}
        <div class="field">
          <div class="field-label">${plan.windows.length ? 'Which notes?' : 'Notes'}</div>
          <p class="b-text">${plan.windows.length ? `${plan.chambers === 1 ? 'One chamber holds' : `${plan.chambers} chambers hold`} ${plan.windows.find(w => w.chosen).notes.length}. ` : ''}Tap a note to leave it out.</p>
          ${noteStripHtml(plan, nn, {
            win: start => `data-action="b-design" data-key="windowStart" data-value="${start}"`,
            toggle: m => `data-action="b-design" data-key="toggleNote" data-value="${m}"`,
          })}
        </div>
        <p class="b-meta">${inst.chambers.map((ch, i) => `Chamber ${i + 1}: ${ch.notes.map(nn).join(' ')} · ${ch.holes.length} hole${ch.holes.length !== 1 ? 's' : ''}`).join('<br>')}</p>
        <div class="b-preview" aria-hidden="true">${renderFingering(inst, inst.chambers[0].notes[0], { size: 'medium', useFlats: uf, useSolfege: us })}</div>
      </div>
      ${earlierBuilds(inst).length ? `
        <details class="b-details" ${b.fromId ? 'open' : ''}>
          <summary>${icon('chevron-right')} Start from an earlier build</summary>
          ${uiField({ label: 'Earlier build', id: 'b-from', help: 'Copies its design, clay body, window and test hole, and shows its readings beside yours.', control: uiPicker({
            id: 'b-from', value: b.fromId ?? '', label: 'Earlier build', action: 'b-from',
            options: [{ value: '', label: 'None' }, ...earlierBuilds(inst).map(i => ({ value: i.id, label: i.name }))],
          }) })}
        </details>` : ''}`;
  }

  if (stage === 'body') {
    const clays = getClayBodies();
    const clay = clays.find(c => c.id === b.clayBody);
    const plans = bodyPlan(inst);
    body = `
      <div class="card b-card">
        ${uiField({ label: 'Clay body', id: 'b-clay', help: `${clay?.builds ? `Learned from ${clay.builds} build${clay.builds !== 1 ? 's' : ''}. ` : clay ? '' : 'Choose one, so a finished build teaches it its shrinkage. '}<button type="button" class="link-btn" data-action="open-clay-bodies">Manage clay bodies in Settings</button>`, control: `
          <select class="select" id="b-clay" data-action="b-clay">
            ${clay ? '' : `<option value="" selected disabled>Not chosen · ${b.shrinkPct}%</option>`}
            ${clays.map(c => `<option value="${escHtml(c.id)}" ${b.clayBody === c.id ? 'selected' : ''}>${escHtml(c.name)} · ${c.shrinkPct}%</option>`).join('')}
            <option value="__new__">Add a clay body…</option>
          </select>` })}
        <details class="b-details">
          <summary>${icon('chevron-right')} Advanced</summary>
          ${uiField({ label: 'Shrinkage for this build', control: unitInput({ value: b.shrinkPct, unit: '%', label: 'Shrinkage for this build, %', attrs: 'data-action="b-shrink"', step: '0.1', min: '0', max: '30' }) })}
        </details>
      </div>
      ${inst.chambers.map((ch, i) => {
        const p = plans[i];
        const win = p.window;
        const round = win.shape === 'round';
        const shapes = [['rect', 'Rectangle'], ['round', 'Round'], ['oval', 'Oval']];
        return `
        <div class="overline b-overline">Chamber ${i + 1} · closed note ${nn(ch.notes[0])}</div>
        <div class="card b-card">
          <div class="field">
            <div class="field-label" id="b-shape-${i}">Window shape</div>
            <div class="seg" role="radiogroup" aria-labelledby="b-shape-${i}">
              ${shapes.map(([sh, label]) => `<button type="button" class="seg-opt" role="radio" aria-checked="${win.shape === sh ? 'true' : 'false'}"
                data-action="b-window" data-ci="${i}" data-key="shape" data-value="${sh}">${shapeIcon(sh)} ${label}</button>`).join('')}
            </div>
          </div>
          <div class="b-dims${round ? ' is-round' : ''}">
            ${uiField({ label: round ? 'Diameter' : 'Width', control: unitInput({ value: win.w, unit: 'mm', label: `${round ? 'Diameter' : 'Width'}, mm`, attrs: `data-action="b-window" data-ci="${i}" data-key="w"` }) })}
            ${round ? '' : uiField({ label: 'Length', control: unitInput({ value: win.l, unit: 'mm', label: 'Length, mm', attrs: `data-action="b-window" data-ci="${i}" data-key="l"` }) })}
            ${uiField({ label: 'Wall', control: unitInput({ value: win.t, unit: 'mm', label: 'Wall, mm', attrs: `data-action="b-window" data-ci="${i}" data-key="t"` }) })}
          </div>
          <dl class="b-result">
            <div><dt>Inside volume</dt><dd>${Math.round(p.volume)} ml</dd></div>
            <div><dt>Form around a ball</dt><dd>${Math.round(p.ballDiameter)} mm</dd></div>
            <div><dt>After firing</dt><dd>~${Math.round(p.firedVolume)} ml</dd></div>
          </dl>
          <p class="b-meta">A starting point: the finished pitch can land a couple of semitones away, which the next step corrects.</p>
        </div>`;
      }).join('')}`;
  }

  if (stage === 'leather') {
    const ch = inst.chambers[ci];
    const cb = chamberBuild(inst, ci);
    const r = cb.readings.leather ?? {};
    const targets = stageTargets(ch, 'leather', shrink, b.a4);
    const plan = leatherHolePlan(ch, { f0: r.f0, d: r.d ?? cb.testHoleMm, f1: r.f1 }, shrink, b.a4);
    const old = from?.build?.perChamber?.[ci]?.readings?.leather;
    const closedAdv = r.f0 > 0 ? noteAdvice('leather', r.f0, targets[ch.notes[0]]) : null;
    const done = plan ? plan.holes.filter(h => cb.holesDone.includes(h.index)).length : 0;
    body = `
      <div class="card b-card">
        <h3 class="b-card-title">1 · Closed pitch</h3>
        <p class="b-text">Cover all holes and blow.</p>
        <p class="b-target-line">Target ${nn(ch.notes[0])} · ${targets[ch.notes[0]].toFixed(1)} Hz</p>
        ${uiHzField(`${ci}:leather:f0`, r.f0, { label: 'Closed pitch, Hz' })}
        ${closedAdv ? recStatus('leather', closedAdv, closedAdv.status === 'ok' ? 'Closed note in tune'
          : closedAdv.status === 'flat' ? `${Math.abs(closedAdv.cents)} cents flat: open the window slightly`
          : `${closedAdv.cents} cents sharp: the chamber is a little small for this note`) : ''}
        ${old?.f0 ? `<div class="b-meta">last build ${old.f0.toFixed(1)}</div>` : ''}
      </div>
      <div class="card b-card">
        <h3 class="b-card-title">2 · Test hole</h3>
        <p class="b-text">Drill a test hole where ${escHtml((ch.holes.find(h => !h.sub) ?? ch.holes[0]).finger)} goes.</p>
        ${uiField({ label: 'Diameter', control: unitInput({ value: r.d ?? cb.testHoleMm, unit: 'mm', label: 'Test hole diameter, mm', attrs: `data-action="b-input" data-path="${ci}:leather:d"` }) })}
        <p class="b-text">Blow with only that hole open:</p>
        ${uiHzField(`${ci}:leather:f1`, r.f1, { label: 'Test hole pitch, Hz' })}
      </div>
      <div class="card b-card">
        <h3 class="b-card-title">3 · Drill the holes${plan ? ` <span class="b-card-count">${done}/${plan.holes.length}</span>` : ''}</h3>
        ${plan ? `
          <p class="b-text">In this order. Sizes are at leather-hard; targets are ${(shrink * 100).toFixed(1)}% lower for shrinkage.</p>
          ${plan.holes.some(h => h.sub) ? `<p class="b-text">Sub-holes first: each sits right beside its finger's hole, just past it toward the fingertip, so the finger covers its own hole and then slides forward to cover both. Leave the finger holes for the next steps.</p>` : ''}
          <div class="b-holes">
            ${plan.holes.map(h => {
              const midi = ch.notes[h.index + 1];
              const isDone = cb.holesDone.includes(h.index);
              const measured = r.notes?.[midi];
              const adv = measured > 0 ? noteAdvice('leather', measured, targets[midi]) : null;
              const size = h.parts.length > 1 ? `${h.parts.length} × ${h.parts[0].toFixed(1)} mm` : `${h.mm.toFixed(1)} mm`;
              return `
              <div class="b-hole${isDone ? ' is-done' : ''}">
                <button type="button" class="b-check" role="checkbox" aria-checked="${isDone ? 'true' : 'false'}"
                  data-action="b-hole-done" data-ci="${ci}" data-index="${h.index}" aria-label="${escHtml(bHoleName(h))} drilled">
                  <span class="checkbox" aria-hidden="true">${isDone ? icon('check') : ''}</span>
                </button>
                <div class="b-hole-main">
                  <div class="b-hole-head">
                    <span class="b-finger">${escHtml(bHoleName(h))}</span><span class="b-size">${size}</span>
                    ${h.index === plan.testHoleIndex ? uiBadge('Your test hole', 'accent') : ''}
                  </div>
                  <div class="b-meta">${nn(midi)} → ${targets[midi].toFixed(1)} Hz</div>
                  ${uiHzField(`${ci}:leather:n:${midi}`, measured, { label: `${nn(midi)}, Hz` })}
                  ${adv ? recStatus('leather', adv, adv.status === 'ok' ? `${nn(midi)} in tune` : `${nn(midi)} is ${adv.text}`) : ''}
                </div>
              </div>`;
            }).join('')}
          </div>` : `<div class="b-empty">${icon('info')}<span>Record the closed pitch and the test-hole pitch to see every hole's size.</span></div>`}
      </div>`;
  }

  if (['boneDry', 'bisque', 'final'].includes(stage)) {
    const intro = {
      boneDry: 'Blow every note once more. Pitch rises while the clay dries; small corrections are still possible with careful filing.',
      bisque: 'After the first firing the targets are concert pitch. Flat notes can be filed larger; sharp ones can\'t be lowered.',
      final: 'After the glaze firing, a last pass records the finished tuning.',
    }[stage];
    const ch = inst.chambers[ci];
    const targets = stageTargets(ch, stage, shrink, b.a4);
    body = `
      <p class="b-intro">${intro}</p>
      <div class="card b-card b-readings">
        ${ch.notes.map(midi => bNoteReading(inst, ci, stage, midi, targets, nn, from)).join('')}
      </div>`;
  }

  if (stage === 'done') {
    const learned = b.learnedShrink;
    const clayName = getClayBodies().find(c => c.id === b.clayBody)?.name ?? 'this clay';
    body = `
      <div class="card b-card">
        <h3 class="b-done-title">${icon('check')} ${escHtml(inst.name)} is finished</h3>
        <p class="b-text">It's playable from the Notes and Chords tabs, with its hole sizes and measured pitches stored.</p>
        ${learned != null ? `
          <dl class="b-result">
            <div><dt>Shrinkage, leather-hard to fired</dt><dd>${(learned * 100).toFixed(1)}%</dd></div>
          </dl>
          <p class="b-meta">That's now the default for ${escHtml(clayName)}.</p>` : ''}
        ${inst.chambers.map((ch, i) => {
          const byFinger = [];
          ch.holes.forEach(h => {
            const last = byFinger[byFinger.length - 1];
            if (last && last.finger === bHoleName(h)) last.n++; else byFinger.push({ finger: bHoleName(h), n: 1, mm: h.sizeMm });
          });
          return `
            <table class="b-table">
              <caption>${inst.chambers.length > 1 ? `Chamber ${i + 1} · ` : ''}hole sizes</caption>
              <thead><tr><th scope="col">Finger</th><th scope="col">Size</th></tr></thead>
              <tbody>${byFinger.map(g => `<tr><td>${escHtml(g.finger)}</td><td>${g.mm ? (g.n > 1 ? g.n + ' × ' : '') + g.mm.toFixed(1) + ' mm' : '—'}</td></tr>`).join('')}</tbody>
            </table>`;
        }).join('')}
      </div>
      <div class="b-actions">
        <button type="button" class="btn btn-primary" data-action="oc-tab" data-tab="notes">Open Notes</button>
        <button type="button" class="btn btn-secondary" data-action="share-instrument">${icon('share-2')} Share…</button>
      </div>`;
  }

  const nextLabel = stage === 'final' ? 'Finish' : stage === 'done' ? '' : `Next: ${stageName(nextStage(stage))}`;
  return `${ocHeader(inst, 'builder')}
    <div class="b-layout">
      <div class="b-main">
        ${bStepsHtml(stage)}
        ${perChamber ? bChamberSwitch(inst, nn) : ''}
        ${body}
        ${nextLabel || stage === 'bisque' ? `
          <div class="b-actions">
            ${nextLabel ? `<button type="button" class="btn btn-primary b-next" data-action="b-next">${escHtml(nextLabel)}${stage === 'final' ? '' : ` ${icon('chevron-right')}`}</button>` : ''}
            ${stage === 'bisque' ? '<button type="button" class="btn btn-ghost b-next" data-action="b-unglazed">Unglazed: finish now</button>' : ''}
          </div>` : ''}
      </div>
      ${bPreviewHtml(inst, stage, nn)}
    </div>`;
}

// Set-up for a bought ocarina (§6.17): which finger covers each hole
// (folded into a sheet), then one reading with all holes closed and one per
// hole open on its own. A capture arms the next empty reading by itself.
function setupOf(inst) {
  if (inst.setup) return inst.setup;
  // From a published chart: its own holes (the owner may rename fingers).
  if (inst.kind === 'traditional') return { holes: (inst.chambers?.[0]?.holes ?? []).map(h => ({ ...h })) };
  return { holes: defaultCustomHoles(inst.holeCount), f0: null, singles: [] };
}

// Holes of a bought flute live in its flute set-up; everything else in setupOf.
function holesSetupOf(inst) {
  return inst.family === 'flute' && inst.kind === 'custom' ? fluteSetupOf(inst) : setupOf(inst);
}

function viewSetup(inst) {
  if (state.oc.holeMap && inst.family === 'ocarina') return viewHoleMap(inst);
  if (inst.kind === 'traditional') return viewChartSetup(inst);
  if (inst.family === 'flute') return viewFluteSetup(inst);
  const setup = setupOf(inst);
  const mapped = setup.holes.filter((h, i) => h.side !== 'bottom' && inst.holeMap?.[i]).length;
  const tops = setup.holes.filter(h => h.side !== 'bottom').length;
  // Listed by finger (R1 first), not in the stored opening order.
  const paths = ['s:f0', ...holeDisplayOrder(setup.holes).map(i => `s:${i}`)];
  const holeOf = p => parseInt(p.slice(2), 10);
  const value = p => (p === 's:f0' ? setup.f0 : setup.singles[holeOf(p)]);
  const filled = paths.filter(p => value(p) > 0).length;
  const left = paths.length - filled;
  const next = paths.find(p => !(value(p) > 0));
  const standard = defaultCustomHoles(setup.holes.length).every((h, i) => h.finger === setup.holes[i].finger);
  const subs = setup.holes.filter(h => h.sub).length;
  const label = p => (p === 's:f0' ? 'All holes closed' : `Only ${escHtml(holeLabel(setup.holes, holeOf(p)))} open`);
  return `${ocHeader(inst, 'setup')}
    <div class="b-layout is-single">
      <div class="b-main">
        <h2 class="b-title">Set up</h2>
        <p class="b-intro">Everything about your ocarina: what it's called, its holes and fingers, and the readings its fingering chart is worked out from.</p>
        ${instSetupCardHtml(inst)}
        ${holeMapCardHtml(inst)}
        <div class="card b-card">
          <div class="b-card-head">
            <div class="b-card-head-text">
              <h3 class="b-card-title">Holes and fingers</h3>
              <p class="b-meta">${setup.holes.length} holes · ${standard ? 'standard order' : 'your order'}${subs ? ` · ${subs} sub-hole${subs !== 1 ? 's' : ''}` : ''}</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" data-action="s-fingers-open" aria-haspopup="dialog">${icon('pencil')} Edit</button>
          </div>
          <p class="b-fingers">${holeDisplayOrder(setup.holes).map(i => escHtml(holeLabel(setup.holes, i))).join(' · ')}</p>
          ${duplicateFingers(setup.holes).length ? `<p class="b-meta is-warning">More than one hole is on ${duplicateFingers(setup.holes).join(', ')}: tap Edit to check.</p>` : ''}
        </div>
        <div class="card b-card">
          <div class="b-card-head">
            <h3 class="b-card-title">Readings</h3>
            <span class="b-card-count">${filled} of ${paths.length}</span>
          </div>
          <div class="practice-progress" role="progressbar" aria-label="Readings recorded" aria-valuemin="0" aria-valuemax="${paths.length}" aria-valuenow="${filled}">
            <span style="width:${Math.round((filled / paths.length) * 100)}%"></span>
          </div>
          <p class="b-meta">Blow each line into the tuner: tap ${icon('mic')}<span class="sr-only">the microphone</span>, blow steadily at a medium breath, and it fills itself in.</p>
          <div class="s-readings">
            ${paths.map((p, i) => {
              const v = value(p);
              const isNext = p === next;
              return `
                <div class="s-reading${isNext ? ' is-next' : ''}${v > 0 ? ' is-filled' : ''}">
                  <div class="s-reading-head">
                    ${mapped && p !== 's:f0' ? `<span class="s-reading-map" aria-hidden="true">${holeMapSvg(inst, { highlight: holeOf(p), mini: true })}</span>` : ''}
                    <span class="s-reading-label">${label(p)}</span>
                    ${isNext ? uiBadge('Next', 'accent') : v > 0 ? `<span class="s-done" aria-label="Recorded">${icon('check')}</span>` : ''}
                  </div>
                  ${uiHzField(p, v, { label: `${p === 's:f0' ? 'All holes closed' : `Only ${holeLabel(setup.holes, holeOf(p))} open`}, Hz` })}
                </div>`;
            }).join('')}
          </div>
        </div>
        <div class="b-actions">
          <button type="button" class="btn btn-primary b-next" data-action="s-calibrate" ${left ? 'disabled' : ''}>Work out the fingering chart</button>
        </div>
        <p class="b-meta">${left ? `${left} reading${left !== 1 ? 's' : ''} to go` : 'Every reading is in.'}</p>
        ${inst.calibration ? `<p class="b-meta">Current chart: ${playableMidis(inst).length} notes. Predicted fingerings are within 20 cents; check them with the tuner.</p>` : ''}
      </div>
    </div>`;
}

// Set up for a flute that isn't charted (Other flute): one reading with all
// holes closed, then one more for each hole lifted, from the bottom up, the
// lower ones staying open. Paths "f:<step>". Holes count from the mouthpiece.
function fluteSetupOf(inst) {
  return inst.setup ?? { holes: fluteHoles(inst.holeCount), readings: [] };
}

function fluteSetupPaths(setup) {
  return Array.from({ length: setup.holes.length + 1 }, (_, k) => `f:${k}`);
}

function fluteStepLabel(n, k) {
  if (k === 0) return 'All holes closed';
  if (k === 1) return `Lift the lowest hole (hole ${n})`;
  return k === n ? 'Also lift hole 1: all holes open' : `Also lift hole ${n - k + 1}`;
}

function viewFluteSetup(inst) {
  const setup = fluteSetupOf(inst);
  const n = setup.holes.length;
  const uf = state.useFlats, us = state.useSolfege;
  const paths = fluteSetupPaths(setup);
  const value = k => setup.readings[k];
  const filled = paths.filter((_, k) => value(k) > 0).length;
  const left = paths.length - filled;
  const next = paths.findIndex((_, k) => !(value(k) > 0));
  // Heard note per reading, and readings that repeat an earlier note.
  const heard = paths.map((_, k) => {
    if (!(value(k) > 0)) return null;
    const exact = hzToMidi(value(k));
    return { midi: Math.round(exact), cents: Math.round((exact - Math.round(exact)) * 100) };
  });
  const firstWith = midi => heard.findIndex(h => h?.midi === midi);
  const cents = c => (c === 0 ? '0 ¢' : `${c > 0 ? '+' : '−'}${Math.abs(c)} ¢`);
  const pattern = k => fluteStepStates(n, k).map(st => (st === 'c' ? '●' : '○')).join(' ');
  const dropped = inst.calibration?.dropped ?? [];
  return `${ocHeader(inst, 'setup')}
    <div class="b-layout is-single">
      <div class="b-main">
        <h2 class="b-title">Set up</h2>
        <p class="b-intro">Blow each line into the tuner. Tap ${icon('mic')}<span class="sr-only">the microphone</span>, blow, and it fills itself in.</p>
        <p class="b-meta">Holes count from the mouthpiece down: hole 1 is nearest your mouth. Lifted holes stay open for the lines below. Blow steadily at a medium breath.</p>
        ${instSetupCardHtml(inst)}
        <div class="card b-card">
          <div class="b-card-head">
            <div class="b-card-head-text">
              <h3 class="b-card-title">Holes and fingers</h3>
              <p class="b-meta">${n} holes, from the mouthpiece down</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" data-action="s-fingers-open" aria-haspopup="dialog">${icon('pencil')} Edit</button>
          </div>
          <p class="b-fingers">${setup.holes.map(h => escHtml(h.finger)).join(' ')}</p>
        </div>
        <div class="card b-card">
          <div class="b-card-head">
            <h3 class="b-card-title">Readings</h3>
            <span class="b-card-count">${filled} of ${paths.length}</span>
          </div>
          <div class="practice-progress" role="progressbar" aria-label="Readings recorded" aria-valuemin="0" aria-valuemax="${paths.length}" aria-valuenow="${filled}">
            <span style="width:${Math.round((filled / paths.length) * 100)}%"></span>
          </div>
          <div class="s-readings">
            ${paths.map((p, k) => {
              const v = value(k);
              const h = heard[k];
              const repeat = h && firstWith(h.midi) < k;
              const isNext = k === next;
              return `
                <div class="s-reading${isNext ? ' is-next' : ''}${v > 0 ? ' is-filled' : ''}">
                  <div class="s-reading-head">
                    <span class="s-reading-label">${escHtml(fluteStepLabel(n, k))}</span>
                    ${isNext ? uiBadge('Next', 'accent') : v > 0 ? `<span class="s-done" aria-label="Recorded">${icon('check')}</span>` : ''}
                  </div>
                  <div class="b-meta fl-step"><span class="fl-pattern" aria-hidden="true">${pattern(k)}</span>${h ? ` · ${escHtml(displayNote(midiToNoteName(h.midi), uf, us))} ${cents(h.cents)}` : ''}${repeat ? ` · <span class="is-warning">same note as “${escHtml(fluteStepLabel(n, firstWith(h.midi)))}”</span>` : ''}</div>
                  ${uiHzField(p, v, { label: `${fluteStepLabel(n, k)}, Hz` })}
                </div>`;
            }).join('')}
          </div>
        </div>
        <div class="b-actions">
          <button type="button" class="btn btn-primary b-next" data-action="f-work-out" ${left ? 'disabled' : ''}>Work out the chart</button>
        </div>
        <p class="b-meta">${left ? `${left} reading${left !== 1 ? 's' : ''} to go` : 'Every reading is in.'}</p>
        ${inst.calibration ? `<p class="b-meta">Current chart: ${playableMidis(inst).length} notes, each the nearest note to what you blew.${dropped.length ? ` ${dropped.length} reading${dropped.length !== 1 ? 's' : ''} gave a note already charted and ${dropped.length !== 1 ? 'were' : 'was'} left out.` : ''}</p>` : ''}
      </div>
    </div>`;
}

// Hole fingers: which finger covers each hole, in opening order.
// ── Photo and hole layout of a bought instrument ─────────────────────────────

function instEditMeta(inst) {
  return inst.kind === 'custom' && !usesLayout(inst) ? 'Name, photo, holes, fingers and readings' : 'Name and photo';
}

// A photo from the camera or the library, read at up to 1600 px on the long
// side for cropping: { src (JPEG data URL), iw, ih }.
async function readImageFile(file, max = 1600) {
  let src = null;
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (_) {
    src = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(src.width * k);
  canvas.height = Math.round(src.height * k);
  canvas.getContext('2d').drawImage(src, 0, 0, canvas.width, canvas.height);
  return { src: canvas.toDataURL('image/jpeg', 0.9), iw: canvas.width, ih: canvas.height };
}

// Every photo of an instrument has the same shape, so pictures line up:
// 4:3 for an ocarina or kalimba, long and thin (3:1) for a flute, square for a round drum.
function photoRatio(inst) { return inst.family === 'flute' ? 3 : inst.family === 'handpan' || inst.family === 'tongue-drum' ? 1 : 4 / 3; }

// Crop step after picking a photo: the photo under a frame of that shape;
// drag to move it, the slider (or a pinch / the wheel) to zoom.
function photoCropSheet() {
  const c = state.photoCrop;
  return uiSheet({
    key: 'photo-crop', title: 'Fit the photo', close: 'crop-cancel',
    body: `
      <p class="sheet-text">Drag the photo so the instrument fills the frame, top side up. Zoom in to crop closer; Rotate turns an upright photo.</p>
      <div class="crop-stage" style="aspect-ratio: ${c.ratio}"><img class="crop-img" src="${c.src}" alt="" draggable="false"></div>
      <div class="crop-tools">
        <label class="crop-zoom-row">${icon('search')}<input type="range" class="crop-zoom" data-action="crop-zoom" min="1" max="4" step="0.01" value="${c.zoom}" aria-label="Zoom"></label>
        <button type="button" class="btn btn-secondary btn-sm" data-action="crop-rotate" title="Turn the photo a quarter turn">${icon('rotate')} Rotate</button>
      </div>`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="crop-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" data-action="crop-done">Use photo</button>`,
  });
}

// A quarter turn clockwise (a photo taken upright), as a new image.
async function rotateCropImage() {
  const c = state.photoCrop;
  if (!c) return;
  const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = c.src; });
  const canvas = document.createElement('canvas');
  canvas.width = c.ih; canvas.height = c.iw;
  const g = canvas.getContext('2d');
  g.translate(c.ih, 0);
  g.rotate(Math.PI / 2);
  g.drawImage(img, 0, 0);
  Object.assign(c, { src: canvas.toDataURL('image/jpeg', 0.9), iw: canvas.width, ih: canvas.height, zoom: 1, cx: 0.5, cy: 0.5 });
  render();
}

// Places the photo under the frame from state.photoCrop (no re-render).
function layoutCrop() {
  const c = state.photoCrop;
  const stage = document.querySelector('.crop-stage');
  const img = stage?.querySelector('.crop-img');
  if (!c || !img) return;
  const r = cropRect(c);
  const k = stage.clientWidth / r.sw;
  Object.assign(img.style, { width: `${c.iw * k}px`, height: `${c.ih * k}px`, left: `${-r.sx * k}px`, top: `${-r.sy * k}px` });
  // Keep the centre inside the image, as the frame shows it.
  c.cx = (r.sx + r.sw / 2) / c.iw;
  c.cy = (r.sy + r.sh / 2) / c.ih;
}

// The cropped photo, at most 720 px wide, saved on the instrument. A new
// photo moves everything, so marked holes are cleared.
function finishCrop() {
  const c = state.photoCrop;
  const inst = c && getInstrument(c.id);
  const img = document.querySelector('.crop-img');
  if (!inst || !img) { state.photoCrop = null; render(); return; }
  const r = cropRect(c);
  const w = Math.round(Math.min(720, r.sw)), h = Math.round(w / c.ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
  if (inst.photo) delete inst.holeMap;
  inst.photo = { src: canvas.toDataURL('image/jpeg', 0.78), aspect: c.ratio };
  saveInstrument(inst);
  refreshInstruments();
  state.photoCrop = null;
  render();
}

// Dragging, pinching and wheel-zooming the photo under the crop frame.
const _cropPointers = new Map();
let _cropPinch = null;
document.addEventListener('pointerdown', e => {
  const stage = e.target.closest?.('.crop-stage');
  if (!stage || !state.photoCrop) return;
  e.preventDefault();
  stage.setPointerCapture?.(e.pointerId);
  _cropPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (_cropPointers.size === 2) {
    const [a, b] = [..._cropPointers.values()];
    _cropPinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: state.photoCrop.zoom };
  }
});
document.addEventListener('pointermove', e => {
  const c = state.photoCrop;
  const prev = _cropPointers.get(e.pointerId);
  if (!c || !prev) return;
  _cropPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const stage = document.querySelector('.crop-stage');
  if (!stage) return;
  if (_cropPointers.size === 2 && _cropPinch) {
    const [a, b] = [..._cropPointers.values()];
    c.zoom = Math.min(4, Math.max(1, _cropPinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / (_cropPinch.d || 1)));
  } else {
    const k = stage.clientWidth / cropRect(c).sw;   // screen px per image px
    c.cx -= (e.clientX - prev.x) / k / c.iw;
    c.cy -= (e.clientY - prev.y) / k / c.ih;
  }
  layoutCrop();
  const zoom = document.querySelector('.crop-zoom');
  if (zoom) zoom.value = c.zoom;
});
const cropPointerEnd = e => { _cropPointers.delete(e.pointerId); if (_cropPointers.size < 2) _cropPinch = null; };
document.addEventListener('pointerup', cropPointerEnd);
document.addEventListener('pointercancel', cropPointerEnd);
document.addEventListener('wheel', e => {
  if (!state.photoCrop || !e.target.closest?.('.crop-stage')) return;
  e.preventDefault();
  state.photoCrop.zoom = Math.min(4, Math.max(1, state.photoCrop.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
  layoutCrop();
  const zoom = document.querySelector('.crop-zoom');
  if (zoom) zoom.value = state.photoCrop.zoom;
}, { passive: false });

// Name, photo and (for one you set up yourself) the number of holes. In
// the Edit instrument sheet, or at the top of Set up for a bought ocarina
// or flute: one place for everything about it.
function instFieldsHtml(inst) {
  const custom = inst.kind === 'custom' && !usesLayout(inst); // a custom handpan's notes are set on its own tab
  const flute = inst.family === 'flute';
  const n = inst.holeCount ?? 0;
  const id = escHtml(inst.id);
  return `
      ${uiField({ label: 'Name', id: `ie-name-${id}`, control: `<input class="input" id="ie-name-${id}" data-action="ie-name" data-id="${id}" value="${escHtml(inst.name)}" autocomplete="off">` })}
      <div class="field">
        <span class="field-label">Photo</span>
        <div class="ie-photo">
          ${inst.photo?.src ? `<img class="ie-photo-img" src="${inst.photo.src}" alt="Photo of ${escHtml(inst.name)}">`
            : `<span class="ie-photo-empty">${icon(FAMILY_ICONS[inst.family] ?? 'music')}</span>`}
          <div class="ie-photo-actions">
            <label class="btn btn-secondary btn-sm">${icon('camera')} ${inst.photo ? 'Change photo' : 'Add photo'}
              <input type="file" accept="image/*" class="sr-only" data-action="ie-photo" data-id="${id}"></label>
            ${inst.photo ? `<button type="button" class="btn btn-ghost btn-sm" data-action="ie-photo-remove" data-id="${id}">Remove</button>` : ''}
          </div>
        </div>
        <div class="field-help">Shown next to its name${inst.family === 'ocarina' && custom ? ', and used to mark where the holes are' : ''}. A photo of the top works best.</div>
      </div>
      ${instKeyFieldHtml(inst)}
      ${custom ? uiField({
        label: flute ? 'Finger holes' : 'Holes, thumb holes included', id: 'ie-holes',
        control: uiStepper({ value: n, label: 'Holes', action: 'ie-holes-step', data: { id: inst.id }, min: n <= (flute ? 3 : 1), max: n >= (flute ? 8 : 13) }),
        help: inst.chambers?.length || inst.setup ? 'Changing this clears the fingering chart; set it up again with the new holes.' : '',
      }) : ''}`;
}

// Key of an instrument made from a published chart, when the chart has
// more than one: changing it moves every note (the fingerings stay).
function instKeyFieldHtml(inst) {
  if (inst.kind !== 'traditional') return '';
  const chart = getChart(inst.type);
  if (!chart || chart.keys.length < 2) return '';
  const key = chart.keys.find(k => k.id === inst.key) ?? chart.keys[0];
  return uiField({
    label: 'Key', id: `ie-key-${escHtml(inst.id)}`,
    control: uiPicker({
      id: `ie-key-${inst.id}`, value: key.id, label: 'Key', action: 'ie-key', data: { id: inst.id },
      options: chart.keys.map(k => ({
        value: k.id, label: chart.octaves ? ocKeyLabel(k) : k.name, group: chart.octaves ? ocKeyOctaveName(k) : undefined,
        keywords: [...(k.root ? noteSearchWords(k.root) : []), ...noteSearchWords(k.lowest)],
      })),
    }),
    help: 'All holes closed sounds the lowest note. Changing the key moves every note; the fingerings stay the same.',
  });
}

// The Edit instrument sheet: ocarinas and flutes without a Set up tab
// (from a published chart, or designed here). Name and photo.
function instEditSheet() {
  const inst = getInstrument(state.instEdit);
  if (!inst) return '';
  return uiSheet({
    key: 'inst-edit', title: 'Edit instrument', close: 'inst-edit-close',
    body: instFieldsHtml(inst),
    footer: '<button type="button" class="btn btn-primary" data-action="inst-edit-close">Done</button>',
  });
}

// Where the holes are: the photo with the marked holes, and Mark / Edit.
function holeMapCardHtml(inst) {
  const holes = setupOf(inst).holes;
  const mapped = holes.filter((h, i) => h.side !== 'bottom' && inst.holeMap?.[i]).length;
  const tops = holes.filter(h => h.side !== 'bottom').length;
  return `
        <div class="card b-card">
          <div class="b-card-head">
            <div class="b-card-head-text">
              <h3 class="b-card-title">Where the holes are</h3>
              <p class="b-meta">${inst.photo ? '' : 'No photo yet · '}${mapped} of ${tops} marked</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" data-action="hm-open">${icon('pencil')} ${mapped ? 'Edit' : 'Mark'}</button>
          </div>
          ${inst.photo || mapped ? `<button type="button" class="hm-preview" data-action="hm-open" aria-label="Edit where the holes are">${holeMapSvg(inst, { fingers: true })}</button>`
            : '<p class="b-meta">Add a photo of the top of your ocarina, then tap where each hole is. The fingering pictures then show your own ocarina.</p>'}
        </div>`;
}

// Set up of an ocarina or flute from a published chart: name, photo, key,
// where the holes are (ocarinas), which finger covers each hole, and the
// notes whose fingering you changed. No readings: the chart gives the notes.
function viewChartSetup(inst) {
  const setup = setupOf(inst);
  const chart = getChart(inst.type);
  const fixed = Object.keys(inst.setup?.fixed ?? {}).map(Number).sort((a, b) => a - b);
  const uf = state.useFlats, us = state.useSolfege;
  return `${ocHeader(inst, 'setup')}
    <div class="b-layout is-single">
      <div class="b-main">
        <h2 class="b-title">Set up</h2>
        <p class="b-intro">Your ${inst.family === 'flute' ? 'flute' : 'ocarina'} plays from ${escHtml(chart?.sourceName ? `the ${chart.sourceName} chart` : 'a published chart')}. Make it yours: its name and photo, ${inst.family === 'ocarina' ? 'where its holes are, ' : ''}and which finger covers each hole.</p>
        ${instSetupCardHtml(inst)}
        ${inst.family === 'ocarina' ? holeMapCardHtml(inst) : ''}
        <div class="card b-card">
          <div class="b-card-head">
            <div class="b-card-head-text">
              <h3 class="b-card-title">Holes and fingers</h3>
              <p class="b-meta">${setup.holes.length} holes${inst.family === 'flute' ? ', from the mouthpiece down' : ''}</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" data-action="s-fingers-open" aria-haspopup="dialog">${icon('pencil')} Edit</button>
          </div>
          <p class="b-fingers">${setup.holes.map(h => escHtml(h.finger) + (h.sub ? '·sub' : '')).join(' ')}</p>
        </div>
        <div class="card b-card">
          <h3 class="b-card-title">Your fingerings</h3>
          <p class="b-meta">${fixed.length
            ? `Played your way: ${fixed.map(m => escHtml(displayNote(midiToNoteName(m), uf, us))).join(', ')}. The chart's fingering is a tap away on each note.`
            : 'None yet. On Notes, pick a note and tap "Not how you play it?" to set the fingering you use.'}</p>
        </div>
      </div>
    </div>`;
}

// The card at the top of Set up.
function instSetupCardHtml(inst) {
  return `
        <div class="card b-card ie-card">
          <h3 class="b-card-title">Your ${inst.family === 'flute' ? 'flute' : 'ocarina'}</h3>
          ${instFieldsHtml(inst)}
        </div>`;
}

const HM_W = 1000;

// The instrument's photo (or a plain body when there's none) with its
// marked holes. opts: sel (hole being placed, editor), highlight (one hole
// drawn open, the reading list), fingers (label the spots), mini.
function holeMapSvg(inst, { sel = null, highlight = null, fingers = false, mini = false } = {}) {
  const aspect = inst.photo?.aspect ?? 1.6;
  const H = Math.round(HM_W / aspect);
  const holes = setupOf(inst).holes;
  const r = mini ? 70 : 34;
  const spots = holes.map((h, i) => ({ h, i, s: holeSpot(inst, i) })).filter(x => x.s);
  const under = holes.map((h, i) => ({ h, i })).filter(x => x.h.side === 'bottom');
  const bg = inst.photo?.src
    ? `<image href="${inst.photo.src}" x="0" y="0" width="${HM_W}" height="${H}"/>`
    : `<rect class="hm-blank" x="0" y="0" width="${HM_W}" height="${H}" rx="40"/>`;
  const marks = spots.map(({ h, i, s }) => {
    const cls = ['hm-spot', i === sel ? 'is-sel' : '', highlight != null ? (i === highlight ? 'is-open' : 'is-closed') : ''].join(' ');
    const text = mini ? '' : `<text class="hm-num" x="${s.x * HM_W}" y="${s.y * H}">${fingers ? escHtml(h.finger) : i + 1}</text>`;
    return `<g class="${cls}"><circle cx="${s.x * HM_W}" cy="${s.y * H}" r="${r}"/>${text}</g>`;
  }).join('');
  const underText = !mini && under.length
    ? `<text class="hm-under" x="24" y="${H - 24}">Underneath: ${under.map(u => escHtml(u.h.finger)).join(', ')}</text>` : '';
  return `<svg class="hm-svg${mini ? ' is-mini' : ''}" viewBox="0 0 ${HM_W} ${H}" preserveAspectRatio="xMidYMid meet">${bg}${marks}${underText}</svg>`;
}

// Marking the holes: pick a hole in the list, tap where it is on the photo;
// the next unmarked hole is picked by itself.
function viewHoleMap(inst) {
  const setup = setupOf(inst);
  const sel = state.oc.holeMap.sel;
  const chips = holeDisplayOrder(setup.holes).map(i => {
    const h = setup.holes[i];
    const under = h.side === 'bottom';
    const done = under || inst.holeMap?.[i];
    return `<button type="button" class="chip hm-chip${i === sel ? ' is-selected' : ''}" data-action="hm-select" data-index="${i}" ${under ? 'disabled' : ''}
      aria-pressed="${i === sel ? 'true' : 'false'}">${escHtml(holeLabel(setup.holes, i))}${under ? ' · under' : done ? ` ${icon('check')}` : ''}</button>`;
  }).join('');
  const selHole = sel != null ? setup.holes[sel] : null;
  return `${ocHeader(inst, 'setup')}
    <div class="b-layout is-single">
      <div class="b-main">
        <h2 class="b-title">Where the holes are</h2>
        <p class="b-intro">${selHole ? `Tap where the ${escHtml(holeLabel(setup.holes, sel))} hole is.` : 'Every hole is marked. Tap a hole below to move it.'}</p>
        ${inst.photo ? '' : `<p class="b-meta">No photo yet: <button type="button" class="btn-link" data-action="inst-edit-open" data-id="${escHtml(inst.id)}">add one</button>, or mark the holes on the plain shape.</p>`}
        <div class="hm-stage" data-action="hm-place">${holeMapSvg(inst, { sel, fingers: true })}</div>
        <div class="chips hm-chips">${chips}</div>
        ${selHole ? uiField({
          label: 'Finger on this hole', id: `s-finger-${sel}`,
          control: `<select class="select" id="s-finger-${sel}" data-action="s-finger" data-index="${sel}">
            ${OC_FINGER_ORDER.map(f => `<option value="${f}" ${selHole.finger === f ? 'selected' : ''}>${f}</option>`).join('')}
          </select>`,
          help: 'A thumb (LT, RT) puts the hole underneath.',
        }) : ''}
        <p class="b-meta">Thumb holes underneath don't need a spot. Not sure which finger is which? See the ⋯ menu.</p>
        <div class="b-actions">
          ${selHole && inst.holeMap?.[sel] ? '<button type="button" class="btn btn-ghost" data-action="hm-clear">Clear this spot</button>' : ''}
          <button type="button" class="btn btn-primary b-next" data-action="hm-close">Done</button>
        </div>
      </div>
    </div>`;
}

function hmFirstUnmarked(inst) {
  const holes = setupOf(inst).holes;
  const i = holeDisplayOrder(holes).find(k => holes[k].side !== 'bottom' && !inst.holeMap?.[k]);
  return i ?? null;
}

// ── Changing a note's fingering by hand (bought ocarinas) ────────────────────

function fgEditable(inst) {
  if (inst.id === SHARED_ID || inst.chambers?.length !== 1) return false;
  return inst.kind === 'traditional' || (inst.kind === 'custom' && inst.family === 'ocarina');
}

// The selected note's fingering while it's being changed: tap a hole to go
// covered → open → half; the calibration says roughly what it would sound.
function fgEditStageHtml(inst, opts) {
  const ed = state.oc.fgEdit;
  const ch = inst.chambers[0];
  const tmp = { ...inst, chambers: [{ ...ch, fingerings: { ...ch.fingerings, [ed.midi]: ed.states } }] };
  const uf = state.useFlats, us = state.useSolfege;
  const cal = inst.calibration;
  let guess = '';
  if (cal?.f0 > 0 && cal.ratios?.length === ed.states.length) {
    const hz = predictFingeringHz(cal.f0, cal.ratios, ed.states);
    const p = pitchLabel(hz, { useFlats: uf, useSolfege: us });
    guess = `From your readings this fingering should sound about ${escHtml(p.text)}.`;
  }
  const fixed = inst.setup?.fixed?.[ed.midi];
  return `
    <div class="fg-stage is-editing">
      ${renderFingering(tmp, ed.midi, { ...opts, size: 'large', showFingers: true, editable: true })}
      <p class="fg-edit-help">Tap a hole: covered → open → half. Blow it with the tuner on to check.</p>
      ${guess ? `<p class="fg-edit-help">${guess}</p>` : ''}
      ${inst.kind !== 'custom' ? '' : `<div class="fg-edit-rec">
        <div class="field-label">What it really sounds (optional)</div>
        ${uiHzField('e:hz', ed.hz ?? null, { label: 'What this fingering sounds in Hz' })}
        <p class="fg-edit-help">Tap ${icon('mic')}<span class="sr-only">the microphone</span> and blow this fingering: the reading is added to your set-up readings, so the other notes are worked out better too.</p>
      </div>`}
      <div class="fg-edit-actions">
        ${fixed ? `<button type="button" class="btn btn-ghost btn-sm" data-action="fg-edit-reset">${inst.kind === 'traditional' ? 'Use the chart\'s one' : 'Use the worked-out one'}</button>` : ''}
        <button type="button" class="btn btn-secondary btn-sm" data-action="fg-edit-cancel">Cancel</button>
        <button type="button" class="btn btn-primary btn-sm" data-action="fg-edit-save">Save for ${escHtml(displayNote(midiToNoteName(ed.hz > 0 ? Math.round(hzToMidi(ed.hz)) : ed.midi), uf, us))}</button>
      </div>
    </div>`;
}

// "R1 ↔ R4, R2 ↔ R3" for the fingers this hand uses.
function handSwapText(holes, hand) {
  const before = holes.map(h => h.finger);
  const after = reverseHandFingers(holes, hand).map(h => h.finger);
  const pairs = new Set();
  before.forEach((f, i) => { if (f !== after[i]) pairs.add([f, after[i]].sort().join(' ↔ ')); });
  return [...pairs].join(', ');
}

function setupFingersSheet() {
  const inst = currentInstrument();
  if (!inst || (inst.kind !== 'custom' && inst.kind !== 'traditional')) return '';
  const setup = holesSetupOf(inst);
  return uiSheet({
    key: 's-fingers', title: 'Hole fingers', close: 's-fingers-close',
    body: `
      <p class="sheet-text">Check which finger covers each hole. ${inst.family === 'flute' ? 'Holes count from the mouthpiece down: hole 1 is nearest your mouth.' : 'Holes are listed by finger, right hand first.'}</p>
      ${(() => {
        const dup = duplicateFingers(setup.holes);
        return dup.length ? `<p class="s-warn is-warning">${icon('hand')} More than one hole is on ${dup.join(', ')}. Each finger usually covers one hole: check the fingers below.</p>` : '';
      })()}
      ${inst.kind === 'custom' && inst.family === 'ocarina' ? `
        <button type="button" class="btn btn-secondary btn-sm s-reverse" data-action="s-fingers-reset">${icon('rotate')} Back to the first guess for ${setup.holes.length} holes</button>` : ''}
      ${inst.kind === 'custom' && inst.family === 'ocarina' && setup.holes.filter(h => h.sub).length === 2 ? `
        <div class="field s-subs">
          <span class="field-label">Sub-holes</span>
          ${uiSeg([{ value: 'taiwanese', label: 'Beside R2 and L2' }, { value: 'japanese', label: 'Beside R1 and R2' }],
            setup.holes.filter(h => h.sub).map(h => h.finger).sort().join() === [...SUB_LAYOUTS.japanese].sort().join() ? 'japanese' : 'taiwanese',
            { action: 's-sub-layout', label: 'Sub-hole layout' })}
          <div class="field-help">Beside each middle finger is the Taiwanese layout; both on the right hand is the Japanese one. Pick the one your ocarina has.</div>
        </div>` : ''}
      ${['R', 'L'].filter(hand => handSwapText(setup.holes, hand)).map(hand => `
        <button type="button" class="btn btn-secondary btn-sm s-reverse" data-action="s-fingers-reverse" data-hand="${hand}">
          ${icon('refresh')} Reverse ${hand === 'R' ? 'right' : 'left'} hand (${handSwapText(setup.holes, hand)})</button>`).join('')}
      <div class="s-fingers">
        ${(inst.family === 'flute' ? setup.holes.map((_, i) => i) : holeDisplayOrder(setup.holes)).map((i, n) => {
          const h = setup.holes[i];
          const where = inst.family !== 'flute' && holeSpot(inst, i)
            ? `<span class="s-finger-map" aria-hidden="true">${holeMapSvg(inst, { highlight: i, mini: true })}</span>` : '';
          return `<div class="s-finger-row">${where}${uiField({
            label: `Hole ${n + 1}${h.sub ? ' (sub-hole)' : ''}`, id: `s-finger-${i}`,
            control: `<select class="select" id="s-finger-${i}" data-action="s-finger" data-index="${i}">
              ${OC_FINGER_ORDER.map(f => `<option value="${f}" ${h.finger === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>`,
          })}</div>`;
        }).join('')}
      </div>`,
    footer: '<button type="button" class="btn btn-primary" data-action="s-fingers-close">Done</button>',
  });
}

// Writes a reading into an instrument. Paths: "ci:stage:f0|d|f1",
// "ci:stage:n:<midi>", "s:f0", "s:<holeIndex>".
function setReading(inst, path, value) {
  const parts = path.split(':');
  if (parts[0] === 'f') {
    const setup = fluteSetupOf(inst);
    setup.readings[parseInt(parts[1], 10)] = value;
    inst.setup = setup;
    return;
  }
  if (parts[0] === 'e') {
    if (state.oc.fgEdit) state.oc.fgEdit.hz = value;
    return;
  }
  if (parts[0] === 's') {
    const setup = inst.setup ?? { holes: defaultCustomHoles(inst.holeCount), f0: null, singles: [] };
    if (parts[1] === 'f0') setup.f0 = value; else setup.singles[parseInt(parts[1], 10)] = value;
    inst.setup = setup;
    return;
  }
  const ci = parseInt(parts[0], 10);
  const stage = parts[1];
  const per = inst.build.perChamber;
  per[ci] = per[ci] ?? {};
  per[ci].readings = per[ci].readings ?? {};
  const r = per[ci].readings[stage] = per[ci].readings[stage] ?? {};
  if (parts[2] === 'n') {
    r.notes = r.notes ?? {};
    r.notes[parts[3]] = value;
  } else {
    r[parts[2]] = value;
    // The closed pitch is also the reading of the chamber's lowest note.
    if (parts[2] === 'f0') { r.notes = r.notes ?? {}; r.notes[inst.chambers[ci].notes[0]] = value; }
  }
}

// Fill big gaps: at most this many holes a chamber (8 fingers + 2 thumbs).
const DESIGN_MAX_HOLES = 10;

function applyDesign(inst) {
  const plan = planOcarina(inst.design);
  inst.scaleId = plan.scale.id;
  inst.transpose = inst.design.transpose ?? 0;
  inst.includeGu = inst.design.includeGu ?? true;
  // Sub-holes add notes below the scale, from its key (the full scale's
  // pitch classes, transposed).
  const pcs = new Set(scaleToMidis(plan.scale, { transpose: inst.transpose, includeGu: true }).map(m => ((m % 12) + 12) % 12));
  inst.chambers = buildScaleChambers(plan.notes, {
    subs: inst.design.subHoles ?? 0, layout: inst.design.subLayout ?? 'taiwanese', pcs,
    fill: inst.design.fillGaps ? DESIGN_MAX_HOLES : 0,
  });
  inst.notes = [...new Set(inst.chambers.flatMap(ch => ch.notes))].sort((a, b) => a - b);
  inst.fullChambers = plan.needed;
}

function finishInstrumentBuild(inst) {
  const { inst: done, learned } = finishBuild(inst);
  if (learned != null && done.build.clayBody) {
    saveClayBodies(getClayBodies().map(c => (c.id === done.build.clayBody ? updateClayBody(c, learned) : c)));
  }
  return done;
}

// ── Tuner ────────────────────────────────────────────────────────────────────
// A panel pinned to the bottom of the screen while the tuner is on. It is
// updated in place ~20 times a second; only a practice-mode advance
// re-renders the page.

let _tunerStop = null;

// The record field armed to take the tuner's next steady reading (§5.3).
// auto: armed by itself after a capture on Set up, so it waits for a new note.
function newRecState() {
  return { armed: null, armedAt: 0, auto: false, slow: false, captured: null, error: null };
}

// The note the player should be playing right now, if any.
function tunerTarget() {
  if (state.view !== 'instrument') return null;
  const inst = currentInstrument();
  if (!inst) return null;
  const oc = state.oc;
  if (oc.practice) {
    const src = practiceSource(inst, oc.practice);
    const steps = src ? practiceSteps(src.entries) : [];
    return steps.length ? steps[oc.practice.idx % steps.length].midi : null;
  }
  if (oc.tab === 'notes') return oc.selected;
  return null;
}

// The docked strip (§5.13): the heard note and cents, a status line, the
// meter, and close. Its parts are redrawn in place on every reading; the
// close button and the screen-reader line stay put.
// Where a set-up reading path is in its sequence: { label, n, total, hole }
// (hole: index on the photo map, for an ocarina's single-hole reading).
function setupStepInfo(inst, path) {
  if (path.startsWith('f:')) {
    const setup = fluteSetupOf(inst);
    const paths = fluteSetupPaths(setup);
    const k = parseInt(path.slice(2), 10);
    return { label: fluteStepLabel(setup.holes.length, k), n: paths.indexOf(path) + 1, total: paths.length, hole: null };
  }
  const setup = setupOf(inst);
  const paths = ['s:f0', ...holeDisplayOrder(setup.holes).map(i => `s:${i}`)];
  const hole = path === 's:f0' ? null : parseInt(path.slice(2), 10);
  return {
    label: hole == null ? 'All holes closed' : `Only ${holeLabel(setup.holes, hole)} open`,
    n: paths.indexOf(path) + 1, total: paths.length, hole,
  };
}

// While set-up readings are being recorded one after another: a bar over
// the tuner with the step, what to blow now (on the photo when the holes are
// marked), the reading just recorded, and Stop.
function recGuideHtml() {
  const path = state.rec.armed;
  if (!path || !/^[sf]:/.test(path) || state.view !== 'instrument' || state.oc.tab !== 'setup' || !state.tuner.on) return '';
  const inst = currentInstrument();
  if (!inst) return '';
  const step = setupStepInfo(inst, path);
  const last = state.recLast && Date.now() - state.recLast.at < 4000 ? state.recLast : null;
  const map = step.hole != null && holeSpot(inst, step.hole) ? `<span class="rec-guide-map" aria-hidden="true">${holeMapSvg(inst, { highlight: step.hole, mini: true })}</span>` : '';
  return `
    <div class="rec-guide" role="status" aria-live="polite">
      ${last ? `<div class="rec-guide-done">${icon('check')} ${escHtml(last.label)}: <strong>${escHtml(last.text)}</strong></div>` : ''}
      <div class="rec-guide-row">
        ${map}
        <div class="rec-guide-text">
          <div class="rec-guide-step">Step ${step.n} of ${step.total}${last ? ' · next' : ''}</div>
          <div class="rec-guide-now">Now blow: <strong>${escHtml(step.label)}</strong></div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-action="b-record" data-path="${escHtml(path)}">Stop</button>
      </div>
    </div>`;
}

function tunerStripHtml() {
  const listening = !state.tuner.on && listenUi().on;
  return `
    <div id="tuner-panel" class="tuner" role="region" aria-label="${listening ? 'Listening' : 'Tuner'}">
      <canvas class="mic-wave tuner-wave" aria-hidden="true"></canvas>
      <div id="tuner-parts" class="tuner-parts">${listening ? listenStripInner() : tunerPanelInner()}</div>
      ${uiIconBtn('x', listening ? 'Stop listening' : 'Stop the tuner', { action: listening ? 'hear-stop' : 'tuner-toggle', cls: 'tuner-close' })}
      <span id="tuner-live" class="sr-only" aria-live="polite"></span>
    </div>`;
}

// The listening bar while Listen hears chords: the chord, or what it's doing.
function listenStripInner() {
  const L = listenUi();
  const c = L.chord;
  return `
    <div class="tuner-note is-${c ? 'ok' : 'idle'}"><div class="tuner-name">${c ? escHtml(listenShownName(c)) : '—'}</div></div>
    <div class="tuner-mid"><div class="tuner-row"><span class="tuner-status">${c ? (L.heard ? 'Chord heard' : 'Last chord heard') : 'Listening for chords…'}</span></div></div>`;
}

// The live wave on every canvas.mic-wave while the microphone is open
// (tuner.js drawMicWave), one frame each screen refresh.
let _micWaveRaf = 0;
function ensureMicWave() {
  if (_micWaveRaf || !openMic()) return;
  const frame = t => {
    const mic = openMic();
    const canvases = document.querySelectorAll('canvas.mic-wave');
    if (!mic) { _micWaveRaf = 0; return; }
    const r = state.tuner.on ? state.tuner.reading : null;
    canvases.forEach(c => drawMicWave(c, mic, { hz: r?.hz > 0 ? r.hz : null, t }));
    _micWaveRaf = requestAnimationFrame(frame);
  };
  _micWaveRaf = requestAnimationFrame(frame);
}

// Where to read how to allow the microphone, for the browsers that say.
function micHelpUrl() {
  const ua = navigator.userAgent;
  if (/Firefox\//.test(ua)) return 'https://support.mozilla.org/kb/how-manage-your-camera-and-microphone-permissions';
  if (/Chrome\/|CriOS\//.test(ua)) return 'https://support.google.com/chrome/answer/2693767';
  return null;
}

// What the strip shows for the current reading: tone ok | near | far | idle.
function tunerReadout() {
  let r = state.tuner.reading;
  const uf = state.useFlats, us = state.useSolfege;
  const target = tunerTarget();
  // A struck note (handpan) fades fast: the last note heard stays up a
  // moment after the sound drops out instead of blinking away.
  const last = state.tuner.lastHeard;
  const held = r?.midi == null && last && performance.now() - last.at < TUNER_HOLD_MS;
  if (held) r = last.reading;
  const heard = r?.midi != null ? Math.round(r.midi) : null;
  if (heard == null) return { tone: 'idle', note: '—', cents: null, status: 'Listening…', hz: null };
  if (held) return { tone: 'idle', note: displayNote(midiToNoteName(heard), uf, us), cents: null, status: 'Last note heard', hz: r.hz };
  const name = displayNote(midiToNoteName(heard), uf, us);
  if (target != null) {
    const tName = displayNote(midiToNoteName(target), uf, us);
    const off = Math.round(centsBetween(r.hz, midiToHz(target)));
    if (Math.abs(off) <= 10) return { tone: 'ok', note: name, cents: off, status: `Target ${tName} · in tune`, hz: r.hz };
    if (Math.abs(off) < 50) return { tone: 'near', note: name, cents: off, status: `${tName} is ${Math.abs(off)} ¢ ${off < 0 ? 'flat' : 'sharp'}`, hz: r.hz };
    return { tone: 'far', note: name, cents: Math.max(-50, Math.min(50, off)), status: `Hearing ${name}, looking for ${tName}`, hz: r.hz };
  }
  // No target: the nearest note, in neutral colours.
  const cents = Math.round(centsBetween(r.hz, midiToHz(heard)));
  return { tone: 'far', note: name, cents, status: Math.abs(cents) <= 10 ? `${name} · in tune` : `${name} is ${Math.abs(cents)} ¢ ${cents < 0 ? 'flat' : 'sharp'}`, hz: r.hz };
}

function tunerPanelInner() {
  const t = state.tuner;
  if (t.error) {
    const help = micHelpUrl();
    return `<div class="tuner-err">${escHtml(t.error)}${help && /refused/.test(t.error) ? ` <a href="${help}" target="_blank" rel="noopener">How to allow the microphone</a>` : ''}</div>`;
  }
  const o = tunerReadout();
  const fmtCents = c => (c > 0 ? '+' : c < 0 ? '−' : '±') + Math.abs(c) + ' ¢';
  return `
    <div class="tuner-note is-${o.tone}">
      <div class="tuner-name">${escHtml(o.note)}</div>
      <div class="tuner-cents">${o.cents == null ? '&nbsp;' : fmtCents(o.cents)}</div>
    </div>
    <div class="tuner-mid">
      <div class="tuner-row"><span class="tuner-status is-${o.tone}">${escHtml(o.status)}</span><span class="tuner-hz">${o.hz ? o.hz.toFixed(1) + ' Hz' : ''}</span></div>
      <div class="tuner-meter" aria-hidden="true">
        <div class="tuner-band"></div><div class="tuner-tick"></div>
        ${o.cents == null ? '' : `<div class="tuner-needle is-${o.tone}" style="left:${50 + Math.max(-50, Math.min(50, o.cents))}%"></div>`}
      </div>
    </div>`;
}

let _tunerLiveAt = 0;
const TUNER_HOLD_MS = 2000;
function onTunerReading(reading) {
  state.tuner.reading = reading;
  ensureMicWave();
  if (reading.midi != null) state.tuner.lastHeard = { reading, at: performance.now() };
  // An armed record field takes the first steady reading. One armed by
  // itself after a capture waits for a note that started after it.
  if (state.view === 'wizard' && state.wizard?.fl?.detect?.listening && reading.stable && reading.hz > 0) {
    onFluteDetectReading(reading.hz);
    return;
  }
  if (state.view === 'wizard' && state.wizard?.oc?.detect?.listening && reading.stable && reading.hz > 0) {
    onFluteDetectReading(reading.hz, 'oc');
    return;
  }
  if (state.pickListen?.listening) {
    if (state.pendingSlot && state.view === 'editor') { onPickListenReading(reading); return; }
    stopPickListen(); // the picker was closed some other way
  }
  if (state.listen?.listening) {
    if (reading.level >= TUNER_MIN_RMS) state.listen.heardAt = performance.now();
    if (onListenReading(reading)) return;
    updateListenLive(reading);
  }
  const rec = state.rec;
  if (rec.armed && reading.stable && reading.hz > 0 && (!rec.auto || reading.since > rec.armedAt)) {
    captureReading(reading.hz);
    return;
  }
  // Practice mode: move on once the right note has held steady, but only for
  // a note started after the last advance (so a repeated note isn't skipped).
  const pr = state.oc.practice;
  const target = tunerTarget();
  if (pr && target != null && reading.stable && reading.since > state.tuner.lastAdvance
      && Math.abs(reading.midi - target) < 0.4) {
    state.tuner.lastAdvance = performance.now();
    const src = practiceSource(currentInstrument(), pr);
    if (src) {
      pr.idx = (pr.idx + 1) % practiceSteps(src.entries).length;
      render();
      return;
    }
  }
  const parts = document.getElementById('tuner-parts');
  if (parts) parts.innerHTML = tunerPanelInner();
  // Screen readers hear steady readings only, at most every 1.5 s.
  const live = document.getElementById('tuner-live');
  if (live && reading.stable && performance.now() - _tunerLiveAt > 1500) {
    const text = tunerReadout().status;
    if (live.textContent !== text) { live.textContent = text; _tunerLiveAt = performance.now(); }
  }
}

async function toggleTuner() {
  if (state.tuner.on) {
    if (_tunerStop) { _tunerStop(); _tunerStop = null; ensureAudioOutput(); } // iOS: give the speaker back after the mic
    state.tuner = { on: false, reading: null, error: null, lastAdvance: 0 };
    disarmRecord();
    render();
    return;
  }
  state.tuner = { on: true, reading: null, error: null, lastAdvance: performance.now() };
  render();
  try {
    _tunerStop = await startTuner(onTunerReading);
  } catch (err) {
    state.tuner.error = err?.name === 'NotAllowedError'
      ? 'Microphone access was refused. Allow it in the browser settings to use the tuner.'
      : `The tuner can't start: ${err?.message || err}`;
    if (state.rec.armed) { const path = state.rec.armed; disarmRecord(); state.rec.error = { path, msg: state.tuner.error }; }
    render();
  }
}

// ── Record fields ────────────────────────────────────────────────────────────
let _recSlowTimer = null;

function armRecord(path, { auto = false } = {}) {
  clearTimeout(_recSlowTimer);
  state.rec = { ...newRecState(), armed: path, armedAt: performance.now(), auto };
  // After 8 s without a steady note, say what to do (in place, no re-render).
  _recSlowTimer = setTimeout(() => {
    if (state.rec.armed !== path) return;
    state.rec.slow = true;
    const help = document.querySelector(`.rec-field[data-rec="${CSS.escape(path)}"] .rec-help`);
    if (help) help.innerHTML = '<span class="is-warning">No steady note yet: keep blowing, or type the value</span>';
  }, 8000);
}

function disarmRecord() {
  clearTimeout(_recSlowTimer);
  state.rec = newRecState();
}

// Fills the armed field with a reading, saves, and on Set up arms the next
// empty reading. The mic shows a check for a second.
function captureReading(hz) {
  const path = state.rec.armed;
  disarmRecord();
  const inst = currentInstrument();
  if (!inst || inst.id === SHARED_ID) { render(); return; }
  // Set-up readings in a row: say what was just recorded (the guide shows it
  // while the next one is armed) and buzz where phones can.
  const step = /^[sf]:/.test(path) ? setupStepInfo(inst, path) : null;
  if (step) {
    state.recLast = { path, label: step.label, text: pitchLabel(hz, { useFlats: state.useFlats, useSolfege: state.useSolfege }).text, at: Date.now() };
    try { navigator.vibrate?.(40); } catch (_) {}
  }
  setReading(inst, path, Math.round(hz * 10) / 10);
  saveInstrument(inst);
  const setupPath = /^[sf]:/.test(path);
  if (!setupPath) bAdvanceChamber(inst);
  state.rec.captured = path;
  const next = setupPath ? nextEmptySetupPath(inst, path) : null;
  if (next) { armRecord(next, { auto: true }); state.rec.captured = path; }
  else if (step) showToast(`${step.label}: ${state.recLast.text}. Every reading is in.`);
  render();
  if (next) document.querySelector('.rec-field.is-armed')?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  setTimeout(() => {
    if (state.rec.captured !== path) return;
    state.rec.captured = null;
    const btn = document.querySelector(`.rec-btn[data-path="${CSS.escape(path)}"]`);
    if (btn) { btn.classList.remove('is-captured'); btn.querySelector('.ico')?.replaceWith(document.createRange().createContextualFragment(icon('mic'))); }
  }, 1000);
}

// The next Set up reading without a value after `fromPath`, wrapping round.
function nextEmptySetupPath(inst, fromPath) {
  const setup = inst.setup;
  if (!setup) return null;
  const flute = fromPath.startsWith('f:');
  const paths = flute ? fluteSetupPaths(setup) : ['s:f0', ...holeDisplayOrder(setup.holes).map(i => `s:${i}`)];
  const value = p => (flute ? setup.readings[parseInt(p.slice(2), 10)]
    : p === 's:f0' ? setup.f0 : setup.singles[parseInt(p.slice(2), 10)]);
  const at = paths.indexOf(fromPath);
  return [...paths.slice(at + 1), ...paths.slice(0, at)].find(p => !(value(p) > 0)) ?? null;
}

function openInstrument(id, { push = true } = {}) {
  const inst = getInstrument(id);
  if (!inst) return false;
  stopAutoplay();
  touchInstrument(id);
  if (state.currentInstrumentId !== id) state.oc = newOcState();
  state.currentInstrumentId = id;
  state.selectedChord = null;
  state.sourcePlaylistId = null;
  state.sourceEntryId = null;
  if (usesLayout(inst)) {
    const saved = state.savedLayouts.find(l => l.id === inst.layoutId);
    if (!saved) return false;
    state.layout = JSON.parse(JSON.stringify(saved.layout));
    state.chords = findAllChords(state.layout);
    state.shellMode = 'both';
    state.chordFilter = { category: 'All', root: 'All', playlist: 'All' };
    state.view = 'chords';
    if (push) navPush(stateToHash());
  } else {
    state.layout = null;
    state.view = 'instrument';
    if (inst.kind === 'scale' && inst.build && inst.build.stage !== 'done') state.oc.tab = 'builder';
    if (inst.kind === 'custom' && !inst.calibration) state.oc.tab = 'setup';
    if (push) navPush(`#i/${id}/${state.oc.tab}`);
  }
  return true;
}

// Where the app opens with no link: the Play screen when nothing is saved
// yet, otherwise My instruments, or straight into the only instrument.
function openStartView() {
  // An account opens where it left off, on this or another device (§7).
  const last = accountOn() ? syncReadPrefs().lastPath : null;
  if (last && !isAppHome(last) && last !== location.pathname + location.hash) {
    history.replaceState(history.state, '', last);
    if (urlIsLink()) { loadFromUrl(); if (state.view !== 'play') return; }
    history.replaceState(history.state, '', APP_HOME);
  }
  // Nothing saved yet: the Play screen, one tap from playing
  // (docs/free-to-play.md, "2. Guest experience").
  if (state.instruments.length === 0) { state.view = 'setup'; state.setup = newSetup(); return; }
  state.view = 'home';
  if (state.instruments.length === 1) openInstrument(state.instruments[0].id, { push: false });
}

// ── View 2: Layout Editor ────────────────────────────────────────────────────
// Handpan Pan tab (§6.8): shells, the pan, capacities, name, Customize and Save.

// Is the layout on screen saved, unchanged, in My instruments?
function hpLayoutSaved() {
  const layout = state.layout;
  const savedId = layout.isCustom ? layout.savedId : layout.id;
  // Read fresh: a layout opened from a playlist can share its object with state.savedLayouts.
  const saved = savedId && getSavedLayouts().find(l => l.id === savedId);
  return !!saved && JSON.stringify(saved.layout) === JSON.stringify(layout);
}

// Customize (a scale's layout) and Save; once saved and unchanged, a status.
function edActionsHtml() {
  const saved = hpLayoutSaved();
  return `
    ${!state.layout.isCustom ? `<button type="button" class="btn btn-secondary" data-action="clone-layout">${icon('pencil')} Customize</button>` : ''}
    ${saved
      ? `<span class="ed-status" role="status">${icon('check')} Saved</span>
         <button type="button" class="btn btn-primary" data-action="save-layout" disabled>Saved</button>`
      : `<button type="button" class="btn btn-primary" data-action="save-layout">${icon('save')} Save</button>`}`;
}

function viewEditor() {
  const layout = state.layout;
  const isCustom = layout.isCustom;

  const panSvg = renderPan(layout, {
    shellMode: state.shellMode,
    highlightNotes: [],
    rotated: state.ringRotated,
    useFlats: state.useFlats,
  });

  const topFilled = layout.top.slots.filter(s => s.note).length;
  const topEmpty = layout.top.slots.filter(s => !s.note).length;
  const bottomFilled = layout.bottom.slots.filter(s => s.note).length;

  const fam = layoutInstrument(layout);
  const fi = layoutFamilyInfo(fam);
  const drum = fam !== 'handpan'; // one row of notes, no shells
  return `
    ${handpanAppBar(handpanTabs('editor'))}
    ${state.currentInstrumentId ? (accountOn() ? '' : notSavedBannerHtml('visit-save')) : notSavedBannerHtml('save-layout')}

    <div class="editor-layout">
      <div class="editor-main">
        ${drum ? '' : uiSeg([{ value: 'both', label: 'Both shells' }, { value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }],
          state.shellMode, { action: 'shell-mode', key: 'mode', label: 'Shells shown' })}
        <div class="pan-wrap ed-pan">
          ${panRotateBtn()}${panSvg}
        </div>
        ${isCustom ? `<p class="ed-hint">Tap a note to remove it · tap + to add one</p>` : ''}
      </div>

      <div class="editor-sidebar">
        <div class="card ed-card">
          ${isCustom ? uiField({ label: 'Name', id: 'custom-name-input', control: `<input class="input" id="custom-name-input" value="${escHtml(layout.name)}" placeholder="Layout name">` }) : ''}
          ${drum ? `<div class="ed-shell">
            <div class="overline">${fi.thing === 'key' ? 'Keys' : 'Tongues'}</div>
            ${uiStepper({
              value: layout.top.capacity + 1, label: fi.thing === 'key' ? 'Keys' : 'Tongues', action: 'adjust-capacity', data: { shell: 'top' },
              min: topEmpty === 0 && layout.top.slots.length > 0, max: layout.top.capacity >= fi.maxNotes,
              help: `${topFilled + 1} ${fi.thing}${topFilled ? 's' : ''} · ${topEmpty} empty`,
            })}
          </div>
          ${fam === 'tongue-drum' ? uiSwitchRow({ label: 'Lowest note in the middle', help: layout.centre ? 'A round tongue in the centre' : 'All tongues round the edge', on: !!layout.centre, action: 'ed-centre' }) : ''}` : `<div class="ed-shell">
            <div class="overline">Top shell</div>
            ${uiStepper({
              value: layout.top.capacity, label: 'Top shell', action: 'adjust-capacity', data: { shell: 'top' },
              min: topEmpty === 0 && layout.top.slots.length > 0, max: layout.top.capacity >= 12,
              help: `${topFilled + 1} notes incl. ding · ${topEmpty} empty`,
            })}
          </div>
          <div class="ed-shell">
            <div class="overline">Bottom shell</div>
            ${uiStepper({
              value: layout.bottom.capacity, label: 'Bottom shell', action: 'adjust-capacity', data: { shell: 'bottom' },
              min: layout.bottom.slots.every(s => !s.note) && layout.bottom.capacity === 0, max: layout.bottom.capacity >= 12,
              help: `${bottomFilled} note${bottomFilled !== 1 ? 's' : ''} · ${layout.bottom.capacity - bottomFilled} empty`,
            })}
          </div>`}
        </div>
        <div class="ed-actions">${edActionsHtml()}</div>
      </div>
    </div>
  `;
}

// Sets the note picker's slot (tapped in the list, or heard).
function setPendingSlotNote(note) {
  const slot = state.pendingSlot;
  if (!slot || !note) return;
  stopPickListen();
  if (slot.shell === 'ding') {
    state.layout.top.ding = note;
  } else {
    const shell = slot.shell === 'top' ? state.layout.top : state.layout.bottom;
    while (shell.slots.length <= slot.index) shell.slots.push({ note: null });
    shell.slots[slot.index].note = note;
  }
  state.pendingSlot = null;
  state.chords = findAllChords(state.layout);
  initAudio();
  playNote(note);
  render();
}

// "Play it": the tuner listens, and the first steady note that starts after
// the tap sets the slot. The tuner is turned off again if this turned it on.
function startPickListen() {
  const startedTuner = !state.tuner.on || !!state.tuner.error;
  state.pickListen = { listening: true, startedTuner, startedAt: performance.now(), heardAt: null, error: null };
  if (startedTuner) {
    if (state.tuner.error) { if (_tunerStop) { _tunerStop(); _tunerStop = null; } state.tuner.on = false; }
    toggleTuner().then(() => {
      if (state.tuner.error && state.pickListen?.listening) { stopPickListen(); state.pickListen = { error: state.tuner.error }; render(); }
    });
    return;
  }
  render();
}

function stopPickListen() {
  const P = state.pickListen;
  state.pickListen = null;
  if (P?.listening && P.startedTuner && state.tuner.on && !state.tuner.error) toggleTuner();
}

// Notes set by playing them, one place at a time, are named on the
// instrument's own tuning, as in the guided round: what each place measured
// is kept per layout, and once three agree on an offset (a drum in 432 Hz)
// every note set this way is named on it. A note changed by hand since is
// left alone.
const _pickHeard = new WeakMap(); // layout → [{ shell, index, midi, named }]
function pickHeardNote(slot, midi) {
  const list = (_pickHeard.get(state.layout) ?? []).filter(h => h.shell !== slot.shell || h.index !== slot.index);
  const before = list.length ? tuningOffsetCents(list.map(h => h.midi)) : 0;
  const off = tuningOffsetCents([...list.map(h => h.midi), midi]);
  for (const h of list) {
    const shell = h.shell === 'ding' ? null : (h.shell === 'top' ? state.layout.top : state.layout.bottom);
    const cur = shell ? shell.slots[h.index]?.note : state.layout.top.ding;
    if (cur !== h.named) continue;
    h.named = midiToNoteName(noteOnTuning(h.midi, off));
    if (shell) shell.slots[h.index].note = h.named; else state.layout.top.ding = h.named;
  }
  const named = midiToNoteName(noteOnTuning(midi, off));
  _pickHeard.set(state.layout, [...list, { shell: slot.shell, index: slot.index, midi, named }]);
  if (off && !before) showToast(`Tuned to A = ${a4ForOffset(off)} Hz: Oakhum names your notes on that tuning`);
  return named;
}

// A tuner reading while "Play it" listens.
function onPickListenReading(reading) {
  const P = state.pickListen;
  if (reading.level >= TUNER_MIN_RMS) P.heardAt = performance.now();
  if (reading.stable && reading.hz > 0 && reading.since > P.startedAt && state.pendingSlot) {
    setPendingSlotNote(pickHeardNote(state.pendingSlot, reading.midi));
    return;
  }
  updateListenLive(reading, P);
}

function renderNotePicker() {
  const allNotes = new Set(getAllNotes(state.layout));
  const octaves = [2, 3, 4, 5];

  const rows = octaves.map(oct => {
    const cols = NOTE_NAMES.map(name => {
      const noteStr = `${name}${oct}`;
      const inUse = allNotes.has(noteStr);
      const label = displayNote(name, state.useFlats);
      return `<button class="chip note-chip ${inUse ? 'is-static' : ''}"
        data-action="pick-note" data-note="${noteStr}" aria-label="${escHtml(label + oct)}${inUse ? ', already on the instrument' : ''}"
        ${inUse ? 'disabled' : ''}>${label}</button>`;
    }).join('');
    return `<div class="note-octave-row">
      <span class="octave-label">${oct}</span>
      <div class="note-octave-notes">${cols}</div>
    </div>`;
  }).join('');

  const fam = layoutInstrument(state.layout);
  const fi = layoutFamilyInfo(fam);
  const slotLabel = fam !== 'handpan'
    ? (state.pendingSlot.shell === 'ding' ? 'lowest note' : `${fi.thing} ${state.pendingSlot.index + 2}`)
    : state.pendingSlot.shell === 'ding'
    ? 'ding (center)'
    : `${state.pendingSlot.shell === 'top' ? 'ring' : 'gu'} slot ${state.pendingSlot.index + 1}`;
  // First: play the note and Oakhum sets it. The list is for when you know it.
  const P = state.pickListen;
  const listen = P?.listening
    ? `<div class="pick-listen card"><p class="pick-listen-title"><span class="listen-dot" aria-hidden="true"></span> Play the ${escHtml(slotLabel)} once and let it ring</p>
        <canvas class="mic-wave pick-wave" aria-hidden="true"></canvas>
        <div class="listen-live" id="listen-live">${listenLiveHtml(state.tuner.reading, P)}</div>
        <button type="button" class="btn btn-ghost btn-sm" data-action="pick-listen-stop">Stop listening</button></div>`
    : `<button type="button" class="btn btn-primary btn-block pick-listen-btn" data-action="pick-listen">${icon('mic')} Play it · Oakhum listens</button>
       ${P?.error ? `<p class="field-help is-danger">${escHtml(P.error)}</p>` : ''}`;

  return uiSheet({
    key: 'note', title: 'Set a note', close: 'close-picker',
    body: `${listen}<p class="sheet-text">Or choose it, for the ${escHtml(slotLabel)}. Greyed notes are already on the instrument.</p>${rows}`,
    footer: `<button class="btn btn-ghost" data-action="close-picker">Cancel</button>`,
  });
}

// ── View 3: Chord Explorer ───────────────────────────────────────────────────
// Handpan Chords tab (§6.7). Phone: the pan and the selected-chord bar stay
// on screen (sticky) while the list scrolls under them. ≥600px: the list is
// a column of its own at the left, the pan and a full chord card at the right.

// The chords shown under the current filters, in display order: the
// playlist's order while a playlist filter is on, otherwise by root, then
// the bigger chords first.
function hpFilteredChords() {
  const { chords, chordFilter, layout } = state;
  // Root options: NOTE_NAMES[i] is at PC i — filter by which PCs have chords.
  const ROOT_ORDER = NOTE_NAMES;
  const roots = chordRootsOf(chords);

  // Apply filters — compare root by PC to handle G# ↔ Ab equivalence.
  const layoutId = layout.isCustom ? (layout.savedId || layout.id) : layout.id;
  // Match by abstract chord identity (layoutId+chordId), not the entry's exact
  // stored id — that id gets a notes suffix once a voicing is saved, which
  // would otherwise make the chord silently drop out of this filtered list.
  const playlistChordKeys = chordFilter.playlist !== 'All'
    ? new Set((state.playlists.find(p => p.id === chordFilter.playlist)?.chords ?? []).map(c => `${c.layoutId}-${c.chordId}`))
    : null;

  const filtered = chords.filter(c => {
    if (state.chordCountSet.size > 0 && !state.chordCountSet.has(chordCountKey(c.noteCount))) return false;
    if (chordFilter.category !== 'All' && c.type.category !== chordFilter.category) return false;
    if (chordFilter.root !== 'All') {
      const filterPC = ROOT_ORDER.indexOf(chordFilter.root);
      if (notePC(c.rootNote) !== filterPC) return false;
    }
    if (playlistChordKeys !== null) {
      if (!playlistChordKeys.has(`${layoutId}-${c.id}`)) return false;
    }
    return true;
  });
  // Preserve playlist order when a playlist filter is active
  if (chordFilter.playlist !== 'All') {
    const pl = state.playlists.find(p => p.id === chordFilter.playlist);
    if (pl) {
      const orderMap = new Map(pl.chords.map((c, i) => [`${c.layoutId}-${c.chordId}`, i]));
      filtered.sort((a, b) =>
        (orderMap.get(`${layoutId}-${a.id}`) ?? Infinity) - (orderMap.get(`${layoutId}-${b.id}`) ?? Infinity)
      );
    }
  } else {
    filtered.sort((a, b) => {
      const rA = notePC(a.rootNote), rB = notePC(b.rootNote);
      return rA !== rB ? rA - rB : b.noteCount - a.noteCount;
    });
  }
  return { filtered, roots, layoutId };
}

// The playlist entry the selected chord was opened from, and whether its
// voicing has since changed (then "Save this voicing" is offered).
function hpSourceEntry() {
  const chord = state.selectedChord;
  const pl = state.sourcePlaylistId ? state.playlists.find(p => p.id === state.sourcePlaylistId) : null;
  const entry = pl ? pl.chords.find(c => c.id === state.sourceEntryId) : null;
  const canUpdate = !!(chord && entry && entry.chordId === chord.id && entry.notes.join(',') !== chord.notes.join(','));
  return { pl, canUpdate };
}

// Filters set in the Filters sheet (the root chips don't count).
function hpFilterCount() {
  const f = state.chordFilter;
  return (state.chordCountSet.size > 0 ? 1 : 0) + (f.category !== 'All' ? 1 : 0) + (f.playlist !== 'All' ? 1 : 0);
}

function hpChordName(c) {
  return `${displayNote(c.rootName, state.useFlats, state.useSolfege)} ${c.type.name}`;
}
function hpNotesText(notes) {
  return notes.map(n => displayNote(n, state.useFlats, state.useSolfege)).join(' · ');
}

// ♡ of a chord: opens the Add to playlist sheet; filled when the chord is
// in any playlist (in any voicing).
function hpHeartBtn(on, opts) {
  return uiIconBtn('heart', 'Add to playlist', { ...opts, cls: `hp-heart${on ? ' is-on' : ''}` });
}

// "Same type, other roots" and "Shares 2+ notes" chips for a chord.
function hpRelatedHtml(chord) {
  const { sameType, sharedNotes } = getRelatedChords(chord, state.chords);
  const chip = c => `<button type="button" class="chip" data-action="select-chord" data-id="${escHtml(c.id)}">${escHtml(hpChordName(c))}</button>`;
  return `
    ${sameType.length ? `<div class="overline">Same type, other roots</div><div class="chips">${sameType.map(chip).join('')}</div>` : ''}
    ${sharedNotes.length ? `<div class="overline">Shares 2+ notes</div><div class="chips">${sharedNotes.slice(0, 10).map(chip).join('')}</div>` : ''}`;
}

// ── Listen: a chord heard, shown on my instrument (docs/listen-mode.md) ─────
// Step 1 of the plan: one chord at a time with its confidence, on the
// handpan and on ocarinas and flutes, plus the debug view. Detection lives
// in js/listen-detect.js (no instrument), the mic in js/listen-audio.js.
let _listenStopFn = null, _listenTrack = null;
const LISTEN_SILENCE_MS = 60000;
const LISTEN_MIN_MS = 700;
const LISTEN_SUFFIX = { maj: '', min: 'm', dom7: '7', maj7: 'maj7', min7: 'm7', sus2: 'sus2', sus4: 'sus4', dim: 'dim' };

function newListenUi() {
  return { on: false, starting: false, error: null, stopped: '', chord: null, chordAt: 0, candidates: [], heard: false,
    lastHeard: 0, history: [], tune: { ...LISTEN_DEFAULTS }, ocNote: null };
}
function listenUi() { return (state.listenUi ??= newListenUi()); }

// Is a Listen screen showing? (The mic turns off as soon as it isn't.)
function listenScreenOn() {
  return (state.view === 'chords' && state.hpListen)
    || (state.view === 'instrument' && state.oc.tab === 'chords' && state.oc.listen)
    || state.view === 'listen-debug';
}

function listenRootName(pc) { return displayNote(NOTE_NAMES[pc], state.useFlats, state.useSolfege); }
function listenChordLabel(c) { return `${listenRootName(c.rootPC)}${LISTEN_SUFFIX[c.typeId] ?? ''}`; }

// What to show for the chord heard: sure or likely → its name; unsure but
// the root is clear → the root and "?"; otherwise "?".
function listenShownName(c) {
  if (c.level !== 'unsure') return listenChordLabel(c);
  return (c.rootConfidence ?? 0) >= 0.6 ? `${listenRootName(c.rootPC)} ?` : '?';
}

// The chord heard on the notes an instrument can play.
function listenHeardOn(playable) {
  const L = listenUi();
  const c = L.chord;
  return { L, chord: c, fit: c ? listenChordOnNotes(c.rootPC, c.typeId, playable) : null };
}

async function listenStart() {
  const L = listenUi();
  if (L.on || L.starting) return;
  if (state.tuner.on) await toggleTuner();   // one microphone session at a time
  Object.assign(L, { starting: true, error: null, stopped: '', lastHeard: performance.now() });
  _listenTrack = listenTracker(L.tune);
  render();
  try {
    _listenStopFn = await startListening(listenOnFrame, { tune: L.tune });
    L.on = true;
  } catch (err) {
    L.error = err?.name === 'NotAllowedError'
      ? 'Microphone access was refused. Allow it in the browser settings to use Listen.'
      : `Listening can't start: ${err?.message || err}`;
  }
  L.starting = false;
  render();
}

function listenStop(stopped = '') {
  const L = listenUi();
  _listenStopFn?.();
  _listenStopFn = null;
  if (L.chord && performance.now() - L.chordAt >= LISTEN_MIN_MS) L.history.push({ ...L.chord, ms: performance.now() - L.chordAt });
  Object.assign(L, { on: false, starting: false, chord: null, candidates: [], heard: false, stopped });
  ensureAudioOutput();
  render();
}

function listenOnFrame(frame) {
  const L = listenUi();
  if (!L.on || !_listenTrack) return;
  ensureMicWave();
  const r = _listenTrack.push(frame);
  const now = performance.now();
  if (r.heard) L.lastHeard = now;
  if (state.view === 'listen-debug') listenDebugUpdate(frame, r);
  const before = L.chord ? `${L.chord.rootPC}-${L.chord.typeId}-${L.chord.level}` : '';
  const wasHeard = L.heard;
  // A chord heard for under 0.7 s is a passing blip (the last chord still
  // ringing into the next): it isn't kept in the history.
  if (r.changed && L.chord && now - L.chordAt >= LISTEN_MIN_MS) L.history.push({ ...L.chord, ms: now - L.chordAt });
  if (r.changed) L.chordAt = now;
  L.chord = r.chord;
  L.candidates = r.candidates.length ? r.candidates : L.candidates;
  L.heard = r.heard;
  const after = L.chord ? `${L.chord.rootPC}-${L.chord.typeId}-${L.chord.level}` : '';
  if (now - L.lastHeard > LISTEN_SILENCE_MS) { listenStop('Stopped: nothing heard for a minute.'); return; }
  if ((before !== after || wasHeard !== L.heard) && state.view !== 'listen-debug') render();
}

// The chord card on a Listen screen: Start (with the one-sentence privacy
// note), or the chord heard with its confidence and what's missing.
function listenCardHtml(heard, { below = '' } = {}) {
  const L = listenUi();
  if (!L.on) {
    return chordCardHtml({
      title: 'Listen to someone playing',
      metas: [],
      actions: `<button type="button" class="btn btn-primary hp-play" data-action="hear-start" ${L.starting ? 'disabled' : ''}>${icon('mic')} ${L.starting ? 'Starting…' : 'Listen'}</button>`,
      below: `<p class="hear-note">Listen uses the microphone to hear the chords nearby; the sound stays on this phone and isn't recorded. Works best with one instrument, the phone 1–2 m from it.</p>
        ${L.error ? `<p class="hear-note is-danger">${escHtml(L.error)}</p>` : ''}${L.stopped ? `<p class="hear-note">${escHtml(L.stopped)}</p>` : ''}`,
    });
  }
  const c = heard?.chord;
  const stop = `<button type="button" class="btn btn-secondary hp-play" data-action="hear-stop">${icon('square')} Stop</button>`;
  if (!c) {
    return chordCardHtml({
      title: `<span class="hear-dot" aria-hidden="true"></span>Listening…`,
      metas: [['Play a chord near the phone']], actions: stop,
    });
  }
  const levelText = { sure: 'Sure', likely: 'Likely', unsure: 'Unsure: ask them to play it again, clearer' }[c.level];
  const other = c.level !== 'sure' ? L.candidates.find(x => `${x.rootPC}-${x.typeId}` !== `${c.rootPC}-${c.typeId}`) : null;
  const type = CHORD_TYPES.find(t => t.id === c.typeId);
  const fit = heard.fit;
  const nn = m => displayNote(midiToNoteName(m), state.useFlats, state.useSolfege);
  const missing = fit && fit.missing.length
    ? `<p class="hear-note">No ${fit.missing.map(listenRootName).join(' or ')} on this instrument${fit.voicing.length ? `: plays as <b>${fit.voicing.map(nn).join(' – ')}</b>` : ''}.</p>` : '';
  return chordCardHtml({
    title: `<span class="hear-name${L.heard ? '' : ' is-faded'}">${escHtml(listenShownName(c))}</span>`,
    metas: [[`${escHtml(`${listenRootName(c.rootPC)} ${type?.name ?? ''}`)}${other ? ` · or ${escHtml(listenChordLabel(other))}?` : ''}`]],
    actions: stop,
    below: `
      <div class="hear-conf is-${c.level}" role="img" aria-label="Confidence: ${levelText}">
        <span class="hear-conf-bars"><i></i><i></i><i></i></span><span>${escHtml(levelText)}</span>
      </div>
      ${missing}${below}`,
  });
}

// Under the Listen card: the chords heard so far (newest last) and how
// clearly the whole session was heard.
function listenHistoryHtml() {
  const L = listenUi();
  const now = performance.now();
  const items = [...L.history, ...(L.chord ? [{ ...L.chord, ms: now - L.chordAt, current: true }] : [])];
  if (!items.length) return `<p class="hp-hint">The chords heard show up here, in order.</p>`;
  const overall = listenOverallConfidence(items);
  return `
    <div class="hear-history">
      <div class="hear-overall is-${overall.level}">${escHtml(overall.text)}</div>
      <div class="chips">${items.slice(-16).map(c => `<span class="chip hear-chip is-${c.level}${c.current ? ' is-current' : ''}">${escHtml(listenShownName(c))}</span>`).join('')}</div>
      ${!L.on ? '<button type="button" class="btn btn-ghost btn-sm" data-action="hear-clear">Clear</button>' : ''}
    </div>`;
}

// Ocarina / flute Listen: the fingering of one of the chord's notes, and the
// chord's notes this instrument can play as chips to pick from.
function listenOcStageParts(inst) {
  const heard = listenHeardOn(playableMidis(inst));
  const L = heard.L;
  const uf = state.useFlats, us = state.useSolfege;
  const notes = heard.fit ? heard.fit.voicing : [];
  const shown = notes.includes(L.ocNote) ? L.ocNote : notes[0] ?? null;
  const picture = shown != null
    ? `<div class="oc-stage-fg"><div class="oc-pstage is-current"><button type="button" class="oc-pstage-fg" data-action="oc-play-note" data-midi="${shown}">
        ${renderFingering(inst, shown, { size: 'medium', useFlats: uf, useSolfege: us, showFingers: true, noteLabel: false })}</button></div></div>`
    : `<div class="oc-stage-fg hear-empty-fg">${icon('mic')}</div>`;
  const chips = notes.length ? `
    <div class="oc-player-notes" role="group" aria-label="Notes of the chord you can play">
      ${notes.map(m => `<button type="button" class="oc-pnote${m === shown ? ' is-current' : ''}" data-action="listen-oc-note" data-midi="${m}">${escHtml(displayNote(midiToNoteName(m), uf, us))}</button>`).join('')}
    </div>` : '';
  return { picture, card: listenCardHtml(heard, { below: chips }), key: '' };
}

// Settings › Listen debug: what the detection sees, live, and its knobs.
function viewListenDebug() {
  const L = listenUi();
  const t = L.tune;
  const slider = (key, label, min, max, step) => `
    <label class="ld-slider-row"><span>${label} <b id="ld-v-${key}">${t[key]}</b></span>
      <input type="range" class="ld-slider" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${t[key]}"></label>`;
  return `${backAppBar('Listen debug', { fallback: 'settings' })}
    <div class="settings listen-debug">
      <p class="settings-intro">For tuning detection with real instruments. Nothing is recorded.</p>
      <div class="row-btns">${L.on
        ? `<button type="button" class="btn btn-secondary" data-action="hear-stop">${icon('square')} Stop</button>`
        : `<button type="button" class="btn btn-primary" data-action="hear-start">${icon('mic')} Start listening</button>`}</div>
      ${L.error ? `<p class="hear-note is-danger">${escHtml(L.error)}</p>` : ''}
      <h2 class="list-title">Chroma (note strengths)</h2>
      <div class="ld-chroma" id="ld-chroma">${NOTE_NAMES.map(n => `<div class="ld-bar"><span style="height:0%"></span><em>${escHtml(displayNote(n, state.useFlats, state.useSolfege))}</em></div>`).join('')}</div>
      <h2 class="list-title">Now</h2>
      <div class="ld-lines">
        <div>Chord: <b id="ld-chord">—</b></div>
        <div>Pitch (YIN): <span id="ld-pitch">—</span></div>
        <div>Level <span id="ld-level">—</span> · peaks <span id="ld-peaks">—</span></div>
      </div>
      <h2 class="list-title">Chord guesses</h2>
      <table class="ld-table" id="ld-cands"><tbody><tr><td>—</td></tr></tbody></table>
      <h2 class="list-title">Thresholds</h2>
      <div class="ld-sliders">
        ${slider('peakRatio', 'Peak above noise floor ×', 1.5, 8, 0.5)}
        ${slider('smoothFrames', 'Frames before a chord shows', 1, 10, 1)}
        ${slider('alpha', 'Smoothing (0 none, 0.9 long)', 0, 0.9, 0.05)}
        ${slider('silenceRatio', 'Silence below × loudest', 0, 0.4, 0.02)}
        <button type="button" class="btn btn-ghost btn-sm" data-action="listen-tune-reset">Reset to defaults</button>
      </div>
    </div>`;
}

// Live update of the debug view, in place (about 10 times a second).
function listenDebugUpdate(frame, r) {
  const bars = document.querySelectorAll('#ld-chroma .ld-bar span');
  if (bars.length === 12) bars.forEach((b, i) => { b.style.height = `${Math.round((frame.chroma?.[i] ?? 0) * 100)}%`; });
  const set = (id, html) => { const e = document.getElementById(id); if (e) e.innerHTML = html; };
  const c = r.chord;
  set('ld-chord', c ? `${escHtml(listenChordLabel(c))} · ${Math.round(c.confidence * 100)}% (${c.level}) · root ${Math.round((c.rootConfidence ?? 0) * 100)}%${r.heard ? '' : ' · quiet'}` : '—');
  const y = frame.timeBuf ? yinPitch(frame.timeBuf, frame.sampleRate) : null;
  set('ld-pitch', y ? `${y.hz.toFixed(1)} Hz · ${escHtml(displayNote(midiToNoteName(Math.round(69 + 12 * Math.log2(y.hz / 440))), state.useFlats, state.useSolfege))} · clarity ${y.clarity.toFixed(2)}` : '—');
  set('ld-level', `${(10 * Math.log10((frame.energy || 1e-12))).toFixed(0)} dB`);
  set('ld-peaks', String(frame.peaks ?? 0));
  set('ld-cands', `<tbody>${(r.candidates || []).map(x => `<tr><td>${escHtml(listenChordLabel(x))}</td><td>${x.score.toFixed(2)}</td></tr>`).join('') || '<tr><td>—</td></tr>'}</tbody>`);
}

// ── The Chords screen, one pattern for every instrument ─────────────────────
// Handpan, ocarina and flute (and any instrument added later) build their
// Chords screen from these three parts, so the screen looks and behaves the
// same everywhere: the instrument picture and the chord card on top
// (sticky on phones, the right column from 600px), the chord list below.
// A new instrument supplies its picture and its chord rows; nothing else.

// The screen: picture + card in the stage, then the list with its head.
function chordsScreenHtml({ cls = '', stageCls = '', stageAttrs = '', picture, card, listHead, list }) {
  return `
    <div class="hp-chords${cls}">
      <div class="hp-stage${stageCls}"${stageAttrs}>
        ${picture}
        ${card}
      </div>
      <section class="hp-list chord-list" aria-label="Chords">
        <div class="hp-list-head">
          ${listHead}
        </div>
        ${list}
      </section>
    </div>
  `;
}

// The selected chord's card: title, meta lines ([html, extra class]), the
// actions (♡, ▶ Chord, ⋯), then anything the instrument adds below.
function chordCardHtml({ title, metas = [], actions, below = '' }) {
  return `
    <div class="hp-card">
      <div class="hp-card-head">
        <div class="hp-card-text">
          <div class="hp-card-title">${title}</div>
          ${metas.map(([html, cls = '']) => `<div class="hp-card-meta${cls ? ' ' + cls : ''}">${html}</div>`).join('\n          ')}
        </div>
        <div class="hp-card-actions">
          ${actions}
        </div>
      </div>
      ${below}
    </div>`;
}

// One chord in the list: name, type, ♡ (and any other buttons) and its
// number of notes; the current one marked.
function chordRowHtml({ title, titleHtml = false, meta, action, data, current, trail }) {
  return uiRow({
    title, titleHtml, meta, action, data, cls: `chord-row${current ? ' is-current' : ''}`,
    trail,
  });
}

// The list head's filter row: Filters (opens the instrument's filter
// sheet, with how many are on) and the root-note chips.
function chordFilterRowHtml({ open, count, roots, root, rootAction }) {
  const uf = state.useFlats, us = state.useSolfege;
  return `<div class="hp-filter-row">
      <button type="button" class="btn btn-secondary hp-filter-btn" data-action="${open}" aria-haspopup="dialog">
        ${icon('sliders-horizontal')} Filters${count ? ` · ${count}` : ''}
      </button>
      <div class="chips-scroll hp-roots" role="group" aria-label="Root note">
        ${roots.map(r => `<button type="button" class="chip" aria-pressed="${root === r ? 'true' : 'false'}"
          data-action="${rootAction}" data-root="${r}">${r === 'All' ? 'All' : escHtml(displayNote(r, uf, us))}</button>`).join('')}
      </div>
    </div>`;
}

// Root chips: All, then the roots the chords have, in pitch order.
function chordRootsOf(chords) {
  const used = new Set(chords.map(c => notePC(c.rootNote)));
  return ['All', ...NOTE_NAMES.filter((_, i) => used.has(i))];
}

// Fields of every instrument's Filters sheet.
function chordCountField(selected, action) {
  return `
      <div class="field">
        <span class="field-label">Notes in chord</span>
        <div class="chips" role="group" aria-label="Notes in chord">
          ${['2', '3', '4', '5+'].map(n => `<button type="button" class="chip" aria-pressed="${selected.has(n) ? 'true' : 'false'}"
            data-action="${action}" data-count="${n}">${n}</button>`).join('')}
        </div>
      </div>`;
}
function chordTypeField(value, action) {
  return uiField({ label: 'Type', control: `
        <select class="select" data-action="${action}" aria-label="Chord type">
          <option value="All" ${value === 'All' ? 'selected' : ''}>All types</option>
          ${CHORD_CATEGORIES.filter(c => c !== 'All').map(cat => `<option value="${cat}" ${value === cat ? 'selected' : ''}>${cat}</option>`).join('')}
        </select>` });
}
function chordCountKey(n) { return n >= 5 ? '5+' : String(n); }

function viewChords() {
  const { chords, chordFilter, selectedChord, layout } = state;
  const uf = state.useFlats;
  const us = state.useSolfege;
  const { filtered, roots, layoutId } = hpFilteredChords();

  const selectedFavId = selectedChord ? favIdForChord(layoutId, selectedChord, chords) : null;
  const selectedInAny = selectedChord ? isChordBookmarkedAnyVoicing(layoutId, selectedChord.id) : false;
  // Show a "save voicing" button only when the selected chord came from a
  // playlist entry (same abstract chord) and its notes have since diverged.
  const { pl: sourcePl, canUpdate: canUpdateEntry } = hpSourceEntry();
  const saveVoicingBtn = cls => uiIconBtn('save', `Save this voicing to ${sourcePl.name}`, { action: 'update-playlist-entry', cls });

  const autoplayPl = chordFilter.playlist !== 'All' ? state.playlists.find(p => p.id === chordFilter.playlist) : null;
  const autoplayPos = autoplayPl && selectedFavId ? autoplayPl.chords.findIndex(c => c.id === selectedFavId) : -1;

  const discoverMatches = state.discoverMode ? identifyChord(state.discoverNotes) : [];
  // Listen: the chord heard, lit on the pan (docs/listen-mode.md).
  const heard = state.hpListen ? listenHeardOn(getAllNotes(layout).map(noteToMidi)) : null;

  // Discover mode's clicked notes get the same treatment as a selected chord's
  // notes: exact matches highlighted, other same-pitch-class positions dimmed.
  const panName = m => getAllNotes(layout).find(n => noteToMidi(n) === m);
  // The root first, so it gets the root's colour on the pan.
  const activeNotes = heard ? (heard.fit ? [...heard.fit.voicing].sort((a, b) => ((a - heard.chord.rootPC) % 12 === 0 ? 0 : 1) - ((b - heard.chord.rootPC) % 12 === 0 ? 0 : 1)).map(panName) : [])
    : state.discoverMode ? state.discoverNotes : (selectedChord ? selectedChord.notes : null);
  const highlightNotes = activeNotes || [];
  const chordPCs = activeNotes ? new Set(activeNotes.map(n => notePC(n))) : new Set();
  const altHighlightNotes = activeNotes
    ? getAllNotes(layout).filter(n => chordPCs.has(notePC(n)) && !activeNotes.includes(n))
    : [];
  const panSvg = renderPan(layout, { shellMode: 'both', highlightNotes, altHighlightNotes, rotated: state.ringRotated, useFlats: uf, useSolfege: us });

  // The selected chord: a bar on phones (More opens a sheet), a full card
  // with every action and the related chords from 600px.
  const card = state.hpListen ? listenCardHtml(heard) : state.discoverMode ? '' : selectedChord ? chordCardHtml({
    title: escHtml(hpChordName(selectedChord)),
    metas: [[escHtml(hpNotesText(selectedChord.notes))], [`${escHtml(selectedChord.type.category)} · ${selectedChord.noteCount} notes`, 'hp-wide']],
    actions: `
          ${hpHeartBtn(selectedInAny, { action: 'show-playlist-picker', data: { 'chord-id': selectedChord.id, 'chord-fav-id': selectedFavId } })}
          ${canUpdateEntry ? saveVoicingBtn('hp-wide') : ''}
          <button type="button" class="btn btn-primary hp-play" data-action="play-chord">${icon('play')} Chord</button>
          <button type="button" class="btn btn-secondary hp-wide" data-action="play-scale">${icon('play')} Scale</button>
          ${uiIconBtn('ellipsis', 'More', { action: 'hp-more-open', cls: 'hp-narrow', attrs: 'aria-haspopup="dialog"' })}`,
    below: `<div class="hp-related hp-wide">${hpRelatedHtml(selectedChord)}</div>`,
  }) : `
    <div class="hp-card is-empty">
      <span class="hp-card-hint">Tap a chord to see it on the ${layoutFamilyInfo(layoutInstrument(state.layout)).word}</span>
      <button type="button" class="btn btn-secondary" data-action="play-scale">${icon('play')} Scale</button>
    </div>`;

  const nowPlaying = autoplayPl ? `
    <div class="hp-now">
      <div class="hp-now-top">
        ${icon('list-music')}
        <span class="hp-now-name">${escHtml(autoplayPl.name)}</span>
        ${autoplayPos >= 0 ? `<span class="hp-now-pos num">${autoplayPos + 1} / ${autoplayPl.chords.length}</span>` : ''}
        <button type="button" class="btn btn-ghost btn-sm" data-action="hp-edit-playlist">Edit</button>
        ${uiIconBtn('x', 'Show all chords', { action: 'hp-clear-playlist', cls: 'is-dense' })}
      </div>
      <div class="hp-now-ctl">
        <button type="button" class="btn btn-primary" data-action="toggle-autoplay">
          ${state.autoplayOn ? icon('pause') + ' Pause' : icon('play') + ' Auto-play'}
        </button>
        <select class="select hp-secs" data-action="set-autoplay-seconds" aria-label="Seconds per chord" title="Seconds per chord">
          ${AUTOPLAY_SECONDS.map(s => `<option value="${s}" ${state.autoplaySeconds === s ? 'selected' : ''}>${s} s</option>`).join('')}
        </select>
      </div>
    </div>` : '';

  const nFilters = hpFilterCount();
  const browseHead = `
    ${nowPlaying}
    ${chordFilterRowHtml({ open: 'hp-filters-open', count: nFilters, roots, root: chordFilter.root, rootAction: 'filter-root' })}
    <div class="hp-count">${filtered.length} chord${filtered.length !== 1 ? 's' : ''}</div>`;

  const rows = filtered.length === 0
    ? uiEmpty({
      icon: 'sliders-horizontal', title: 'No chords match these filters',
      action: '<button type="button" class="btn btn-secondary" data-action="hp-filters-clear" data-all="1">Clear filters</button>',
    })
    : `<div class="list chord-rows">${filtered.map(c => {
      const favId = `${layoutId}-${c.id}`;
      const inAny = isChordBookmarkedAnyVoicing(layoutId, c.id);
      const isSel = selectedChord?.id === c.id;
      return chordRowHtml({
        title: hpChordName(c), meta: escHtml(c.type.category),
        action: 'select-chord', data: { id: c.id }, current: isSel,
        trail: `
          ${hpHeartBtn(inAny, { action: 'show-playlist-picker', data: { 'chord-id': c.id, 'chord-fav-id': favId } })}
          ${canUpdateEntry && isSel ? saveVoicingBtn('') : ''}
          <span class="chord-count">${c.noteCount}</span>`,
      });
    }).join('')}</div>`;

  // Identify: notes tapped on the pan, and the chords they make.
  const dn = state.discoverNotes;
  let matches = '';
  if (dn.length < 2) {
    matches = `<p class="hp-hint">Select 2 or more notes to identify a chord.</p>`;
  } else if (discoverMatches.length === 0) {
    matches = `<div class="list">${uiRow({
      title: 'Custom combination',
      meta: `Not a recognized chord type · ${dn.length} notes: ${escHtml(dn.map(n => displayNote(n, uf, us)).join(', '))}`,
      trail: `${hpHeartBtn(false, { action: 'discover-bookmark-custom' })}${uiIconBtn('play', 'Play chord', { action: 'discover-play-custom' })}`,
    })}</div>`;
  } else {
    matches = `<div class="list">${discoverMatches.map((m, idx) => uiRow({
      title: hpChordName(m),
      meta: `${escHtml(m.type.category)} · ${m.noteCount} notes: ${escHtml(m.notes.map(n => displayNote(n, uf, us)).join(', '))}`,
      trail: `${hpHeartBtn(isChordBookmarkedAnyVoicing(layoutId, m.id), { action: 'discover-bookmark', data: { 'match-idx': idx } })}${uiIconBtn('play', 'Play chord', { action: 'discover-play', data: { 'match-idx': idx } })}`,
    })).join('')}</div>`;
  }
  const identify = `
    <div class="hp-identify">
      <p class="hp-hint">Tap notes on the ${layoutFamilyInfo(layoutInstrument(state.layout)).word} to build a chord. Tap again to remove one.</p>
      ${dn.length ? `
        <div class="hp-identify-notes">
          <div class="chips">${dn.map(n => `<span class="chip is-selected hp-note-chip">${escHtml(displayNote(n, uf, us))}</span>`).join('')}</div>
          <button type="button" class="btn btn-secondary btn-sm" data-action="discover-clear">Clear</button>
        </div>` : ''}
      ${matches}
    </div>`;

  return `
    ${handpanAppBar(handpanTabs('chords'))}${chordsScreenHtml({
    cls: state.discoverMode ? ' is-identify' : '',
    picture: `<div class="pan-wrap hp-pan">${panRotateBtn()}${panSvg}</div>`,
    card,
    listHead: `${uiSeg([{ value: 'browse', label: 'Browse' }, { value: 'identify', label: 'Identify' }, { value: 'listen', label: 'Listen' }],
            state.hpListen ? 'listen' : state.discoverMode ? 'identify' : 'browse', { action: 'toggle-discover-mode', label: 'Find chords by' })}
          ${state.discoverMode || state.hpListen ? '' : browseHead}`,
    list: state.hpListen ? listenHistoryHtml() : state.discoverMode ? identify : rows,
  })}`;
}

// Filters sheet: note counts, chord type and playlist (§6.7).
function hpFiltersSheet() {
  const f = state.chordFilter;
  const pl = f.playlist !== 'All' ? state.playlists.find(p => p.id === f.playlist) : null;
  const body = `
    <div class="hp-sheet-form">
      ${chordCountField(state.chordCountSet, 'toggle-note-count')}
      ${chordTypeField(f.category, 'filter-category')}
      ${uiField({ label: 'Playlist', id: 'hp-playlist-filter', control: uiPicker({
        id: 'hp-playlist-filter', value: f.playlist, label: 'Playlist', action: 'select-playlist-filter',
        options: [{ value: 'All', label: 'All chords' }, ...state.playlists.map(p => ({ value: p.id, label: p.name, meta: `${p.chords.length} chord${p.chords.length !== 1 ? 's' : ''}` }))],
      }) })}
      ${pl ? `<div class="list">${uiRow({ lead: 'pencil', title: 'Edit playlist', meta: escHtml(pl.name), chevron: true, action: 'hp-edit-playlist' })}</div>` : ''}
    </div>`;
  return uiSheet({
    key: 'hp-filters', title: 'Filters', close: 'hp-filters-close', body,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="hp-filters-clear">Clear all</button>
      <button type="button" class="btn btn-primary" data-action="hp-filters-close">Done</button>`,
  });
}

// More sheet of the selected chord on phones: what the desktop card shows inline.
function hpMoreSheet() {
  const chord = state.selectedChord;
  const { pl, canUpdate } = hpSourceEntry();
  const rows = [
    uiRow({ lead: 'play', title: 'Play scale', action: 'play-scale' }),
    canUpdate ? uiRow({ lead: 'save', title: `Save this voicing to "${pl.name}"`, action: 'update-playlist-entry' }) : '',
    uiRow({ lead: 'link', title: 'Copy link to this chord', action: 'copy-url' }),
  ].join('');
  return uiSheet({
    key: 'hp-more', variant: 'hpmore', title: hpChordName(chord), close: 'hp-more-close',
    body: `<div class="list">${rows}</div><div class="hp-related">${hpRelatedHtml(chord)}</div>`,
  });
}

// Rotate button overlaid on the pan drawing (Chords and Pan).
function panRotateBtn() {
  // Tongue drums and kalimbas are drawn the way makers lay them out: no rotation.
  if (layoutInstrument(state.layout) !== 'handpan') return '';
  return uiIconBtn('rotate', 'Rotate the ring so the two lowest notes face you', {
    action: 'toggle-rotation', pressed: state.ringRotated, cls: 'tonal pan-rotate',
  });
}

// ── Add to home screen ─────────────────────────────────────────────────────
// The app works best installed: full screen, its own icon, offline. A slim
// banner on the start screens says so; Android browsers give us their own
// install dialog (beforeinstallprompt), iPhones don't, so there the button
// shows the steps. Hidden in the installed app, and for 30 days after ×
// (a per-device convenience, so localStorage).
let _installEvent = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); _installEvent = e; render(); });
window.addEventListener('appinstalled', () => { _installEvent = null; state.installHelp = false; render(); });
const INSTALL_DISMISS_KEY = 'hp-install-dismissed';
const INSTALL_QUIET_MS = 30 * 24 * 3600 * 1000;

function runningInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function installBannerHtml() {
  if (runningInstalled()) return '';
  try { if (Date.now() - Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0) < INSTALL_QUIET_MS) return ''; } catch {}
  return `
      <div class="banner install-banner">
        <span>${icon('smartphone')} Add Oakhum to your home screen: it opens like an app, full screen, and works offline.</span>
        <span class="install-banner-actions">
          <button type="button" class="btn btn-primary btn-sm" data-action="install-app">Add</button>
          ${uiIconBtn('x', 'Not now', { action: 'install-dismiss' })}
        </span>
      </div>`;
}
function installHelpSheet() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const steps = ios
    ? (/CriOS|FxiOS|EdgiOS/.test(ua)
      ? ['Tap the Share button in the address bar (a square with an arrow).', 'Choose <b>Add to Home Screen</b>.', 'Tap <b>Add</b>.']
      : ['Tap the Share button (a square with an arrow) at the bottom of Safari.', 'Scroll down and choose <b>Add to Home Screen</b>.', 'Tap <b>Add</b>.'])
    : /SamsungBrowser/.test(ua)
    ? ['Open the menu (the three lines at the bottom).', 'Choose <b>Add page to</b>, then <b>Home screen</b>.']
    : ['Open the browser menu (⋮ or ≡).', 'Choose <b>Add to Home screen</b> or <b>Install app</b>.'];
  return uiSheet({
    key: 'install', title: 'Add Oakhum to your home screen', close: 'install-help-close',
    body: `<ol class="install-steps">${steps.map(t => `<li>${t}</li>`).join('')}</ol>
      <p class="sheet-text">Then open Oakhum from its icon: full screen, quicker to reach, and with an account it works offline.</p>`,
    footer: '<button type="button" class="btn btn-primary" data-action="install-help-close">Done</button>',
  });
}

// ── Sheets ───────────────────────────────────────────────────────────────────
// At most one sheet is open; it's rendered from state after the view.
function sheetHtml() {
  if (state.listenReport) return listenReportSheet();
  if (state.installHelp) return installHelpSheet();
  if (state.saveSheet) return saveSheetHtml();
  if (state.accountConfirm) return accountConfirmSheet();
  if (state.confirm) return confirmSheet();
  if (state.menu) return menuSheet();
  if (state.photoCrop) return photoCropSheet();
  if (state.instEdit) return instEditSheet();
  if (state.shareModal) return shareModalHtml();
  if (state.pickerChordFavId && ['chords', 'instrument', 'playlist'].includes(state.view)) return renderPlaylistPicker();
  if (state.plName) return plNameSheet();
  if (state.chordSheet && ['hp-playlists', 'instrument', 'progression'].includes(state.view)) return chordSheetSheet();
  if (state.plRowMenu != null && state.view === 'playlist') return plRowMenuSheet();
  if (state.progRowMenu != null && state.view === 'progression') return progRowMenuSheet();
  if (state.hpFilters && state.view === 'chords') return hpFiltersSheet();
  if (state.hpMore && state.view === 'chords' && state.selectedChord && !state.discoverMode) return hpMoreSheet();
  if (state.pendingSlot && state.view === 'editor') return renderNotePicker();
  if (state.oc.handLegend && (state.view === 'instrument' || state.view === 'settings')) return handLegendModal();
  if (state.oc.fingersSheet && state.view === 'instrument' && state.oc.tab === 'setup') return setupFingersSheet();
  if (state.oc.chordMore && state.view === 'instrument' && state.oc.tab === 'chords') return ocChordMoreSheet();
  if (state.oc.filtersOpen && state.view === 'instrument' && state.oc.tab === 'chords') return ocFiltersSheet();
  if (state.clayEdit && state.view === 'clay') return clayEditSheet();
  return '';
}

// Add to playlist: tick playlists, or start a new one. Its Progression
// segment appends the chord as a step instead (repeats allowed).
function renderPlaylistPicker() {
  const seg = `<div class="picker-mode">${uiSeg([{ value: 'playlist', label: 'Playlist' }, { value: 'progression', label: 'Progression' }],
    state.pickerMode, { action: 'picker-mode', label: 'Add to' })}</div>`;
  if (state.pickerMode === 'progression') {
    const rows = state.progressions.map(p => uiRow({
      lead: `<span class="row-check">${icon('plus')}</span>`, title: p.name,
      meta: p.steps.length ? escHtml(p.steps.slice(-3).map(progStepTitle).join(' · ')) : 'No steps yet',
      trail: `<span class="chord-count">${p.steps.length}</span>`,
      action: 'add-to-progression', data: { 'prog-id': p.id },
    })).join('');
    const create = state.pickerNewProgression
      ? `<div class="picker-new-row">
           <input class="input" id="new-progression-input" placeholder="Progression name" aria-label="New progression name">
           <button class="btn btn-primary" data-action="confirm-new-progression">Create</button>
         </div>`
      : uiRow({ lead: `<span class="row-check">${icon('plus')}</span>`, title: 'New progression', action: 'show-new-progression-input' });
    return uiSheet({
      key: 'picker', title: 'Add to progression', close: 'close-playlist-picker',
      body: `${seg}<p class="picker-hint">Adds the chord as the next step. The same chord can go in more than once.</p><div class="list">${rows}${create}</div>`,
    });
  }
  const favId = state.pickerChordFavId;
  const rows = state.playlists.map(pl => {
    const inPl = pl.chords.some(c => c.id === favId);
    return uiRow({
      lead: `<span class="row-check">${inPl ? icon('check') : ''}</span>`, title: pl.name,
      trail: `<span class="chord-count">${pl.chords.length}</span>`, cls: inPl ? 'is-current' : '',
      action: 'toggle-playlist-chord', data: { 'playlist-id': pl.id },
    });
  }).join('');
  const create = state.pickerNewPlaylist
    ? `<div class="picker-new-row">
         <input class="input" id="new-playlist-input" placeholder="Playlist name" aria-label="New playlist name">
         <button class="btn btn-primary" data-action="confirm-new-playlist">Create</button>
       </div>`
    : uiRow({ lead: `<span class="row-check">${icon('plus')}</span>`, title: 'New playlist', action: 'show-new-playlist-input' });
  return uiSheet({
    key: 'picker', title: 'Add to playlist', close: 'close-playlist-picker',
    body: `${seg}<div class="list">${rows}${create}</div>`,
  });
}

// The ⋯ menu of the instrument on screen.
function menuSheet() {
  if (state.menu?.id) return rowMenuSheet(state.menu.id);
  const rows = [];
  let title = 'Menu';
  if (state.view === 'playlist') {
    const pl = state.playlists.find(p => p.id === state.activePlaylistId);
    title = pl?.name ?? title;
    if (pl) rows.push(uiRow({ lead: 'pencil', title: 'Rename', action: 'pl-rename-open' }));
    if (pl && pl.chords.length) rows.push(uiRow({ lead: 'list-ordered', title: 'Copy as progression', meta: 'Same chords in order, then repeat any of them', action: 'pl-copy-progression' }));
    if (pl && pl.id !== 'favorites') rows.push(uiRow({ lead: 'trash-2', title: 'Delete playlist', action: 'delete-playlist', cls: 'is-danger' }));
  } else if (state.view === 'progression') {
    const prog = progFind();
    title = prog?.name ?? title;
    if (prog) {
      rows.push(uiRow({ lead: 'pencil', title: 'Rename', action: 'prog-rename-open' }));
      rows.push(uiRow({ lead: 'trash-2', title: 'Delete progression', action: 'prog-delete', cls: 'is-danger' }));
    }
  } else if (state.view === 'instrument') {
    const inst = currentInstrument();
    const shared = inst?.id === SHARED_ID;
    title = inst?.name ?? title;
    if (inst && !shared) rows.push(uiRow({ lead: 'pencil', title: 'Edit instrument', meta: instEditMeta(inst), action: 'inst-edit-open', data: { id: inst.id } }));
    if (inst && !shared) rows.push(uiRow({ lead: 'share-2', title: 'Share…', meta: 'Code, link and QR code', action: 'share-instrument' }));
    if (inst?.link) rows.push(uiRow({ lead: 'link', title: 'Copy link', action: 'copy-url' }));
    if (inst) rows.push(uiRow({ lead: 'hand', title: 'Which finger is which', action: 'oc-hand-open' }));
    rows.push(uiRow({ lead: 'settings', title: 'Settings', action: 'open-settings' }));
    if (inst && !shared) rows.push(uiRow({ lead: 'trash-2', title: 'Remove instrument', action: 'delete-instrument', data: { id: inst.id }, cls: 'is-danger' }));
  } else if (state.layout) {
    title = state.layout.name;
    const mine = state.currentInstrumentId ? getInstrument(state.currentInstrumentId) : null;
    if (mine) rows.push(uiRow({ lead: 'pencil', title: 'Edit instrument', meta: instEditMeta(mine), action: 'inst-edit-open', data: { id: mine.id } }));
    if (mine) rows.push(uiRow({ lead: 'share-2', title: 'Share…', meta: 'Code, link and QR code', action: 'share-instrument', data: { id: mine.id } }));
    rows.push(uiRow({ lead: 'link', title: state.selectedChord ? 'Copy link to this chord' : 'Copy link', action: 'copy-url' }));
    rows.push(uiRow({ lead: 'settings', title: 'Settings', action: 'open-settings' }));
    if (state.currentInstrumentId) {
      rows.push(uiRow({ lead: 'trash-2', title: 'Remove instrument', action: 'delete-instrument', data: { id: state.currentInstrumentId }, cls: 'is-danger' }));
    }
  }
  return uiSheet({ key: 'menu', variant: 'menu', title, close: 'menu-close', body: `<div class="list">${rows.join('')}</div>` });
}

// Are you sure? Replaces window.confirm for removing instruments and playlists.
function confirmSheet() {
  const c = state.confirm;
  return uiSheet({
    key: 'confirm', variant: 'confirm', title: c.title, close: 'confirm-cancel',
    body: `<p class="sheet-text">${escHtml(c.body)}</p>`,
    footer: `
      <button class="btn btn-ghost" data-action="confirm-cancel">Cancel</button>
      <button class="btn btn-danger is-filled" data-action="confirm-ok">${escHtml(c.ok)}</button>`,
  });
}

// ⋯ button of an instrument's app bar.
function menuAppBtn() { return uiIconBtn('ellipsis', 'More', { action: 'menu-open', attrs: 'aria-haspopup="dialog"' }); }

// ── View 4: Playlist ─────────────────────────────────────────────────────────
// Playlist detail (§6.9): Play or Practice on the instrument you came from,
// the chords (handpan rows, ocarina and flute entries as their instrument's
// chord cards), an Order mode to rearrange, and Rename / Delete in ⋯.

// The instrument the playlist was opened from and how many entries are its.
function plHere(pl) {
  const inst = state.currentInstrumentId ? currentInstrument() : null;
  if (inst && !usesLayout(inst)) {
    return { kind: 'oc', name: inst.name, n: pl.chords.filter(c => entryIsFor(c, inst)).length };
  }
  const layoutId = hpCurrentLayoutId();
  if (!layoutId) return null;
  return { kind: 'hp', name: state.layout.name, n: pl.chords.filter(c => !c.instrumentId && c.layoutId === layoutId).length };
}

function plEntryTitle(en) {
  return `${displayNote(en.rootName, state.useFlats, state.useSolfege)} ${en.typeName}`;
}
function plEntryMeta(en) {
  return escHtml(`${en.scaleName} · ${en.notes.map(n => displayNote(n, state.useFlats, state.useSolfege)).join(' · ')}`);
}

function viewPlaylist() {
  const pl = state.playlists.find(p => p.id === state.activePlaylistId);
  if (!pl) return viewSelector();
  const uf = state.useFlats, us = state.useSolfege;
  const here = plHere(pl);
  const order = state.plMode === 'order';
  const last = pl.chords.length - 1;

  const play = !here?.n ? '' : here.kind === 'oc'
    ? `<button type="button" class="btn btn-primary btn-lg btn-block" data-action="pl-practice">${icon('play')} Practice on ${escHtml(here.name)}</button>`
    : `<button type="button" class="btn btn-primary btn-lg btn-block" data-action="hp-play-playlist" data-id="${escHtml(pl.id)}">${icon('play')} Play</button>`;

  let entries;
  if (pl.chords.length === 0) {
    entries = uiEmpty({
      icon: 'heart', title: 'No chords yet', body: 'Tap ♡ on any chord to add it here.',
      action: here ? '<button type="button" class="btn btn-secondary" data-action="pl-go-chords">Go to Chords</button>' : '',
    });
  } else if (order) {
    entries = `<div class="list">${pl.chords.map((en, idx) => uiRow({
      title: plEntryTitle(en), meta: plEntryMeta(en), cls: 'pl-order-row',
      trail: `
        ${uiIconBtn('chevron-up', 'Move up', { action: 'move-chord-up', data: { idx }, disabled: idx === 0 })}
        ${uiIconBtn('chevron-down', 'Move down', { action: 'move-chord-down', data: { idx }, disabled: idx === last })}
        ${uiIconBtn('x', 'Remove from playlist', { action: 'remove-playlist-chord', data: { idx } })}`,
    })).join('')}</div>`;
  } else {
    entries = `<div class="pl-entries">${pl.chords.map((en, idx) => {
      const inst = en.instrumentId ? entryInstrument(en) : null;
      if (inst && playableMidis(inst).length) {
        // Same row as a handpan entry: it opens the chord on its instrument.
        return `<div class="list">${uiRow({
          title: `${displayNote(en.rootName, uf, us)} ${en.typeName}`,
          meta: escHtml(`${inst.name}${en.category ? ' · ' + en.category : ''} · ${en.notes.map(n => displayNote(n, uf, us)).join(' · ')}`),
          action: 'open-playlist-chord', data: { idx }, chevron: false,
          trail: uiIconBtn('ellipsis', 'Move or remove', { action: 'pl-row-menu', data: { idx }, attrs: 'aria-haspopup="dialog"' }),
        })}</div>`;
      }
      return `<div class="list">${uiRow({
        title: plEntryTitle(en),
        meta: en.instrumentId ? `${escHtml(en.scaleName)} · no longer in My instruments` : plEntryMeta(en),
        action: en.instrumentId ? '' : 'open-playlist-chord', data: { idx },
        trail: uiIconBtn('ellipsis', 'Move or remove', { action: 'pl-row-menu', data: { idx }, attrs: 'aria-haspopup="dialog"' }),
      })}</div>`;
    }).join('')}</div>`;
  }

  return `
    ${backAppBar(pl.name, { actions: [tunerAppBtn(), menuAppBtn()] })}
    <div class="playlist-view">
      ${play}
      ${pl.chords.length > 1 ? uiSeg([{ value: 'chords', label: 'Chords' }, { value: 'order', label: 'Order' }], state.plMode, { action: 'pl-mode', label: 'Show' }) : ''}
      ${entries}
    </div>
  `;
}

// ⋯ of a playlist entry: Move up, Move down, Remove.
function plRowMenuSheet() {
  const pl = state.playlists.find(p => p.id === state.activePlaylistId);
  const idx = state.plRowMenu;
  const en = pl?.chords[idx];
  if (!en) return '';
  const rows = [
    uiRow({ lead: 'chevron-up', title: 'Move up', action: 'move-chord-up', data: { idx }, cls: idx === 0 ? 'is-disabled' : '' }),
    uiRow({ lead: 'chevron-down', title: 'Move down', action: 'move-chord-down', data: { idx }, cls: idx === pl.chords.length - 1 ? 'is-disabled' : '' }),
    uiRow({ lead: 'trash-2', title: 'Remove from playlist', action: 'remove-playlist-chord', data: { idx }, cls: 'is-danger' }),
  ].join('');
  return uiSheet({ key: 'pl-row', variant: 'plrow', title: plEntryTitle(en), close: 'pl-row-close', body: `<div class="list">${rows}</div>` });
}

// New playlist / Rename playlist: one name field.
function plNameSheet() {
  const n = state.plName;
  const isNew = n.mode === 'new' || n.mode === 'prog-new';
  const what = n.mode.startsWith('prog-') ? 'progression' : 'playlist';
  return uiSheet({
    key: 'pl-name', title: `${isNew ? 'New' : 'Rename'} ${what}`, close: 'pl-name-cancel',
    body: `<div class="hp-sheet-form">${uiField({
      label: 'Name', id: 'pl-name-input', error: n.error ? 'Give it a name' : '',
      control: `<input class="input" id="pl-name-input" value="${escHtml(n.value)}" placeholder="${what === 'playlist' ? 'Playlist' : 'Progression'} name" autocomplete="off">`,
    })}</div>`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="pl-name-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" data-action="pl-name-save">${isNew ? 'Create' : 'Save'}</button>`,
  });
}

// Plays a playlist on the handpan on screen: opens its first chord for this
// handpan in Chords, filtered to the playlist, and turns auto-play on.
function hpPlayPlaylist(pl) {
  const layoutId = hpCurrentLayoutId();
  const idx = pl.chords.findIndex(c => !c.instrumentId && c.layoutId === layoutId);
  if (idx < 0) return;
  if (!loadPlaylistChordAt(pl, idx)) { showToast('Scale not found'); return; }
  state.chordFilter = { category: 'All', root: 'All', playlist: pl.id };
  state.view = 'chords';
  navPush(stateToHash());
  startAutoplay(pl);
}

// ── View 5: Progression ──────────────────────────────────────────────────────
// Progression detail (#prog/<id>): chords in order with repeats, a tempo,
// beats per bar and bars per step (docs/ocarina-mode.md, "Progressions").
// On a handpan Play runs the steps in time and shows each one on the pan;
// on an ocarina or flute Practice walks each step's arpeggio. Steps of other
// instruments are listed with their instrument's name and skipped.

function progFind(id = state.activeProgressionId) {
  return state.progressions.find(p => p.id === id) ?? null;
}

function progStepTitle(s) {
  if (s.missing && s.symbol) return s.symbol; // a chord sheet chord the instrument lacks
  return `${displayNote(s.rootName, state.useFlats, state.useSolfege)} ${s.typeName}`;
}

// The layout a handpan step was saved on (a copy), or null when it's gone.
function progStepLayout(s) {
  if (s.layoutData) return JSON.parse(JSON.stringify(s.layoutData));
  const saved = state.savedLayouts.find(l => l.id === s.layoutId);
  if (saved) return JSON.parse(JSON.stringify(saved.layout));
  const scale = findTuning(s.layoutId);
  return scale ? createLayoutFromScale(scale) : null;
}

function progOcContext(inst) {
  return { kind: 'oc', inst, name: inst.name, isHere: s => entryIsFor(s, inst) && !s.missing };
}
function progHpContext(layoutId, name) {
  return { kind: 'hp', layoutId, name, isHere: s => !s.instrumentId && s.layoutId === layoutId && !s.missing };
}

// Where the progression plays: the instrument it was opened from, else the
// instrument of its first step that still exists (load / open: that
// handpan or ocarina is put on screen first). null when there is none.
function progContext(prog) {
  const cur = state.currentInstrumentId ? getInstrument(state.currentInstrumentId) : null;
  if (cur && !usesLayout(cur)) return progOcContext(cur);
  const layoutId = hpCurrentLayoutId();
  if (layoutId) return progHpContext(layoutId, state.layout.name);
  const first = prog?.steps.find(s => (s.instrumentId ? !!entryInstrument(s) : !!progStepLayout(s)));
  if (!first) return null;
  if (first.instrumentId) return { ...progOcContext(entryInstrument(first)), open: true };
  return { ...progHpContext(first.layoutId, first.scaleName), load: first };
}

// Puts a step's handpan on screen (as that instrument when it's saved).
function progLoadHandpan(s) {
  const owned = getInstrument(handpanInstrumentId(s.layoutId));
  const saved = owned && state.savedLayouts.find(l => l.id === s.layoutId);
  const layout = saved ? JSON.parse(JSON.stringify(saved.layout)) : progStepLayout(s);
  if (!layout) return false;
  state.layout = layout;
  state.chords = findAllChords(layout);
  state.currentInstrumentId = saved ? owned.id : null;
  return true;
}

// ── Playing on the handpan: one timer tick per beat, the chord on beat 1 ──
let _progTimer = null;

function progBeatMs(prog) { return progressionStepMs(prog.bpm, prog.beatsPerBar, 1) / prog.beatsPerBar; }

function progStop() {
  if (_progTimer) { clearInterval(_progTimer); _progTimer = null; }
  if (state.progPlay) state.progPlay.playing = false;
}

// The step on the pan: the one playing, or the last one tapped.
function progCurrentIdx(prog) {
  const pp = state.progPlay;
  if (!pp || pp.id !== prog.id) return -1;
  const idx = prog.steps.findIndex(s => s.stepId === pp.stepId);
  return idx >= 0 ? idx : -1;
}

function progStrike(s) {
  initAudio();
  for (const n of s.notes) playNote(n);
  updatePanPlaying(s.notes);
}

function progStart(prog, fromIdx = null) {
  progStop();
  let ctx = progContext(prog);
  if (ctx?.load) {
    if (!progLoadHandpan(ctx.load)) { showToast('Scale not found'); return; }
    ctx = progContext(prog);
  }
  if (!ctx || ctx.kind !== 'hp') return;
  const idx = fromIdx != null && ctx.isHere(prog.steps[fromIdx]) ? fromIdx : nextProgressionStep(prog.steps, -1, ctx.isHere);
  if (idx < 0) { showToast(`No steps on ${ctx.name}`); return; }
  if (progressionLevel(prog) !== 'chord') { progStartLevel(prog, idx); return; }
  state.progPlay = { id: prog.id, stepId: prog.steps[idx].stepId, beat: 0, playing: true };
  render();
  progStrike(prog.steps[idx]);
  _progTimer = setInterval(progTick, progBeatMs(prog));
}

// A new tempo or time signature takes effect from the next beat.
function progRetime(prog) {
  if (!_progTimer || state.progPlay?.id !== prog.id) return;
  clearInterval(_progTimer);
  if (state.progPlay.half != null) { _progTimer = setInterval(progLevelTick, progBeatMs(prog) / 2); return; }
  _progTimer = setInterval(progTick, progBeatMs(prog));
}

function progTick() {
  const pp = state.progPlay;
  const prog = pp?.playing ? progFind(pp.id) : null;
  const ctx = prog && state.view === 'progression' && state.activeProgressionId === prog.id ? progContext(prog) : null;
  if (!ctx || ctx.kind !== 'hp' || ctx.load) { progStop(); if (state.view === 'progression') render(); return; }
  let idx = progCurrentIdx(prog);
  const step = prog.steps[idx];
  pp.beat += 1;
  if (step && pp.beat < progressionStepBeats(step, prog.beatsPerBar)) { progBeatUpdate(prog, step); return; }
  idx = nextProgressionStep(prog.steps, idx, ctx.isHere);
  if (idx < 0) { progStop(); render(); return; }
  Object.assign(pp, { stepId: prog.steps[idx].stepId, beat: 0 });
  render();
  progStrike(prog.steps[idx]);
}

// ── Play levels: Roots, Arpeggio, Groove ("From chord sheet to playing") ──
// A level plays a pattern from js/chordsheet.js instead of the whole chord,
// after one bar of count-in clicks (4-3-2-1 on screen). The timer ticks
// every half beat, for Groove's ghost taps. The Chord level is Play as it
// always was, with no count-in.

// The notes a level plays for a step on the pan on screen: its voicing as
// saved when that isn't the chord's default one, otherwise the chord
// stacked from its lowest root (the docs' table: F on D Kurd is C4 F4 A4).
function progStepVoicing(s) {
  if (!s || s.missing || !s.notes?.length) return [];
  const sorted = [...s.notes].sort((a, b) => noteToMidi(a) - noteToMidi(b));
  const type = CHORD_TYPES.find(t => t.id === s.chordId?.slice(s.chordId.indexOf('-') + 1));
  const canonical = state.chords.find(c => c.id === s.chordId);
  if (!type || !state.layout || (canonical && canonical.notes.join(',') !== s.notes.join(','))) return sorted;
  return stackVoicing(notePC(s.rootName + '4'), type.intervals, getAllNotes(state.layout)) ?? sorted;
}

function progPattern(prog, idx, ctx) {
  const s = prog.steps[idx];
  const notes = progStepVoicing(s);
  const ni = nextProgressionStep(prog.steps, idx, ctx.isHere);
  const next = ni >= 0 ? progStepVoicing(prog.steps[ni]) : null;
  const root = notes.find(n => notePC(n) === notePC(s.rootName + '4')) ?? notes[0];
  const pat = strikePattern({
    notes, root, beatsPerBar: prog.beatsPerBar, beats: progressionStepBeats(s, prog.beatsPerBar),
    bpm: prog.bpm, level: progressionLevel(prog), next, section: s.section,
  });
  return { ...pat, notes, next: ni >= 0 && ni !== idx ? next : null };
}

// "1 C4 R · 2 F4 L · …": the first bar of a pattern, for reading and for
// screen readers.
function progPatternText(pat, beatsPerBar) {
  const first = pat.hits.filter(h => !h.ghost && h.beat < beatsPerBar);
  const beats = [...new Set(first.map(h => h.beat))];
  const uf = state.useFlats, us = state.useSolfege;
  const parts = beats.map((b, i) => {
    const at = first.filter(h => h.beat === b);
    return `${i + 1} ${at.map(h => `${displayNote(h.notes[0], uf, us)} ${h.hand}`).join(' + ')}`;
  });
  return parts.join(' · ') + (pat.hits.some(h => h.ghost) ? ' · ghost taps between' : '');
}

function progStartLevel(prog, idx) {
  state.progPlay = { id: prog.id, stepId: prog.steps[idx].stepId, beat: 0, half: 0, countIn: prog.beatsPerBar, playing: true };
  render();
  initAudio();
  playClick(true);
  _progTimer = setInterval(progLevelTick, progBeatMs(prog) / 2);
}

function progLevelStrike(prog, ctx, beat) {
  const idx = progCurrentIdx(prog);
  if (idx < 0) return;
  const hits = progPattern(prog, idx, ctx).hits.filter(h => h.beat === beat && !h.ghost);
  if (!hits.length) return;
  const notes = hits.flatMap(h => h.notes);
  for (const n of notes) playNote(n);
  updatePanPlaying(notes);
}

function progLevelTick() {
  const pp = state.progPlay;
  const prog = pp?.playing ? progFind(pp.id) : null;
  const ctx = prog && state.view === 'progression' && state.activeProgressionId === prog.id ? progContext(prog) : null;
  if (!ctx || ctx.kind !== 'hp' || ctx.load) { progStop(); if (state.view === 'progression') render(); return; }
  pp.half += 1;
  if (pp.countIn > 0) {
    if (pp.half % 2) return;
    pp.countIn -= 1;
    if (pp.countIn > 0) { playClick(false); progBeatUpdate(prog, null); return; }
    Object.assign(pp, { half: 0, beat: 0 });
    render();
    progLevelStrike(prog, ctx, 0);
    return;
  }
  let idx = progCurrentIdx(prog);
  const step = prog.steps[idx];
  if (step && pp.half < progressionStepBeats(step, prog.beatsPerBar) * 2) {
    if (pp.half % 2 === 0) { pp.beat = pp.half / 2; progBeatUpdate(prog, step); }
    progLevelStrike(prog, ctx, pp.half / 2);
    return;
  }
  idx = nextProgressionStep(prog.steps, idx, ctx.isHere);
  if (idx < 0) { progStop(); render(); return; }
  Object.assign(pp, { stepId: prog.steps[idx].stepId, beat: 0, half: 0 });
  render();
  progLevelStrike(prog, ctx, 0);
}

// Bar and beat of the step playing, updated in place between steps; the
// count-in's 4-3-2-1 before a level starts.
function progBeatHtml(prog, s) {
  const pp = state.progPlay;
  if (pp?.countIn > 0) {
    return `
      <span class="prog-count" aria-hidden="true">${pp.countIn}</span>
      <span class="prog-beat-text">Count-in</span>`;
  }
  const beat = pp?.beat ?? 0;
  const bar = Math.floor(beat / prog.beatsPerBar);
  const inBar = beat % prog.beatsPerBar;
  const bars = s.beats != null ? Math.max(1, Math.ceil(s.beats / prog.beatsPerBar)) : s.bars;
  return `
    <span class="prog-beat-dots" aria-hidden="true">${Array.from({ length: prog.beatsPerBar }, (_, i) => `<span class="${i === inBar ? 'is-on' : ''}"></span>`).join('')}</span>
    <span class="prog-beat-text">Bar ${bar + 1} of ${bars}</span>`;
}
function progBeatUpdate(prog, s) {
  const el = document.querySelector('.prog-beat');
  if (el) el.innerHTML = progBeatHtml(prog, s);
}

// ── The screen ──
// A step's length: "2 bars", or "2 beats" for part of a bar.
function progStepLenText(s) {
  if (s.beats != null) return `${s.beats} beat${s.beats !== 1 ? 's' : ''}`;
  return `${s.bars} bar${s.bars !== 1 ? 's' : ''}`;
}

function progStepRow(s, idx, { here, current, last }) {
  const uf = state.useFlats, us = state.useSolfege;
  const no = idx + 1;
  const sec = s.section ? `${escHtml(s.section)} · ` : '';
  return `
    <div class="row prog-step${current ? ' is-current' : ''}${here ? '' : ' is-other'}${s.missing ? ' is-missing' : ''}" role="button" tabindex="0" data-action="prog-step-tap" data-idx="${idx}">
      <span class="row-lead tile prog-num"><span class="sr-only">Step </span>${no}</span>
      <span class="row-title prog-step-title">${escHtml(progStepTitle(s))}</span>
      <span class="prog-step-meta">
        ${s.missing
          ? `<span class="row-meta">${sec}<span class="prog-missing">Not on ${escHtml(s.scaleName ?? 'this instrument')}</span></span>`
          : `<span class="row-meta">${sec}${escHtml(s.notes.map(n => displayNote(n, uf, us)).join(' · '))}</span>
        ${here ? '' : `<span class="row-meta">${escHtml(s.scaleName ?? '')} · skipped here</span>`}`}
      </span>
      <span class="prog-bars" role="group" aria-label="Bars for step ${no}">
        ${uiIconBtn('minus', `Fewer bars (step ${no})`, { action: 'prog-step-bars', data: { idx, delta: -1 }, cls: 'tonal', disabled: s.bars <= PROG_LIMITS.bars[0] })}
        <span class="prog-bars-val">${progStepLenText(s)}</span>
        ${uiIconBtn('plus', `More bars (step ${no})`, { action: 'prog-step-bars', data: { idx, delta: 1 }, cls: 'tonal', disabled: s.bars >= PROG_LIMITS.bars[1] })}
      </span>
      <span class="row-trail">${uiIconBtn('ellipsis', `Step ${no}: duplicate, move or remove`, { action: 'prog-row-menu', data: { idx }, attrs: 'aria-haspopup="dialog"' })}</span>
    </div>`;
}

function progFmtLength(ms) {
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function viewProgression() {
  const prog = progFind();
  if (!prog) return viewHome();
  const uf = state.useFlats, us = state.useSolfege;
  const ctx = progContext(prog);
  const isHere = ctx ? ctx.isHere : () => false;
  const nHere = prog.steps.filter(isHere).length;
  const curIdx = progCurrentIdx(prog);
  const cur = curIdx >= 0 ? prog.steps[curIdx] : null;
  const playing = !!(state.progPlay?.playing && state.progPlay.id === prog.id);
  const order = state.progMode === 'order';
  const last = prog.steps.length - 1;
  const tot = progressionTotals(prog, ctx && nHere ? isHere : undefined);

  // Player: the pan with the step on it (handpan), or Practice (ocarina).
  let player = '';
  if (prog.steps.length === 0) {
    player = ''; // the empty state below says how to add steps
  } else if (ctx && !nHere) {
    player = `<p class="prog-now-hint">None of these steps is on ${escHtml(ctx.name)}. Each one plays on its own instrument.</p>`;
  } else if (ctx?.kind === 'hp' && !ctx.load) {
    const level = progressionLevel(prog);
    const shown = cur && isHere(cur);
    const panOpts = {
      shellMode: 'both', highlightNotes: shown ? cur.notes : [], altHighlightNotes: [],
      rotated: state.ringRotated, useFlats: uf, useSolfege: us,
    };
    let patternLine = '';
    if (level !== 'chord' && shown) {
      // The pattern's notes numbered in strike order with L/R, the next chord faint.
      const pat = progPattern(prog, curIdx, ctx);
      Object.assign(panOpts, {
        highlightNotes: pat.notes,
        faintNotes: (pat.next ?? []).filter(n => !pat.notes.includes(n)),
        strikeMarks: strikeNumbers(pat.hits, prog.beatsPerBar),
      });
      patternLine = `<div class="prog-now-pattern">${escHtml(progPatternText(pat, prog.beatsPerBar))}</div>`;
    }
    const pan = renderPan(state.layout, panOpts);
    const levelSeg = uiSeg([{ value: 'chord', label: 'Chord' }, ...PLAY_LEVELS.map(l => ({ value: l.id, label: l.name }))],
      level, { action: 'prog-level', label: 'Level' });
    player = `
      <div class="prog-player">
        <div class="pan-wrap prog-pan">${panRotateBtn()}${pan}</div>
        <div class="prog-now" aria-live="polite">
          ${shown ? `
            <div class="prog-now-text">
              <div class="prog-now-title">${escHtml(progStepTitle(cur))}</div>
              <div class="prog-now-meta">Step ${curIdx + 1} of ${prog.steps.length}${cur.section ? ` · ${escHtml(cur.section)}` : ''} · ${escHtml((level !== 'chord' ? panOpts.highlightNotes : cur.notes).map(n => displayNote(n, uf, us)).join(' · '))}</div>
              ${patternLine}
            </div>
            ${playing ? `<div class="prog-beat">${progBeatHtml(prog, cur)}</div>` : ''}`
          : `<div class="prog-now-hint">${level === 'chord' ? 'Play runs the steps in order, in time. Tap a step to hear it.' : 'Play counts in one bar, then shows each chord numbered in strike order with L and R hands, the next chord faint. Tap a step to see it.'}</div>`}
        </div>
        <div class="prog-level">${levelSeg}</div>
        ${playing
          ? `<button type="button" class="btn btn-secondary btn-lg btn-block" data-action="prog-stop">${icon('square')} Stop</button>`
          : `<button type="button" class="btn btn-primary btn-lg btn-block" data-action="prog-play" ${nHere ? '' : 'disabled'}>${icon('play')} Play</button>`}
      </div>`;
  } else if (ctx?.kind === 'hp') {
    player = `<div class="prog-player"><button type="button" class="btn btn-primary btn-lg btn-block" data-action="prog-play">${icon('play')} Play on ${escHtml(ctx.name)}</button></div>`;
  } else if (ctx?.kind === 'oc') {
    const can = nHere > 0 && playableMidis(ctx.inst).length > 0;
    player = `<div class="prog-player">${can
      ? `<button type="button" class="btn btn-primary btn-lg btn-block" data-action="prog-practice">${icon('play')} Practice on ${escHtml(ctx.name)}</button>`
      : `<p class="prog-now-hint">No steps on ${escHtml(ctx.name)} yet.</p>`}</div>`;
  }

  const timing = `
    <div class="list prog-timing">
      ${uiSetRow({ label: 'Tempo', help: 'Beats per minute', control: uiStepper({
        value: prog.bpm, label: 'Tempo', action: 'prog-bpm',
        min: prog.bpm <= PROG_LIMITS.bpm[0], max: prog.bpm >= PROG_LIMITS.bpm[1],
      }) })}
      ${uiSetRow({ label: 'Beats per bar', help: 'Time signature', control: uiStepper({
        value: `${prog.beatsPerBar}/4`, label: 'Beats per bar', action: 'prog-beats',
        min: prog.beatsPerBar <= PROG_LIMITS.beatsPerBar[0], max: prog.beatsPerBar >= PROG_LIMITS.beatsPerBar[1],
      }) })}
    </div>
    <p class="prog-summary">${tot.steps} step${tot.steps !== 1 ? 's' : ''}${ctx && nHere ? ` on ${escHtml(ctx.name)}` : ''} · ${csFmtBars(tot.bars)} · ${progFmtLength(tot.ms)} at ${prog.bpm} BPM</p>`;

  let steps;
  if (prog.steps.length === 0) {
    steps = uiEmpty({
      icon: 'list-ordered', title: 'No steps yet',
      body: 'Tap ♡ on any chord, choose Progression and pick this one. The same chord can go in more than once. Or paste a chord sheet.',
      action: `<div class="empty-actions">
        <button type="button" class="btn btn-secondary" data-action="cs-open" data-prog-id="${escHtml(prog.id)}">${icon('clipboard-paste')} Paste a chord sheet</button>
        ${ctx && !ctx.load && !ctx.open ? '<button type="button" class="btn btn-ghost" data-action="pl-go-chords">Go to Chords</button>' : ''}
      </div>`,
    });
  } else if (order) {
    steps = `<div class="list">${prog.steps.map((s, idx) => uiRow({
      lead: `<span class="tile prog-num"><span class="sr-only">Step </span>${idx + 1}</span>`, title: progStepTitle(s), cls: 'pl-order-row',
      meta: escHtml(s.missing ? `Not on ${s.scaleName ?? 'this instrument'}` : isHere(s) ? s.notes.map(n => displayNote(n, uf, us)).join(' · ') : `${s.scaleName ?? ''} · skipped here`),
      trail: `
        ${uiIconBtn('chevron-up', `Move step ${idx + 1} up`, { action: 'prog-step-up', data: { idx }, disabled: idx === 0 })}
        ${uiIconBtn('chevron-down', `Move step ${idx + 1} down`, { action: 'prog-step-down', data: { idx }, disabled: idx === last })}
        ${uiIconBtn('x', `Remove step ${idx + 1}`, { action: 'prog-step-remove', data: { idx } })}`,
    })).join('')}</div>`;
  } else {
    steps = `<div class="list prog-steps">${prog.steps.map((s, idx) => progStepRow(s, idx, { here: isHere(s), current: idx === curIdx, last })).join('')}</div>`;
  }

  return `
    ${backAppBar(prog.name, { actions: [tunerAppBtn(), menuAppBtn()] })}
    <div class="prog-view${player.includes('prog-pan') ? ' has-pan' : ''}">
      <div class="prog-side">${player}</div>
      <div class="prog-main">
        ${timing}
        ${prog.steps.length > 1 ? uiSeg([{ value: 'steps', label: 'Steps' }, { value: 'order', label: 'Order' }], state.progMode, { action: 'prog-mode', label: 'Show' }) : ''}
        ${steps}
      </div>
    </div>`;
}

// ⋯ of a step: Duplicate, Move up, Move down, Remove.
function progRowMenuSheet() {
  const prog = progFind();
  const idx = state.progRowMenu;
  const s = prog?.steps[idx];
  if (!s) return '';
  const rows = [
    uiRow({ lead: 'copy', title: 'Duplicate step', meta: 'A copy right after this one', action: 'prog-step-dup', data: { idx } }),
    uiRow({ lead: 'chevron-up', title: 'Move up', action: 'prog-step-up', data: { idx }, cls: idx === 0 ? 'is-disabled' : '' }),
    uiRow({ lead: 'chevron-down', title: 'Move down', action: 'prog-step-down', data: { idx }, cls: idx === prog.steps.length - 1 ? 'is-disabled' : '' }),
    uiRow({ lead: 'trash-2', title: 'Remove step', action: 'prog-step-remove', data: { idx }, cls: 'is-danger' }),
  ].join('');
  return uiSheet({ key: 'prog-row', variant: 'progrow', title: `Step ${idx + 1} · ${progStepTitle(s)}`, close: 'prog-row-close', body: `<div class="list">${rows}</div>` });
}

// Progressions on the Playlists tab (and Home): a row opens one; on a
// handpan Play opens it and plays, on an ocarina Practice starts.
function progressionRowsHtml(inst, { home = false } = {}) {
  const layoutId = !inst && !home ? hpCurrentLayoutId() : null;
  return state.progressions.map(p => {
    const n = p.steps.length;
    if (home) {
      return uiRow({
        lead: 'list-ordered', title: p.name, chevron: true, action: 'open-progression', data: { id: p.id },
        meta: `${n} step${n !== 1 ? 's' : ''} · ${p.bpm} BPM`,
      });
    }
    const here = p.steps.filter(s => !s.missing && (inst ? entryIsFor(s, inst) : !s.instrumentId && s.layoutId === layoutId)).length;
    const trail = inst
      ? `<button type="button" class="btn btn-primary btn-sm" data-action="prog-practice" data-id="${escHtml(p.id)}" ${here ? '' : 'disabled'}>${icon('play')} Practice</button>`
      : `<button type="button" class="btn btn-primary btn-sm" data-action="prog-play" data-id="${escHtml(p.id)}" ${here ? '' : 'disabled'}>${icon('play')} Play</button>`;
    return uiRow({
      lead: 'list-ordered', title: p.name, chevron: true, action: 'open-progression', data: { id: p.id }, trail,
      meta: `${here} step${here !== 1 ? 's' : ''} here · ${n} in total · ${p.bpm} BPM`,
    });
  }).join('');
}

function openProgression(id, { push = true } = {}) {
  stopAutoplay();
  progStop();
  Object.assign(state, { view: 'progression', activeProgressionId: id, progMode: 'steps', progRowMenu: null, menu: false });
  if (state.progPlay?.id !== id) state.progPlay = null;
  if (push) navPush(`#prog/${encodeURIComponent(id)}`);
  render();
}

function removeProgression(id) {
  deleteProgression(id);
  state.progressions = getProgressions();
  if (state.view === 'progression' && state.activeProgressionId === id) {
    progStop();
    state.progPlay = null;
    if (history.state?.hp) { history.back(); return; }
    state.view = 'home';
    state.activeProgressionId = null;
    navPush('/');
  }
  render();
}

// ── Chord sheet → progression ────────────────────────────────────────────────
// "Paste a chord sheet" (Playlists tab, an empty progression): a ChordPro or
// chord-over-lyrics sheet is parsed (js/chordsheet.js), fitted to an
// instrument in the best few keys, and saved as a progression. Chords the
// instrument lacks stay in as steps marked "not on this instrument".

function csHpTarget(layoutId, layout, name = layout.name) {
  return { key: 'hp:' + layoutId, kind: 'hp', name, layoutId, layout };
}
function csOcTarget(inst) {
  return { key: 'oc:' + inst.id, kind: 'oc', name: inst.name, inst, layout: ocarinaToLayout(inst) };
}

// Instruments a sheet can be fitted to: the one on screen first, then My
// instruments (ocarinas and flutes with a playable chart).
function csTargets() {
  const out = [];
  const add = t => { if (t && !out.some(x => x.key === t.key)) out.push(t); };
  const cur = state.currentInstrumentId && state.currentInstrumentId !== SHARED_ID ? getInstrument(state.currentInstrumentId) : null;
  if (cur && !usesLayout(cur) && playableMidis(cur).length) add(csOcTarget(cur));
  if (state.layout && (!cur || usesLayout(cur))) add(csHpTarget(hpCurrentLayoutId(), state.layout));
  for (const inst of getInstruments()) {
    if (usesLayout(inst)) {
      const saved = state.savedLayouts.find(l => l.id === inst.layoutId);
      if (saved) add(csHpTarget(saved.id, saved.layout, inst.name));
    } else if (playableMidis(inst).length) add(csOcTarget(inst));
  }
  return out;
}

function csOpen(progId = null) {
  const targets = csTargets();
  let target = targets[0]?.key ?? null;
  const prog = progId ? progFind(progId) : null;
  const ctx = prog ? progContext(prog) : null;
  if (ctx?.kind === 'hp' && targets.some(t => t.key === 'hp:' + ctx.layoutId)) target = 'hp:' + ctx.layoutId;
  if (ctx?.kind === 'oc' && targets.some(t => t.key === 'oc:' + ctx.inst.id)) target = 'oc:' + ctx.inst.id;
  state.chordSheet = { step: 'paste', text: '', target, semis: 0, name: '', progId, error: '' };
  render();
}

function csModel(cs = state.chordSheet) {
  const sheet = parseChordSheet(cs.text);
  const target = csTargets().find(t => t.key === cs.target) ?? null;
  const chords = target?.layout.top.ding ? findAllChords(target.layout) : [];
  return { sheet, target, chords };
}

function csShiftLabel(semis) {
  if (!semis) return 'As written';
  return `${semis > 0 ? 'Up' : 'Down'} ${Math.abs(semis)} semitone${Math.abs(semis) !== 1 ? 's' : ''}`;
}

function csFmtBars(bars) {
  const r = Math.round(bars * 10) / 10;
  return `${r} bar${r !== 1 ? 's' : ''}`;
}

// A progression step for one sheet step on the target, moved by semis.
function csProgressionStep(s, target, chords, semis, beatsPerBar) {
  const match = matchSheetChord(s.chord, chords, semis);
  const symbol = transposeChordSymbol(s.chord, semis);
  const chord = match
    ? { chordId: match.id, rootName: match.rootName, typeName: match.type.name, category: match.type.category, notes: match.notes, noteCount: match.noteCount }
    : { chordId: null, rootName: symbol.match(/^[A-G][#b]?/)?.[0] ?? '', typeName: s.chord.type?.name ?? s.chord.suffix, category: s.chord.type?.category ?? '', notes: [], noteCount: 0, missing: true };
  const where = target.kind === 'hp'
    ? { layoutId: target.layoutId, layoutData: target.layout.isCustom ? JSON.parse(JSON.stringify(target.layout)) : null, scaleName: target.name }
    : { layoutId: ocLayoutId(target.inst), layoutData: null, scaleName: target.inst.name, family: target.inst.family, instrumentId: entryInstId(target.inst) };
  const len = stepLength(s.beats, beatsPerBar);
  const step = newProgressionStep({ ...chord, ...where, symbol, section: s.section ?? null }, { bars: len.bars });
  if (len.beats != null) step.beats = len.beats;
  return step;
}

function csKeyRow(c, selected, firstSym) {
  const band = coverageBand(c.score);
  const badge = band === 'plays' ? uiBadge('Plays', 'success') : band === 'swaps' ? uiBadge('A few missing', 'warning') : uiBadge('Breaks down');
  const meta = `${Math.round(c.score * 100)}% · ${c.playable} of ${c.total} steps · starts on ${escHtml(firstSym)}`
    + (c.missing.length ? ` · missing ${escHtml(c.missing.slice(0, 4).join(', '))}${c.missing.length > 4 ? '…' : ''}` : '');
  return `
    <button type="button" class="row cs-key${selected ? ' is-current' : ''}" role="radio" aria-checked="${selected ? 'true' : 'false'}"
      data-action="cs-semis" data-semis="${c.semis}">
      <span class="row-lead"><span class="row-check">${selected ? icon('check') : ''}</span></span>
      <span class="row-text"><span class="row-title">${escHtml(csShiftLabel(c.semis))}</span><span class="row-meta">${meta}</span></span>
      <span class="row-trail">${badge}</span>
    </button>`;
}

function chordSheetSheet() {
  const cs = state.chordSheet;
  const targets = csTargets();
  if (cs.step === 'paste') {
    const targetField = targets.length
      ? uiField({
        label: 'Play on', id: 'cs-target',
        control: uiPicker({
          id: 'cs-target', value: cs.target, label: 'Play on', action: 'cs-target',
          options: targets.map(t => ({ value: t.key, label: `${t.name}${t.kind === 'oc' ? ` (${t.inst.family})` : ''}`, keywords: [t.kind === 'oc' ? t.inst.family : 'handpan'] })),
        }),
      })
      : '<p class="cs-note">Add an instrument first: the chords are fitted to one.</p>';
    return uiSheet({
      key: 'chordsheet', title: 'Paste a chord sheet', close: 'cs-cancel',
      body: `<div class="hp-sheet-form">
        ${uiField({
          label: 'Chord sheet', id: 'cs-text', error: cs.error,
          help: 'ChordPro ([Am] in the words, {title}, {tempo}, {time: 3/4}, {soc}…{eoc}) or chords over lyrics. Bars split on |; lyrics are left out.',
          control: `<textarea class="input cs-text" id="cs-text" rows="9" spellcheck="false" autocapitalize="off" autocomplete="off"
            placeholder="{title: My song}&#10;{tempo: 90}&#10;| Am | Dm | Am | Bbm |&#10;[F]Words with [C]chords in them">${escHtml(cs.text)}</textarea>`,
        })}
        ${targetField}
      </div>`,
      footer: `
        <button type="button" class="btn btn-ghost" data-action="cs-cancel">Cancel</button>
        <button type="button" class="btn btn-primary" data-action="cs-next" ${targets.length ? '' : 'disabled'}>Next</button>`,
    });
  }

  // Fit: name, the best keys with their coverage, and the chords in order.
  const { sheet, target, chords } = csModel(cs);
  const ranked = rankTranspositions(sheet.steps, chords);
  const shown = ranked.slice(0, 3);
  if (!shown.some(c => c.semis === 0)) shown.push(ranked.find(c => c.semis === 0));
  if (!shown.some(c => c.semis === cs.semis)) shown.push(ranked.find(c => c.semis === cs.semis));
  const first = sheet.steps[0]?.chord;
  const bars = sheet.steps.reduce((n, s) => n + s.beats, 0) / sheet.beatsPerBar;
  const facts = [
    `${sheet.steps.length} step${sheet.steps.length !== 1 ? 's' : ''}`, csFmtBars(bars),
    `${sheet.beatsPerBar}/${sheet.beatUnit}`, sheet.bpm ? `${sheet.bpm} BPM` : `${PROG_DEFAULTS.bpm} BPM (none given)`,
  ].join(' · ');
  const missingNow = new Set(sheet.steps.filter(s => !matchSheetChord(s.chord, chords, cs.semis)).map(s => s.symbol));
  const preview = sheet.steps.slice(0, 64).map((s, i) => {
    const sym = transposeChordSymbol(s.chord, cs.semis);
    const miss = missingNow.has(s.symbol);
    const sec = s.section && s.section !== sheet.steps[i - 1]?.section ? `<span class="cs-sec">${escHtml(s.section)}</span>` : '';
    return `${sec}<span class="chip is-static${miss ? ' is-off' : ''}"${miss ? ' title="Not on this instrument"' : ''}>${escHtml(sym)}${miss ? '<span class="sr-only"> (not on this instrument)</span>' : ''}</span>`;
  }).join('') + (sheet.steps.length > 64 ? `<span class="chip is-static">+${sheet.steps.length - 64}</span>` : '');
  return uiSheet({
    key: 'chordsheet', title: `Fit to ${target?.name ?? 'instrument'}`, close: 'cs-cancel',
    body: `<div class="hp-sheet-form">
      ${uiField({ label: 'Name', id: 'cs-name', control: `<input class="input" id="cs-name" value="${escHtml(cs.name)}" placeholder="Progression name" autocomplete="off">` })}
      <p class="cs-facts">${escHtml(facts)}${sheet.sections.length ? `<br>Sections: ${escHtml(sheet.sections.join(', '))}` : ''}</p>
      ${sheet.unknown.length ? `<p class="cs-note">${icon('info')}<span>Not in the app's chord list: ${escHtml(sheet.unknown.join(', '))}. They stay in, marked, and are skipped when playing.</span></p>` : ''}
      <div>
        <h3 class="cs-label" id="cs-key-label">Key</h3>
        <div class="list" role="radiogroup" aria-labelledby="cs-key-label">${shown.map(c => csKeyRow(c, c.semis === cs.semis, transposeChordSymbol(first, c.semis))).join('')}</div>
      </div>
      <div>
        <h3 class="cs-label">Chords${cs.semis ? ` (${escHtml(csShiftLabel(cs.semis).toLowerCase())})` : ''}</h3>
        <div class="chips cs-preview">${preview}</div>
      </div>
    </div>`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="cs-back">Back</button>
      <button type="button" class="btn btn-primary" data-action="cs-save">Save progression</button>`,
  });
}

// Next: parse; with chords, pick the best key and go on to fitting.
function csNext() {
  const cs = state.chordSheet;
  cs.text = document.getElementById('cs-text')?.value ?? cs.text;
  const { sheet, chords } = csModel(cs);
  if (!sheet.steps.length) {
    cs.error = cs.text.trim() ? 'No chords found. Put chords on lines of their own, or in [brackets] inside the words.' : 'Paste a chord sheet first';
    render();
    return;
  }
  const best = rankTranspositions(sheet.steps, chords)[0];
  const asWritten = sheetCoverage(sheet.steps, chords, 0);
  Object.assign(cs, { step: 'fit', error: '', semis: best.score > asWritten.score ? best.semis : 0, name: cs.name || sheet.title || 'Chord sheet' });
  render();
}

function csSave() {
  const cs = state.chordSheet;
  cs.name = document.getElementById('cs-name')?.value ?? cs.name;
  const { sheet, target, chords } = csModel(cs);
  if (!target || !sheet.steps.length) return;
  const steps = sheet.steps.map(s => csProgressionStep(s, target, chords, cs.semis, sheet.beatsPerBar));
  const extra = { bpm: sheet.bpm ?? PROG_DEFAULTS.bpm, beatsPerBar: sheet.beatsPerBar, transpose: cs.semis, source: 'chordsheet' };
  if (target.kind === 'hp') extra.level = 'arpeggio';
  const name = cs.name.trim() || sheet.title || 'Chord sheet';
  const into = cs.progId ? progFind(cs.progId) : null;
  let id;
  if (into && !into.steps.length && fillProgression(into.id, steps, extra)) id = into.id;
  else id = addProgression(name, steps, extra);
  state.progressions = getProgressions();
  state.chordSheet = null;
  // Put the instrument it was fitted to on screen, so the progression plays.
  if (target.kind === 'oc' && state.currentInstrumentId !== target.inst.id) openInstrument(target.inst.id, { push: false });
  if (target.kind === 'hp' && (hpCurrentLayoutId() !== target.layoutId || (state.currentInstrumentId && !usesLayout(getInstrument(state.currentInstrumentId))))) {
    progLoadHandpan({ layoutId: target.layoutId, layoutData: target.layout.isCustom ? target.layout : null, scaleName: target.name });
  }
  const cov = sheetCoverage(sheet.steps, chords, cs.semis);
  if (state.view === 'progression' && state.activeProgressionId === id) render();
  else openProgression(id);
  showToast(cov.playable === cov.total ? `Saved: all ${cov.total} steps play on ${target.name}` : `Saved: ${cov.playable} of ${cov.total} steps play on ${target.name}`);
}

// ── Playlist chord navigation (shared by manual open + autoplay) ────────────
function loadPlaylistChordAt(pl, idx) {
  const fav = pl.chords[idx];
  if (!fav || fav.instrumentId) return false; // ocarina / flute entries play on their own instrument
  if (fav.layoutData) {
    state.layout = fav.layoutData;
  } else {
    const saved = state.savedLayouts.find(l => l.id === fav.layoutId);
    if (saved) {
      state.layout = saved.layout;
    } else {
      const scale = findTuning(fav.layoutId);
      if (!scale) return false;
      state.layout = createLayoutFromScale(scale);
    }
  }
  state.chords = findAllChords(state.layout);
  const canonical = state.chords.find(c => c.id === fav.chordId) || null;
  if (canonical) {
    // Preserve the exact voicing saved with this playlist entry — it may differ
    // from the canonical (default) notes if the user swapped to an alt position.
    state.selectedChord = Array.isArray(fav.notes) ? { ...canonical, notes: fav.notes } : canonical;
  } else {
    // No canonical chord type (e.g. a Discover-mode "Custom" combination) —
    // rebuild a displayable chord object directly from what was saved.
    state.selectedChord = {
      id: fav.chordId, rootName: fav.rootName,
      type: { name: fav.typeName, category: fav.category },
      notes: fav.notes, noteCount: fav.noteCount,
    };
  }
  state.shellMode = 'both';
  const owned = getInstrument(handpanInstrumentId(fav.layoutId));
  state.currentInstrumentId = owned ? owned.id : null;
  // Remember where this chord came from so a later voicing swap can be
  // saved back into this exact entry instead of only adding a new one.
  state.sourcePlaylistId = pl.id;
  state.sourceEntryId = fav.id;
  return true;
}

// The playlist entry for a chord picked in the playlist picker. Handpan
// entries are unchanged; ocarina and flute entries also record the
// instrument they were saved from, so they play back as fingerings.
function playlistEntryFor(chord, favId) {
  const common = {
    id: favId, chordId: chord.id, rootName: chord.rootName,
    typeName: chord.type.name, category: chord.type.category,
    notes: chord.notes, noteCount: chord.noteCount,
  };
  // In a playlist, an ocarina entry's card adds to playlists for its own instrument.
  const inst = state.view === 'instrument' ? currentInstrument()
    : state.view === 'playlist' && state.pickerInstrumentId ? getInstrument(state.pickerInstrumentId) : null;
  if (inst) {
    return { ...common, layoutId: ocLayoutId(inst), layoutData: null, scaleName: inst.name, family: inst.family, instrumentId: entryInstId(inst) };
  }
  const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
  return {
    ...common, layoutId,
    layoutData: state.layout.isCustom ? JSON.parse(JSON.stringify(state.layout)) : null,
    scaleName: state.layout.name,
  };
}

// Playlist-entry id for a chord. The canonical (default) voicing keeps the
// plain `${layoutId}-${chordId}` form used before per-voicing bookmarks existed,
// so existing playlists never need migrating. Only a chord swapped to a
// non-default voicing gets a notes-suffixed id, which can't collide with any
// id saved before this feature existed.
function favIdForChord(layoutId, chord, canonicalChords) {
  const canonical = canonicalChords.find(c => c.id === chord.id);
  const isCustomVoicing = !canonical || canonical.notes.join(',') !== chord.notes.join(',');
  return isCustomVoicing
    ? `${layoutId}-${chord.id}-${chord.notes.join(',')}`
    : `${layoutId}-${chord.id}`;
}

// Swap one note of a chord for an alternate same-pitch-class position elsewhere
// on the pan. Returns a new chord object — never mutates state.chords entries.
function swapChordNoteVoicing(chord, targetNote) {
  const targetPC = notePC(targetNote);
  const newNotes = chord.notes.map(n => notePC(n) === targetPC ? targetNote : n);
  return { ...chord, notes: newNotes };
}

let _autoplayTimer = null;

function stopAutoplay() {
  if (_autoplayTimer) { clearInterval(_autoplayTimer); _autoplayTimer = null; }
  state.autoplayOn = false;
  state.autoplayPlaylistId = null;
}

function playSelectedChordSound() {
  if (!state.selectedChord) return;
  initAudio();
  playChord(state.selectedChord.notes,
    note => updatePanPlaying([note]),
    notes => updatePanPlaying(notes)
  );
}

// Advance to the next chord in the autoplaying playlist, wrapping around.
// Bails out (and stops the timer) if autoplay was turned off or the playlist vanished.
function advanceAutoplay() {
  const pl = state.playlists.find(p => p.id === state.autoplayPlaylistId);
  if (!state.autoplayOn || state.view !== 'chords' || !pl || pl.chords.length === 0) {
    stopAutoplay();
    render();
    return;
  }
  const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
  const curFavId = state.selectedChord ? favIdForChord(layoutId, state.selectedChord, state.chords) : null;
  const curIdx = pl.chords.findIndex(c => c.id === curFavId);
  // Skip ocarina / flute entries: they play in that instrument's practice mode.
  let nextIdx = (curIdx + 1) % pl.chords.length;
  for (let n = 0; n < pl.chords.length && pl.chords[nextIdx].instrumentId; n++) nextIdx = (nextIdx + 1) % pl.chords.length;
  if (!loadPlaylistChordAt(pl, nextIdx)) { stopAutoplay(); render(); return; }
  navReplace(stateToHash());
  render();
  playSelectedChordSound();
}

function startAutoplay(pl) {
  if (pl.chords.length === 0) { showToast('No chords in playlist yet'); return; }
  stopAutoplay();
  state.autoplayOn = true;
  state.autoplayPlaylistId = pl.id;
  const layoutId = state.layout?.isCustom ? (state.layout.savedId || state.layout.id) : state.layout?.id;
  const curFavId = state.selectedChord && state.layout ? favIdForChord(layoutId, state.selectedChord, state.chords) : null;
  let startIdx = Math.max(0, pl.chords.findIndex(c => c.id === curFavId));
  for (let n = 0; n < pl.chords.length && pl.chords[startIdx].instrumentId; n++) startIdx = (startIdx + 1) % pl.chords.length;
  if (!loadPlaylistChordAt(pl, startIdx)) { stopAutoplay(); return; }
  navReplace(stateToHash());
  render();
  playSelectedChordSound();
  _autoplayTimer = setInterval(advanceAutoplay, state.autoplaySeconds * 1000);
}

// ── URL serialization ────────────────────────────────────────────────────────
// The handpan on screen as a link (/handpan/d-kurd/chords/a-min, or
// /handpan/custom?… with every note), so the address bar always shows a
// link to what's on screen. (The name is from when these were '#…' hashes.)
function stateToHash() {
  if (!state.layout) return '';
  const tab = state.view === 'chords' ? 'chords' : state.view === 'hp-playlists' ? 'playlists' : null;
  const chord = state.view === 'chords' ? state.selectedChord?.id ?? null : null;

  if (!state.layout.isCustom) {
    const path = linkFor({ scaleId: state.layout.id }, { tab, chord }) ?? `#scale=${state.layout.id}${chord ? `&chord=${chord}` : ''}`;
    // A catalogue tongue drum drawn the other way round from the maker's (ed-centre).
    const maker = findTuning(state.layout.id);
    const flipped = layoutInstrument(state.layout) === 'tongue-drum' && maker && !!maker.centre !== !!state.layout.centre;
    return flipped && path.startsWith('/') ? `${path}?centre=${state.layout.centre ? 1 : 0}` : path;
  }

  const topSlots = state.layout.top.slots.map(s => s.note ?? 'null').join(',');
  const bottomSlots = state.layout.bottom.slots.map(s => s.note ?? 'null').join(',');
  const params = new URLSearchParams({
    ding: state.layout.top.ding,
    top: topSlots,
    bottom: bottomSlots,
    tc: state.layout.top.capacity,
    bc: state.layout.bottom.capacity,
    name: state.layout.name,
  });
  const family = layoutInstrument(state.layout);
  if (family === 'tongue-drum' && state.layout.centre) params.set('centre', '1');
  return linkFor({ custom: params, family }, { tab, chord });
}

// An ocarina or flute tab as a URL: a visiting or shared one by its link,
// one of mine by its id.
function instUrl(id, tab) {
  if (id !== SHARED_ID) return `#i/${id}/${tab}`;
  const sh = state.shared;
  if (sh?.link) return linkFor(sh.link, { tab });
  if (sh?.publicId) return linkFor({ code: sh.publicId }, { tab: tab === 'notes' ? null : tab });
  return location.pathname;
}

// The URL of the screen on show, for Copy link.
function currentPath() {
  if (state.view === 'instrument' && state.currentInstrumentId) return instUrl(state.currentInstrumentId, state.oc.tab);
  if (state.layout) return stateToHash();
  return location.pathname + location.hash;
}

// Opens what the URL points at: a deep link (/handpan/d-kurd, /ocarina/…,
// /s/CODE, docs/free-to-play.md) or one of the app's '#…' screens. Old
// '#scale=', '#custom?' and '#p/' links still open, and the address bar is
// then changed to the new link.
function loadFromUrl() {
  const link = parseLink(location.pathname, location.search);
  if (link) {
    openLink(link);
    // An alias or old spelling shows its canonical link.
    if ((link.kind === 'scale' || link.kind === 'chart' || link.kind === 'shared') && location.pathname !== link.path) navReplace(link.path);
    return;
  }
  loadFromHash();
  const h = location.hash;
  if (state.layout && (h.startsWith('#scale=') || h.startsWith('#custom?'))) navReplace(stateToHash());
  else if (h.startsWith('#p/')) navReplace(linkFor({ code: decodeURIComponent(h.slice(3)) }));
}

function urlIsLink() {
  return !!parseLink(location.pathname, location.search) || (!!location.hash && location.hash !== '#');
}

// An ocarina or flute from a published chart, opened as a visiting
// instrument (a deep link, or a playlist entry added from one).
function openChartLink({ chartId, keyId }) {
  const inst = instrumentFromChart(chartId, keyId, { name: linkTitle(parseLink(linkFor({ chartId, keyId }))) });
  Object.assign(state, {
    view: 'instrument', layout: null, currentInstrumentId: SHARED_ID, sharedStatus: null, oc: newOcState(),
    shared: { ...inst, id: SHARED_ID, link: { chartId, keyId } },
  });
}

// A handpan, tongue drum or kalimba someone shared by code (/s/CODE): its
// notes open as a visiting instrument, as a deep link would. A catalogue
// scale keeps its id; anything else opens as custom notes under its name.
function openSharedLayout(data, tab) {
  const layout = JSON.parse(JSON.stringify(data.layout));
  layout.name = data.name || layout.name;
  if (layout.isCustom || !findTuning(layout.id)) { layout.isCustom = true; delete layout.savedId; layout.id = 'custom'; }
  Object.assign(state, {
    layout, currentInstrumentId: null, shared: null, sharedStatus: null, selectedChord: null,
    chords: findAllChords(layout), shellMode: 'both', chordFilter: { category: 'All', root: 'All', playlist: 'All' },
    view: tab === 'chords' || tab === 'listen' ? 'chords' : tab === 'playlists' ? 'hp-playlists' : 'editor',
  });
  navReplace(stateToHash());
}

// Renames a saved handpan, tongue drum or kalimba layout (Edit instrument).
function renameSavedLayout(layoutId, name) {
  const saved = getSavedLayouts().find(l => l.id === layoutId);
  if (!saved) return;
  saveLayout({ ...saved, name, layout: { ...saved.layout, name } });
  state.savedLayouts = getSavedLayouts();
  if (state.layout && hpCurrentLayoutId() === layoutId) state.layout.name = name;
}

// A handpan from the catalogue: my saved copy of it when I have one, so it
// opens as that instrument.
function openScaleLayout(scale) {
  const owned = getInstrument(handpanInstrumentId(scale.id));
  const saved = owned && state.savedLayouts.find(l => l.id === scale.id);
  state.layout = saved ? JSON.parse(JSON.stringify(saved.layout)) : createLayoutFromScale(scale);
  state.currentInstrumentId = saved ? owned.id : null;
  state.chords = findAllChords(state.layout);
}

// Opens a parsed deep link (links.js) as a visiting instrument, ready to
// play: nothing is added to My instruments until Save.
function openLink(link) {
  stopAutoplay();
  Object.assign(state, { selectedChord: null, pendingSlot: null, sourcePlaylistId: null, sourceEntryId: null, wizard: null, playNotice: null });
  if (link.kind === 'unknown') {
    state.view = 'play';
    state.layout = null;
    state.currentInstrumentId = null;
    state.playFamily = link.family;
    state.playNotice = { slug: link.slug, closest: link.closest };
    return;
  }
  if (link.kind === 'shared') {
    openSharedLink(link.code, link.tab);
    if (link.tab === 'chords' || link.tab === 'listen') state.oc.tab = 'chords';
    return;
  }
  if (link.kind === 'chart') {
    openChartLink(link);
    if (link.tab === 'chords' || link.tab === 'listen') state.oc.tab = 'chords';
    return;
  }
  // Handpans: a scale, or custom notes carried in the link.
  if (link.kind === 'scale') {
    openScaleLayout(findTuning(link.scaleId));
    if (link.centre != null && layoutInstrument(state.layout) === 'tongue-drum') state.layout.centre = link.centre;
  } else {
    state.layout = layoutFromCustomParams(link.params, link.family);
    state.currentInstrumentId = null;
    state.chords = findAllChords(state.layout);
  }
  state.shellMode = 'both';
  state.chordFilter = { category: 'All', root: 'All', playlist: 'All' };
  state.view = link.tab === 'chords' || link.tab === 'listen' || link.chord ? 'chords' : link.tab === 'playlists' ? 'hp-playlists' : 'editor';
  if (link.chord) state.selectedChord = state.chords.find(c => linkSlug(c.id) === link.chord) || null;
}

function loadFromHash() {
  const hash = window.location.hash;
  if (!hash || hash === '#') return;

  let chordId = null;

  if (hash === '#scales') { state.view = 'selector'; return; }
  if (hash === '#play') { state.view = 'play'; return; }
  if (hash === '#setup') { state.view = 'setup'; state.setup = newSetup(); return; }
  if (hash === '#settings') { state.view = 'settings'; return; }
  if (hash === '#settings/clay') { state.view = canBuild() ? 'clay' : 'settings'; return; }
  if (hash === '#settings/listen') { state.view = 'listen-debug'; return; }
  if (hash.startsWith('#pl/')) {
    const id = decodeURIComponent(hash.slice(4));
    if (state.playlists.some(p => p.id === id)) { state.activePlaylistId = id; state.view = 'playlist'; state.plMode = 'chords'; }
    return;
  }
  if (hash.startsWith('#prog/')) {
    const id = decodeURIComponent(hash.slice(6));
    if (state.progressions.some(p => p.id === id)) { state.activeProgressionId = id; state.view = 'progression'; state.progMode = 'steps'; }
    return;
  }
  if (hash.startsWith('#p/')) { openSharedLink(decodeURIComponent(hash.slice(3))); return; }
  if (hash.startsWith('#i/')) {
    const [id, tab] = hash.slice(3).split('/');
    if (openInstrument(decodeURIComponent(id), { push: false }) && ['chords', 'notes', 'playlists', 'builder', 'setup'].includes(tab)) {
      state.oc.tab = tab;
    }
    return;
  }

  if (hash.startsWith('#scale=')) {
    const raw = hash.slice(7);
    const [scaleId, ...rest] = raw.split('&chord=');
    chordId = rest[0] || null;
    const scale = findTuning(scaleId);
    if (scale) {
      openScaleLayout(scale);
      state.view = chordId ? 'chords' : 'editor';
    }
  } else if (hash.startsWith('#custom?')) {
    const rawParams = hash.slice(8);
    const chordMarker = rawParams.indexOf('&chord=');
    const paramStr = chordMarker >= 0 ? rawParams.slice(0, chordMarker) : rawParams;
    chordId = chordMarker >= 0 ? rawParams.slice(chordMarker + 7) : null;

    state.layout = layoutFromCustomParams(new URLSearchParams(paramStr));
    state.chords = findAllChords(state.layout);
    state.view = chordId ? 'chords' : 'editor';
  }

  if (chordId && state.chords.length) {
    state.selectedChord = state.chords.find(c => c.id === chordId) || null;
  }
}

// ── Measurement (docs/free-to-play.md §9) ──────────────────────────────────
// Which link brought someone in, how long until the first sound, and which
// features get used: event names and a few properties, no ids (auth.js
// logEvent). Each feature is counted once per visit.
const MEASURE_START = Date.now();

function measureFamily() {
  if (state.layout) return layoutInstrument(state.layout);
  return currentInstrument()?.family ?? null;
}

function measureOpen() {
  const link = parseLink(location.pathname, location.search);
  // The link, without anything personal: custom notes and share codes stay out.
  const path = !link ? (isAppHome() ? APP_HOME : 'other')
    : link.kind === 'custom' ? `/${link.family}/custom`
    : link.kind === 'shared' ? '/s'
    : link.kind === 'unknown' ? `/${link.family}/?`
    : link.path;
  const q = new URLSearchParams(location.search);
  let referrer = null;
  try { const r = document.referrer && new URL(document.referrer); if (r && r.host !== location.host) referrer = r.host; } catch (_) {}
  const props = { path };
  if (referrer) props.referrer = referrer;
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign']) if (q.get(k)) props[k] = q.get(k);
  logEvent('open', props);
  onFirstSound(() => logEvent('first_play', { family: measureFamily(), seconds: Math.round((Date.now() - MEASURE_START) / 1000) }));
}

const MEASURE_FEATURES = {
  'go-chords': 'chords', 'play-chord': 'chords', 'toggle-discover-mode': 'identify', 'oc-play-arp': 'arpeggio',
  'tuner-toggle': 'tuner', 'listen-start': 'listen-scale', 'cs-open': 'chord-sheet',
  'oc-practice-start': 'practice', 'prog-practice': 'practice', 'hp-play-playlist': 'playlist-play',
  'play-custom-handpan': 'custom-notes', 'clone-layout': 'custom-notes', 'add-instrument': 'add-instrument',
  'setup-listen': 'setup-listen', 'setup-know': 'setup-know',
};
const _measured = new Set();
function measureFeature(action, el) {
  let name = MEASURE_FEATURES[action];
  if (action === 'oc-tab' && el.dataset.tab === 'chords') name = 'chords';
  if (!name || _measured.has(name)) return;
  _measured.add(name);
  logEvent('feature', { name, family: measureFamily() });
}

// ── Utilities ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Toast (§5.7): bottom centre above the tab bar, tuner, wizard action bar
// or sheet footer (CSS), 3 s, or 5 s with an action ({ label, run }). A
// toast belongs to the screen it was shown on: render() hides it when the
// screen changes, unless it was shown in the same event that changed it.
let _toastTimer = null;
let _toastFresh = false;
function showToast(msg, { action = null } = {}) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span class="toast-msg">${escHtml(msg)}</span>${action ? `<button type="button" class="toast-action">${escHtml(action.label)}</button>` : ''}`;
  if (action) toast.querySelector('.toast-action').addEventListener('click', () => { hideToast(); action.run(); });
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(hideToast, action ? 5000 : 3000);
  _toastFresh = true;
  queueMicrotask(() => { _toastFresh = false; });
}
function hideToast() {
  clearTimeout(_toastTimer);
  document.querySelector('.toast')?.classList.remove('show');
}

// ── Preferences (persist across sessions) ────────────────────────────────────
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem('hp-prefs') || '{}');
    if (typeof p.ringRotated === 'boolean') state.ringRotated = p.ringRotated;
    if (typeof p.useFlats === 'boolean') state.useFlats = p.useFlats;
    if (typeof p.useSolfege === 'boolean') state.useSolfege = p.useSolfege;
    if (typeof p.autoplaySeconds === 'number') state.autoplaySeconds = p.autoplaySeconds;
    if (['slow', 'normal', 'fast'].includes(p.playbackSpeed)) state.playbackSpeed = p.playbackSpeed;
    if (typeof p.showFingers === 'boolean') state.showFingers = p.showFingers;
    if (typeof p.showSizes === 'boolean') state.showSizes = p.showSizes;
    if (typeof p.ocLegendSeen === 'boolean') state.ocLegendSeen = p.ocLegendSeen;
    if (typeof p.handLegendSeen === 'boolean') state.handLegendSeen = p.handLegendSeen;
    if (['dark', 'light', 'auto'].includes(p.theme)) state.theme = p.theme;
  } catch {}
  applyTheme();
  setPlaybackSpeed(state.playbackSpeed);
}

// The theme pref on <html data-theme> (the CSS does the rest) and the
// browser chrome colour to match. Auto follows the OS as it changes.
const THEME_COLORS = { dark: '#1C1B16', light: '#F2E6D3' };
const _themeQuery = window.matchMedia?.('(prefers-color-scheme: light)');
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const resolved = state.theme === 'auto' ? (_themeQuery?.matches ? 'light' : 'dark') : state.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved]);
}
_themeQuery?.addEventListener?.('change', applyTheme);

// Settings sync with an account (as the 'prefs' item): updatedAt stamps the
// edit, and lastPath (rememberLastPath) is kept.
function savePrefs() {
  let kept = {};
  try { const p = JSON.parse(localStorage.getItem('hp-prefs') || '{}'); if (p.lastPath) kept = { lastPath: p.lastPath }; } catch {}
  localStorage.setItem('hp-prefs', JSON.stringify({
    ...kept,
    updatedAt: new Date().toISOString(),
    ringRotated: state.ringRotated,
    useFlats: state.useFlats,
    useSolfege: state.useSolfege,
    autoplaySeconds: state.autoplaySeconds,
    playbackSpeed: state.playbackSpeed,
    showFingers: state.showFingers,
    showSizes: state.showSizes,
    ocLegendSeen: state.ocLegendSeen,
    handLegendSeen: state.handLegendSeen,
    theme: state.theme,
  }));
  scheduleSave();
}

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
    if (a.canBuild) localStorage.setItem('hp-can-build', '1'); else localStorage.removeItem('hp-can-build');
    if (canBuild() !== before) render();
  });
}

// Every saved list read again (after a sync, a carry-over or a sign-out).
function reloadSaved() {
  state.savedLayouts = getSavedLayouts();
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
  if (action === 'open-sign-in') { openSaveSheet('signin'); return true; }
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
  if (!session) { render(); return; }
  if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
  if (!accountOn()) becomeAccount(session);
  startAccount();
  syncSoon(0);
  refreshAccess();
}

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
const SYNC_PREFS = ['ringRotated', 'useFlats', 'useSolfege', 'autoplaySeconds', 'playbackSpeed', 'showFingers', 'showSizes', 'ocLegendSeen', 'handLegendSeen', 'theme', 'lastPath', 'updatedAt'];

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
      localStorage.setItem('hp-prefs', JSON.stringify({ ...syncReadPrefs(), ...rest }));
      return;
    }
    const key = SYNC_LISTS[kind];
    if (!key) return;
    const list = syncReadList(key);
    const i = list.findIndex(x => x.id === id);
    if (i >= 0) list[i] = data; else list.push(data);
    dataStore().setItem(key, JSON.stringify(list));
  },
  add(kind, data) { this.write(kind, data.id, data); },
};

let _syncTimer = null;
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
const COUNT_WORDS = [['layout', 'handpan/drum/kalimba', 'handpans, drums and kalimbas'], ['instrument', 'ocarina or flute', 'ocarinas and flutes'], ['playlist', 'playlist', 'playlists'], ['progression', 'progression', 'progressions']];
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
    : !isLoggedIn() ? 'Connecting…'
    : state.syncError === 'error' ? 'Couldn’t sync just now · tap ⟳ to try again'
    : n ? `${n} change${n !== 1 ? 's' : ''} waiting to sync`
    : state.lastSynced ? 'Everything is synced' : 'Getting your things…';
  return `
    ${uiRow({ lead: 'user', title: getUserEmail() ?? 'Signed in', meta: escHtml(status), trail: isLoggedIn() ? uiIconBtn('refresh', 'Sync now', { action: 'account-sync' }) : '' })}
    ${uiRow({ lead: 'cloud', title: 'In your account', meta: state.accountCounts === 'error' ? 'Couldn’t be read just now' : state.accountCounts ? escHtml(countsText(state.accountCounts)) : 'Checking…' })}
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
        <p class="sheet-text">Your instruments, playlists, progressions and settings are deleted from the server and this device. This can't be undone. Export your data first if you want a copy.</p>
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
  await syncBases.clear();
  await offline.disable();
  Object.assign(state, { syncPending: 0, lastSynced: null, offlineReady: false, accountConfirm: null, accountError: null });
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
    signOut().then(forgetAccountOnDevice).then(() => showToast('Signed out'));
    return true;
  }
  if (action === 'account-delete-ok') {
    const typed = (document.getElementById('account-delete-input')?.value || '').trim().toUpperCase();
    if (typed !== 'DELETE') { state.accountError = 'Type DELETE'; render(); return true; }
    deleteMyAccount().then(err => {
      if (err) { state.accountError = `Couldn't delete it: ${err}`; render(); return; }
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

// The path of a link without anything personal (custom notes, share codes).
function measurePathOf(pathname) {
  const link = parseLink((pathname || '/').split(/[?#]/)[0], '');
  return !link ? APP_HOME : link.kind === 'custom' ? `/${link.family}/custom` : link.kind === 'shared' ? '/s' : link.kind === 'unknown' ? `/${link.family}/?` : link.path;
}

// The screen on show, kept in the synced prefs so a second device opens
// where you left off (§7). Only instruments and their tabs count.
function rememberLastPath() {
  if (!accountOn()) return;
  const path = location.pathname + location.hash;
  const p = syncReadPrefs();
  const isPlace = state.view === 'instrument' || state.layout;
  if (!isPlace || p.lastPath === path) return;
  localStorage.setItem('hp-prefs', JSON.stringify({ ...p, lastPath: path, updatedAt: new Date().toISOString() }));
  syncSoon(5000);
}

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
    const i = id === 'ding' ? 0 : id?.startsWith('ring-') ? parseInt(id.slice(5), 10) + 1 : -1;
    if (i >= 0 && i < g.count) {
      g.active = i;
      Object.assign(g, { msg: g.notes[i] != null ? `Play ${setupSlotLabel(state.setup.family, i)} again to change it.` : '', tone: '' });
      render();
    }
    return;
  }
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
  if (action === 'picker-open') { openPicker(el.dataset.picker); return; }

  // ── Sheets: the ⋯ menu and confirm ────────────────────────────────────────
  if (action === 'menu-open') { state.menu = true; render(); return; }
  if (action === 'row-menu') { e.stopPropagation(); state.menu = { id: el.dataset.id }; render(); return; }
  if (action === 'visit-save') {
    // Reached with an account only (a guest gets the save sheet first, and
    // signing in moved this visit's work into the account).
    reloadSaved();
    showToast('Saved to My instruments');
    render();
    return;
  }
  if (action === 'menu-close') { state.menu = false; render(); return; }
  // A menu row closes the menu, then does what it says.
  if (state.menu && el.closest('.sheet-menu, .sheet-rowmenu')) { state.menu = false; render(); }
  if (state.hpMore && el.closest('.sheet-hpmore') && action !== 'hp-more-close') { state.hpMore = false; render(); }
  if (state.plRowMenu != null && el.closest('.sheet-plrow') && action !== 'pl-row-close') { state.plRowMenu = null; render(); }
  if (state.progRowMenu != null && el.closest('.sheet-progrow') && action !== 'prog-row-close') { state.progRowMenu = null; render(); }
  if (action === 'confirm-cancel') { state.confirm = null; render(); return; }
  if (action === 'confirm-ok') {
    const c = state.confirm;
    state.confirm = null;
    if (c?.kind === 'instrument') removeInstrument(c.id);
    else if (c?.kind === 'playlist') removePlaylist(c.id);
    else if (c?.kind === 'progression') removeProgression(c.id);
    else render();
    return;
  }

  if (action === 'hp-playlists') {
    stopAutoplay();
    state.pendingSlot = null;
    state.view = 'hp-playlists';
    // Remembered on the history entry, so coming back to it reopens this tab.
    if (state.layout) navReplace(stateToHash(), { hpTab: 'playlists' });
    render();
    return;
  }

  // ── My instruments ────────────────────────────────────────────────────────
  if (action === 'open-instrument') {
    if (e.target.closest('[data-action="delete-instrument"]')) return;
    if (openInstrument(el.dataset.id)) render();
    else showToast('Instrument not found');
    return;
  }
  if (action === 'delete-instrument') {
    e.stopPropagation();
    const inst = getInstrument(el.dataset.id);
    if (!inst) return;
    state.confirm = {
      kind: 'instrument', id: inst.id, ok: 'Remove', title: `Remove ${inst.name}?`,
      body: usesLayout(inst)
        ? 'Its saved layout is removed from My instruments on this device and from sync.'
        : 'Its readings and build history are removed from this device and from sync.',
    };
    render();
    return;
  }
  if (action === 'back-home') { goHome(); guestLeaving(); return; }
  if (action === 'nav-back') {
    if (history.state?.hp) history.back();
    else if (el.dataset.fallback === 'selector') goSelector();
    else if (el.dataset.fallback === 'settings') openSettings({ push: false });
    else goHome();
    return;
  }
  if (action === 'open-settings') { openSettings(); return; }
  if (action === 'open-play') {
    goHome({ push: false });
    state.view = 'play';
    if (el.dataset.family) state.playFamily = el.dataset.family;
    state.playNotice = null;
    navPush('#play');
    render();
    guestLeaving();
    return;
  }
  if (action === 'play-family') {
    state.playFamily = el.dataset.value;
    state.playNotice = null;
    render();
    return;
  }
  if (action === 'open-link') {
    const link = parseLink(el.dataset.path);
    if (!link) return;
    openLink(link);
    navPush(link.path ?? el.dataset.path);
    render();
    return;
  }
  if (action === 'play-custom-handpan') {
    // An empty custom handpan: a D3 ding and eight notes to set on the Pan.
    // No bottom notes to start with: few beginners' handpans have them, and
    // the Pan adds them when there are. A tongue drum: eight tongues from C4;
    // a kalimba: ten keys from C4.
    const fam = isLayoutFamily(el.dataset.family) ? el.dataset.family : 'handpan';
    const rest = { handpan: 8, 'tongue-drum': 7, kalimba: 9 }[fam] ?? 8;
    const params = new URLSearchParams({ ding: fam === 'handpan' ? 'D3' : 'C4', top: Array(rest).fill('null').join(','), bottom: '', tc: String(rest), bc: '0', name: `My ${LAYOUT_FAMILIES[fam].word}` });
    const link = parseLink(`/${fam}/custom`, '?' + params);
    openLink(link);
    navPush(stateToHash());
    render();
    return;
  }
  if (action === 'other-instrument') {
    state.currentInstrumentId = null;
    state.view = 'selector';
    navPush('#scales');
    render();
    return;
  }
  if (action === 'add-instrument') { setupAction('setup-open', el); return; }
  if (listenReportAction(action)) return;
  if (setupAction(action, el)) return;


  // ── Ocarina Notes view ────────────────────────────────────────────────────
  if (action === 'oc-select-note') {
    const m = parseInt(el.dataset.midi, 10);
    if (m !== state.oc.selected) { state.oc.previous = state.oc.selected; state.oc.selected = m; }
    initAudio();
    playNote(midiToNoteName(m));
    render();
    return;
  }
  if (action === 'oc-play-selected') {
    initAudio();
    playNote(midiToNoteName(state.oc.selected));
    return;
  }
  if (action === 'oc-play-scale') {
    const inst = currentInstrument();
    if (!inst) return;
    const pcs = state.oc.scaleFilter !== 'All' ? scalePitchClasses(state.oc.scaleFilter) : null;
    const notes = playableMidis(inst).filter(m => !pcs || pcs.has(((m % 12) + 12) % 12)).map(midiToNoteName);
    playScale(notes, n => {
      const m = noteToMidi(n);
      if (state.view !== 'instrument') return;
      state.oc.previous = state.oc.selected;
      state.oc.selected = m;
      render();
    });
    return;
  }
  if (action === 'oc-toggle-fingers') {
    state.showFingers = !state.showFingers;
    // The finger legend opens by itself the first time labels are switched on.
    if (state.showFingers && !state.handLegendSeen) { state.handLegendSeen = true; state.oc.handLegend = true; }
    savePrefs(); render(); return;
  }
  if (action === 'oc-toggle-sizes') { state.showSizes = !state.showSizes; savePrefs(); render(); return; }
  if (action === 'oc-legend-dismiss') { state.ocLegendSeen = true; savePrefs(); render(); return; }
  if (action === 'oc-hand-open') { state.oc.handLegend = true; state.oc.chordMore = false; render(); return; }
  if (action === 'oc-hand-close') { state.oc.handLegend = false; render(); return; }


  if (action === 'tuner-toggle') { toggleTuner(); return; }
  if (action === 'install-app') {
    if (_installEvent) {
      const ev = _installEvent;
      _installEvent = null;
      ev.prompt();
      ev.userChoice?.then(c => { logEvent('install', { outcome: c?.outcome ?? 'unknown' }); render(); });
    } else {
      state.installHelp = true;
      logEvent('install', { outcome: 'help' });
      render();
    }
    return;
  }
  if (action === 'install-help-close') { state.installHelp = false; render(); return; }
  if (action === 'install-dismiss') {
    try { localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now())); } catch {}
    render();
    return;
  }
  if (action === 'share-instrument') { shareInstrument(el.dataset.id); return; }
  if (action === 'share-close') { state.shareModal = null; render(); return; }
  if (action === 'share-copy') {
    navigator.clipboard?.writeText(state.shareModal?.url ?? '').then(() => showToast('Link copied'), () => showToast('Copy the link from the box'));
    return;
  }
  if (action === 'shared-add') {
    if (!state.shared) return;
    // A visiting chart instrument (a deep link) is made afresh; a shared
    // one is copied with its setup.
    const copy = state.shared.link ? instrumentFromChart(state.shared.link.chartId, state.shared.link.keyId, { name: state.shared.name }) : copySharedInstrument(state.shared);
    saveInstrument(copy);
    refreshInstruments();
    state.shared = null;
    openInstrument(copy.id);
    showToast(`${copy.name} added to My instruments`);
    render();
    return;
  }

  // ── Builder and set-up ────────────────────────────────────────────────────
  if (action === 'b-record') {
    // Arm the field (or disarm it); the tuner turns on if it's off.
    if (state.rec.armed === el.dataset.path) { disarmRecord(); render(); return; }
    armRecord(el.dataset.path);
    if (!state.tuner.on || state.tuner.error) {
      if (state.tuner.error) { if (_tunerStop) { _tunerStop(); _tunerStop = null; } state.tuner.on = false; }
      toggleTuner();
      return;
    }
    render();
    return;
  }
  if (action === 'b-stage' || action === 'b-next' || action === 'b-unglazed') {
    let inst = currentInstrument();
    if (!inst) return;
    const target = action === 'b-stage' ? el.dataset.stage
      : action === 'b-unglazed' ? 'done' : nextStage(inst.build.stage);
    if (target === 'done' && inst.build.stage !== 'done') inst = finishInstrumentBuild(inst);
    else inst.build.stage = target;
    state.oc.buildChamber = 0;
    saveInstrument(inst);
    refreshInstruments();
    window.scrollTo(0, 0);
    render();
    return;
  }
  if (action === 'b-design') {
    const inst = currentInstrument();
    if (!inst || el.tagName === 'SELECT' || el.tagName === 'INPUT') return; // handled on change
    inst.design = inst.design ?? { scaleId: inst.scaleId, transpose: inst.transpose, includeGu: inst.includeGu };
    const key = el.dataset.key, v = parseInt(el.dataset.value, 10);
    if (key === 'chambers') Object.assign(inst.design, { chambers: v, windowStart: null, excluded: [] });
    if (key === 'windowStart') Object.assign(inst.design, { windowStart: v, excluded: [] });
    if (key === 'toggleNote') {
      const ex = inst.design.excluded ?? [];
      inst.design.excluded = ex.includes(v) ? ex.filter(x => x !== v) : [...ex, v];
    }
    applyDesign(inst);
    saveInstrument(inst);
    render();
    return;
  }
  if (action === 'b-design-subs' || action === 'b-design-sublayout' || action === 'b-design-fill') {
    const inst = currentInstrument();
    if (!inst) return;
    const d = inst.design = inst.design ?? { scaleId: inst.scaleId, transpose: inst.transpose, includeGu: inst.includeGu };
    if (action === 'b-design-subs') d.subHoles = parseInt(el.dataset.n, 10) || 0;
    else if (action === 'b-design-fill') d.fillGaps = !d.fillGaps;
    else d.subLayout = el.dataset.v;
    applyDesign(inst);
    saveInstrument(inst);
    refreshInstruments();
    render();
    return;
  }
  if (action === 'b-design-transpose' || action === 'b-design-gu' || action === 'b-design-chambers') {
    const inst = currentInstrument();
    if (!inst) return;
    const d = inst.design = inst.design ?? { scaleId: inst.scaleId, transpose: inst.transpose, includeGu: inst.includeGu };
    if (action === 'b-design-transpose') {
      Object.assign(d, { transpose: Math.max(-6, Math.min(6, (d.transpose ?? 0) + parseInt(el.dataset.delta, 10))), windowStart: null, excluded: [] });
    }
    if (action === 'b-design-gu') Object.assign(d, { includeGu: !(d.includeGu ?? true), chambers: null, windowStart: null, excluded: [] });
    if (action === 'b-design-chambers') Object.assign(d, { chambers: parseInt(el.dataset.n, 10), windowStart: null, excluded: [] });
    applyDesign(inst);
    saveInstrument(inst);
    refreshInstruments();
    render();
    return;
  }
  if (action === 'b-chamber') {
    state.oc.buildChamber = parseInt(el.dataset.ci, 10) || 0;
    render();
    return;
  }
  if (action === 'fg-edit-open') {
    const inst = currentInstrument();
    const f = inst && fingeringFor(inst, state.oc.selected);
    if (!f) return;
    state.oc.fgEdit = { midi: state.oc.selected, states: [...f.states] };
    render();
    return;
  }
  if (action === 'fg-edit-hole' && state.oc.fgEdit) {
    const i = parseInt(el.dataset.index, 10);
    const next = { c: 'o', o: 'h', h: 'c' };
    state.oc.fgEdit.states[i] = next[state.oc.fgEdit.states[i]] ?? 'c';
    render();
    return;
  }
  if (action === 'fg-edit-cancel') { state.oc.fgEdit = null; render(); return; }
  if (action === 'fg-edit-save' || action === 'fg-edit-reset') {
    const inst = currentInstrument();
    const ed = state.oc.fgEdit;
    if (!inst || !ed) return;
    inst.setup = inst.setup ?? setupOf(inst);
    const fixed = { ...(inst.setup.fixed ?? {}) };
    if (action === 'fg-edit-save') fixed[ed.midi] = ed.states;
    else delete fixed[ed.midi];
    let heard = null;
    if (action === 'fg-edit-save' && ed.hz > 0) {
      // A reading of this fingering: one more measurement for the fit. It
      // fixes the note it actually sounds, which may not be the one picked.
      const same = x => x.states.join() === ed.states.join();
      inst.setup.extra = [...(inst.setup.extra ?? []).filter(x => !same(x)), { states: ed.states, hz: ed.hz }];
      heard = Math.round(hzToMidi(ed.hz));
      if (heard !== ed.midi) delete fixed[ed.midi];
    }
    inst.setup.fixed = fixed;
    if (heard != null) {
      const s2 = inst.setup;
      const ch = calibrateChamber(s2.holes, s2.f0, s2.singles, { extra: s2.extra });
      if (ch) {
        inst.chambers = [withFixedFingerings({ notes: ch.notes, holes: ch.holes, fingerings: ch.fingerings }, fixed)];
        inst.calibration = ch.calibration;
      }
    } else if (action === 'fg-edit-save') {
      inst.chambers = [withFixedFingerings(inst.chambers[0], { [ed.midi]: ed.states })];
    } else if (inst.kind === 'traditional') {
      // Back to the published chart's fingering for this note.
      const chartFg = instrumentFromChart(inst.type, inst.key).chambers[0].fingerings[ed.midi];
      const fg = { ...inst.chambers[0].fingerings };
      if (chartFg) fg[ed.midi] = chartFg; else delete fg[ed.midi];
      inst.chambers[0] = { ...inst.chambers[0], fingerings: fg, notes: Object.keys(fg).map(Number).sort((a, b) => a - b) };
    } else {
      // Back to the chart worked out from the readings for this note.
      const s = inst.setup;
      const ch = calibrateChamber(s.holes, s.f0, s.singles, { extra: s.extra });
      if (ch?.fingerings[ed.midi]) inst.chambers[0] = { ...inst.chambers[0], fingerings: { ...inst.chambers[0].fingerings, [ed.midi]: ch.fingerings[ed.midi] } };
    }
    saveInstrument(inst);
    refreshInstruments();
    state.oc.fgEdit = null;
    const uf = state.useFlats, us = state.useSolfege;
    showToast(heard != null && heard !== ed.midi
      ? `That fingering sounds ${displayNote(midiToNoteName(heard), uf, us)}: saved for ${displayNote(midiToNoteName(heard), uf, us)}, chart updated`
      : heard != null ? 'Fingering and reading saved, chart updated'
      : action === 'fg-edit-save' ? 'Fingering saved' : inst.kind === 'traditional' ? 'Back to the chart\'s fingering' : 'Back to the worked-out fingering');
    if (heard != null && playableMidis(inst).includes(heard)) state.oc.selected = heard;
    render();
    return;
  }
  if (action === 'inst-edit-open') {
    const id = el.dataset.id || state.currentInstrumentId;
    const inst = getInstrument(id);
    state.menu = false;
    // One you set up yourself is edited on its Set up tab, with everything else.
    if ((inst?.kind === 'custom' || inst?.kind === 'traditional') && !usesLayout(inst)) {
      if (state.currentInstrumentId !== id || state.view !== 'instrument') openInstrument(id);
      state.oc.tab = 'setup';
      state.oc.holeMap = null;
      navReplace(`#i/${id}/setup`);
      render();
      window.scrollTo({ top: 0 });
      return;
    }
    state.instEdit = id;
    render();
    return;
  }
  if (action === 'crop-cancel') { state.photoCrop = null; render(); return; }
  if (action === 'crop-done') { finishCrop(); return; }
  if (action === 'crop-rotate') { rotateCropImage().catch(() => showToast('That photo couldn\'t be turned')); return; }
  if (action === 'inst-edit-close') { state.instEdit = null; refreshInstruments(); render(); return; }
  if (action === 'ie-photo-remove' || action === 'ie-holes-step') {
    let inst = getInstrument(el.dataset.id || state.instEdit);
    if (!inst) return;
    if (action === 'ie-photo-remove') { delete inst.photo; delete inst.holeMap; }
    else inst = withHoleCount(inst, (inst.holeCount ?? 0) + parseInt(el.dataset.delta, 10));
    saveInstrument(inst);
    refreshInstruments();
    render();
    return;
  }
  if (action === 'hm-open') {
    const inst = currentInstrument();
    if (!inst) return;
    state.oc.holeMap = { sel: hmFirstUnmarked(inst) ?? 0 };
    render();
    return;
  }
  if (action === 'hm-close') { state.oc.holeMap = null; render(); return; }
  if (action === 'hm-select') { state.oc.holeMap.sel = parseInt(el.dataset.index, 10); render(); return; }
  if (action === 'hm-place' || action === 'hm-clear') {
    const inst = currentInstrument();
    const sel = state.oc.holeMap?.sel;
    if (!inst || sel == null) return;
    const n = setupOf(inst).holes.length;
    inst.holeMap = Array.from({ length: n }, (_, i) => inst.holeMap?.[i] ?? null);
    if (action === 'hm-clear') {
      inst.holeMap[sel] = null;
    } else {
      const svg = el.querySelector('svg');
      const box = svg.getBoundingClientRect();
      const x = (e.clientX - box.left) / box.width, y = (e.clientY - box.top) / box.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      inst.holeMap[sel] = { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
    }
    saveInstrument(inst);
    refreshInstruments();
    if (action === 'hm-place') state.oc.holeMap.sel = hmFirstUnmarked(inst);
    render();
    return;
  }
  if (action === 's-fingers-reset' || action === 's-sub-layout') {
    const inst = currentInstrument();
    if (!inst) return;
    const setup = setupOf(inst);
    setup.holes = action === 's-fingers-reset' ? defaultCustomHoles(setup.holes.length) : withSubLayout(setup.holes, el.dataset.value);
    inst.setup = setup;
    if (inst.chambers?.[0]?.holes?.length === setup.holes.length) {
      inst.chambers[0] = { ...inst.chambers[0], holes: inst.chambers[0].holes.map((h, i) => ({ ...h, finger: setup.holes[i].finger, side: setup.holes[i].side, sub: setup.holes[i].sub })) };
    }
    saveInstrument(inst);
    refreshInstruments();
    render();
    return;
  }
  if (action === 's-fingers-reverse') {
    const inst = currentInstrument();
    if (!inst) return;
    const setup = holesSetupOf(inst);
    setup.holes = reverseHandFingers(setup.holes, el.dataset.hand);
    inst.setup = setup;
    // The chart's copies of the holes take the new finger names too.
    if (inst.chambers?.[0]?.holes?.length === setup.holes.length) {
      inst.chambers[0] = { ...inst.chambers[0], holes: inst.chambers[0].holes.map((h, i) => ({ ...h, finger: setup.holes[i].finger, side: setup.holes[i].side })) };
    }
    saveInstrument(inst);
    refreshInstruments();
    showToast(`${el.dataset.hand === 'R' ? 'Right' : 'Left'} hand reversed`);
    render();
    return;
  }
  if (action === 's-fingers-open') { state.oc.fingersSheet = true; render(); return; }
  if (action === 's-fingers-close') { state.oc.fingersSheet = false; render(); return; }
  if (action === 'b-hole-done') {
    const inst = currentInstrument();
    if (!inst) return;
    const ci = parseInt(el.dataset.ci, 10), idx = parseInt(el.dataset.index, 10);
    const per = inst.build.perChamber[ci] = inst.build.perChamber[ci] ?? {};
    const done = per.holesDone ?? [];
    per.holesDone = done.includes(idx) ? done.filter(x => x !== idx) : [...done, idx];
    saveInstrument(inst);
    bAdvanceChamber(inst);
    render();
    return;
  }
  if (action === 'b-window' && el.tagName === 'BUTTON') {
    const inst = currentInstrument();
    if (!inst) return;
    const ci = parseInt(el.dataset.ci, 10);
    const per = inst.build.perChamber[ci] = inst.build.perChamber[ci] ?? {};
    per.window = { ...chamberBuild(inst, ci).window, shape: el.dataset.value };
    saveInstrument(inst);
    render();
    return;
  }
  if (action === 'f-work-out') {
    const inst = currentInstrument();
    if (!inst?.setup || inst.family !== 'flute') return;
    const ch = fluteChamberFromReadings(inst.setup.holes, inst.setup.readings);
    if (!ch || ch.notes.length < 2) { showToast('Those readings don\'t give a chart: check each line is a different note'); return; }
    inst.chambers = [withFixedFingerings({ notes: ch.notes, holes: ch.holes, fingerings: ch.fingerings }, inst.setup.fixed)];
    inst.calibration = ch.calibration;
    saveInstrument(inst);
    refreshInstruments();
    state.oc.tab = 'notes';
    navReplace(`#i/${inst.id}/notes`);
    const n = ch.calibration.dropped.length;
    const nn = m => displayNote(midiToNoteName(m), state.useFlats, state.useSolfege);
    showToast(n
      ? `Chart ready: ${ch.notes.length} notes. ${ch.calibration.dropped.map(d => nn(d.midi)).join(', ')} came out twice; the first fingering is kept`
      : `Chart ready: ${ch.notes.length} notes`);
    render();
    return;
  }
  if (action === 's-calibrate') {
    const inst = currentInstrument();
    if (!inst?.setup) return;
    const ch = calibrateChamber(inst.setup.holes, inst.setup.f0, inst.setup.singles, { extra: inst.setup.extra });
    if (!ch || ch.notes.length < 2) { showToast('Those readings don\'t give a chart: check each hole raises the pitch'); return; }
    inst.chambers = [{ notes: ch.notes, holes: ch.holes, fingerings: ch.fingerings }];
    inst.calibration = ch.calibration;
    saveInstrument(inst);
    refreshInstruments();
    state.oc.tab = 'notes';
    showToast(`Chart ready: ${ch.notes.length} notes`);
    render();
    return;
  }


  // ── Ocarina Chords view and practice ──────────────────────────────────────
  if (action === 'oc-tab') {
    state.oc.tab = el.dataset.tab;
    state.oc.practice = null;
    navReplace(instUrl(state.currentInstrumentId, state.oc.tab));
    render();
    return;
  }
  if (action === 'oc-chord-select') {
    if (e.target.closest('.row-trail button')) return;
    // Like a handpan chord: pick it, and hear it.
    state.oc.expanded = el.dataset.key;
    state.oc.chordStep = {};
    const list = document.querySelector('.chord-list');
    const saved = list?.scrollTop ?? 0;
    render();
    const again = document.querySelector('.chord-list');
    if (again) again.scrollTop = saved;
    document.querySelector('.oc-stage [data-action="oc-play-arp"]')?.click();
    return;
  }
  if (action === 'oc-more-open') { state.oc.chordMore = true; render(); return; }
  if (action === 'oc-filters-open') { state.oc.filtersOpen = true; render(); return; }
  if (action === 'oc-filters-close') { state.oc.filtersOpen = false; render(); return; }
  if (action === 'oc-filter-root') { state.oc.root = el.dataset.root; render(); return; }
  if (action === 'oc-toggle-count') {
    const set = new Set(state.oc.counts ?? []);
    if (set.has(el.dataset.count)) set.delete(el.dataset.count); else set.add(el.dataset.count);
    state.oc.counts = [...set];
    render();
    return;
  }
  if (action === 'oc-more-close') { state.oc.chordMore = false; render(); return; }
  if (action === 'oc-missing-toggle') {
    // The <details> opens by itself; remember it across re-renders.
    state.oc.missingOpen = !el.closest('details').open;
    return;
  }
  if (action === 'oc-filters-clear') {
    // The sheet's filters; the empty list's "Clear filters" also clears the root.
    Object.assign(state.oc, { scaleFilter: 'All', category: 'All', counts: [] });
    if (el.dataset.all) state.oc.root = 'All';
    render();
    return;
  }
  if (['oc-play-arp', 'oc-voicing', 'oc-show-playlist-picker'].includes(action)) {
    e.stopPropagation();
    const inst = ocCardInstrument(el.dataset.key);
    if (!inst) return;
    const key = el.dataset.key;
    const card = ocCardData(inst, key);
    if (!card) return;
    if (action === 'oc-play-arp') {
      const names = card.midis.map(midiToNoteName);
      const rootName = names.find(n => notePC(n) === card.rootPC) ?? names[0];
      const seq = arpeggioOrder(names, rootName).map(midiToNoteName);
      playSequence(seq, (n, i) => ocHighlightStep(key, i, i === seq.length - 1));
      return;
    }
    if (action === 'oc-voicing') {
      const m = parseInt(el.dataset.midi, 10);
      const voiced = nextVoicing(inst, card.midis, m);
      if (voiced.join() === card.midis.join()) { showToast('No other octave of this note on the instrument'); return; }
      state.oc.voicings[key] = voiced;
      playNote(midiToNoteName(voiced.find(x => !card.midis.includes(x)) ?? m));
      render();
      return;
    }
    // Playlist picker, reusing the handpan one. Someone's instrument shared
    // by code is read-only: its chords go into playlists once it's added.
    if (inst.id === SHARED_ID && !inst.link) { showToast('Add it to My instruments to keep its chords'); return; }
    const names = card.midis.map(midiToNoteName);
    state.pickerChordFavId = card.entry
      ? (card.midis.join() === card.entry.notes.map(noteToMidi).join() ? card.entry.id : ocFavId(inst, card.chordId, names, null))
      : ocFavId(inst, card.chordId, names, card.canonical);
    state.pickerChordObj = {
      id: card.chordId, rootName: card.rootName, notes: names, noteCount: names.length,
      type: { name: card.typeName, category: card.category },
    };
    state.pickerNewPlaylist = false;
    state.pickerInstrumentId = inst.id;
    render();
    return;
  }
  if (action === 'oc-step') {
    initAudio();
    playNote(midiToNoteName(parseInt(el.dataset.midi, 10)));
    ocHighlightStep(el.dataset.key, parseInt(el.dataset.i, 10), true);
    return;
  }
  if (action === 'oc-play-note') {
    initAudio();
    playNote(midiToNoteName(parseInt(el.dataset.midi, 10)));
    const stage = el.closest('.oc-pstage');
    if (stage) ocHighlightStep(stage.closest('.oc-player').dataset.key, parseInt(stage.dataset.i, 10), true);
    return;
  }
  if (action === 'oc-play-pair') {
    initAudio();
    playNote(midiToNoteName(parseInt(el.dataset.a, 10)));
    playNote(midiToNoteName(parseInt(el.dataset.b, 10)));
    return;
  }
  if (action === 'oc-practice-start') {
    if (el.dataset.id) state.oc.playlistId = el.dataset.id;
    state.oc.practice = { playlistId: state.oc.playlistId, idx: 0 };
    playPracticeStep();
    render();
    return;
  }
  if (action === 'oc-practice-stop') { state.oc.practice = null; render(); return; }
  if (action === 'oc-practice-next' || action === 'oc-practice-prev') {
    const src = practiceSource(currentInstrument());
    if (!src) return;
    const n = practiceSteps(src.entries).length;
    state.oc.practice.idx = (state.oc.practice.idx + (action === 'oc-practice-next' ? 1 : n - 1)) % n;
    state.tuner.lastAdvance = performance.now();
    playPracticeStep();
    render();
    return;
  }

  // ── Add-instrument wizard ─────────────────────────────────────────────────
  if (action === 'wizard-family') {
    const fams = state.wizard.families;
    const f = el.dataset.family;
    state.wizard.families = fams.includes(f) ? fams.filter(x => x !== f) : [...fams, f];
    render();
    return;
  }
  if (action === 'wizard-families-next') {
    if (!state.wizard.families.length) return;
    state.wizard.queue = INSTRUMENT_FAMILIES.map(f => f.id).filter(f => state.wizard.families.includes(f));
    state.wizard.history = [];
    wizardNext();
    return;
  }
  if (action === 'wizard-skip') {
    setOnboarded();
    state.wizard = null;
    state.view = 'selector';
    navReplace('#scales');
    render();
    return;
  }
  if (action === 'wizard-skip-step') { wizardNext(); return; }
  if (action === 'wizard-fl-create') {
    const fl = state.wizard.fl;
    if (fl.detect?.listening) stopFluteDetect(null);
    const chart = fl.chartId === 'custom' ? null : getChart(fl.chartId) ?? chartsForFamily('flute')[0];
    if (!chart && fl.chartId !== 'custom') return;
    const inst = chart
      ? instrumentFromChart(chart.id, fl.keyId ?? chartDefaultKey(chart), { name: fl.name.trim() || wizardFluteName(chart, fl.keyId) })
      : createCustomFlute({ name: fl.name.trim(), holeCount: fl.holeCount });
    fl.detect = null;
    saveInstrument(inst);
    refreshInstruments();
    wizardAdded(inst.id, inst.name);
    return;
  }
  if (action === 'wizard-pick-handpan') {
    const scale = findTuning(el.dataset.id);
    if (!scale) return;
    const layout = createLayoutFromScale(scale);
    saveLayout({
      id: scale.id, name: scale.name,
      noteCount: 1 + scale.top.notes.length + scale.bottom.notes.length,
      layout, savedAt: Date.now(),
    });
    state.savedLayouts = getSavedLayouts();
    scheduleSave();
    refreshInstruments();
    state.wizard.search = '';
    wizardAdded(handpanInstrumentId(scale.id), scale.name);
    return;
  }
  if (action === 'wizard-oc-path') {
    if (state.wizard.oc.detect?.listening) stopFluteDetect(null, 'oc');
    state.wizard.oc.detect = null;
    state.wizard.oc.path = el.dataset.path || null;
    render();
    return;
  }
  if (action === 'wizard-oc-chambers') {
    state.wizard.oc.chambers = parseInt(el.dataset.n, 10);
    state.wizard.oc.windowStart = null;
    render();
    return;
  }
  if (action === 'wizard-oc-window') {
    state.wizard.oc.windowStart = parseInt(el.dataset.start, 10);
    render();
    return;
  }
  if (action === 'wizard-oc-create') {
    const oc = state.wizard.oc;
    if (oc.detect?.listening) stopFluteDetect(null, 'oc');
    const inst = oc.path === 'have' && oc.chartId !== 'custom' && getChart(oc.chartId)
      ? instrumentFromChart(oc.chartId, oc.keyId ?? chartDefaultKey(getChart(oc.chartId)), { name: oc.name.trim() })
      : oc.path === 'have'
      ? createCustomOcarina({ name: oc.name.trim(), holeCount: oc.holeCount })
      : Object.assign(createScaleOcarina({
          scaleId: oc.scaleId, transpose: oc.transpose, includeGu: oc.includeGu,
          notes: wizardOcarinaPlan().notes, name: oc.name.trim(),
        }), { design: { scaleId: oc.scaleId, transpose: oc.transpose, includeGu: oc.includeGu, chambers: oc.chambers, windowStart: oc.windowStart, excluded: [] } });
    saveInstrument(inst);
    refreshInstruments();
    state.wizard.oc = newWizard(false).oc;
    wizardAdded(inst.id, inst.name);
    return;
  }
  if (action === 'wizard-back') {
    const w = state.wizard;
    const prev = w.history.pop();
    if (prev) { w.queue.unshift(w.step); w.step = prev; w.notice = null; }
    render();
    return;
  }
  if (action === 'wizard-filter-notes') { state.wizard.noteFilter = el.dataset.val; render(); return; }
  if (action === 'wizard-fl-holes-step') {
    const fl = state.wizard.fl;
    fl.holeCount = Math.max(3, Math.min(8, fl.holeCount + parseInt(el.dataset.delta, 10)));
    render();
    return;
  }
  if (action === 'wizard-fl-octave') {
    const fl = state.wizard.fl;
    const chart = getChart(fl.chartId);
    if (!chart?.octaves) return;
    const cur = chart.keys.find(k => k.id === (fl.keyId ?? chartDefaultKey(chart)));
    fl.keyId = chartKeyFor(chart, cur.root, parseInt(el.dataset.octave, 10))?.id ?? fl.keyId;
    render();
    return;
  }
  if (action === 'wizard-fl-detect') { startFluteDetect(); return; }
  if (action === 'listen-start') { startListen(); return; }
  if (action === 'listen-stop') { stopListen(); return; }
  if (action === 'listen-clear') {
    if (!state.listen) return;
    if (state.listen.listening) Object.assign(state.listen, { notes: [], raw: [], lastSince: null }); else state.listen = null;
    clearMicTakes();
    render();
    return;
  }
  if (action === 'listen-remove') {
    if (!state.listen) return;
    const m = parseInt(el.dataset.midi, 10);
    state.listen.notes = state.listen.notes.filter(n => n !== m);
    if (!state.listen.notes.length && !state.listen.listening) state.listen = null;
    render();
    return;
  }
  if (action === 'wizard-oc-detect') {
    if (state.wizard.oc.detect?.listening) stopFluteDetect(null, 'oc');
    else startFluteDetect('oc');
    return;
  }
  if (action === 'wizard-oc-holes-step') {
    const oc = state.wizard.oc;
    oc.holeCount = Math.max(4, Math.min(13, oc.holeCount + parseInt(el.dataset.delta, 10)));
    render();
    return;
  }
  if (action === 'wizard-oc-transpose-step') {
    const oc = state.wizard.oc;
    Object.assign(oc, { transpose: Math.max(-6, Math.min(6, oc.transpose + parseInt(el.dataset.delta, 10))), windowStart: null });
    render();
    return;
  }
  if (action === 'wizard-oc-gu-toggle') {
    Object.assign(state.wizard.oc, { includeGu: !state.wizard.oc.includeGu, chambers: null, windowStart: null });
    render();
    return;
  }

  // ── Save sheet and Settings › Account ─────────────────────────────────────
  if (saveSheetAction(action, el)) return;
  if (accountAction(action)) return;

  // ── Selector ──────────────────────────────────────────────────────────────
  if (action === 'filter-notes') {
    state.noteCountFilter = el.dataset.val;
    render();
    return;
  }

  if (action === 'select-scale') {
    const scale = findTuning(el.dataset.id);
    if (!scale) return;
    state.layout = createLayoutFromScale(scale);
    state.chords = findAllChords(state.layout);
    state.selectedChord = null;
    state.shellMode = 'both';
    state.chordFilter = { category: 'All', root: 'All' };
    state.view = 'editor';
    state.currentInstrumentId = null;
    navPush(stateToHash());
    render();
    return;
  }

  // ── Saved layouts ─────────────────────────────────────────────────────────
  if (action === 'save-layout') {
    if (state.layout.isCustom && !state.layout.savedId) {
      state.layout.savedId = 'c-' + Date.now();
    }
    const id = state.layout.isCustom ? state.layout.savedId : state.layout.id;
    const total = 1 + state.layout.top.slots.filter(s => s.note).length
                    + state.layout.bottom.slots.filter(s => s.note).length;
    saveLayout({
      id,
      name: state.layout.name,
      noteCount: total,
      layout: JSON.parse(JSON.stringify(state.layout)),
      savedAt: Date.now(),
    });
    state.savedLayouts = getSavedLayouts();
    scheduleSave();
    refreshInstruments();
    state.currentInstrumentId = handpanInstrumentId(id);
    showToast('Saved to My instruments');
    render();
    return;
  }

  // ── Playlist picker ───────────────────────────────────────────────────────
  if (action === 'show-playlist-picker') {
    e.stopPropagation();
    const chordId = el.dataset.chordId;
    const favId = el.dataset.chordFavId;
    // Panel heart (matches the selected chord) preserves any voicing swap;
    // row hearts always use the canonical chord for that row.
    const chord = (state.selectedChord && state.selectedChord.id === chordId)
      ? state.selectedChord
      : state.chords.find(c => c.id === chordId);
    if (!chord) return;
    state.pickerChordFavId = favId;
    state.pickerChordObj = chord;
    state.pickerNewPlaylist = false;
    render();
    return;
  }

  if (action === 'update-playlist-entry') {
    if (!state.selectedChord || !state.sourcePlaylistId || !state.sourceEntryId) return;
    const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
    const newId = favIdForChord(layoutId, state.selectedChord, state.chords);
    const ok = updatePlaylistChordVoicing(state.sourcePlaylistId, state.sourceEntryId, {
      id: newId, notes: state.selectedChord.notes, noteCount: state.selectedChord.notes.length,
    });
    if (!ok) { showToast('That playlist entry no longer exists'); return; }
    state.sourceEntryId = newId;
    state.playlists = getPlaylists();
    state.favorites = getFavorites();
    scheduleSave();
    showToast('Saved to playlist');
    render();
    return;
  }

  if (action === 'close-playlist-picker') {
    state.pickerChordFavId = null;
    state.pickerChordObj = null;
    state.pickerNewPlaylist = false;
    state.pickerNewProgression = false;
    render();
    return;
  }

  if (action === 'toggle-playlist-chord') {
    const playlistId = el.dataset.playlistId;
    const favId = state.pickerChordFavId;
    const chord = state.pickerChordObj;
    if (!chord || !favId) return;
    const pl = state.playlists.find(p => p.id === playlistId);
    if (!pl) return;
    if (pl.chords.some(c => c.id === favId)) {
      removeChordFromPlaylist(playlistId, favId);
    } else {
      addChordToPlaylist(playlistId, playlistEntryFor(chord, favId));
    }
    state.playlists = getPlaylists();
    state.favorites = getFavorites();
    scheduleSave();
    render();
    return;
  }

  if (action === 'show-new-playlist-input') {
    state.pickerNewPlaylist = true;
    render();
    setTimeout(() => document.getElementById('new-playlist-input')?.focus(), 0);
    return;
  }

  if (action === 'confirm-new-playlist') {
    const input = document.getElementById('new-playlist-input');
    const name = (input?.value || '').trim();
    if (!name) return;
    const newId = addPlaylist(name);
    if (state.pickerChordObj && state.pickerChordFavId) {
      addChordToPlaylist(newId, playlistEntryFor(state.pickerChordObj, state.pickerChordFavId));
    }
    state.playlists = getPlaylists();
    state.pickerChordFavId = null;
    state.pickerChordObj = null;
    state.pickerNewPlaylist = false;
    scheduleSave();
    showToast('Playlist created');
    render();
    return;
  }

  // ── Playlist view ─────────────────────────────────────────────────────────
  if (action === 'open-playlist-chords') {
    const pl = state.playlists.find(p => p.id === el.dataset.id);
    if (!pl) return;
    if (pl.chords.length === 0) { showToast('No chords in playlist yet'); return; }
    if (pl.chords[0].instrumentId) {
      if (openPlaylistEntryOnInstrument(pl, pl.chords[0])) render();
      return;
    }
    if (!loadPlaylistChordAt(pl, 0)) { showToast('Scale not found'); return; }
    state.chordFilter = { category: 'All', root: 'All', playlist: pl.id };
    state.view = 'chords';
    navPush(stateToHash());
    render();
    return;
  }

  // ── Playlists tab and playlist detail ─────────────────────────────────────
  if (action === 'hp-play-playlist') {
    const pl = state.playlists.find(p => p.id === el.dataset.id);
    if (pl) hpPlayPlaylist(pl);
    return;
  }
  if (action === 'pl-practice') {
    const inst = currentInstrument();
    const pl = state.playlists.find(p => p.id === state.activePlaylistId);
    if (!inst || !pl) return;
    state.view = 'instrument';
    state.oc.tab = 'playlists';
    state.oc.playlistId = pl.id;
    state.oc.practice = { playlistId: pl.id, idx: 0 };
    navPush(`#i/${inst.id}/playlists`);
    playPracticeStep();
    render();
    return;
  }
  if (action === 'pl-go-chords') {
    if (state.layout) {
      state.chords = findAllChords(state.layout);
      state.selectedChord = null;
      state.chordFilter = { category: 'All', root: 'All', playlist: 'All' };
      state.view = 'chords';
      navPush(stateToHash());
    } else if (state.currentInstrumentId) {
      state.view = 'instrument';
      state.oc.tab = 'chords';
      navPush(instUrl(state.currentInstrumentId, 'chords'));
    }
    render();
    return;
  }
  if (action === 'pl-mode') { state.plMode = el.dataset.value; render(); return; }
  if (action === 'pl-row-menu') { e.stopPropagation(); state.plRowMenu = parseInt(el.dataset.idx, 10); render(); return; }
  if (action === 'pl-row-close') { state.plRowMenu = null; render(); return; }
  if (action === 'pl-new-open' || action === 'pl-rename-open') {
    const pl = state.playlists.find(p => p.id === state.activePlaylistId);
    state.plName = action === 'pl-new-open' ? { mode: 'new', value: '' } : { mode: 'rename', id: pl?.id, value: pl?.name ?? '' };
    render();
    setTimeout(() => document.getElementById('pl-name-input')?.focus(), 0);
    return;
  }
  if (action === 'pl-name-cancel') { state.plName = null; render(); return; }
  if (action === 'pl-name-save') {
    const n = state.plName;
    if (!n) return;
    const name = (document.getElementById('pl-name-input')?.value ?? n.value).trim();
    if (!name) { n.error = true; render(); document.getElementById('pl-name-input')?.focus(); return; }
    if (n.mode === 'prog-new' || n.mode === 'prog-rename') {
      const id = n.mode === 'prog-new' ? addProgression(name) : n.id;
      if (n.mode === 'prog-rename') renameProgression(id, name);
      state.progressions = getProgressions();
      state.plName = null;
      if (n.mode === 'prog-new') showToast('Progression created', { action: { label: 'Open', run: () => openProgression(id) } });
      render();
      return;
    }
    if (n.mode === 'new') addPlaylist(name);
    else renamePlaylist(n.id, name);
    state.playlists = getPlaylists();
    state.plName = null;
    scheduleSave();
    if (n.mode === 'new') showToast('Playlist created');
    render();
    return;
  }

  // ── Progressions ──────────────────────────────────────────────────────────
  if (action === 'picker-mode') {
    state.pickerMode = el.dataset.value === 'progression' ? 'progression' : 'playlist';
    state.pickerNewPlaylist = false;
    state.pickerNewProgression = false;
    render();
    return;
  }
  if (action === 'add-to-progression') {
    const chord = state.pickerChordObj;
    const prog = progFind(el.dataset.progId);
    if (!chord || !prog) return;
    const no = addStepToProgression(prog.id, playlistEntryFor(chord, state.pickerChordFavId));
    if (!no) return;
    state.progressions = getProgressions();
    // The sheet closes so the toast doesn't cover it; ♡ opens it again on
    // Progression for the next chord.
    Object.assign(state, { pickerChordFavId: null, pickerChordObj: null, pickerNewProgression: false });
    showToast(`Added ${progStepTitle({ rootName: chord.rootName, typeName: chord.type.name })} to ${prog.name} (step ${no})`);
    render();
    return;
  }
  if (action === 'show-new-progression-input') {
    state.pickerNewProgression = true;
    render();
    setTimeout(() => document.getElementById('new-progression-input')?.focus(), 0);
    return;
  }
  if (action === 'confirm-new-progression') {
    const name = (document.getElementById('new-progression-input')?.value || '').trim();
    const chord = state.pickerChordObj;
    if (!name || !chord) return;
    const id = addProgression(name, [newProgressionStep(playlistEntryFor(chord, state.pickerChordFavId))]);
    state.progressions = getProgressions();
    Object.assign(state, { pickerChordFavId: null, pickerChordObj: null, pickerNewProgression: false });
    showToast(`Added ${progStepTitle({ rootName: chord.rootName, typeName: chord.type.name })} to ${name} (step 1)`);
    render();
    return;
  }
  if (action === 'cs-open') { csOpen(el.dataset.progId || null); return; }
  if (action === 'cs-cancel') { state.chordSheet = null; render(); return; }
  if (action === 'cs-next') { csNext(); return; }
  if (action === 'cs-back') {
    if (state.chordSheet) { state.chordSheet.name = document.getElementById('cs-name')?.value ?? state.chordSheet.name; state.chordSheet.step = 'paste'; }
    render();
    return;
  }
  if (action === 'cs-semis') {
    if (!state.chordSheet) return;
    state.chordSheet.name = document.getElementById('cs-name')?.value ?? state.chordSheet.name;
    state.chordSheet.semis = parseInt(el.dataset.semis, 10) || 0;
    render();
    return;
  }
  if (action === 'cs-save') { csSave(); return; }
  if (action === 'prog-new-open' || action === 'prog-rename-open') {
    const prog = progFind();
    state.plName = action === 'prog-new-open' ? { mode: 'prog-new', value: '' } : { mode: 'prog-rename', id: prog?.id, value: prog?.name ?? '' };
    render();
    setTimeout(() => document.getElementById('pl-name-input')?.focus(), 0);
    return;
  }
  if (action === 'open-progression') {
    if (e.target.closest('.row-trail button')) return;
    openProgression(el.dataset.id);
    return;
  }
  if (action === 'pl-copy-progression') {
    const pl = state.playlists.find(p => p.id === state.activePlaylistId);
    if (!pl || !pl.chords.length) return;
    const id = addProgression(pl.name, pl.chords.map(c => newProgressionStep(c)));
    state.progressions = getProgressions();
    showToast(`Copied ${pl.name} as a progression`, { action: { label: 'Open', run: () => openProgression(id) } });
    render();
    return;
  }
  if (action === 'prog-delete') {
    const prog = progFind();
    if (!prog) return;
    state.confirm = {
      kind: 'progression', id: prog.id, ok: 'Delete', title: `Delete ${prog.name}?`,
      body: 'The progression is removed on this device and from sync. The chords stay on your instruments.',
    };
    render();
    return;
  }
  if (action === 'prog-mode') { state.progMode = el.dataset.value === 'order' ? 'order' : 'steps'; render(); return; }
  if (action === 'prog-row-menu') { e.stopPropagation(); state.progRowMenu = parseInt(el.dataset.idx, 10); render(); return; }
  if (action === 'prog-row-close') { state.progRowMenu = null; render(); return; }
  if (['prog-step-up', 'prog-step-down', 'prog-step-remove', 'prog-step-dup', 'prog-step-bars'].includes(action)) {
    const prog = progFind();
    const idx = parseInt(el.dataset.idx, 10);
    if (!prog || !prog.steps[idx]) return;
    if (action === 'prog-step-up') moveProgressionStep(prog.id, idx, idx - 1);
    if (action === 'prog-step-down') moveProgressionStep(prog.id, idx, idx + 1);
    if (action === 'prog-step-remove') removeProgressionStep(prog.id, idx);
    if (action === 'prog-step-dup') duplicateProgressionStep(prog.id, idx);
    if (action === 'prog-step-bars') {
      // A part-bar step (from a chord sheet) grows to a whole bar first.
      const st = prog.steps[idx];
      const d = parseInt(el.dataset.delta, 10);
      if (st.beats != null) { if (d > 0) setProgressionStepBars(prog.id, idx, 1); }
      else setProgressionStepBars(prog.id, idx, st.bars + d);
    }
    state.progressions = getProgressions();
    render();
    return;
  }
  if (action === 'prog-bpm' || action === 'prog-beats') {
    const prog = progFind();
    if (!prog) return;
    const d = parseInt(el.dataset.delta, 10);
    setProgressionTiming(prog.id, action === 'prog-bpm' ? { bpm: prog.bpm + d * 5 } : { beatsPerBar: prog.beatsPerBar + d });
    state.progressions = getProgressions();
    progRetime(progFind());
    render();
    return;
  }
  if (action === 'prog-step-tap') {
    if (e.target.closest('.row-trail button, .prog-bars button')) return;
    const prog = progFind();
    const idx = parseInt(el.dataset.idx, 10);
    const s = prog?.steps[idx];
    if (!s) return;
    let ctx = progContext(prog);
    if (s.missing) { showToast(`${s.symbol ?? 'This chord'} isn't on ${s.scaleName ?? 'this instrument'}`); return; }
    if (!ctx || !ctx.isHere(s)) { showToast(`This step plays on ${s.scaleName ?? 'another instrument'}`); return; }
    if (ctx.kind === 'oc') {
      initAudio();
      const rootName = s.notes.find(n => notePC(n) === notePC(s.rootName + '4')) ?? s.notes[0];
      playSequence(arpeggioOrder(s.notes, rootName).map(midiToNoteName));
      return;
    }
    if (ctx.load) {
      if (!progLoadHandpan(ctx.load)) { showToast('Scale not found'); return; }
      ctx = progContext(prog);
    }
    if (state.progPlay?.playing && state.progPlay.id === prog.id) { progStart(prog, idx); return; }
    state.progPlay = { id: prog.id, stepId: s.stepId, beat: 0, playing: false };
    render();
    progStrike(s);
    return;
  }
  if (action === 'prog-play') {
    const prog = progFind(el.dataset.id || state.activeProgressionId);
    if (!prog) return;
    if (state.view !== 'progression') {
      // From the Playlists tab: the player lives on the progression's screen.
      stopAutoplay();
      Object.assign(state, { view: 'progression', activeProgressionId: prog.id, progMode: 'steps', progRowMenu: null });
      navPush(`#prog/${encodeURIComponent(prog.id)}`);
    }
    progStart(prog);
    return;
  }
  if (action === 'prog-stop') { progStop(); render(); return; }
  if (action === 'prog-level') {
    const prog = progFind();
    if (!prog || !setProgressionLevel(prog.id, el.dataset.value)) return;
    state.progressions = getProgressions();
    const pp = state.progPlay;
    if (pp?.playing && pp.id === prog.id) { const at = progCurrentIdx(prog); progStart(progFind(), at >= 0 ? at : null); return; }
    render();
    return;
  }
  if (action === 'prog-practice') {
    const prog = progFind(el.dataset.id || state.activeProgressionId);
    if (!prog) return;
    const ctx = state.view === 'instrument' ? progOcContext(currentInstrument()) : progContext(prog);
    if (!ctx || ctx.kind !== 'oc') return;
    if (!(state.view === 'instrument' && state.currentInstrumentId === ctx.inst.id)) {
      if (ctx.open && !openInstrument(ctx.inst.id, { push: false })) { showToast('That ocarina is no longer in My instruments'); return; }
      state.view = 'instrument';
      state.oc.tab = 'playlists';
      navPush(`#i/${ctx.inst.id}/playlists`);
    }
    state.oc.practice = { progressionId: prog.id, idx: 0 };
    playPracticeStep();
    render();
    return;
  }

  if (action === 'open-playlist') {
    stopAutoplay();
    state.plMode = 'chords';
    state.plRowMenu = null;
    state.activePlaylistId = el.dataset.id;
    state.view = 'playlist';
    navPush(`#pl/${encodeURIComponent(el.dataset.id)}`);
    render();
    return;
  }

  if (action === 'delete-playlist') {
    const pl = state.playlists.find(p => p.id === state.activePlaylistId);
    if (!pl || pl.id === 'favorites') return;
    state.confirm = {
      kind: 'playlist', id: pl.id, ok: 'Delete', title: `Delete ${pl.name}?`,
      body: 'The playlist is removed on this device and from sync. The chords stay on your instruments.',
    };
    render();
    return;
  }

  if (action === 'move-chord-up') {
    const idx = parseInt(el.dataset.idx, 10);
    reorderChordInPlaylist(state.activePlaylistId, idx, idx - 1);
    state.playlists = getPlaylists();
    scheduleSave();
    render();
    return;
  }

  if (action === 'move-chord-down') {
    const idx = parseInt(el.dataset.idx, 10);
    reorderChordInPlaylist(state.activePlaylistId, idx, idx + 1);
    state.playlists = getPlaylists();
    scheduleSave();
    render();
    return;
  }

  if (action === 'remove-playlist-chord') {
    const idx = parseInt(el.dataset.idx, 10);
    const pl = state.playlists.find(p => p.id === state.activePlaylistId);
    if (!pl) return;
    const chord = pl.chords[idx];
    if (!chord) return;
    removeChordFromPlaylist(state.activePlaylistId, chord.id);
    state.playlists = getPlaylists();
    state.favorites = getFavorites();
    scheduleSave();
    render();
    return;
  }

  if (action === 'open-playlist-chord') {
    const idx = parseInt(el.dataset.idx, 10);
    const pl = state.playlists.find(p => p.id === state.activePlaylistId);
    if (!pl) return;
    if (pl.chords[idx]?.instrumentId) {
      if (openPlaylistEntryOnInstrument(pl, pl.chords[idx])) render();
      return;
    }
    if (!loadPlaylistChordAt(pl, idx)) { showToast('Scale not found'); return; }
    state.chordFilter = { category: 'All', root: 'All', playlist: 'All' };
    state.view = 'chords';
    navPush(stateToHash());
    render();
    return;
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  if (action === 'back-selector') { goSelector(); return; }

  if (action === 'back-editor') {
    stopAutoplay();
    state.view = 'editor';
    state.selectedChord = null;
    state.sourcePlaylistId = null;
    state.sourceEntryId = null;
    navReplace(stateToHash(), { hpTab: null });
    render();
    return;
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  if (action === 'set-theme') { state.theme = el.dataset.value; applyTheme(); savePrefs(); render(); return; }
  if (action === 'set-flats') { state.useFlats = el.dataset.value === 'flats'; savePrefs(); render(); return; }
  if (action === 'set-solfege') { state.useSolfege = el.dataset.value === 'solfege'; savePrefs(); render(); return; }
  if (action === 'set-speed') {
    state.playbackSpeed = el.dataset.value;
    setPlaybackSpeed(state.playbackSpeed);
    savePrefs();
    initAudio();
    playScale(['C4', 'E4', 'G4']); // a short preview at the new speed
    render();
    return;
  }
  if (action === 'set-rotation') { state.ringRotated = el.dataset.value === 'rotated'; savePrefs(); render(); return; }
  if (action === 'set-autoplay-step') {
    const i = AUTOPLAY_SECONDS.indexOf(state.autoplaySeconds);
    const next = AUTOPLAY_SECONDS[Math.max(0, Math.min(AUTOPLAY_SECONDS.length - 1, (i < 0 ? 1 : i) + parseInt(el.dataset.delta, 10)))];
    state.autoplaySeconds = next;
    savePrefs();
    render();
    return;
  }
  if (action === 'reset-legends') {
    state.ocLegendSeen = false;
    state.handLegendSeen = false;
    savePrefs();
    showToast('The legend will show again');
    return;
  }
  if (action === 'open-clay-bodies') {
    state.view = 'clay';
    navPush('#settings/clay');
    render();
    return;
  }
  if (action === 'clay-edit') {
    const c = getClayBodies().find(x => x.id === el.dataset.id);
    state.clayEdit = c
      ? { id: c.id, name: c.name, pct: String(c.shrinkPct), error: null }
      : { id: '__new__', name: '', pct: '11', error: null };
    render();
    return;
  }
  if (action === 'clay-cancel') { state.clayEdit = null; render(); return; }
  if (action === 'clay-save') {
    const c = state.clayEdit;
    if (!c) return;
    c.name = (document.getElementById('clay-name-input')?.value ?? c.name).trim();
    c.pct = document.getElementById('clay-pct-input')?.value ?? c.pct;
    const pct = parseFloat(c.pct);
    c.error = !c.name ? 'name' : !(pct >= 0 && pct <= 30) ? 'pct' : null;
    if (c.error) { render(); return; }
    const list = getClayBodies();
    if (c.id === '__new__') list.push({ id: 'clay-' + Date.now().toString(36), name: c.name, shrinkPct: pct, builds: 0 });
    else Object.assign(list.find(x => x.id === c.id) ?? {}, { name: c.name, shrinkPct: pct });
    saveClayBodies(list);
    state.clayEdit = null;
    showToast(`${c.name} saved`);
    render();
    return;
  }
  if (action === 'check-updates') {
    navigator.serviceWorker?.getRegistration?.().then(r => r?.update()).catch(() => {});
    if (accountOn()) syncNow();
    showToast(accountOn() ? 'Checked for updates and synced' : 'Checked for updates');
    return;
  }

  // ── Pan rotation ──────────────────────────────────────────────────────────
  if (action === 'toggle-rotation') {
    state.ringRotated = !state.ringRotated;
    savePrefs();
    render();
    return;
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  if (action === 'shell-mode') {
    state.shellMode = el.dataset.mode;
    render();
    return;
  }

  if (action === 'clone-layout') {
    state.currentInstrumentId = null;
    state.layout = {
      ...state.layout,
      isCustom: true,
      id: 'custom',
      name: state.layout.name + ' (Custom)',
      top: {
        ...state.layout.top,
        slots: state.layout.top.slots.map(s => ({ ...s })),
      },
      bottom: {
        ...state.layout.bottom,
        slots: state.layout.bottom.slots.map(s => ({ ...s })),
      },
    };
    render();
    return;
  }

  if (action === 'go-chords') {
    state.chords = findAllChords(state.layout);
    state.selectedChord = null;
    state.chordFilter = { category: 'All', root: 'All', playlist: 'All' };
    state.view = 'chords';
    navPush(stateToHash());
    render();
    return;
  }

  if (action === 'ed-centre') {
    if (layoutInstrument(state.layout) !== 'tongue-drum') return;
    state.layout.centre = !state.layout.centre;
    state.chords = findAllChords(state.layout);
    navReplace(stateToHash());
    render();
    return;
  }

  if (action === 'adjust-capacity') {
    const shell = el.dataset.shell;
    const delta = parseInt(el.dataset.delta);
    const target = state.layout[shell];
    const newCap = Math.max(0, Math.min(layoutFamilyInfo(layoutInstrument(state.layout)).maxNotes, target.capacity + delta));
    if (newCap === target.capacity) return;

    if (delta > 0) {
      target.slots.push({ note: null });
    } else {
      // Only remove last slot if it's empty
      const lastIdx = target.slots.length - 1;
      if (lastIdx >= 0 && target.slots[lastIdx].note === null) {
        target.slots.pop();
      } else {
        showToast('Remove the last note first');
        return;
      }
    }
    target.capacity = newCap;
    state.chords = findAllChords(state.layout);
    render();
    return;
  }

  // Note picker: cancel or overlay background click
  if (action === 'close-picker') {
    stopPickListen();
    state.pendingSlot = null;
    render();
    return;
  }
  if (action === 'pick-listen') { startPickListen(); return; }
  if (action === 'pick-listen-stop') { stopPickListen(); render(); return; }

  // Note picker: pick a note
  if (action === 'pick-note') { setPendingSlotNote(el.dataset.note); return; }

  // ── Chord explorer ─────────────────────────────────────────────────────────
  if (action === 'hp-filters-open') { state.hpFilters = true; render(); return; }
  if (action === 'hp-filters-close') { state.hpFilters = false; render(); return; }
  if (action === 'hp-more-open') { state.hpMore = true; render(); return; }
  if (action === 'hp-more-close') { state.hpMore = false; render(); return; }
  if (action === 'hp-filters-clear') {
    // The sheet's filters; the empty list's "Clear filters" also clears the root.
    state.chordCountSet.clear();
    state.chordFilter.category = 'All';
    if (state.autoplayOn && state.autoplayPlaylistId !== 'All') stopAutoplay();
    state.chordFilter.playlist = 'All';
    if (el.dataset.all) state.chordFilter.root = 'All';
    render();
    return;
  }
  if (action === 'hp-clear-playlist') {
    if (state.autoplayOn) stopAutoplay();
    state.chordFilter.playlist = 'All';
    render();
    return;
  }
  if (action === 'hp-edit-playlist') {
    // Same as the old "Edit playlist" option of the playlist select.
    stopAutoplay();
    state.hpFilters = false;
    state.plMode = 'chords';
    state.activePlaylistId = state.chordFilter.playlist;
    state.view = 'playlist';
    navPush(`#pl/${encodeURIComponent(state.activePlaylistId)}`);
    render();
    return;
  }
  if (action === 'toggle-note-count') {
    const count = el.dataset.count;
    if (state.chordCountSet.has(count)) state.chordCountSet.delete(count);
    else state.chordCountSet.add(count);
    render();
    return;
  }

  if (action === 'filter-root') {
    state.chordFilter.root = el.dataset.root;
    render();
    return;
  }

  if (action === 'select-chord') {
    const chord = state.chords.find(c => c.id === el.dataset.id);
    if (!chord) return;
    stopAutoplay();

    // If the chord list is filtered to a playlist, clicking a row is the
    // same as opening that entry — show its saved voicing (it may differ
    // from canonical) and track it so a swap can be saved back.
    const pl = state.chordFilter.playlist !== 'All' ? state.playlists.find(p => p.id === state.chordFilter.playlist) : null;
    const entry = pl ? pl.chords.find(c => c.chordId === chord.id) : null;
    if (pl && entry) {
      state.selectedChord = Array.isArray(entry.notes) ? { ...chord, notes: entry.notes } : chord;
      state.sourcePlaylistId = pl.id;
      state.sourceEntryId = entry.id;
    } else {
      state.selectedChord = chord;
      state.sourcePlaylistId = null;
      state.sourceEntryId = null;
    }

    navReplace(stateToHash());
    // Preserve chord list scroll position across render
    const chordList = document.querySelector('.chord-list');
    const savedScroll = chordList?.scrollTop ?? 0;
    render();
    const newChordList = document.querySelector('.chord-list');
    if (newChordList) newChordList.scrollTop = savedScroll;
    // Arpeggiate then play together; show playing animation at the "together" moment
    initAudio();
    playChord(state.selectedChord.notes,
      note => updatePanPlaying([note]),
      notes => updatePanPlaying(notes)
    );
    return;
  }

  if (action === 'toggle-autoplay') {
    const pl = state.playlists.find(p => p.id === state.chordFilter.playlist);
    if (!pl) return;
    if (state.autoplayOn) { stopAutoplay(); render(); }
    else startAutoplay(pl);
    return;
  }

  if (action === 'play-chord') {
    if (!state.selectedChord) return;
    initAudio();
    playChord(state.selectedChord.notes,
      note => updatePanPlaying([note]),
      notes => updatePanPlaying(notes)
    );
    return;
  }

  if (action === 'play-scale') {
    const allNotes = getAllNotes(state.layout);
    initAudio();
    playScale(allNotes, note => updatePanPlaying([note]));
    return;
  }

  // ── Discover mode ────────────────────────────────────────────────────────
  if (action === 'hear-start') { listenStart(); return; }
  if (action === 'hear-stop') { listenStop(); return; }
  if (action === 'hear-clear') { Object.assign(listenUi(), { history: [], stopped: '' }); render(); return; }
  if (action === 'listen-oc-note') {
    listenUi().ocNote = parseInt(el.dataset.midi, 10);
    initAudio();
    playNote(midiToNoteName(listenUi().ocNote));
    render();
    return;
  }
  if (action === 'oc-listen-mode') {
    const want = el.dataset.value;
    const now = state.oc.listen ? 'listen' : state.oc.identify ? 'identify' : 'browse';
    if (want === now) return;
    state.oc.listen = want === 'listen';
    state.oc.identify = want === 'identify';
    state.oc.idNotes = [];
    render();
    return;
  }
  if (action === 'oc-id-note') {
    const m = parseInt(el.dataset.midi, 10);
    const list = state.oc.idNotes ?? (state.oc.idNotes = []);
    const i = list.indexOf(m);
    if (i >= 0) list.splice(i, 1); else list.push(m);
    if (i < 0) { initAudio(); playNote(midiToNoteName(m)); }
    render();
    return;
  }
  if (action === 'oc-id-clear') { state.oc.idNotes = []; render(); return; }
  if (action === 'oc-id-play') {
    const names = [...(state.oc.idNotes ?? [])].sort((a, b) => a - b).map(midiToNoteName);
    if (names.length >= 2) { initAudio(); playSequence(names, () => {}, 0.55); }
    return;
  }
  if (action === 'oc-id-open') {
    // The chord found, in Browse: its fingerings in playing order, playlists, octaves.
    Object.assign(state.oc, { identify: false, idNotes: [], expanded: el.dataset.id, root: 'All', category: 'All', scaleFilter: 'All', counts: [] });
    render();
    return;
  }
  if (action === 'open-listen-debug') { state.view = 'listen-debug'; navPush('#settings/listen'); render(); return; }
  if (action === 'listen-tune-reset') {
    const L = listenUi();
    Object.assign(L.tune, LISTEN_DEFAULTS);
    _listenTrack = listenTracker(L.tune);
    render();
    return;
  }
  if (action === 'toggle-discover-mode') {
    // From the Browse | Identify | Listen segment: only a change of mode toggles.
    const want = el.dataset.value ?? (state.discoverMode ? 'browse' : 'identify');
    const now = state.hpListen ? 'listen' : state.discoverMode ? 'identify' : 'browse';
    if (want === now) return;
    stopAutoplay();
    state.hpListen = want === 'listen';
    state.discoverMode = want === 'identify';
    state.discoverNotes = [];
    state.selectedChord = null;
    state.sourcePlaylistId = null;
    state.sourceEntryId = null;
    render();
    return;
  }

  if (action === 'discover-clear') {
    state.discoverNotes = [];
    render();
    return;
  }

  if (action === 'discover-bookmark') {
    const idx = parseInt(el.dataset.matchIdx, 10);
    const chord = identifyChord(state.discoverNotes)[idx];
    if (!chord) return;
    const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
    state.pickerChordFavId = favIdForChord(layoutId, chord, state.chords);
    state.pickerChordObj = chord;
    state.pickerNewPlaylist = false;
    render();
    return;
  }

  if (action === 'discover-bookmark-custom') {
    if (state.discoverNotes.length < 2) return;
    const notes = [...state.discoverNotes];
    // A shared, note-less id — the favId suffix (added below since no
    // canonical "custom" chord type exists) is what disambiguates combos.
    const chord = {
      id: 'custom', rootName: getNoteName(notes[0]),
      type: { name: 'Custom', category: 'Custom' }, notes, noteCount: notes.length,
    };
    const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
    state.pickerChordFavId = favIdForChord(layoutId, chord, state.chords);
    state.pickerChordObj = chord;
    state.pickerNewPlaylist = false;
    render();
    return;
  }

  if (action === 'discover-play') {
    const idx = parseInt(el.dataset.matchIdx, 10);
    const chord = identifyChord(state.discoverNotes)[idx];
    if (!chord) return;
    initAudio();
    playChord(chord.notes, note => updatePanPlaying([note]), notes => updatePanPlaying(notes));
    return;
  }

  if (action === 'discover-play-custom') {
    if (state.discoverNotes.length < 2) return;
    initAudio();
    playChord(state.discoverNotes, note => updatePanPlaying([note]), notes => updatePanPlaying(notes));
    return;
  }

  if (action === 'copy-url') {
    const url = location.origin + navUrl(currentPath());
    navigator.clipboard.writeText(url).then(() => showToast('URL copied!'), () => showToast('Copy the link from the address bar'));
    return;
  }
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
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action } = el.dataset;
  if (action === 'select-playlist-filter') {
    if (el.value === '__edit__') {
      stopAutoplay();
      state.activePlaylistId = state.chordFilter.playlist;
      state.view = 'playlist';
      navPush(`#pl/${encodeURIComponent(state.activePlaylistId)}`);
    } else {
      if (state.autoplayOn && el.value !== state.autoplayPlaylistId) stopAutoplay();
      state.chordFilter.playlist = el.value;
    }
    render();
  }
  if (action === 'filter-category') { state.chordFilter.category = el.value; render(); }
  if (action === 'ie-key') {
    const inst = getInstrument(el.dataset.id);
    if (!inst || inst.kind !== 'traditional') return;
    const before = instrumentFromChart(inst.type, inst.key);
    const fresh = instrumentFromChart(inst.type, el.value);
    // A name the app made ("… (D4)") follows the key; one the owner typed stays.
    if (inst.name === before.name) inst.name = fresh.name;
    inst.key = fresh.key;
    // Finger names the owner set stay with their holes; fingerings set by
    // hand move with the key.
    const shift = fresh.chambers[0].notes[0] - before.chambers[0].notes[0];
    const holes = fresh.chambers[0].holes.map((h, i) => (inst.setup?.holes?.[i] ? { ...h, finger: inst.setup.holes[i].finger, side: inst.setup.holes[i].side } : h));
    if (inst.setup?.fixed) {
      inst.setup.fixed = Object.fromEntries(Object.entries(inst.setup.fixed).map(([m, st]) => [Number(m) + shift, st]));
    }
    inst.chambers = [withFixedFingerings({ ...fresh.chambers[0], holes }, inst.setup?.fixed)];
    saveInstrument(inst);
    refreshInstruments();
    state.oc.selected = null;
    render();
    return;
  }
  if (action === 'ie-name' || action === 'ie-photo') {
    const inst = getInstrument(el.dataset.id || state.instEdit);
    if (!inst) return;
    if (action === 'ie-name') {
      inst.name = el.value.trim() || inst.name;
      // A handpan, tongue drum or kalimba takes its name from its saved
      // layout (instruments.js reconcileInstruments), so rename that too.
      if (usesLayout(inst)) renameSavedLayout(inst.layoutId, inst.name);
      saveInstrument(inst);
      refreshInstruments();
      render();
      return;
    }
    const file = el.files?.[0];
    if (!file) return;
    readImageFile(file).then(img => {
      state.photoCrop = { id: inst.id, ...img, ratio: photoRatio(inst), zoom: 1, cx: 0.5, cy: 0.5 };
      render();
    }).catch(() => showToast('That photo couldn\'t be read'));
    return;
  }
  if (action === 'cs-target' && state.chordSheet) { state.chordSheet.target = el.value; return; }
  if (action === 'oc-scale-filter') { state.oc.scaleFilter = el.value; state.oc.voicings = {}; render(); }
  if (action === 'b-input' || action === 'b-shrink' || (action === 'b-window' && el.tagName === 'INPUT')
      || action === 'b-clay' || action === 'b-from' || action === 's-finger'
      || (action === 'b-design' && (el.tagName === 'SELECT' || el.tagName === 'INPUT'))) {
    let inst = currentInstrument();
    if (!inst) return;
    const num = parseFloat(el.value);
    if (action === 'b-input') {
      // Record fields take a note ("D4", "Re4 +12") or a frequency; other
      // builder inputs (the test hole in mm) stay plain numbers.
      const v = el.dataset.kind === 'pitch' ? parsePitch(el.value) : (num > 0 ? num : null);
      if (el.dataset.kind === 'pitch' && el.value.trim() && v == null) { showToast(`"${el.value.trim()}" isn't a note or a frequency`); render(); return; }
      setReading(inst, el.dataset.path, v);
    }
    if (action === 'b-shrink' && num >= 0) inst.build.shrinkPct = num;
    if (action === 'b-window') {
      const ci = parseInt(el.dataset.ci, 10);
      const per = inst.build.perChamber[ci] = inst.build.perChamber[ci] ?? {};
      if (num > 0) per.window = { ...chamberBuild(inst, ci).window, [el.dataset.key]: num };
    }
    if (action === 'b-clay') {
      if (el.value === '__new__') {
        const name = (prompt('Name of the clay body') || '').trim();
        if (!name) { render(); return; }
        const pct = parseFloat(prompt('Its shrinkage in %, if known', '11')) || 11;
        const clay = { id: 'clay-' + Date.now().toString(36), name, shrinkPct: pct, builds: 0 };
        saveClayBodies([...getClayBodies(), clay]);
        inst.build.clayBody = clay.id;
        inst.build.shrinkPct = pct;
      } else {
        const clay = getClayBodies().find(c => c.id === el.value);
        inst.build.clayBody = el.value;
        if (clay) inst.build.shrinkPct = clay.shrinkPct;
      }
    }
    if (action === 'b-from') {
      const src = getInstrument(el.value);
      inst.build.fromId = src ? src.id : null;
      if (src) {
        inst.design = { ...(src.design ?? { scaleId: src.scaleId, transpose: src.transpose, includeGu: src.includeGu }) };
        applyDesign(inst);
        inst.build.clayBody = src.build.clayBody;
        const clay = getClayBodies().find(c => c.id === src.build.clayBody);
        inst.build.shrinkPct = clay ? clay.shrinkPct : src.build.shrinkPct;
        inst.build.perChamber = (src.build.perChamber ?? []).map(p => ({ window: p?.window, testHoleMm: p?.readings?.leather?.d }));
      }
    }
    if (action === 's-finger') {
      const setup = holesSetupOf(inst);
      const h = setup.holes[parseInt(el.dataset.index, 10)];
      h.finger = el.value;
      h.side = el.value.endsWith('T') ? 'bottom' : 'top';
      inst.setup = setup;
      // The chart's holes are copies made when it was worked out: keep their
      // finger names in step (the notes don't depend on them).
      const ch = inst.chambers?.[0]?.holes?.[parseInt(el.dataset.index, 10)];
      if (ch) Object.assign(ch, { finger: h.finger, side: h.side });
    }
    if (action === 'b-design') {
      inst.design = inst.design ?? { scaleId: inst.scaleId, transpose: inst.transpose, includeGu: inst.includeGu };
      const key = el.dataset.key;
      if (key === 'scaleId') Object.assign(inst.design, { scaleId: el.value, chambers: null, windowStart: null, excluded: [] });
      applyDesign(inst);
      if (!inst.name || inst.name.endsWith(' ocarina')) inst.name = `${findTuning(inst.scaleId).name} ocarina`;
    }
    saveInstrument(inst);
    refreshInstruments();
    if (action === 'b-input') bAdvanceChamber(inst);
    // The Hole fingers sheet stays as it is (and keeps focus) while it's open.
    if (action === 's-finger' && state.oc.fingersSheet) return;
    render();
  }

  if (action === 'oc-category') { state.oc.category = el.value; render(); }
  if (action === 'wizard-chart') {
    const t = el.dataset.fam === 'oc' ? state.wizard.oc : state.wizard.fl;
    if (t.detect?.listening) stopFluteDetect(null, el.dataset.fam === 'oc' ? 'oc' : 'fl');
    t.chartId = el.value; t.keyId = null;
    t.detect = null;
    render();
  }
  if (action === 'wizard-fl-root') {
    const fl = state.wizard.fl;
    const chart = getChart(fl.chartId);
    const cur = chart?.keys.find(k => k.id === (fl.keyId ?? chartDefaultKey(chart)));
    if (cur) fl.keyId = chartKeyFor(chart, el.value, cur.octave)?.id ?? fl.keyId;
    render();
  }
  if (action === 'wizard-key') {
    (el.dataset.fam === 'oc' ? state.wizard.oc : state.wizard.fl).keyId = el.value;
  }
  if (action === 'wizard-oc-scale') {
    Object.assign(state.wizard.oc, { scaleId: el.value, chambers: null, windowStart: null });
    render();
  }
  if (action === 'set-autoplay-seconds') {
    state.autoplaySeconds = parseInt(el.value, 10);
    savePrefs();
    if (state.autoplayOn && _autoplayTimer) {
      clearInterval(_autoplayTimer);
      _autoplayTimer = setInterval(advanceAutoplay, state.autoplaySeconds * 1000);
    }
  }
});

// ── Input delegation ──────────────────────────────────────────────────────────
document.addEventListener('input', e => {
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
  if (history.state?.hpTab === 'playlists' && state.layout && (state.view === 'editor' || state.view === 'chords')) state.view = 'hp-playlists';
  render();
});
