// The Chords screen, one pattern for every instrument, and Goes well with.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { CHORD_CATEGORIES, NOTE_NAMES, displayNote, getAllNotes, notePC } from '../../data.js';
import { icon } from '../../icons.js';
import { goesWellWith, instrumentKey } from '../../harmony.js';
import { layoutFamilyInfo, layoutInstrument } from '../../layoutfamilies.js';
import { midiToNoteName, windWord } from '../../instruments.js';
import { initAudio, playSequence } from '../../audio.js';
import { arpeggioOrder, ocarinaToLayout } from '../../ocarina-ui.js';
import { addProgression, getProgressions, newProgressionStep } from '../../storage.js';
import { logEvent } from '../../auth.js';

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

// ── Goes well with (js/harmony.js) ─────────────────────────────────────────
// On every instrument's chord card: the chords that usually come next in the
// instrument's key (tap one to see it), and a sheet of well-known
// progressions with this chord, each to hear and to save as a progression.

// The chord on show, the instrument's chords and its key, and how a chord
// is picked on this screen.
function goesWithContext() {
  if (state.view === 'instrument') {
    const inst = currentInstrument();
    if (!inst || state.oc.tab !== 'chords') return null;
    const model = ocChordModel(inst);
    const chord = model.chords.find(c => c.id === state.oc.expanded);
    const pcs = state.oc.scaleFilter !== 'All' ? scalePitchClasses(state.oc.scaleFilter) : null;
    const layout = ocarinaToLayout(inst, pcs);
    if (!chord || !layout.top.ding) return null;
    return { chord, chords: model.chords, layout, pick: c => ({ action: 'oc-chord-select', data: { key: c.id } }) };
  }
  if (state.view !== 'chords' || !state.selectedChord || !state.layout?.top.ding) return null;
  return { chord: state.selectedChord, chords: state.chords, layout: state.layout, pick: c => ({ action: 'select-chord', data: { id: c.id } }) };
}
function goesWithFor(ctx) {
  const key = instrumentKey(layoutPitchClasses(ctx.layout), notePC(ctx.layout.top.ding));
  return { key, g: goesWellWith(ctx.chord, ctx.chords, key, { progressions: 4 }) };
}
function gwChordName(c) {
  const q = c.type.id === 'min' ? 'm' : c.type.id === 'dim' ? '°' : c.type.id === 'maj' ? '' : ` ${c.type.name}`;
  return `${displayNote(c.rootName, state.useFlats, state.useSolfege)}${q}`;
}

// The line on the card: "Goes well with  [Gm] [B♭] [C]  Progressions".
function goesWithLineHtml() {
  const ctx = goesWithContext();
  if (!ctx) return '';
  const { g } = goesWithFor(ctx);
  if (!g || (!g.next.length && !g.progressions.length)) return '';
  const chips = g.next.slice(0, 4).map(c => {
    const p = ctx.pick(c);
    return `<button type="button" class="chip gw-chip" data-action="${p.action}"${uiData(p.data)}>${escHtml(gwChordName(c))}</button>`;
  }).join('');
  if (!chips) return '';
  return `<div class="gw-line">
      <span class="gw-label">Goes well with ${uiHelp('goes-well-with')}</span>
      <div class="gw-chips">${chips}</div>
    </div>`;
}
// Are there well-known progressions with the chord on show (the ⋯ sheet's row)?
function goesWithHasProgressions() {
  const ctx = goesWithContext();
  return !!(ctx && goesWithFor(ctx).g?.progressions.length);
}

// The sheet: the progressions with this chord, each with ▶ and Save.
function goesWithSheet() {
  const ctx = goesWithContext();
  const res = ctx && goesWithFor(ctx);
  if (!res?.g) { state.goesWith = null; return ''; }
  const { key, g } = res;
  const keyName = `${displayNote(NOTE_NAMES[key.tonic], state.useFlats, state.useSolfege)} ${key.mode}`;
  const rows = g.progressions.map((p, i) => uiRow({
    title: p.name, titleHtml: false,
    meta: p.chords.map((c, j) => (j === p.at ? `<strong>${escHtml(gwChordName(c))}</strong>` : escHtml(gwChordName(c)))).join(' – '),
    meta2: escHtml(p.degrees.join(' – ')),
    trail: `${uiIconBtn('play', `Play ${p.name}`, { action: 'gw-play', data: { i } })}
      <button type="button" class="btn btn-secondary btn-sm" data-action="gw-save" data-i="${i}">Save</button>`,
  })).join('');
  return uiSheet({
    help: uiHelp('goes-well-with', 'progressions'), key: 'goes-with', title: `Goes well with ${gwChordName(ctx.chord)}`, close: 'gw-close',
    body: `<p class="sheet-text">Well-known progressions in ${escHtml(keyName)}, the key of your ${escHtml(state.view === 'instrument' ? windWord(currentInstrument()) : layoutFamilyInfo(layoutInstrument(state.layout)).word)}, all playable on it. ▶ to hear one, Save to keep it as a playlist.</p>
      <div class="list gw-list">${rows}</div>`,
  });
}

