// The beginner setup and its guided rounds.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { NOTE_NAMES, createLayoutFromScale, displayNote, notePC, noteToMidi } from '../../data.js';
import { icon } from '../../icons.js';
import { findAllChords } from '../../chords.js';
import { heardNoteName, rankScalesByNotes } from '../../scalefinder.js';
import { a4ForOffset, chartSetupTunings, noteOnTuning, preferCommonChart, scaleFits, setupFirstChord, setupHeardEnough, setupKeyNote, setupMatch, setupRoots, setupScalesFor, setupTopScales, tuningOffsetCents } from '../../setup.js';
import { clearMicTakes } from '../../tuner.js';
import { chartDefaultKey, getChart, instrumentFromChart } from '../../charts.js';
import { isLayoutFamily, layoutFamilyInfo } from '../../layoutfamilies.js';
import { layoutFromCustomParams, linkFor, linkTitle, parseLink } from '../../links.js';
import { midiToNoteName } from '../../instruments.js';
import { initAudio, playChord, playScale, playSequence } from '../../audio.js';
import { renderPan, updatePanPlaying } from '../../pan.js';
import { renderFingering } from '../../ocarina-ui.js';
import { logEvent } from '../../auth.js';

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
  { family: 'recorder', name: 'Recorder', hint: 'Soprano (descant), alto (treble), tenor', picture: '/brand/instruments/recorder.webp' },
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
  recorder: {
    word: 'recorder', voice: 'recorder', first: 'lowest note: every hole covered, the thumb hole too', firstShort: 'the lowest note',
    each: 'note up the scale, lifting one finger at a time', thing: 'note', firstRoot: 0,
    knowTitle: 'Which size is it?', knowSub: 'A soprano (descant) and a tenor are in C, an alto (treble) and a sopranino in F. The school recorder is a soprano.',
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
  return { ...setupMatch(ranked, g ? { count: guideTotal(g), heard: notes.length } : {}), ranked };
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
    const rest = names.slice(1, guide.count);
    const under = names.slice(guide.count);
    const layout = layoutFromCustomParams(new URLSearchParams({
      ding: names[0] === 'null' ? 'D3' : names[0], top: rest.join(','), bottom: under.join(','), tc: String(rest.length), bc: String(under.length),
      ...(guide.centre ? { centre: '1' } : {}),
    }), family);
    if (guide.notes[0] == null) layout.top.ding = null;
    let svg = renderPan(layout, { highlightNotes: highlight, rotated: false, useFlats: state.useFlats });
    const id = guide.active === 0 ? 'ding' : guide.active >= guide.count ? `gu-${guide.active - guide.count}` : `ring-${guide.active - 1}`;
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
      return `<div class="setup-wind setup-wind-chord">${midis.map((m, i) => `<div class="setup-wind-step"><span class="setup-wind-step-n">${i + 1}</span>${renderFingering(inst, m, { size: 'medium', useFlats: state.useFlats, useSolfege: state.useSolfege, previousMidi: midis[i - 1] ?? null, closeUp: state.closeUp })}</div>`).join('')}</div>`;
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
// count: the notes on top (the ding or lowest note too); bottom: a handpan's
// notes underneath, places count … count + bottom − 1.
function newSetupGuide(family, count = SETUP_GUIDE_DEFAULT[family] ?? 9, centre = false, bottom = 0) {
  return { count, centre, bottom, notes: Array(count + bottom).fill(null), active: 0, order: null, msg: '', tone: '' };
}
function guideTotal(g) { return g.count + (g.bottom ?? 0); }
// A place by its number in the playing order (1 the lowest, then round).
function setupSlotLabel(family, i) {
  if (i === 0) return family === 'handpan' ? 'the ding' : 'the lowest note';
  const g = state.setup?.guide;
  if (g && i >= g.count) {
    const under = (g.order ?? []).filter(x => x >= g.count);
    return `the note underneath ${(under.length ? under.indexOf(i) : i - g.count) + 1}`;
  }
  const order = g?.order;
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
  const under = [...svg.querySelectorAll('[data-note-id^="gu-"]')].map(el => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2 - cx, y = r.top + r.height / 2 - cy;
    const a = Math.atan2(-x, y);
    return { i: g.count + parseInt(el.dataset.noteId.slice(3), 10), key: a < 0 ? a + 2 * Math.PI : a };
  });
  g.order = [0, ...places.sort((p, q) => p.key - q.key).map(p => p.i), ...under.sort((p, q) => p.key - q.key).map(p => p.i)];
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
  g.raw ??= Array(guideTotal(g)).fill(null);
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
    { name: '4 holes', hint: 'Small pendant, English system', group: ['ocarina-4-stl-c'] },
    { name: '6 holes', hint: 'Pendant, English system (4 on top, 2 thumbs)', group: ['ocarina-6-stl-c'] },
    { name: '7 holes', hint: 'Pendant', holes: 7, noChart: true },
    { name: '8 holes', hint: 'Pendant', holes: 8, noChart: true },
    { name: '10 holes', hint: 'Transverse, Italian (European) system · a generic chart, check it with the tuner', group: ['ocarina-10-eu-c'] },
    { name: '10 holes, Asian system', hint: 'The right thumb lifts before the left little finger · a generic chart, check it with the tuner', group: ['ocarina-10-as-c'] },
    { name: 'Another number, or made by hand', holes: 12 },
  ],
  flute: [
    { name: 'Tin whistle', hint: '6 holes, in D or C', group: ['tin-whistle-d', 'tin-whistle-c'] },
    { name: 'Tin whistle in another key', hint: 'B♭, E♭, A, low D', holes: 6, noChart: true },
    { name: 'Native American flute, 6 holes', hint: 'Any key', group: ['naf6-a', 'naf6-fs', 'naf6-penta'] },
    { name: 'Native American flute, 5 holes', hint: 'Any key', group: ['naf5-a', 'naf5-fs', 'naf5-penta'] },
    { name: 'Another flute', hint: 'A bansuri, a fife, one made by hand', holes: 6, noChart: true },
  ],
  // By fingering system: the charts differ from F up; sizes are the keys.
  // How to tell them apart is Yamaha's ("Baroque style and German style":
  // https://www.yamaha.com/en/musical_instrument_guide/recorder/selection/selection002.html).
  recorder: [
    { name: 'Baroque (English) fingering', hint: 'Most recorders, in every size. F is a forked fingering', group: ['recorder-baroque'] },
    { name: 'German fingering', hint: 'Some school sopranos. F is the next finger after E', group: ['recorder-german'] },
    { name: 'Another recorder', hint: 'A German alto or tenor, a bass, one in another pitch', holes: 8 },
  ],
};
const SETUP_WIND_STEPS = 7;
// The keys a type comes in, for "Do you know its key?": one entry per key
// note, the common ones first ({ root, variants: [{ chartId, keyId, name }] }),
// each with its sizes (a low, a usual and a high flute), the usual size
// first. A chart for that very key (a Native American flute in A) before the
// any-key one.
const SETUP_WIND_COMMON = { flute: ['A', 'G', 'F#', 'E', 'D', 'C'], ocarina: ['C', 'G', 'F'], recorder: ['C', 'F'] };
function setupWindKeys(group) {
  const byRoot = new Map();
  const family = getChart(group[0])?.family;
  group.forEach((id, order) => {
    const chart = getChart(id);
    if (!chart) return;
    const usual = noteToMidi(chart.keys.find(k => k.id === chartDefaultKey(chart)).lowest);
    for (const k of chart.keys) {
      const root = NOTE_NAMES[notePC(`${k.root ?? k.lowest.replace(/-?\d+$/, '')}4`)];
      const list = byRoot.get(root) ?? [];
      if (list.some(v => v.lowest === k.lowest)) continue;
      list.push({ chartId: id, keyId: k.id, name: k.name, lowest: k.lowest, dist: Math.abs(noteToMidi(k.lowest) - usual), order });
      byRoot.set(root, list);
    }
  });
  const common = SETUP_WIND_COMMON[family] ?? [];
  const rank = r => { const i = common.indexOf(r); return i < 0 ? 100 + NOTE_NAMES.indexOf(r) : i; };
  return [...byRoot.entries()]
    .map(([root, variants]) => ({ root, common: common.includes(root), variants: variants.sort((a, b) => a.dist - b.dist || a.order - b.order) }))
    .sort((a, b) => rank(a.root) - rank(b.root));
}
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
// A wind instrument blown softly, or tuned to A = 432, sounds a little flat
// (a Native American flute easily a quarter tone): every note after the
// lowest is taken relative to how the lowest one sounded (g.cents), and
// counts when it is within two thirds of a semitone of the note expected.
const SETUP_WIND_TOLERANCE = 0.67;
function setupWindOnNote(midi) {
  const st = state.setup;
  const g = st.windGuide;
  const m = g.idx === 0 ? Math.round(midi) : Math.round(midi - (g.cents ?? 0));
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
      Object.assign(g, { chartId: id, keyId: found.key.id, offset: found.offset, seq, idx: 1, cents: midi - m,
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
  if (Math.abs(midi - (g.cents ?? 0) - want) <= SETUP_WIND_TOLERANCE) {
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

// One `setup_screen` event each time a different setup screen comes up, so a
// funnel can show which screen people leave on (PostHog): screen is the step
// ('what', 'how', 'count', 'listen', 'match', 'know', 'scales', 'windtype',
// 'windkey', 'done'), from the one before, back when Back brought them there.
function setupScreenEvent(st) {
  if (st.loggedStep === st.step) return;
  logEvent('setup_screen', { screen: st.step, family: st.step === 'what' ? null : st.family, from: st.loggedStep ?? null, back: !!st.wentBack, first: homeIsEmpty() });
  st.loggedStep = st.step;
  st.wentBack = false;
}

function viewBeginnerSetup() {
  const st = state.setup ?? (state.setup = newSetup());
  setupScreenEvent(st);
  const first = homeIsEmpty();
  const header = st.step === 'what'
    ? (first ? uiAppBar({ title: 'Welcome', actions: [settingsAppBtn()] }) : backAppBar('Add instrument'))
    : uiAppBar({ title: st.step === 'done' ? 'Ready' : `Your ${setupWord(st)}`, back: { action: 'setup-back', label: 'Back' } });
  const word = setupWord(st);
  const fi = setupFamilyInfo(st.family);
  const tunings = setupTunings(st);
  const uf = state.useFlats, us = state.useSolfege;
  const nn = n => displayNote(n, uf, us);

  if (st.step === 'what') {
    return stepFrame({
      header, hero: first, title: 'What do you play?', sub: 'Tap your instrument. You can add more later.',
      body: `
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
      header, help: uiHelp('set-up-by-playing', 'before'), stage: 2, title: `Let’s find out which ${word} you have`,
      sub: `No need to know its ${fi.pick}. Play it to your phone and Oakhum works it out.`,
      body: `
        <ol class="setup-how">
          <li>Put your phone next to the ${word}, somewhere quiet.</li>
          <li>Play the <strong>${fi.first}</strong>. ${fi.sound}</li>
          <li>Then play each ${fi.each}, one by one. Any order is fine.</li>
        </ol>`,
      bar: {
        help: 'Oakhum only listens while this screen is open. The sound stays on your phone unless you choose to send it to us.',
        left: `<button type="button" class="btn btn-secondary" data-action="setup-know">${fi.knowBtn}</button>`,
        right: `<button type="button" class="btn btn-primary" data-action="setup-listen">${icon('mic')} Play my notes</button>`,
      },
    });
  }

  if (st.step === 'count') {
    const g = st.guide ?? (st.guide = newSetupGuide(st.family));
    const max = fi.maxNotes + 1;
    const what = st.family === 'handpan' ? 'Count the notes on top, the ding in the middle too. Then any underneath.'
      : st.family === 'kalimba' ? 'Count every key.' : 'Count every tongue, a round one in the middle too.';
    return stepFrame({
      header, help: uiHelp('set-up-by-playing', 'steps'), stage: 3, title: `How many notes does your ${word} have?`, sub: what,
      body: `
        <div class="setup-count">
          ${st.family === 'handpan'
            ? `<div class="list setup-count-rows">
                ${uiSetRow({ label: 'On top', help: 'The ding and the notes round it', control: uiStepper({ value: g.count, label: 'Notes on top', action: 'setup-count', min: g.count <= 3, max: g.count >= max }) })}
                ${uiSetRow({ label: 'Underneath', help: 'Notes on the bottom shell, if any', control: uiStepper({ value: g.bottom ?? 0, label: 'Notes underneath', action: 'setup-bottom', min: !g.bottom, max: (g.bottom ?? 0) >= 12 }) })}
              </div>`
            : uiStepper({ value: g.count, label: 'Notes', action: 'setup-count', min: g.count <= 3, max: g.count >= max })}
          ${st.family === 'tongue-drum' ? uiSwitchRow({ label: 'A round note in the middle', help: g.centre ? 'The lowest note is in the middle' : 'Every tongue is round the edge', on: g.centre, action: 'setup-centre' }) : ''}
        </div>
        ${setupPanHtml({ guide: g, family: st.family })}`,
      bar: {
        left: '<button type="button" class="btn btn-ghost" data-action="setup-listen-free">Not sure · play my notes</button>',
        right: `<button type="button" class="btn btn-primary" data-action="setup-guide-start">${icon('mic')} Start</button>`,
      },
    });
  }

  if (st.step === 'windtype') {
    return stepFrame({
      header, help: uiHelp('set-up-ocarina-or-flute'), stage: 2, title: `Which ${word} do you have?`, sub: 'Then its key: tell Oakhum, or play it a note.',
      body: `<div class="list">${(SETUP_WIND_TYPES[st.family] ?? []).map((t, i) => uiRow({ title: t.name, meta: escHtml(t.group ? (t.hint ?? '') : `${t.hint ? `${t.hint} · ` : ''}${t.noChart ? 'no published chart found yet: ' : ''}set up note by note with the tuner`.replace(/^s/, 'S')), chevron: true, action: 'setup-windtype', data: { i } })).join('')}</div>${st.family === 'ocarina' ? `<p class="wizard-foot">A double or triple ocarina (several chambers)? Their charts aren’t in Oakhum yet. <a class="link-btn" href="${SETUP_REQUEST_URL}">Ask for yours</a>.</p>` : ''}`,
      bar: { left: '<button type="button" class="btn btn-ghost" data-action="setup-listen-free">Not sure · play my notes</button>' },
    });
  }

  if (st.step === 'windkey') {
    const t = SETUP_WIND_TYPES[st.family]?.[st.windType];
    const keys = t?.group ? setupWindKeys(t.group) : [];
    const picked = st.windRoot ? keys.find(k => k.root === st.windRoot) : null;
    const rn = r => escHtml(displayNote(r, uf, us));
    return stepFrame({
      header, help: uiHelp('set-up-ocarina-or-flute', 'listen'), stage: 3, title: 'Do you know its key?',
      sub: `It’s usually written on the ${escHtml(word)} or its box. ${keys.length <= 2 ? '' : st.family === 'flute' ? 'A, G and F♯ are the most common.' : st.family === 'recorder' ? 'A soprano (descant) or tenor is in C, an alto (treble) or sopranino in F.' : 'C is the most common.'}`,
      body: `
        <div class="setup-roots setup-wind-roots">
          ${keys.map(k => `<button type="button" class="setup-root${picked === k ? ' is-first' : ''}" data-action="setup-wind-root" data-root="${escHtml(k.root)}" aria-pressed="${picked === k ? 'true' : 'false'}">${rn(k.root)}</button>`).join('')}
        </div>
        ${picked ? `<h2 class="list-title">Which ${rn(picked.root)} ${escHtml(word)}?</h2>
          <div class="list">${picked.variants.map((v, i) => uiRow({
            title: v.name, meta: i === 0 ? 'The usual size' : '', chevron: true,
            action: 'setup-wind-key', data: { chart: v.chartId, key: v.keyId },
          })).join('')}</div>` : ''}
        <p class="wizard-foot">Or <button type="button" class="link-btn" data-action="setup-listen-free">play it my own way</button>: any notes, any order, and Oakhum works it out.</p>`,
      bar: {
        right: `<button type="button" class="btn btn-primary" data-action="setup-wind-listen">${icon('mic')} I don’t know: play it</button>`,
      },
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
      header, help: uiHelp('set-up-by-playing', 'steps'), stage: 3,
      title: g.idx === 0 ? 'Cover every hole and blow gently' : `Now play ${windNoteName(want + g.offset)}`,
      sub: (g.idx === 0 ? `The lowest note${chart.holes.some(h => h.side === 'bottom') ? ', thumb holes covered too' : ''}. Oakhum works out the key from it.` : 'Open the holes shown open, keep the others covered. Tap a note above to play it again.')
        + (g.chartId.startsWith('naf6') ? ' On a 6-hole Native American flute the third hole from the top stays closed for this whole scale.' : ''),
      body: `${steps}
        <div class="setup-wind setup-wind-finger">${renderFingering(inst, want, { size: 'large', useFlats: state.useFlats, useSolfege: state.useSolfege, previousMidi: prev, closeUp: state.closeUp })}</div>
        ${g.msg ? `<p class="setup-guide-msg is-${g.tone}" aria-live="polite">${escHtml(g.msg)}</p>` : ''}
        ${status}${L.listening ? `<div class="listen-live" id="listen-live">${listenLiveHtml()}</div>` : ''}`,
      bar: {
        left: `<button type="button" class="btn btn-ghost" data-action="setup-know">Choose my key instead</button>`,
        right: L.listening
          ? (g.idx > 0 ? '<button type="button" class="btn btn-secondary" data-action="setup-wind-skip">Skip this note</button>' : '')
          : `<button type="button" class="btn btn-primary" data-action="setup-listen">${icon('mic')} Play again</button>`,
      },
    });
  }

  if (st.step === 'listen' && st.guide) {
    const L = state.listen?.where === 'setup' ? state.listen : { notes: [], listening: false };
    const g = st.guide;
    const filled = g.notes.filter(m => m != null).length;
    const label = setupSlotLabel(st.family, g.active);
    const status = L.error ? `<p class="setup-status is-danger">${escHtml(L.error)}</p>`
      : `<p class="setup-status" aria-live="polite">${L.listening ? '<span class="listen-dot" aria-hidden="true"></span>' : ''}${L.listening ? `${filled} of ${guideTotal(g)} · listening` : (L.stopped ? escHtml(L.stopped) : 'Stopped listening.')}</p>`;
    return stepFrame({
      header, help: uiHelp('set-up-by-playing', 'steps'), stage: 3,
      title: g.notes[g.active] != null ? `Play ${label} again` : `Play ${label}`,
      sub: `${fi.sound} The one to play is lit; tap another if you’re playing that one instead.`,
      body: `${setupPanHtml({ guide: g, family: st.family })}
        ${g.msg ? `<p class="setup-guide-msg is-${g.tone}" aria-live="polite">${escHtml(g.msg)}</p>` : ''}
        ${status}${L.listening ? `<div class="listen-live" id="listen-live">${listenLiveHtml()}</div>` : ''}`,
      bar: {
        left: `<button type="button" class="btn btn-ghost" data-action="setup-know">Choose my ${fi.pick} instead</button>`,
        right: L.listening || filled >= 3
          ? `<button type="button" class="btn btn-primary" data-action="setup-heard-done"${filled >= 3 ? '' : ' disabled'}>${filled >= guideTotal(g) ? 'Next' : 'That’s all my notes'}</button>`
          : `<button type="button" class="btn btn-primary" data-action="setup-listen">${icon('mic')} Play again</button>`,
      },
    });
  }

  if (st.step === 'listen') {
    const L = state.listen?.where === 'setup' ? state.listen : { notes: [], listening: false };
    const n = L.notes.length;
    const status = L.error ? `<p class="setup-status is-danger">${escHtml(L.error)}</p>`
      : `<p class="setup-status" aria-live="polite">${L.listening ? '<span class="listen-dot" aria-hidden="true"></span>' : ''}${L.listening ? `Listening · ${n} note${n !== 1 ? 's' : ''} heard` : (L.stopped ? escHtml(L.stopped) : 'Stopped listening.')}</p>`;
    return stepFrame({
      header, help: uiHelp('set-up-by-playing', 'steps'), stage: 3,
      title: n === 0 ? `Play ${fi.firstShort}` : 'Now the next note',
      sub: n === 0 ? fi.sound : `Heard ${escHtml(nn(heardNoteName(L.notes[n - 1])).replace(/-?\d+$/, ''))}. Keep going, any order. ${fi.next}`,
      body: `${setupPanHtml({ heard: L.notes, highlight: n ? [heardNoteName(L.notes[n - 1])] : [], family: st.family })}${status}${L.listening ? `<div class="listen-live" id="listen-live">${listenLiveHtml()}</div>` : ''}`,
      bar: {
        left: `<button type="button" class="btn btn-ghost" data-action="setup-know">Choose my ${fi.pick} instead</button>`,
        right: L.listening || n >= 3
          ? `<button type="button" class="btn btn-primary" data-action="setup-heard-done"${n >= 3 ? '' : ' disabled'}>That’s all my notes</button>`
          : `<button type="button" class="btn btn-primary" data-action="setup-listen">${icon('mic')} Play again</button>`,
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
        header, help: uiHelp('set-up-by-playing', 'wrong-note'), stage: 3, title: `We heard ${notes.length} notes`,
        body: `
          <div class="setup-result card">
            <p class="setup-result-lead">Your ${word}</p>
            <p class="setup-result-name">${escHtml([...notes].sort((a, b) => a - b).map(m => nn(midiToNoteName(m))).join(' '))}</p>
            <p class="setup-result-desc">None of the ${guideTotal(st.guide)}-note ${escHtml(word)}s Oakhum knows has exactly these notes, so it’ll use them as you played them. You can change any note later.</p>
            ${setupScaleFitHtml(st, notes)}
            ${st.tuningCents ? `<p class="setup-result-desc">Tuned to A = ${a4ForOffset(st.tuningCents)} Hz, not the usual 440: Oakhum names its notes on that tuning.</p>` : ''}
            ${setupPanHtml({ guide: { ...st.guide, active: -1 }, family: st.family })}
          </div>
          ${closeLinks ? `<p class="wizard-foot">Closest with ${guideTotal(st.guide)} notes: ${closeLinks}</p>` : ''}
          ${listenReportLinkHtml('Did Oakhum mishear a note?')}`,
        bar: {
          left: '<button type="button" class="btn btn-ghost" data-action="setup-not-right">Not quite, let me choose</button>',
          right: `<button type="button" class="btn btn-primary" data-action="setup-use-heard">Use my ${notes.length} notes</button>`,
        },
      });
    }
    if (!best) {
      return stepFrame({
        header, help: uiHelp('set-up-by-playing', 'wrong-note'), stage: 3, title: `We couldn’t tell which ${fi.pick} that is`,
        sub: `Try again in a quieter spot, ${fi.again}, or choose it yourself.`,
        body: `${notes.length >= 3 ? `<div class="list">${setupOwnRowHtml(st, notes.length)}</div>` : ''}${listenReportLinkHtml('Is something not right?')}`,
        bar: {
          left: `<button type="button" class="btn btn-secondary" data-action="setup-know">Choose my ${fi.pick}</button>`,
          right: `<button type="button" class="btn btn-primary" data-action="setup-listen">${icon('mic')} Play again</button>`,
        },
      });
    }
    const s = best.scale;
    const close = ranked.filter(r => r.ding !== 'none' && r.scale.family !== s.family && (!st.guide || r.total === guideTotal(st.guide))).slice(0, 2).map(r => `<button type="button" class="link-btn" data-action="setup-scale" data-id="${escHtml(r.scale.id)}">${escHtml(r.scale.name)}</button>`).join(', ');
    return stepFrame({
      header, help: uiHelp('set-up-by-playing', 'wrong-note'), stage: 3, title: `We heard ${notes.length} notes`,
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
      header, help: (fi.wind ? uiHelp('set-up-ocarina-or-flute') : uiHelp('set-up-by-scale', 'steps')), stage: 3, title: fi.knowTitle,
      sub: fi.knowSub,
      body: `
        <div class="setup-roots">
          ${roots.map((r, i) => `<button type="button" class="setup-root${i === 0 ? ' is-first' : ''}" data-action="setup-root" data-pc="${r.pc}">${escHtml(setupRootName(r.pc))}</button>`).join('')}
        </div>
        <p class="wizard-foot">Most ${word}s are in ${escHtml(setupRootName(roots[0]?.pc ?? 2))}, so it’s first. Not sure? <button type="button" class="link-btn" data-action="setup-listen">Play it to Oakhum</button>.</p>`,
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
      header, help: (fi.wind ? uiHelp('set-up-ocarina-or-flute') : uiHelp('set-up-by-scale', 'steps')), stage: 3, title: fi.wind ? `Which ${root} ${word}?` : `Which ${root} scale?`, sub: 'The most common ones first.',
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
  const chord = setupFirstChord(findAllChords(createLayoutFromScale(s)), setupKeyNote(s), { prefer: s.chartId && !s.chartId.startsWith('naf') ? 'maj' : 'min' });
  const chordName = chord ? `${displayNote(chord.rootName + '4', uf, us).replace(/-?\d+$/, '')} ${chord.type.name.toLowerCase()}` : '';
  return stepFrame({
    header, help: uiHelp('set-up-your-instrument', 'account'), stage: 4, title: fi.wind ? `Your ${s.name} is ready` : `Your ${s.name.replace(/ \(\d+\)$/, '')} ${word} is ready`,
    sub: chord ? (fi.wind ? `Start with this chord. Your ${word} plays one note at a time, so Oakhum shows the fingering of each note and plays them in turn.`
      : `Start with this chord. Oakhum lights its notes on your ${word}, and plays them for you.`) : '',
    body: `
      ${chord ? `<div class="setup-result card">
        <p class="setup-result-name">${escHtml(chordName)}</p>
        <p class="setup-result-notes">${chord.notes.map(x => escHtml(nn(x))).join(' · ')}</p>
        ${setupPanHtml({ scale: s, highlight: chord.notes, family: st.family })}
      </div>` : ''}
      ${st.windGuide ? listenReportLinkHtml('Did Oakhum mishear a note?') : ''}
      ${fi.wind && !st.windGuide && st.windType != null && SETUP_WIND_TYPES[st.family]?.[st.windType]?.group ? `<p class="wizard-foot">Want to be sure? <button type="button" class="link-btn" data-action="setup-wind-check">Check it by playing</button>: Oakhum shows each fingering and listens.</p>` : ''}`,
    bar: {
      left: `<button type="button" class="btn btn-secondary" data-action="setup-save">${accountOn() ? 'Save' : `Keep this ${escHtml(word)}`}</button>`,
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
    // An ocarina or flute: which type first, then its key (setupWindKeys).
    if (SETUP_WIND_TYPES[fam]) { setupGo('windtype', { family: fam, windType: null, windRoot: null }); return true; }
    if (isLayoutFamily(fam) || SETUP_WIND_WORDS[fam]) { setupGo('how', { family: fam }); return true; }
    return true;
  }
  if (action === 'setup-own-wind') {
    // An ocarina or flute that isn't one of the charts: set it up note by
    // note in the add-instrument wizard (its holes, then each fingering).
    stopListen();
    const fam = st.family;
    const w = newWizard(homeIsEmpty());
    // A recorder without a chart is charted like any other flute.
    const wfam = fam === 'recorder' ? 'flute' : fam;
    Object.assign(w, { families: [wfam], step: wfam, queue: [], history: [] });
    // From "Which ocarina?": straight to charting your own, its holes filled in.
    const holes = parseInt(el?.dataset?.holes ?? '', 10);
    if (fam === 'ocarina') Object.assign(w.oc, { path: 'have', chartId: 'custom', ...(holes ? { holeCount: holes } : {}) });
    if (wfam === 'flute' && holes) Object.assign(w.fl, { chartId: 'custom', holeCount: holes });
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
    st.guide = newSetupGuide(st.family, n, g.centre, g.bottom);
    render();
    return true;
  }
  if (action === 'setup-centre') { st.guide = newSetupGuide(st.family, st.guide.count, !st.guide.centre); render(); return true; }
  // A handpan's notes underneath (0 to 12, as the editor).
  if (action === 'setup-bottom') {
    const g = st.guide;
    const b = Math.max(0, Math.min(12, (g.bottom ?? 0) + parseInt(el.dataset.delta, 10)));
    st.guide = newSetupGuide(st.family, g.count, g.centre, b);
    render();
    return true;
  }
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
    // Do you know its key? One key only (a tin whistle in D): it's that.
    const keys = setupWindKeys(t.group);
    if (keys.length === 1 && keys[0].variants.length === 1) {
      const v = keys[0].variants[0];
      setupGo('done', { windType: parseInt(el.dataset.i, 10), scaleId: `chart:${v.chartId}/${v.keyId}`, windGuide: null });
      return true;
    }
    setupGo('windkey', { windType: parseInt(el.dataset.i, 10), windRoot: null });
    return true;
  }
  // Its key, known: a root, then (when it comes in more sizes) which one.
  if (action === 'setup-wind-root') {
    const t = SETUP_WIND_TYPES[st.family]?.[st.windType];
    const k = t && setupWindKeys(t.group).find(x => x.root === el.dataset.root);
    if (!k) return true;
    if (k.variants.length === 1) return setupAction('setup-wind-key', { dataset: { chart: k.variants[0].chartId, key: k.variants[0].keyId } });
    st.windRoot = k.root;
    render();
    return true;
  }
  if (action === 'setup-wind-key') {
    logEvent('setup', { step: 'scale', how: 'knew-key' });
    setupGo('done', { scaleId: `chart:${el.dataset.chart}/${el.dataset.key}`, windGuide: null });
    return true;
  }
  // Not known: Oakhum listens to the lowest note (and then checks the scale).
  if (action === 'setup-wind-listen' || action === 'setup-wind-check') {
    const t = SETUP_WIND_TYPES[st.family]?.[st.windType];
    if (!t?.group) return true;
    // Checking a key already chosen: only its chart.
    const chartId = action === 'setup-wind-check' ? /^chart:([^/]+)\//.exec(st.scaleId ?? '')?.[1] : null;
    st.windGuide = newWindGuide(chartId ? [chartId] : t.group);
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
    const places = (el.dataset.places ?? '').split(',').map(Number).filter(i => i >= 0 && i < guideTotal(g));
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
    st.guide = newSetupGuide(st.family, st.guide.count, st.guide.centre, st.guide.bottom);
    return setupAction('setup-listen', el);
  }
  if (action === 'setup-listen') {
    stopListen();
    state.listen = null;
    if (st.guide) st.guide = newSetupGuide(st.family, st.guide.count, st.guide.centre, st.guide.bottom);
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
      const name = m => (m == null ? 'null' : midiToNoteName(m));
      const rest = g.notes.slice(1, g.count).map(name);
      const under = g.notes.slice(g.count).map(name);
      params = new URLSearchParams({ ding: midiToNoteName(ding), top: rest.join(','), bottom: under.join(','), tc: String(rest.length), bc: String(under.length), name: `My ${layoutFamilyInfo(fam).word}`, ...(g.centre ? { centre: '1' } : {}) });
    } else {
      const heard = [...new Set(state.listen?.notes ?? [])].sort((a, b) => a - b).map(midiToNoteName);
      if (heard.length < 2) return true;
      // More than fit on top: the rest go underneath (a handpan's bottom notes).
      const max = layoutFamilyInfo(fam).maxNotes;
      const rest = heard.slice(1, 1 + max);
      const under = fam === 'handpan' ? heard.slice(1 + max, 1 + max + 12) : [];
      params = new URLSearchParams({ ding: heard[0], top: rest.join(','), bottom: under.join(','), tc: String(rest.length), bc: String(under.length), name: `My ${layoutFamilyInfo(fam).word}` });
    }
    stopListen();
    logEvent('setup', { step: 'scale', how: 'heard-notes' });
    state.setup = null;
    openLink(parseLink(`/${fam}/custom`, '?' + params));
    state.view = 'editor';
    // A handpan: next, where each note is on the real one.
    state.edArrange = fam === 'handpan';
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
    if (!prev) { logEvent('setup_screen', { screen: 'left', family: st.family, from: st.step, back: true, first: homeIsEmpty() }); goHome(); return true; }
    st.step = prev;
    st.wentBack = true;
    render();
    return true;
  }
  if (action === 'setup-first-chord' || action === 'setup-save') {
    const s = setupFindTuning(st, st.scaleId);
    if (!s) return true;
    logEvent('setup_finish', { family: st.family, how: action === 'setup-save' ? 'save' : 'play', listened: st.history.includes('listen') });
    const chord = setupFirstChord(findAllChords(createLayoutFromScale(s)), setupKeyNote(s), { prefer: s.chartId && !s.chartId.startsWith('naf') ? 'maj' : 'min' });
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
