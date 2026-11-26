// Navigation and URLs: history, deep links, opening an instrument.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { createLayoutFromScale } from '../data.js';
import { findAllChords } from '../chords.js';
import { instrumentFromChart } from '../charts.js';
import { findTuning, layoutInstrument, safeLayout } from '../layoutfamilies.js';
import { layoutFromCustomParams, linkFor, linkSlug, linkTitle, panPosToParam, parseLink } from '../links.js';
import { safeSetItem } from '../datastore.js';
import { getInstrument, handpanInstrumentId, touchInstrument, usesLayout } from '../instruments.js';
import { getSavedLayouts, saveLayout } from '../storage.js';

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
  Object.assign(state.chordsUi, { mode: 'browse', filtersOpen: false, moreOpen: false });
  Object.assign(state, {
    view: 'home', layout: null, selectedChord: null, pendingSlot: null,
    currentInstrumentId: null,
    wizard: null, discoverNotes: [], shared: null, sharedStatus: null, shareModal: null,
    menu: false, confirm: null, pickerChordFavId: null, pickerChordObj: null, pendingSong: null,
  });
  refreshInstruments();
  if (!push) return;
  navPush('/');
  render();
}

function goSelector() {
  state.view = 'selector';
  state.layout = null;
  state.selectedChord = null;
  state.pendingSlot = null;
  state.currentInstrumentId = null;
  navPush('#scales');
  render();
}