// Plays a progression: each chord's notes one after another, as one-note
// instruments play chords.
function playGoesWith(chords) {
  initAudio();
  const seq = [];
  for (const c of chords) {
    const root = c.notes.find(n => notePC(n) === notePC(c.rootNote)) ?? c.notes[0];
    seq.push(...arpeggioOrder(c.notes, root).map(midiToNoteName));
  }
  playSequence(seq, () => {}, 0.28);
}

function goesWithAction(action, el) {
  if (action === 'gw-open') { state.goesWith = true; state.chordsUi.moreOpen = false; render(); return true; }
  if (!state.goesWith) return false;
  if (action === 'gw-close') { state.goesWith = null; render(); return true; }
  const ctx = goesWithContext();
  const p = ctx && goesWithFor(ctx).g?.progressions[parseInt(el.dataset.i, 10)];
  if (action === 'gw-play') { if (p) playGoesWith(p.chords); return true; }
  if (action === 'gw-save') {
    if (!p) return true;
    const steps = p.chords.map(c => newProgressionStep(playlistEntryFor(c, `gw-${c.id}`)));
    const name = `${p.name}: ${p.chords.map(gwChordName).join(' ')}`;
    const id = addProgression(name, steps);
    state.progressions = getProgressions();
    state.goesWith = null;
    logEvent('feature', { name: 'goes-with-save', family: measureFamily() });
    showToast(`Saved "${name}"`, { action: { label: 'Open', run: () => openProgression(id) } });
    render();
    return true;
  }
  return false;
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

// One chord in the list: its name, then its type and number of notes; the
// current one marked. No buttons: a tap picks and plays it, and everything
// done with a chord is on its card. One that is in a playlist shows a bookmark.
function chordRowHtml({ title, titleHtml = false, meta, action, data, current, saved = false }) {
  return uiRow({
    title, titleHtml, meta, action, data, cls: `chord-row${current ? ' is-current' : ''}`,
    trail: saved ? `<span class="chord-saved" title="In a playlist">${icon('bookmark')}<span class="sr-only">In a playlist</span></span>` : '',
  });
}
function chordNotesWord(n) { return `${n} note${n !== 1 ? 's' : ''}`; }

// All chords · Tap notes · Listen: the three ways to find a chord, the same
// switch on every instrument.
function chordModeSegHtml() {
  const mode = state.chordsUi.mode;
  const seg = uiSeg([{ value: 'browse', label: 'All chords' }, { value: 'identify', label: 'Tap notes' }, { value: 'listen', label: 'Listen' }],
    mode, { action: 'chords-mode', label: 'Find a chord' });
  const help = mode === 'identify' ? uiHelp('identify-a-chord', 'steps') : mode === 'listen' ? uiHelp('listen', 'steps') : uiHelp('chords', 'play');
  return `<div class="chord-mode-row">${seg}${help}</div>`;
}

// Main chords (chords.js mainChordsInKey): every Chords list shows the plain
// major and minor chords first, from the instrument's home note up, and the
// rest behind "Show all". Not while another filter, a root or a playlist
// narrows the list, and not when the instrument has no main chords at all.
function chordsMainOn(chords, narrowed) {
  return !state.chordsAll && !narrowed && chords.some(c => c.type.id === 'maj' || c.type.id === 'min');
}
function layoutPitchClasses(layout) { return new Set(getAllNotes(layout).map(notePC)); }
// The count under the filters, with the switch between main chords and all.
// With Filters (how many are on) at the end of the same line: the list head
// is this one line under the switch.
function chordListLineHtml({ shown, all, main, count }) {
  const n = (k, w) => `${k} ${w}${k !== 1 ? 's' : ''}`;
  const sw = main
    ? `<button type="button" class="link-btn" data-action="chords-scope">Show all ${all}</button>`
    : all > shown || !state.chordsAll ? '' : `<button type="button" class="link-btn" data-action="chords-scope">Main chords only</button>`;
  return `<div class="hp-list-line">
      <div class="hp-count">${main ? n(shown, 'main chord') : n(shown, 'chord')}${sw ? ` · ${sw}` : ''}</div>
      <button type="button" class="btn btn-secondary btn-sm hp-filter-btn" data-action="chords-filters-open" aria-haspopup="dialog">
        ${icon('sliders-horizontal')} Filters${count ? ` · ${count}` : ''}
      </button>
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

// The Filters sheet of every instrument's Chords: the note the chord starts
// on, how many notes, the type, then the instrument's own field (an
// ocarina's or flute's scale). roots: the chord roots this instrument has.
function chordFiltersSheet({ roots, extra = '' }) {
  const uf = state.useFlats, us = state.useSolfege;
  const { root, counts, category } = state.chordsUi;
  return uiSheet({ help: uiHelp('chords', 'filters'),
    key: 'chord-filters', title: 'Filters', close: 'chords-filters-close',
    body: `
    <div class="hp-sheet-form">
      <div class="field">
        <span class="field-label">Starts on</span>
        <div class="chips" role="group" aria-label="The note the chord starts on">
          ${roots.map(r => `<button type="button" class="chip" aria-pressed="${root === r ? 'true' : 'false'}"
            data-action="chords-root" data-root="${r}">${r === 'All' ? 'Any note' : escHtml(displayNote(r, uf, us))}</button>`).join('')}
        </div>
      </div>
      ${chordCountField(counts, 'chords-count')}
      ${chordTypeField(category, 'chords-category')}
      ${extra}
    </div>`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="chords-filters-clear" data-all="1">Clear all</button>
      <button type="button" class="btn btn-primary" data-action="chords-filters-close">Done</button>`,
  });
}

