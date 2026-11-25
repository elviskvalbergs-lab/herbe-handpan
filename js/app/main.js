// Bootstrap and the event listeners that dispatch to the action registry.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { findAllChords } from '../chords.js';
import { listenTracker } from '../listen-detect.js';
import { initAudio, playNote, setVoice } from '../audio.js';
import { updatePanPlaying } from '../pan.js';
import { initSupabase, logEvent } from '../auth.js';
import { offline } from '../offline.js';
import { plainDataset, saveIntentFor } from '../store.js';

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