function openInstrument(id, { push = true } = {}) {
  const inst = getInstrument(id);
  if (!inst) return false;
  touchInstrument(id);
  if (state.currentInstrumentId !== id) { state.oc = newOcState(); state.chordsUi = newChordsUi(); }
  state.currentInstrumentId = id;
  state.selectedChord = null;
  if (usesLayout(inst)) {
    const saved = state.savedLayouts.find(l => l.id === inst.layoutId);
    if (!saved) return false;
    state.layout = JSON.parse(JSON.stringify(saved.layout));
    state.chords = findAllChords(state.layout);
    state.shellMode = 'both';
    clearChordFilters();
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

// ── URL serialization ────────────────────────────────────────────────────────
// The handpan on screen as a link (/handpan/d-kurd/chords/a-min, or
// /handpan/custom?… with every note), so the address bar always shows a
// link to what's on screen. (The name is from when these were '#…' hashes.)
function stateToHash() {
  if (!state.layout) return '';
  const tab = state.view === 'chords' ? 'chords' : state.view === 'hp-playlists' ? 'playlists' : state.view === 'hp-songs' ? 'songs' : null;
  const chord = state.view === 'chords' ? state.selectedChord?.id ?? null : null;
  const makerCode = makerCodePath(tab, chord ? linkSlug(chord) : null); // a maker's instrument keeps its code's address (js/makers-ui.js)
  if (makerCode) return makerCode;

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
  if (family === 'handpan' && state.layout.pos) params.set('pos', panPosToParam(state.layout.pos));
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

// The screen a link's tab opens: a handpan's view, an ocarina's or flute's tab.
function layoutTabView(tab) {
  return tab === 'chords' || tab === 'listen' ? 'chords' : tab === 'playlists' ? 'hp-playlists' : tab === 'songs' ? 'hp-songs' : 'editor';
}
function windTabOf(tab) {
  return tab === 'chords' || tab === 'listen' ? 'chords' : tab === 'playlists' || tab === 'songs' ? tab : 'notes';
}

// An ocarina or flute from a published chart, opened as a visiting
// instrument (a deep link, or a playlist entry added from one).
function openChartLink({ chartId, keyId }) {
  const inst = instrumentFromChart(chartId, keyId, { name: linkTitle(parseLink(linkFor({ chartId, keyId }))) });
  Object.assign(state, {
    view: 'instrument', layout: null, currentInstrumentId: SHARED_ID, sharedStatus: null, oc: newOcState(), chordsUi: newChordsUi(),
    shared: { ...inst, id: SHARED_ID, link: { chartId, keyId } },
  });
}

// A handpan, tongue drum or kalimba someone shared by code (/s/CODE): its
// notes open as a visiting instrument, as a deep link would. A catalogue
// scale keeps its id; anything else opens as custom notes under its name.
function openSharedLayout(data, tab) {
  // Someone else's data: only note names and small numbers reach the picture.
  const layout = safeLayout(JSON.parse(JSON.stringify(data.layout)));
  layout.name = String(data.name || layout.name).slice(0, 80);
  if (layout.isCustom || !findTuning(layout.id)) { layout.isCustom = true; delete layout.savedId; layout.id = 'custom'; }
  Object.assign(state, {
    layout, currentInstrumentId: null, shared: null, sharedStatus: null, selectedChord: null,
    chords: findAllChords(layout), shellMode: 'both',
    view: layoutTabView(tab),
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
  Object.assign(state, { selectedChord: null, pendingSlot: null, wizard: null, playNotice: null, songCtx: null });
  if (link.kind === 'song') { openSongAnywhere(link.song); return; }
  // A song on this instrument opens once the instrument is up (songOpenPending).
  if (link.song) state.pendingSong = link.song;
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
    state.oc.tab = windTabOf(link.tab);
    return;
  }
  if (link.kind === 'chart') {
    openChartLink(link);
    state.oc.tab = windTabOf(link.tab);
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
  clearChordFilters();
  state.view = link.chord ? 'chords' : layoutTabView(link.tab);
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
  if (makerOpenHash(hash)) return; // #maker… (js/makers-ui.js)
  if (hash.startsWith('#pl/')) {
    const id = decodeURIComponent(hash.slice(4));
    // A playlist moved into the one kind of list opens as that list.
    const moved = state.progressions.find(p => p.fromPlaylist === id || p.id === `pr-from-${id}`);
    if (moved) { state.activeProgressionId = moved.id; state.view = 'progression'; state.progMode = 'steps'; }
    return;
  }
  if (hash.startsWith('#song/')) {
    const id = decodeURIComponent(hash.slice(6));
    if (state.songCtx?.id === id) state.view = 'song';
    return;
  }
  if (hash.startsWith('#prog/')) {
    const id = decodeURIComponent(hash.slice(6));
    if (state.progressions.some(p => p.id === id)) { state.activeProgressionId = id; state.view = 'progression'; state.progMode = 'steps'; }
    return;
  }
  if (hash.startsWith('#p/')) { openSharedLink(decodeURIComponent(hash.slice(3))); return; }
  if (hash.startsWith('#i/')) {
    const [id, tab, songId] = hash.slice(3).split('/');
    if (openInstrument(decodeURIComponent(id), { push: false }) && ['chords', 'notes', 'songs', 'playlists', 'builder', 'setup'].includes(tab)) {
      state.oc.tab = tab;
    }
    // A song on one of my ocarinas or flutes (songAddress).
    if (tab === 'song' && songId && currentInstrument()?.id === decodeURIComponent(id)) state.pendingSong = decodeURIComponent(songId);
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

// The screen on show, kept in the synced prefs so a second device opens
// where you left off (§7). Only instruments and their tabs count.
function rememberLastPath() {
  if (!accountOn()) return;
  const path = location.pathname + location.hash;
  const p = syncReadPrefs();
  const isPlace = state.view === 'instrument' || state.layout;
  if (!isPlace || p.lastPath === path) return;
  safeSetItem(localStorage, 'hp-prefs', JSON.stringify({ ...p, lastPath: path, updatedAt: new Date().toISOString() }));
  syncSoon(5000);
}

// ── Click: Navigation ─────────────────────────────────────────────────────
registerActions({
  'back-selector': (el, e, action) => { goSelector(); return; },
  'back-editor': (el, e, action) => {
    state.view = 'editor';
    state.selectedChord = null;
    navReplace(stateToHash(), { hpTab: null });
    render();
    return;
  },
});
