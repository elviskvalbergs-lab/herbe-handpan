// The fingering diagram: one SVG component that draws every ocarina (and
// later flute) fingering in the app, at three sizes. See docs/ocarina-mode.md,
// "The fingering diagram".
//
// renderFingering() returns an SVG string, like renderPan() does. The helpers
// above it (fingeringFor, fingeringMoves, describeFingering) are pure and unit
// tested in Node.

import { displayNote, noteToMidi } from './data.js';
import { relativeHoleSizes, midiToHz } from './ocarina.js';
import { midiToNoteName } from './instruments.js';
import { usesHoleMap, holeSpot } from './builder.js';

export const FINGER_NAMES = {
  L1: 'left index', L2: 'left middle', L3: 'left ring', L4: 'left pinky', LT: 'left thumb',
  R1: 'right index', R2: 'right middle', R3: 'right ring', R4: 'right pinky', RT: 'right thumb',
};

// ── Pure helpers ─────────────────────────────────────────────────────────────

// Every note the instrument can play, ascending, with no duplicates.
export function playableMidis(inst) {
  const set = new Set();
  for (const ch of inst.chambers ?? []) for (const m of Object.keys(ch.fingerings)) set.add(Number(m));
  return [...set].sort((a, b) => a - b);
}

// The chamber and hole states for a note: { chamberIndex, chamber, states }
// or null if the instrument can't play it. Lowest chamber wins if several can.
export function fingeringFor(inst, midi) {
  const chambers = inst.chambers ?? [];
  for (let i = 0; i < chambers.length; i++) {
    const states = chambers[i].fingerings[midi];
    if (states) return { chamberIndex: i, chamber: chambers[i], states };
  }
  return null;
}

// What a hole is called in instructions: its finger, or "R2 sub-hole" for
// the small extra hole a finger covers by sliding forward.
function fgHoleName(h) { return h.sub ? `${h.finger} sub-hole` : h.finger; }

// Per finger (sub-holes separately), whether it is on a hole ('c' or 'h').
function fgFingersDown(chamber, states) {
  // Per finger: 'c' covered, 'h' half-covered, 'o' open (a finger with
  // several holes counts as its most covered one).
  const rank = { o: 0, h: 1, c: 2 };
  const down = {};
  chamber.holes.forEach((h, i) => {
    const k = fgHoleName(h);
    const st = states[i] === 'c' || states[i] === 'h' ? states[i] : 'o';
    if (!down[k] || rank[st] > rank[down[k]]) down[k] = st;
  });
  return down;
}

function fgJoinFingers(list) {
  if (list.length <= 1) return list.join('');
  return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
}

// What moves from one note to the next: fingers to lift and to cover, a
// sentence for under the diagram ("Lift R3 and R2", "Cover L1, lift R4"), and
// whether the player switches chamber. Fingers that stay put aren't listed.
export function fingeringMoves(inst, fromMidi, toMidi) {
  const a = fingeringFor(inst, fromMidi);
  const b = fingeringFor(inst, toMidi);
  if (!a || !b) return { lift: [], cover: [], switchChamber: false, text: '' };
  const before = fgFingersDown(a.chamber, a.states);
  const after = fgFingersDown(b.chamber, b.states);
  const fingers = Object.keys(after);
  const lift = fingers.filter(f => before[f] && before[f] !== 'o' && after[f] === 'o');
  const cover = fingers.filter(f => before[f] !== 'c' && after[f] === 'c');
  const half = fingers.filter(f => before[f] !== 'h' && after[f] === 'h');
  const switchChamber = a.chamberIndex !== b.chamberIndex;
  const parts = [];
  if (switchChamber) parts.push(`Blow chamber ${b.chamberIndex + 1}`);
  if (cover.length) parts.push(`cover ${fgJoinFingers(cover)}`);
  if (lift.length) parts.push(`lift ${fgJoinFingers(lift)}`);
  if (half.length) parts.push(`half-cover ${fgJoinFingers(half)}`);
  let text = parts.join(', ');
  text = text ? text[0].toUpperCase() + text.slice(1) : 'No change';
  return { lift, cover, half, switchChamber, text };
}

// Accessible label: "D4: R4 and R3 open, all others closed".
export function describeFingering(inst, midi, noteLabel = midiToNoteName(midi)) {
  const f = fingeringFor(inst, midi);
  if (!f) return `${noteLabel}: not on this instrument`;
  const open = [], half = [];
  f.chamber.holes.forEach((h, i) => {
    const k = fgHoleName(h);
    if (f.states[i] === 'o' && !open.includes(k)) open.push(k);
    if (f.states[i] === 'h' && !half.includes(k)) half.push(k);
  });
  const chamber = (inst.chambers.length > 1) ? ` (chamber ${f.chamberIndex + 1})` : '';
  const parts = [];
  if (open.length) parts.push(`${fgJoinFingers(open)} open`);
  if (half.length) parts.push(`${fgJoinFingers(half)} half-covered`);
  const blow = f.chamber.overblow?.includes(midi) ? ', blow harder' : '';
  if (!parts.length) return `${noteLabel}${chamber}: all holes closed${blow}`;
  const rest = (open.length + half.length) < new Set(f.chamber.holes.map(fgHoleName)).size ? ', all others closed' : '';
  return `${noteLabel}${chamber}: ${parts.join(', ')}${rest}${blow}`;
}

