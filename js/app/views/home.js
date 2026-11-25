// My instruments, Play (the home screen) and the row menu.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { SCALES } from '../../data.js';
import { icon } from '../../icons.js';
import { brandLogo } from '../../brand.js';
import { SONGS } from '../../songs.js';
import { chartsForFamily } from '../../charts.js';
import { LAYOUT_FAMILIES, findTuning, isLayoutFamily } from '../../layoutfamilies.js';
import { linkFor, linkTitle, parseLink } from '../../links.js';
import { visitHasWork } from '../../datastore.js';
import { INSTRUMENT_FAMILIES, deleteInstrument, getInstrument, getInstruments, instrumentStatus, setOnboarded, syncHandpanInstruments, usesLayout } from '../../instruments.js';
import { STAGE_ORDER, STAGE_TITLES } from '../../builder.js';
import { deleteLayout, getSavedLayouts } from '../../storage.js';
import { scheduleSave } from '../../auth.js';

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

// ── My instruments ───────────────────────────────────────────────────────────

function refreshInstruments() {
  syncHandpanInstruments(getSavedLayouts());
  state.instruments = getInstruments();
  if (state.instruments.length > 0) setOnboarded();
}

const FAMILY_ICONS = { handpan: 'family-handpan', 'tongue-drum': 'family-tongue-drum', kalimba: 'family-kalimba', ocarina: 'family-ocarina', flute: 'family-flute', recorder: 'family-recorder' };
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
  recorder: [['recorder-baroque', 'soprano'], ['recorder-baroque', 'alto'], ['recorder-german', 'soprano'], ['recorder-baroque', 'tenor'], ['recorder-baroque', 'sopranino']].map(([chartId, keyId]) => ({ chartId, keyId })),
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
  const waiting = state.pendingSong && SONGS.find(x => x.id === state.pendingSong);
  const notice = waiting ? `
    <div class="card play-notice" role="status">
      <div class="tip-title">Pick your instrument to play ${escHtml(waiting.title)}</div>
      <div class="tip-body">The song opens on it, moved to the notes it has.</div>
    </div>` : n ? `
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
    : uiRow({ lead: 'plus', title: fam === 'ocarina' ? 'Other keys, or your own ocarina' : fam === 'recorder' ? 'Another recorder' : 'Other keys, or your own flute', meta: fam === 'ocarina' ? 'Every key, ocarinas you made, building one from a scale' : fam === 'recorder' ? 'Set up any recorder note by note with the tuner' : 'Every key, and flutes you made', chevron: true, action: 'add-instrument' });
  // Back goes to the start screen (My instruments, or the setup when nothing
  // is saved), not to the instrument that was being tried.
  const bar = uiAppBar({ title: 'Play something else', back: { action: 'back-home', label: 'My instruments' }, actions: [tunerAppBtn(), settingsAppBtn()] });
  return `
    ${bar}
    <div class="play">
      ${homeIsEmpty() ? `<div class="brand-about play-brand">${brandLogo()}<span class="brand-about-line">Notes, chords and scales for handpan, tongue drum, kalimba, ocarina, flute and recorder. Free, no sign-up to play.</span></div>` : ''}
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
      meta: `Playlist · ${n} chord${n !== 1 ? 's' : ''}${n ? ` · ${where} instrument${where !== 1 ? 's' : ''}` : ''}`,
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
            body: 'Handpans and tongue drums by scale, ocarinas, flutes and recorders.',
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
        ${state.progressions.length ? `<h2 class="list-title">Playlists</h2><div class="list">${progressionRowsHtml(null, { home: true })}</div>` : ''}
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

// ── Click: My instruments ─────────────────────────────────────────────────
registerActions({
  'open-instrument': (el, e, action) => {
    if (e.target.closest('[data-action="delete-instrument"]')) return;
    if (openInstrument(el.dataset.id)) render();
    else showToast('Instrument not found');
    return;
  },
  'delete-instrument': (el, e, action) => {
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
  },
  'back-home': (el, e, action) => { goHome(); guestLeaving(); return; },
  'nav-back': (el, e, action) => {
    if (history.state?.hp) history.back();
    else if (el.dataset.fallback === 'selector') goSelector();
    else if (el.dataset.fallback === 'settings') openSettings({ push: false });
    else if (el.dataset.fallback === 'songs' && state.songCtx) songBackToList();
    else goHome();
    return;
  },
  'open-settings': (el, e, action) => { openSettings(); return; },
  'open-play': (el, e, action) => {
    goHome({ push: false });
    state.view = 'play';
    if (el.dataset.family) state.playFamily = el.dataset.family;
    state.playNotice = null;
    navPush('#play');
    render();
    guestLeaving();
    return;
  },
  'play-family': (el, e, action) => {
    state.playFamily = el.dataset.value;
    state.playNotice = null;
    render();
    return;
  },
  'open-link': (el, e, action) => {
    const link = parseLink(el.dataset.path);
    if (!link) return;
    openLink(link);
    navPush(link.path ?? el.dataset.path);
    render();
    return;
  },
  'play-custom-handpan': (el, e, action) => {
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
  },
  'other-instrument': (el, e, action) => {
    state.currentInstrumentId = null;
    state.view = 'selector';
    navPush('#scales');
    render();
    return;
  },
  'add-instrument': (el, e, action) => { setupAction('setup-open', el); return; },
});
