// render(), focus across re-renders, and which sheet is open (the ⋯ menu, confirm).
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { APP_NAME } from '../links.js';
import { getInstrument } from '../instruments.js';

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
  songOpenPending();
  if (state.songWait && state.view !== 'song') songWaitOff();
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
  else if (state.view === 'hp-songs') html = viewHandpanSongs();
  else if (state.view === 'playlist') html = viewPlaylist();
  else if (state.view === 'progression') html = viewProgression();
  else if (state.view === 'song') html = viewSong();
  else if (state.view === 'settings') html = viewSettings();
  else if (state.view === 'clay') html = viewClayBodies();
  else if (state.view === 'listen-debug') html = viewListenDebug();
  else if (state.view === 'maker') html = viewMaker(); // js/makers-ui.js
  else if (state.view === 'maker-profile') html = viewMakerProfile();
  else if (state.view === 'maker-review') html = viewMakerReview();
  else if (state.view === 'maker-inst') html = viewMakerInst();
  else if (state.view === 'maker-import') html = viewMakerImport();
  else if (state.view === 'maker-stats') html = viewMakerStats();
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
  songTabFollow();
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
function rememberTrigger(el) { _lastTrigger = focusKeyOf(el); }
let _sheetReturnFocus = null;

function focusKeyOf(el) {
  if (!el || el === document.body || !el.closest?.('#app')) return null;
  if (el.id) return '#' + CSS.escape(el.id);
  // A note of the picture keeps the focus across a re-render.
  if (el.dataset?.noteId && el.matches('.pan-note')) return `.pan-note[data-note-id="${CSS.escape(el.dataset.noteId)}"]`;
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

// ── Sheets ───────────────────────────────────────────────────────────────────
// At most one sheet is open; it's rendered from state after the view.
function sheetHtml() {
  if (state.help) return helpSheet();
  if (state.speedSheet) return speedSheet();
  if (state.listenReport) return listenReportSheet();
  if (state.goesWith) return goesWithSheet();
  if (state.installHelp) return installHelpSheet();
  if (state.saveSheet) return saveSheetHtml();
  const makerSheet = makerSheetHtml(); // js/makers-ui.js
  if (makerSheet) return makerSheet;
  if (state.accountConfirm) return accountConfirmSheet();
  if (state.confirm) return confirmSheet();
  if (state.menu) return menuSheet();
  if (state.photoCrop) return photoCropSheet();
  if (state.instEdit) return instEditSheet();
  if (state.shareModal) return shareModalHtml();
  if (state.linkSheet) return linkSheetHtml();
  if (state.pickerChordFavId && ['chords', 'instrument', 'playlist'].includes(state.view)) return renderPlaylistPicker();
  if (state.plName) return plNameSheet();
  if (state.songsCountries && ['hp-playlists', 'hp-songs', 'instrument'].includes(state.view)) return songsCountriesSheet();
  if (state.chordSheet && ['hp-playlists', 'hp-songs', 'instrument', 'progression'].includes(state.view)) return chordSheetSheet();
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
      rows.push(uiRow({ lead: 'trash-2', title: 'Delete playlist', action: 'prog-delete', cls: 'is-danger' }));
    }
  } else if (state.view === 'instrument') {
    const inst = currentInstrument();
    const shared = inst?.id === SHARED_ID;
    title = inst?.name ?? title;
    if (inst && !shared) rows.push(uiRow({ lead: 'pencil', title: 'Edit instrument', meta: instEditMeta(inst), action: 'inst-edit-open', data: { id: inst.id } }));
    if (inst && !shared) rows.push(uiRow({ lead: 'share-2', title: 'Share…', meta: 'Code, link and QR code', action: 'share-instrument' }));
    if (inst?.link) rows.push(uiRow({ lead: 'link', title: 'Copy link', action: 'copy-url' }));
    if (inst) rows.push(uiRow({ lead: 'hand', title: 'Which finger is which', action: 'oc-hand-open' }));
    rows.push(helpMenuRow());
    rows.push(uiRow({ lead: 'settings', title: 'Settings', action: 'open-settings' }));
    if (inst && !shared) rows.push(uiRow({ lead: 'trash-2', title: 'Remove instrument', action: 'delete-instrument', data: { id: inst.id }, cls: 'is-danger' }));
  } else if (state.layout) {
    title = state.layout.name;
    const mine = state.currentInstrumentId ? getInstrument(state.currentInstrumentId) : null;
    if (mine) rows.push(uiRow({ lead: 'pencil', title: 'Edit instrument', meta: instEditMeta(mine), action: 'inst-edit-open', data: { id: mine.id } }));
    if (mine) rows.push(uiRow({ lead: 'share-2', title: 'Share…', meta: 'Code, link and QR code', action: 'share-instrument', data: { id: mine.id } }));
    rows.push(uiRow({ lead: 'link', title: state.selectedChord ? 'Copy link to this chord' : 'Copy link', action: 'copy-url' }));
    rows.push(helpMenuRow());
    rows.push(uiRow({ lead: 'settings', title: 'Settings', action: 'open-settings' }));
    if (state.currentInstrumentId) {
      rows.push(uiRow({ lead: 'trash-2', title: 'Remove instrument', action: 'delete-instrument', data: { id: state.currentInstrumentId }, cls: 'is-danger' }));
    }
  }
  if (state.view === 'playlist' || state.view === 'progression') rows.push(helpMenuRow());
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

// ── Click: picker and the ⋯ menu (before a menu row closes its menu) ──────
registerActions({
  'picker-open': (el, e, action) => { openPicker(el.dataset.picker); return; },
  'menu-open': (el, e, action) => { state.menu = true; render(); return; },
  'row-menu': (el, e, action) => { e.stopPropagation(); state.menu = { id: el.dataset.id }; render(); return; },
  'visit-save': (el, e, action) => {
    // Reached with an account only (a guest gets the save sheet first, and
    // signing in moved this visit's work into the account).
    reloadSaved();
    showToast('Saved to My instruments');
    render();
    return;
  },
  'menu-close': (el, e, action) => { state.menu = false; render(); return; },
}, EARLY_ACTIONS);

// ── Click: Sheets: the ⋯ menu and confirm ─────────────────────────────────
registerActions({
  'confirm-cancel': (el, e, action) => { state.confirm = null; render(); return; },
  'confirm-ok': (el, e, action) => {
    const c = state.confirm;
    state.confirm = null;
    if (c?.kind === 'instrument') removeInstrument(c.id);
    else if (c?.kind === 'playlist') removePlaylist(c.id);
    else if (c?.kind === 'progression') removeProgression(c.id);
    else render();
    return;
  },
  'hp-playlists, hp-songs': (el, e, action) => {
    stopAutoplay();
    state.pendingSlot = null;
    state.view = action;
    // Remembered on the history entry, so coming back to it reopens this tab.
    if (state.layout) navReplace(stateToHash(), { hpTab: action === 'hp-songs' ? 'songs' : 'playlists' });
    render();
    return;
  },
});