// Hole sizes relative to the largest hole of the chamber (1 = largest).
// Uses calibrated or measured sizes when stored, otherwise (if fromNotes)
// the proportions from the target notes, otherwise all the same.
export function relativeSizes(chamber, a4 = 440, { fromNotes = true } = {}) {
  if (chamber.holes.length && chamber.holes.every(h => h.rel > 0)) return chamber.holes.map(h => h.rel);
  const mm = chamber.holes.map(h => h.sizeMm);
  if (mm.every(x => x > 0)) {
    const max = Math.max(...mm);
    return mm.map(x => x / max);
  }
  if (fromNotes && chamber.notes?.length === chamber.holes.length + 1) {
    const [closed, ...rest] = chamber.notes;
    return relativeHoleSizes(midiToHz(closed, a4), rest.map(m => midiToHz(m, a4)));
  }
  return chamber.holes.map(() => 1);
}

// ── Chords ───────────────────────────────────────────────────────────────────

// The layout shape findAllChords() expects, from an ocarina's playable notes:
// lowest note as the "ding", the rest as ring notes. With a pitch-class set
// (a scale filter), only notes in it are kept.
export function ocarinaToLayout(inst, pcs = null) {
  const names = playableMidis(inst)
    .filter(m => !pcs || pcs.has(((m % 12) + 12) % 12))
    .map(midiToNoteName);
  return {
    id: 'oc:' + inst.id,
    name: inst.name,
    isCustom: true,
    top: { ding: names[0] ?? null, slots: names.slice(1).map(note => ({ note })), capacity: Math.max(0, names.length - 1) },
    bottom: { slots: [], capacity: 0 },
  };
}

// A chord's notes in arpeggio order: the root first, then upward, then the
// notes below the root (still ascending). Returns MIDI numbers.
export function arpeggioOrder(noteNames, rootNote) {
  const midis = noteNames.map(noteToMidi).sort((a, b) => a - b);
  const root = rootNote ? noteToMidi(rootNote) : midis[0];
  const rootIdx = Math.max(0, midis.indexOf(root));
  return [...midis.slice(rootIdx), ...midis.slice(0, rootIdx)];
}

// Fits a chord (note names, e.g. from a handpan scale) onto the instrument:
// each note as written if playable, else the nearest octave of the same
// pitch class that is. Returns { midis, missing } where missing lists the
// note names with no playable octave at all.
export function fitChordToInstrument(inst, noteNames) {
  const playable = playableMidis(inst);
  const midis = [], missing = [];
  for (const n of noteNames) {
    const m = noteToMidi(n);
    if (playable.includes(m)) { midis.push(m); continue; }
    const same = playable.filter(p => ((p - m) % 12 + 12) % 12 === 0 && !midis.includes(p));
    if (same.length) midis.push(same.sort((a, b) => Math.abs(a - m) - Math.abs(b - m))[0]);
    else missing.push(n);
  }
  return { midis: midis.sort((a, b) => a - b), missing };
}

// Voicing swap: moves chord note `midi` to the next higher octave of the same
// pitch class the instrument has (wrapping to the lowest), skipping octaves
// the chord already uses. Returns the new ascending MIDI list.
export function nextVoicing(inst, midis, midi) {
  const options = playableMidis(inst).filter(p => ((p - midi) % 12 + 12) % 12 === 0 && (p === midi || !midis.includes(p)));
  if (options.length < 2) return [...midis];
  const next = options[(options.indexOf(midi) + 1) % options.length];
  return midis.map(m => (m === midi ? next : m)).sort((a, b) => a - b);
}

// ── Geometry ─────────────────────────────────────────────────────────────────
// Diagram coordinates (viewBox units, 300 wide).
//
// Transverse ocarinas are traced from a published fingering chart (an alto C
// 12-hole chart the owner supplied): the body outline, the two thin lines
// on it, the windway (the beak at the lower left), and every hole's centre
// and size. The left hand's four holes run along the upper edge from the
// head; the right hand's four form the lower row towards the tail, where
// the right pinky covers a pair of small holes. Sub-holes are small holes
// beside a finger's main hole; thumb holes are drawn as dots outside the
// body (left thumb left of the head, right thumb below the belly), as
// printed charts do. Coordinates below are in the traced image's pixels;
// fgVesselPage() maps them onto the diagram.
//
// Multi-chamber ocarinas are traced from the owner's drawing of one: a
// single body, chamber 1 laid out like the transverse one, and each further
// chamber a row of holes below it, in the columns of the right-hand fingers
// that cover them.

const FG_W = 300;

const FG_OC_SINGLE = {
  s: 1.4, ox: 6, oy: 1,
  outline: [[33, 12], [48, 16], [69, 20], [85, 27], [97, 35], [109, 44], [123, 55], [150, 79], [166, 93],
    [182, 106], [204, 124], [212, 130], [214, 137], [207, 142], [200, 143], [179, 140], [167, 136], [147, 126],
    [132, 119], [116, 113], [89, 102], [75, 103], [40, 120], [35, 114], [28, 99], [38, 94], [49, 85], [51, 72],
    [46, 62], [38, 50], [29, 38], [24, 25], [26, 18]],
  lines: [[[34, 41], [50, 37], [62, 30], [72, 27]], [[50, 100], [64, 86], [79, 77], [96, 74], [110, 76]],
    [[186, 137], [192, 136], [198, 133]]],
  windway: [[40, 120], [28, 99]],
  holes: { L1: [67.8, 36.2, 7.5], L2: [84.1, 50.5, 9.2], L3: [104.2, 60.8, 8.5], L4: [125.3, 67.1, 8.5],
    R1: [108.8, 89.6, 8.6], R2: [134.3, 96.4, 6.2], R3: [157.4, 104.7, 8.1], R4: [177.2, 118.6, 5.2] },
  pair: { R4: [174.3, 130.7, 5.5] },          // where a finger's second hole goes
  sub: { R2: [139.3, 82.8, 4.6], L2: [90, 68, 4.6] },
  thumbs: { LT: [22.2, 71.3, 9.2], RT: [90, 128.3, 9.3] },
  maxSlot: 9.2,                                // largest traced hole radius
  top: 12, bottom: 143,
};