// ⋯ of the chord on top, the same sheet on every instrument: the
// instrument's own rows, the well-known progressions with this chord, then
// whatever else the instrument shows (related chords, octaves, the legend).
function chordMoreSheet({ variant = 'menu', title, rows = [], extra = '' }) {
  const all = [
    ...rows,
    goesWithHasProgressions() ? uiRow({ lead: 'list-ordered', title: 'Progressions with this chord', meta: 'Well-known ones, to hear and to save', chevron: true, action: 'gw-open' }) : '',
  ].join('');
  return uiSheet({ help: uiHelp('chords', 'more'), key: 'chord-more', variant, title, close: 'chords-more-close', body: `<div class="list">${all}</div>${extra}` });
}

// ── The Chords screen's state, the same on every instrument ───────────────
// What the Chords screen of the instrument on screen shows: Browse (All
// chords), Tap notes or Listen, its filters, and whether its Filters or More
// sheet is open. A new instrument starts with a fresh one.
function newChordsUi() {
  return { mode: 'browse', category: 'All', root: 'All', counts: new Set(), filtersOpen: false, moreOpen: false };
}
// Back to every chord type and root (the Chords tab opened again).
function clearChordFilters() { Object.assign(state.chordsUi, { category: 'All', root: 'All' }); }
// How many filters are on; extra: the instrument's own (an ocarina's scale).
function chordFilterCount(extra = 0) {
  const u = state.chordsUi;
  return (u.counts.size ? 1 : 0) + (u.category !== 'All' ? 1 : 0) + (u.root !== 'All' ? 1 : 0) + extra;
}

// ── Click: the Chords screen, every instrument ────────────────────────────
registerActions({
  'chords-filters-open': (el, e, action) => { state.chordsUi.filtersOpen = true; render(); return; },
  'chords-filters-close': (el, e, action) => { state.chordsUi.filtersOpen = false; render(); return; },
  'chords-more-open': (el, e, action) => { state.chordsUi.moreOpen = true; render(); return; },
  'chords-more-close': (el, e, action) => { state.chordsUi.moreOpen = false; render(); return; },
  'chords-root': (el, e, action) => { state.chordsUi.root = el.dataset.root; render(); return; },
  'chords-count': (el, e, action) => {
    const counts = state.chordsUi.counts;
    if (counts.has(el.dataset.count)) counts.delete(el.dataset.count); else counts.add(el.dataset.count);
    render();
    return;
  },
  'chords-filters-clear': (el, e, action) => {
    // The sheet's filters (an ocarina's scale too); the empty list's "Clear
    // filters" also clears the root.
    Object.assign(state.chordsUi, { category: 'All', counts: new Set() });
    if (state.view === 'instrument') state.oc.scaleFilter = 'All';
    if (el.dataset.all) state.chordsUi.root = 'All';
    render();
    return;
  },
  'chords-mode': (el, e, action) => {
    // From the All chords | Tap notes | Listen switch: only a change of mode counts.
    const ui = state.chordsUi;
    const want = el.dataset.value ?? (ui.mode === 'identify' ? 'browse' : 'identify');
    if (want === ui.mode) return;
    ui.mode = want;
    if (state.view === 'instrument') state.oc.idNotes = [];
    else { state.discoverNotes = []; state.selectedChord = null; }
    render();
    return;
  },
});
registerActions({
  'chords-category': (el, e, action) => { state.chordsUi.category = el.value; render(); },
}, CHANGE_ACTIONS);