const FG_OC_MULTI = {
  s: 0.625, ox: 12, oy: -22,
  outline: [[46, 14], [134, 0], [178, 4], [228, 21], [464, 139], [472, 150], [470, 183], [465, 205], [461, 225],
    [451, 249], [442, 265], [430, 277], [403, 293], [382, 298], [294, 304], [241, 311], [203, 320], [132, 343],
    [79, 288], [56, 256], [33, 224], [24, 206], [45, 189], [76, 165], [88, 153], [97, 137], [94, 122],
    [82, 103], [30, 46], [28, 37], [32, 25], [39, 16]],
  lines: [],
  beak: [[36, 232], [124, 336]],               // the windways' end, one mark per chamber
  holes: { L1: [138.9, 41.6, 16.1], L2: [182.8, 68.1, 20.3], L3: [236.1, 76.5, 17.4], L4: [288.6, 76.5, 18.1],
    R1: [240.6, 129.1, 15.7], R2: [291.3, 118.2, 10.7], R3: [336.3, 124.8, 13.4], R4: [379.5, 133.6, 9.6] },
  sub: { R2: [312, 96, 7], L2: [205, 104, 7] },
  thumbs: { LT: [45.2, 106.7, 18.5], RT: [330, 330, 16] },
  // Further chambers: one row each, holes in these finger columns.
  rows: [181, 230, 278],
  col: { R1: [244.5, 14.6], R2: [289.5, 13.6], R3: [336, 10.6], R4: [379.5, 10.8],
    L4: [198, 13], L3: [152, 13], L2: [110, 12], L1: [72, 12] },
  maxSlot: 20.3,
  lastRow: 278, bottom: 343,
};

// Smooth closed (or open) path through points: Catmull-Rom as cubic Béziers.
function fgSmoothPath(pts, closed = true) {
  const n = pts.length;
  const at = i => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  const f = v => Math.round(v * 10) / 10;
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${f(c1[0])} ${f(c1[1])}, ${f(c2[0])} ${f(c2[1])}, ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? d + ' Z' : d;
}

const FG_PENDANT = {
  bodyH: 170,
  pos: {
    L1: [112, 58], L2: [96, 92], L3: [96, 126], L4: [112, 156],
    R1: [188, 58], R2: [204, 92], R3: [204, 126], R4: [188, 156],
  },
};
const FG_THUMB_X = { LT: 100, RT: 200 };
// Flutes, seen from above with the mouth end on the left, the holes in the
// order the chart lists them (mouth end first) and a gap between the hands.
//
// Native American flute, after the High Spirits Flutes booklet's drawings
// ("Functional Parts of the Flute", p.11, and the flute on p.24): mouth end,
// the long plain slow air chamber, the fetish (the carved block) tied on
// with leather over the sound hole, then the finger holes in the lower half
// towards the open foot end. Tin whistle: a tapered mouthpiece with its
// sound window, then a plain tube with six holes.
const FG_TUBE = { bodyH: 70, pos: {} };
const FG_TUBE_CY = 40;   // tube centre line within the chamber block
const FG_TUBE_R = 14;    // tube half-height

function fgFluteStyle(inst) {
  return String(inst.type ?? '').startsWith('tin-whistle') ? 'whistle' : 'naf';
}

function fgTubePositions(holes, y0, style = 'naf') {
  const top = holes.map((h, i) => ({ h, i })).filter(x => x.h.side !== 'bottom');
  // NAF: the holes end well before the foot, as on a real flute.
  const [from, to] = style === 'whistle' ? [118, 272] : [172, 262];
  const xs = {};
  const gap = 12;
  const n = top.length;
  const step = n > 1 ? (to - from - (top.some(x => x.h.finger.startsWith('R')) ? gap : 0)) / (n - 1) : 0;
  top.forEach((x, k) => {
    const handGap = x.h.finger.startsWith('R') && top.some(t => t.h.finger.startsWith('L')) ? gap : 0;
    xs[x.i] = [n === 1 ? (from + to) / 2 : from + k * step + handGap, y0 + FG_TUBE_CY];
  });
  return xs;
}

function fgFluteBody(style, y0, blown) {
  const cy = y0 + FG_TUBE_CY, r = FG_TUBE_R;
  const g = [];
  if (style === 'whistle') {
    // Body tube, then the mouthpiece over its end: tapered to the lip,
    // with the sound window (the opening with the cut edge) on top.
    g.push(`<rect class="fg-metal" x="86" y="${cy - r + 2}" width="${FG_W - 92}" height="${r * 2 - 4}" rx="3"/>`);
    g.push(`<path class="fg-metal-shine" d="M 96 ${cy - 5} L ${FG_W - 14} ${cy - 5}"/>`);
    g.push(`<path class="fg-head" d="M 8 ${cy - 6} Q 6 ${cy}, 8 ${cy + 6} L 64 ${cy + r + 1} L 94 ${cy + r + 1} L 94 ${cy - r - 1} L 64 ${cy - r - 1} Z"/>`);
    g.push(`<rect class="fg-bore" x="70" y="${cy - 5}" width="13" height="10" rx="1.5"/>`);
    g.push(`<path class="fg-mouth-lip ${blown ? 'fg-blow' : ''}" d="M 8 ${cy - 6} Q 6 ${cy}, 8 ${cy + 6}"/>`);
  } else {
    // Wooden tube with nearly square-cut ends (slightly rounded corners);
    // the blowing end is a little narrower, as on a real flute.
    const L = FG_W - 6, rr = r - 2;
    g.push(`<path class="fg-wood" d="M 8 ${cy - rr + 2} Q 8 ${cy - rr}, 12 ${cy - rr} L 40 ${cy - rr - 1} L ${L - 4} ${cy - rr - 1} Q ${L} ${cy - rr - 1}, ${L} ${cy - rr + 3} L ${L} ${cy + rr - 3} Q ${L} ${cy + rr + 1}, ${L - 4} ${cy + rr + 1} L 40 ${cy + rr + 1} L 12 ${cy + rr} Q 8 ${cy + rr}, 8 ${cy + rr - 2} Z"/>`);
    g.push(`<path class="fg-wood-grain" d="M 20 ${cy - 4} L ${L - 10} ${cy - 5} M 30 ${cy + 3} L ${L - 16} ${cy + 4}"/>`);
    g.push(`<path class="fg-mouth-lip ${blown ? 'fg-blow' : ''}" d="M 9 ${cy - rr + 3} L 9 ${cy + rr - 3}"/>`);
    g.push(`<ellipse class="fg-bore" cx="${L - 3}" cy="${cy}" rx="2" ry="${rr - 4}"/>`);
    // Fetish: an angular carved block tied on with two flat leather wraps;
    // the loose ends lie along the tube. The sound hole sits just in front.
    g.push(`<path class="fg-block" d="M 78 ${cy - 8} L 132 ${cy - 8} L 142 ${cy - 4} L 142 ${cy + 4} L 132 ${cy + 8} L 78 ${cy + 8} Z"/>`);
    g.push(`<rect class="fg-tie" x="90" y="${cy - rr - 2}" width="6" height="${rr * 2 + 4}" rx="1.5"/>`);
    g.push(`<rect class="fg-tie" x="120" y="${cy - rr - 2}" width="6" height="${rr * 2 + 4}" rx="1.5"/>`);
    g.push(`<path class="fg-tie-end" d="M 96 ${cy + rr + 1} L 112 ${cy + rr + 1} M 126 ${cy + rr + 1} L 140 ${cy + rr + 1}"/>`);
    g.push(`<rect class="fg-bore" x="150" y="${cy - 3}" width="6" height="6" rx="1"/>`);
  }
  return g.join('');
}
const FG_STRIP_H = 34;

// Round pendant body only for small single-chamber ocarinas (4 holes or
// fewer, like the English-system pendants); everything else is transverse.
function fgIsPendant(inst) {
  const chambers = inst.chambers ?? [];
  const holes = Math.max(0, ...chambers.map(c => c.holes.length));
  return chambers.length === 1 && holes <= 4;
}

// ── Render ───────────────────────────────────────────────────────────────────

function fgHoleShape(x, y, r, state, cls) {
  if (state === 'c') return `<circle class="fg-hole fg-c ${cls}" cx="${x}" cy="${y}" r="${r}"/>`;
  if (state === 'o') return `<circle class="fg-hole fg-o ${cls}" cx="${x}" cy="${y}" r="${r}"/>`;
  // Half: ring with the lower half filled.
  return `<g class="fg-hole fg-h ${cls}">
    <circle class="fg-o" cx="${x}" cy="${y}" r="${r}"/>
    <path class="fg-c" d="M ${x - r} ${y} A ${r} ${r} 0 0 0 ${x + r} ${y} Z"/>
  </g>`;
}

function fgArrow(x, y, r, dir) {
  // Up arrow above the hole for "lift", down arrow for "cover".
  const top = y - r - 16, bot = y - r - 4;
  const [tip, tail] = dir === 'up' ? [top, bot] : [bot, top];
  const head = dir === 'up' ? tip + 5 : tip - 5;
  return `<g class="fg-arrow fg-arrow-${dir}">
    <line x1="${x}" y1="${tail}" x2="${x}" y2="${tip}"/>
    <polyline points="${x - 4},${head} ${x},${tip} ${x + 4},${head}"/>
  </g>`;
}

// renderFingering(instrument, midi, { size, previousMidi, showFingers, showSizes, useFlats, useSolfege, blowBoth })
//   size: 'large' | 'medium' | 'mini'
//   previousMidi: note played before, to mark the holes that change
//   blowBoth: a second MIDI note, on another chamber, for two-note harmony
export function renderFingering(inst, midi, opts = {}) {
  const {
    size = 'medium', previousMidi = null, showFingers = false, showSizes = false,
    useFlats = false, useSolfege = false, blowBoth = null, a4 = 440, nextMidi = null, editable = false,
    noteLabel = true,
  } = opts;
  const tube = inst.family === 'flute';
  const pendant = !tube && fgIsPendant(inst);
  const chambers = inst.chambers ?? [];
  const main = fingeringFor(inst, midi);
  const second = blowBoth != null ? fingeringFor(inst, blowBoth) : null;
  // Arrows show either how this note was reached (previousMidi) or, in
  // practice mode, what to change next (nextMidi).
  const moves = nextMidi != null && nextMidi !== midi ? fingeringMoves(inst, midi, nextMidi)
    : previousMidi != null && previousMidi !== midi ? fingeringMoves(inst, previousMidi, midi) : null;
  const label = displayNote(midiToNoteName(midi), useFlats, useSolfege);
  const aria = describeFingering(inst, midi, label);
  const labelH = !noteLabel ? 6 : size === 'mini' ? 26 : 30;
  const ctx = { inst, chambers, main, second, moves, size, showFingers, showSizes, a4, editable };

  const { parts, bodyBottom } = usesHoleMap(inst) && chambers.length === 1 ? fgPhotoParts(ctx)
    : (tube || pendant) ? fgFlatParts(ctx, tube) : fgVesselParts(ctx);
  const H = bodyBottom + labelH;
  const noteY = bodyBottom + (size === 'mini' ? 14 : 16);
  const overblow = main && main.chamber.overblow?.includes(midi);
  if (noteLabel) parts.push(`<text class="fg-note" x="${FG_W / 2}" y="${noteY}">${main ? label : label + ' ✕'}${overblow ? '<tspan class="fg-overblow" dx="6">↑ blow harder</tspan>' : ''}</text>`);

  return `<svg class="fingering fingering-${size}${tube ? ' is-flute' : ''}" viewBox="0 0 ${FG_W} ${Math.round(H)}" role="img"
    aria-label="${aria.replace(/"/g, '&quot;')}" data-midi="${midi}">${parts.join('')}</svg>`;
}

// One hole with its state, change mark, arrow, finger label and size.
function fgHoleParts(g, opts) {
  const start = g.length;
  fgHolePartsInner(g, opts);
  // Editing a fingering: each hole is a tap target that cycles its state.
  if (opts.editable) {
    const inner = g.splice(start).join('');
    g.push(`<g class="fg-edit-hole" data-action="fg-edit-hole" data-index="${opts.index}"><circle class="fg-edit-target" cx="${opts.x}" cy="${opts.y}" r="${Math.max(opts.r + 4, 14)}"/>${inner}</g>`);
  }
}

function fgHolePartsInner(g, { x, y, r, state, hole, moves, changedOk, size, showFingers, showSizes, labelled, wood = false, photo = false }) {
  const hk = fgHoleName(hole);
  const changed = moves && changedOk && (moves.lift.includes(hk) || moves.cover.includes(hk) || moves.half?.includes(hk));
  g.push(fgHoleShape(x, y, r, state, `${changed ? 'fg-changed' : ''}${wood ? ' fg-on-wood' : ''}${photo ? ' fg-on-photo' : ''}`));
  if (changed && size !== 'mini' && labelled) g.push(fgArrow(x, y, r, moves.lift.includes(hk) ? 'up' : 'down'));
  if (showFingers && size !== 'mini' && labelled) {
    // Small flute holes can't hold a label: it goes under the hole.
    g.push(photo
      ? `<text class="fg-finger-photo" x="${x}" y="${y + r + 10}">${hole.finger}</text>`
      : wood
      ? `<text class="fg-finger-below" x="${x}" y="${y + r + 11}">${hole.sub ? '' : hole.finger}</text>`
      : `<text class="fg-finger ${state === 'c' ? 'on-dark' : ''}" x="${x}" y="${y}">${hole.sub ? '' : hole.finger}</text>`);
  }
  if (showSizes && size !== 'mini' && hole.sizeMm > 0) {
    g.push(`<text class="fg-size" x="${x}" y="${y + r + 9}">${hole.sizeMm.toFixed(1)}</text>`);
  }
}

// Which chamber is blown, and its hole states (all covered when not blown).
function fgChamberState(ctx, ci) {
  const { main, second } = ctx;
  const f = main?.chamberIndex === ci ? main : second?.chamberIndex === ci ? second : null;
  return { blown: !!f, f, states: f ? f.states : ctx.chambers[ci].holes.map(() => 'c') };
}

// Transverse ocarinas, one chamber or several, from the traced geometry.
function fgVesselParts(ctx) {
  const { chambers, size, inst } = ctx;
  const multi = chambers.length > 1;
  const G = multi ? FG_OC_MULTI : FG_OC_SINGLE;
  // Multi: the traced drawing has 4 chambers. With fewer, the rows stay
  // where they are and only the body below the last row used is pulled up,
  // keeping the same depth of body under it as the drawing has.
  const lastRow = multi ? G.rows[Math.min(chambers.length, 4) - 2] : 0;
  const k = multi ? (G.bottom - G.lastRow) / (G.bottom - lastRow) : 1;
  const fy = y => (multi && y > lastRow ? lastRow + (y - lastRow) * k : y);
  const pageX = x => (x - G.ox) * G.s;
  const pageY = y => (fy(y) - G.oy) * G.s;
  const pt = ([x, y]) => [pageX(x), pageY(y)];
  const parts = [];

  parts.push(`<path class="fg-body" d="${fgSmoothPath(G.outline.map(pt))}"/>`);
  for (const line of G.lines) parts.push(`<path class="fg-line" d="${fgSmoothPath(line.map(pt), false)}"/>`);

  // Windways: the beak's end, one mark per chamber, red where to blow.
  const blownIdx = chambers.map((_, ci) => fgChamberState(ctx, ci).blown);
  if (!multi) {
    const [p, q] = G.windway.map(pt);
    parts.push(`<path class="fg-windway ${blownIdx[0] ? 'fg-blow' : ''}" d="M ${p[0]} ${p[1]} L ${q[0]} ${q[1]}"/>`);
  } else {
    const [p, q] = G.beak.map(pt);
    const n = chambers.length;
    for (let i = 0; i < n; i++) {
      const t0 = (i + 0.15) / n, t1 = (i + 0.85) / n;
      const a = [p[0] + (q[0] - p[0]) * t0, p[1] + (q[1] - p[1]) * t0];
      const b = [p[0] + (q[0] - p[0]) * t1, p[1] + (q[1] - p[1]) * t1];
      parts.push(`<path class="fg-windway ${blownIdx[i] ? 'fg-blow' : ''}" d="M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}"/>`);
    }
  }
  const blowing = blownIdx.map((b, i) => (b ? i : -1)).filter(i => i >= 0);
  if (blowing.length && multi && size !== 'mini') {
    const text = blowing.length > 1 ? 'blow both' : `blow ${blowing[0] + 1}`;
    const [bx, by] = pt(G.beak[1]);
    parts.push(`<text class="fg-blow-label" x="${bx + 8}" y="${by + 4}">${text}</text>`);
  }

  chambers.forEach((ch, ci) => {
    const { blown, f, states } = fgChamberState(ctx, ci);
    const rel = relativeSizes(ch, ctx.a4, { fromNotes: inst.kind === 'scale' });
    const sized = inst.kind === 'scale' || ch.holes.some(h => h.rel > 0 || h.sizeMm > 0);
    const g = [];
    const seen = {};
    if (multi && ci > 0 && size !== 'mini') {
      g.push(`<text class="fg-row-label" x="${pageX(424)}" y="${pageY(G.rows[Math.min(ci, 3) - 1])}">${ci + 1}</text>`);
    }
    ch.holes.forEach((h, i) => {
      const nth = h.sub ? 0 : (seen[h.finger] = (seen[h.finger] ?? -1) + 1);
      const group = ch.holes.filter(x => x.finger === h.finger && !x.sub && x.side === h.side);
      let x, y, slot;
      if (h.side === 'bottom') {
        [x, y, slot] = G.thumbs[h.finger] ?? G.thumbs.LT;
      } else if (h.sub) {
        [x, y, slot] = G.sub[h.finger] ?? (() => { const m = G.holes[h.finger] ?? G.holes.R1; return [m[0] + m[2] * 1.4, m[1] + m[2] * 1.2, m[2] * 0.5]; })();
      } else if (multi && ci > 0) {
        const c = G.col[h.finger] ?? G.col.R1;
        [x, y, slot] = [c[0], G.rows[Math.min(ci, 3) - 1], c[1]];
      } else {
        [x, y, slot] = G.holes[h.finger] ?? G.holes.R1;
      }
      // A finger with several holes (a hole split because it was too big, or
      // the pinky's pair on a chart): the traced pair spot if there is one,
      // else a small cluster around the finger's place.
      if (!h.sub && group.length > 1 && nth > 0) {
        const pair = !multi && ci === 0 ? G.pair?.[h.finger] : null;
        if (pair && nth === 1) [x, y, slot] = pair;
        else { x += nth * slot * 1.3; y += nth * slot * 0.6; }
      }
      let r = slot;
      if (sized) r = Math.max(2.5, Math.min(slot * 1.35, G.maxSlot * (rel[i] ?? 1) / Math.sqrt(group.length || 1)));
      fgHoleParts(g, {
        x: pageX(x), y: pageY(y), r: r * G.s, state: states[i], hole: h, index: i, editable: ctx.editable,
        moves: ctx.moves, changedOk: !!f, size, showFingers: ctx.showFingers, showSizes: ctx.showSizes,
        labelled: nth === 0,
      });
    });
    parts.push(`<g class="fg-chamber ${blown ? '' : 'fg-dim'}">${g.join('')}</g>`);
  });

  const bottom = pageY(G.bottom);
  return { parts, bodyBottom: bottom + 6 };
}

// A bought ocarina drawn on its own photo: each hole where it was marked,
// sized from its calibration, thumb holes in a strip underneath.
function fgPhotoParts(ctx) {
  const { chambers, size, inst } = ctx;
  const ch = chambers[0];
  const aspect = inst.photo?.aspect ?? 1.6;
  const pad = 14;
  let w = FG_W - 2 * pad, h = w / aspect;
  if (h > 230) { h = 230; w = h * aspect; }
  const x0 = (FG_W - w) / 2, y0 = pad;
  const hasThumbs = ch.holes.some(hh => hh.side === 'bottom');
  const { f, states } = fgChamberState(ctx, 0);
  const rel = relativeSizes(ch, ctx.a4, { fromNotes: false });
  const g = [];
  g.push(inst.photo?.src
    ? `<image class="fg-photo" href="${inst.photo.src}" x="${x0}" y="${y0}" width="${w}" height="${h}" preserveAspectRatio="none"/>`
      + `<rect class="fg-photo-frame" x="${x0}" y="${y0}" width="${w}" height="${h}" rx="8"/>`
    : `<rect class="fg-body" x="${x0}" y="${y0}" width="${w}" height="${h}" rx="24"/>`);
  const sy = y0 + h + 8;
  if (hasThumbs) {
    g.push(`<rect class="fg-strip" x="60" y="${sy}" width="${FG_W - 120}" height="${FG_STRIP_H - 6}" rx="6"/>`);
    if (size === 'large') g.push(`<text class="fg-strip-label" x="${FG_W / 2}" y="${sy + FG_STRIP_H / 2 - 2}">underside</text>`);
  }
  const under = ch.holes.filter(hh => hh.side === 'bottom');
  ch.holes.forEach((hole, i) => {
    let x, y;
    const spot = holeSpot(inst, i);
    if (hole.side === 'bottom' || !spot) {
      const k = under.indexOf(hole);
      x = FG_THUMB_X[hole.finger] ?? (FG_W / 2 + (k - (under.length - 1) / 2) * 40);
      y = sy + (FG_STRIP_H - 6) / 2;
    } else {
      x = x0 + spot.x * w;
      y = y0 + spot.y * h;
    }
    // Sizes from the calibration; a chart's holes have none: sub-holes small.
    const r = hole.rel > 0 ? Math.max(6, 13 * rel[i]) : hole.sub ? 6 : 10;
    fgHoleParts(g, { x, y, r, state: states[i], hole, index: i, editable: ctx.editable, moves: ctx.moves, changedOk: !!f, size, photo: hole.side !== 'bottom' && !!spot,
      showFingers: ctx.showFingers, showSizes: ctx.showSizes, labelled: true });
  });
  return { parts: [`<g class="fg-chamber">${g.join('')}</g>`], bodyBottom: sy + (hasThumbs ? FG_STRIP_H : 0) };
}

// Pendants and flutes (tube): the simpler flat layouts.
function fgFlatParts(ctx, tube) {
  const { chambers, size, inst } = ctx;
  const geo = tube ? FG_TUBE : FG_PENDANT;
  const hasThumbs = chambers.some(c => c.holes.some(h => h.side === 'bottom'));
  const pad = 22;
  const chamberH = geo.bodyH + (hasThumbs ? FG_STRIP_H : 0) + 14;
  const parts = [];
  chambers.forEach((ch, ci) => {
    const y0 = pad + ci * chamberH;
    const { blown, f, states } = fgChamberState(ctx, ci);
    const rel = relativeSizes(ch, ctx.a4, { fromNotes: inst.kind === 'scale' });
    const g = [];
    const style = tube ? fgFluteStyle(inst) : null;
    const tubeXY = tube ? fgTubePositions(ch.holes, y0, style) : null;
    if (tube) {
      g.push(fgFluteBody(style, y0, blown));
    } else {
      g.push(`<ellipse class="fg-body" cx="${FG_W / 2}" cy="${y0 + geo.bodyH / 2}" rx="${FG_W / 2 - 60}" ry="${geo.bodyH / 2}"/>`);
      g.push(`<rect class="fg-mouth ${blown ? 'fg-blow' : ''}" x="${FG_W / 2 - 13}" y="${y0 - 4}" width="26" height="18" rx="4"/>`);
    }
    if (hasThumbs) {
      const sy = y0 + geo.bodyH + 6;
      g.push(`<rect class="fg-strip" x="60" y="${sy}" width="${FG_W - 120}" height="${FG_STRIP_H - 6}" rx="6"/>`);
      if (size === 'large') g.push(`<text class="fg-strip-label" x="${FG_W / 2}" y="${sy + FG_STRIP_H / 2 - 2}">underside</text>`);
    }
    const seen = {};
    ch.holes.forEach((h, i) => {
      const nth = h.sub ? 0 : (seen[h.finger] = (seen[h.finger] ?? -1) + 1);
      const sameFinger = ch.holes.filter(x => x.finger === h.finger && !x.sub);
      const split = !h.sub && sameFinger.length > 1;
      let x, y;
      if (h.side === 'bottom') { x = FG_THUMB_X[h.finger] ?? FG_W / 2; y = y0 + geo.bodyH + 6 + (FG_STRIP_H - 6) / 2; }
      else if (tube) [x, y] = tubeXY[i];
      else { [x, y] = geo.pos[h.finger] ?? [FG_W / 2, geo.bodyH / 2]; y += y0; }
      if (h.x != null && h.y != null) { x = h.x; y = y0 + h.y; }
      if (split) y += (sameFinger.indexOf(h) - (sameFinger.length - 1) / 2) * (16 / Math.max(1, sameFinger.length - 1));
      if (h.sub) { x += 13; y += 15; }
      const r0 = Math.max(4, (split ? 18 / sameFinger.length : 13) * rel[i] * (h.sub && !(h.rel > 0) ? 0.5 : 1));
      // Flute holes sit inside the tube's width.
      // On a real flute the finger holes are about a third of the tube's width.
      const r = tube ? Math.min(r0, 5.5) : r0;
      fgHoleParts(g, { x, y, r, state: states[i], hole: h, index: i, editable: ctx.editable, moves: ctx.moves, changedOk: !!f, size, wood: tube,
        showFingers: ctx.showFingers, showSizes: ctx.showSizes, labelled: nth === 0 });
    });
    parts.push(`<g class="fg-chamber ${blown ? '' : 'fg-dim'}">${g.join('')}</g>`);
  });
  return { parts, bodyBottom: pad + chambers.length * chamberH };
}

// Two hands as the player holds the instrument, each finger named.
//
// The hand is traced from the owner's own reference picture (the back of a
// right hand, fingers up, nails showing): its outline and the five nails.
// The left hand is the same drawing mirrored, so both thumbs face the
// middle. Coordinates are in the traced 1116 × 1183 frame.
const HAND_PATH = 'M776 1179C777 1177 777 1171 778 1165C780 1146 785 1123 791 1107C795 1092 796 1091 811 1062C818 1047 824 1033 825 1031C826 1029 829 1019 833 1010C848 968 877 851 882 810C883 804 885 794 886 788C887 782 888 773 888 769C889 762 894 744 899 731C906 711 919 688 941 655C947 646 954 636 955 634C957 631 961 626 963 623C967 617 977 601 988 583C996 568 1005 554 1017 536C1023 527 1031 516 1033 512C1036 508 1043 498 1048 490C1053 482 1060 471 1063 467C1067 462 1071 456 1073 453C1075 450 1079 445 1081 442C1097 420 1110 398 1114 388C1116 380 1116 364 1113 358C1102 333 1072 323 1048 336C1032 345 1021 358 990 404C986 410 977 422 970 432C963 442 953 458 946 467C929 492 921 504 908 521C893 540 889 546 871 574C837 626 822 636 804 622C794 614 793 600 801 569C803 561 806 549 808 541C810 534 814 521 816 513C830 470 829 472 834 451C836 444 838 433 839 429C842 406 849 366 857 333C859 323 862 309 863 302C866 290 869 277 875 253C876 248 878 239 879 233C881 227 884 214 886 205C893 181 897 161 898 152C900 123 878 99 847 99C822 99 805 112 794 140C789 151 789 150 780 185C778 190 775 200 773 209C767 227 762 245 756 267C750 292 741 325 739 333C736 345 730 365 723 384C717 401 715 411 712 433C708 458 706 466 695 515C689 541 689 541 685 544C681 546 677 545 672 541C669 539 669 539 669 531C669 511 673 456 677 422C678 415 680 390 682 355C682 350 681 337 681 325C679 305 678 245 679 242C680 241 681 232 682 221C682 211 684 198 685 192C685 186 687 175 688 166C689 157 691 141 693 129C702 66 703 62 701 51C697 18 660 0 626 14C611 21 597 39 592 61C592 65 590 75 588 85C586 94 584 103 583 105C579 121 573 157 570 191C569 197 568 205 568 209C567 212 565 221 564 227C560 263 554 296 550 318C545 345 544 373 547 427C550 481 550 485 549 506C548 524 548 525 545 529C539 539 527 539 516 528C512 524 510 516 505 489C502 470 498 453 496 440C492 426 491 419 489 408C487 396 486 391 481 375C479 368 477 361 476 357C475 354 473 347 472 341C464 311 458 286 455 273C453 265 451 255 450 250C445 229 443 211 441 181C440 170 439 159 438 157C438 155 438 148 437 141C435 120 429 104 421 95C409 84 399 79 384 80C357 82 339 100 332 130C331 137 331 144 331 174C331 209 331 216 335 251C336 256 336 264 337 269C337 273 339 288 341 300C343 312 344 329 345 337C349 393 350 403 362 449C373 497 383 536 387 559C390 571 390 584 390 615C390 634 390 653 390 659C390 676 384 705 377 723C362 757 364 754 346 770C341 775 331 778 320 778C309 778 303 776 293 770C278 760 272 755 249 733C216 700 216 700 173 670C134 642 65 631 31 647C12 656 1 672 1 690C0 704 5 710 23 718C69 738 99 758 120 781C127 789 139 799 147 802C153 806 188 842 201 859C202 861 207 867 212 874C223 888 230 899 243 923C251 937 262 950 285 969C297 979 322 1004 332 1014C360 1046 376 1064 379 1067C380 1069 383 1073 386 1077C407 1102 422 1133 432 1167C434 1176 435 1177 436 1177C442 1176 470 1172 481 1171C488 1170 496 1170 499 1169C543 1166 657 1166 697 1170C721 1172 757 1178 768 1181C772 1182 775 1183 775 1183C776 1183 776 1181 776 1179Z';
const HAND_W = 1116, HAND_H = 1183;
// Right hand as drawn: [x, y, rx, ry, tilt°] for each nail, and the
// fingertip each label sits next to.
const HAND_NAILS = { 1: [384, 130, 36, 40, 0], 2: [651, 68, 40, 43, 0], 3: [846, 155, 37, 41, 0],
  4: [1078, 379, 32, 36, 25], T: [52, 700, 41, 32, -15] };
const HAND_TIPS = { 1: [382, 83], 2: [642, 20], 3: [842, 105], 4: [1087, 335], T: [70, 655] };

export function renderHandLegend() {
  // Backs of the hands, fingers up, as you look down at them on the
  // instrument: L4 … L1 left to right, then R1 … R4, thumbs facing the
  // middle. Labels sit above the fingertips and thumbs, the hand
  // names under the wrists.
  const k = 0.3, top = 40, gap = 100, side0 = 20;
  const w = HAND_W * k, h = HAND_H * k;
  const hand = (side, ox) => {
    const mirror = side === 'L';
    const px = x => ox + (mirror ? HAND_W - x : x) * k;
    const py = y => top + y * k;
    const t = `translate(${mirror ? ox + w : ox} ${top}) scale(${mirror ? -k : k} ${k})`;
    const nails = Object.values(HAND_NAILS).map(([x, y, rx, ry, a]) =>
      `<ellipse class="hand-nail" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${a} ${x} ${y})"/>`).join('');
    const labels = Object.entries(HAND_TIPS).map(([f, [x, y]]) => {
      return `<text class="hand-label" x="${px(x)}" y="${py(y) - 22}">${side}${f}</text>`;
    }).join('');
    return `<g transform="${t}"><path class="hand-skin" d="${HAND_PATH}"/>${nails}</g>${labels}
      <text class="hand-name" x="${ox + w / 2}" y="${top + h + 34}">${side === 'L' ? 'Left hand' : 'Right hand'}</text>`;
  };
  const W = 2 * w + gap + 2 * side0, H = top + h + 50;
  return `<svg class="hand-legend" viewBox="0 0 ${Math.round(W)} ${Math.round(H)}" role="img"
    aria-label="Finger names, backs of the hands with the fingers up: L1 to L4 are the left index to pinky, R1 to R4 the right index to pinky, LT and RT the thumbs">
    ${hand('L', side0)}${hand('R', side0 + w + gap)}</svg>`;
}
