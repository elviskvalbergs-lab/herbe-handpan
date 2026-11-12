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
  const down = {};
  chamber.holes.forEach((h, i) => {
    const k = fgHoleName(h);
    down[k] = (down[k] ?? false) || states[i] !== 'o';
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
  const lift = fingers.filter(f => before[f] === true && after[f] === false);
  const cover = fingers.filter(f => before[f] !== true && after[f] === true);
  const switchChamber = a.chamberIndex !== b.chamberIndex;
  const parts = [];
  if (switchChamber) parts.push(`Blow chamber ${b.chamberIndex + 1}`);
  if (cover.length) parts.push(`cover ${fgJoinFingers(cover)}`);
  if (lift.length) parts.push(`lift ${fgJoinFingers(lift)}`);
  let text = parts.join(', ');
  text = text ? text[0].toUpperCase() + text.slice(1) : 'No change';
  return { lift, cover, switchChamber, text };
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
  const [from, to] = style === 'whistle' ? [118, 272] : [176, 280];
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
    useFlats = false, useSolfege = false, blowBoth = null, a4 = 440, nextMidi = null,
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
  const labelH = size === 'mini' ? 26 : 30;
  const ctx = { inst, chambers, main, second, moves, size, showFingers, showSizes, a4 };

  const { parts, bodyBottom } = (tube || pendant) ? fgFlatParts(ctx, tube) : fgVesselParts(ctx);
  const H = bodyBottom + labelH;
  const noteY = bodyBottom + (size === 'mini' ? 14 : 16);
  const overblow = main && main.chamber.overblow?.includes(midi);
  parts.push(`<text class="fg-note" x="${FG_W / 2}" y="${noteY}">${main ? label : label + ' ✕'}${overblow ? '<tspan class="fg-overblow" dx="6">↑ blow harder</tspan>' : ''}</text>`);

  return `<svg class="fingering fingering-${size}" viewBox="0 0 ${FG_W} ${Math.round(H)}" role="img"
    aria-label="${aria.replace(/"/g, '&quot;')}" data-midi="${midi}">${parts.join('')}</svg>`;
}

// One hole with its state, change mark, arrow, finger label and size.
function fgHoleParts(g, { x, y, r, state, hole, moves, changedOk, size, showFingers, showSizes, labelled, wood = false }) {
  const hk = fgHoleName(hole);
  const changed = moves && changedOk && (moves.lift.includes(hk) || moves.cover.includes(hk));
  g.push(fgHoleShape(x, y, r, state, `${changed ? 'fg-changed' : ''}${wood ? ' fg-on-wood' : ''}`));
  if (changed && size !== 'mini' && labelled) g.push(fgArrow(x, y, r, moves.lift.includes(hk) ? 'up' : 'down'));
  if (showFingers && size !== 'mini' && labelled) {
    // Small flute holes can't hold a label: it goes under the hole.
    g.push(wood
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
        x: pageX(x), y: pageY(y), r: r * G.s, state: states[i], hole: h,
        moves: ctx.moves, changedOk: !!f, size, showFingers: ctx.showFingers, showSizes: ctx.showSizes,
        labelled: nth === 0,
      });
    });
    parts.push(`<g class="fg-chamber ${blown ? '' : 'fg-dim'}">${g.join('')}</g>`);
  });

  const bottom = pageY(G.bottom);
  return { parts, bodyBottom: bottom + 6 };
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
      fgHoleParts(g, { x, y, r, state: states[i], hole: h, moves: ctx.moves, changedOk: !!f, size, wood: tube,
        showFingers: ctx.showFingers, showSizes: ctx.showSizes, labelled: nth === 0 });
    });
    parts.push(`<g class="fg-chamber ${blown ? '' : 'fg-dim'}">${g.join('')}</g>`);
  });
  return { parts, bodyBottom: pad + chambers.length * chamberH };
}

// Two hands as the player holds the instrument, each finger named.
//
// The hand is "Human Hand Line Art" by GDJ, Openclipart
// (https://openclipart.org/detail/314416/human-hand-line-art), CC0 1.0
// public domain dedication: the drawing the owner picked. Used as is; the
// right hand is the same path mirrored. Seen from behind the hands, so both
// thumbs face the middle. Coordinates are in the drawing's own
// 1007 × 1631 frame; fingertips measured from it.
const HAND_PATH = 'M441.846,40.94c28.341-40.555,97.034-29.623,119.639,11.404c29.941,46.471-0.82,92.604,18.219,432.334 c-4.656,35.696-5.398,71.662-4.724,107.696c1.08,35.561-8.57,70.582-6.478,106.211c7.018,6.815,16.262,14.643,18.826-0.202 c2.902-73.349-2.969-148.25,15.385-220.182c37.87-155.602-21.028-264.045,20.783-323.087c21.526-43.659,92.31-47.64,116.468-4.656 c27.531,40.487,24.09,91.163,29.218,137.656c2.564,20.648-3.711,40.824-4.454,61.338c-1.957,38.328,2.362,77.128-6.748,114.848 c-1.889,69.84,0.945,139.95-6.95,209.588c1.687,31.31-6.815,62.283-3.846,93.525c-3.981,29.69,11.606,57.694,10.257,87.385 c1.754,26.991-4.116,55.197,6.748,80.907c15.79-25.169,44.806-47.1,40.285-80.097c-1.822-58.571-0.202-121.056,29.893-173.15 c20.109-30.703,50.339-66.399,91.433-59.044c22.47-0.675,40.352,14.036,52.498,31.647c11.741,28.476,2.564,59.448-2.632,88.262 c-7.693,25.979,3.239,52.026,4.184,78.073c1.619,35.763,16.06,74.024,0.202,108.37c-97.603,180.981-77.761,184.879-113.499,257.093 c-41.634,118.02-131.65,208.981-212.422,301.224c-28.611,33.874-25.237,79.759-25.844,121.056 c-3.104,1.552-9.245,4.723-12.349,6.343c-2.294-38.328-2.227-77.6,13.766-113.296c-38.665,18.894-81.851,33.469-125.442,26.654 c42.714-11.606,91.703-12.821,126.05-44.401c18.961-19.636,42.916-33.942,59.921-55.535 c117.597-136.466,146.452-181.369,203.717-355.544c24.022-54.05,54.05-105.266,77.87-159.317 c3.374-26.789,1.012-54.05-4.116-80.502c-3.779-20.513,2.227-45.683-11.539-62.755c-26.384-14.71-32.39-48.382-28.138-75.981 c2.632-19.906,13.901-37.046,21.661-55.13c-28.813-8.772-63.767-3.441-82.931,21.458c-50.879,55.467-52.026,135.497-48.112,206.282 c7.895,15.655,28.409,19.569,42.646,28.341c-15.52,2.564-29.623-3.644-42.984-10.594 c-29.244,41.934-104.034,124.611-80.974,190.559c-10.392-8.637-23.347-12.348-35.763-16.87c5.533-0.675,16.532-1.957,21.998-2.632 c-0.135-5.128-0.472-15.453-0.675-20.581c-14.373,0.81-28.678,2.699-42.984,4.386c13.833-8.705,29.556-13.361,45.481-16.397 c4.386-24.427,13.293-47.775,26.654-68.693c-5.466-54.658-4.386-110.395-17.882-163.973c-3.374-11.336,4.454-22.943,0.81-34.211 c-8.3-12.349-22.065-19.231-33.334-28.341c9.717,2.092,19.501,4.319,29.286,6.478c5.871-24.427,5.803-49.462,6.68-74.361 c8.772-63.16,4.993-126.994,6.275-190.492c6.95-41.972,9.515-84.618,10.459-127.129c6.006-52.701,3.104-106.279-9.447-157.765 c-25.133-86.821-121.18-53.703-122.541,8.907c-0.607,42.511-3.576,85.968,6.681,127.602c25.574,11.201,53.645,5.533,80.502,7.962 c-24.427,17.747-53.578,11.809-80.434,4.791c2.497,51.081-2.902,101.892-14.845,151.557c27.194,11.471,56.547,11.539,85.495,13.428 c-29.151,9.649-62.283,7.693-90.826-3.576c-0.068,5.466-0.202,16.397-0.27,21.796c29.286,9.11,60.056,8.097,89.409-0.067 c-24.562,24.832-62.215,11.539-93.12,12.416c-3.037,57.762-6.748,115.523-7.625,173.352c27.329,6.68,57.424,7.085,81.109,23.887 c-40.69-3.576-80.839-13.361-121.866-15.453c-1.215-35.494,6.411-70.65,4.926-106.144c-3.037-61.068,16.127-122.473,1.687-183.002 c-12.493-201.496,11.017-227.766-4.521-347.514c-7.895-43.524-70.515-67.141-102.365-33.874 c-26.991,35.561-35.899,81.784-30.298,125.51c2.766,19.771-3.104,42.849,9.245,59.988c30.163,11.134,61.135-1.35,91.838,1.417 c-28.746,14.44-63.025,17.544-93.795,8.232c5.803,66.736-12.416,133-5.466,199.331c18.219,2.497,35.966-4.454,54.05-5.601 c-18.017,15.52-42.444,13.091-64.442,14.575c20.648,12.821,44.401,5.803,67.006,5.736c-21.728,13.968-47.235,15.183-70.785,5.533 c0,33.874-2.632,68.018,1.754,101.69c8.57,46.358,1.889,93.593,5.466,140.355c17.342,2.092,35.426,0.945,51.958,7.558 c-32.727,4.116-66.061-2.024-98.586,4.723c-12.686,2.429-25.574,3.779-38.463,3.239c9.784-4.993,19.906-9.312,29.826-14.103 c3.037-67.411-0.337-134.822-0.202-202.3c-12.011-66.736-4.386-134.822-6.343-202.233c6.613-50.744,13.226-104.929-7.625-153.378 c-11.539-29.691-54.522-42.309-78.14-19.569c-50.195,58.152-33.294,125.019-35.696,186.106 c26.249,18.826,59.111,23.145,90.556,20.851l-0.27,6.815c-31.108,3.374-62.08-1.417-90.286-14.913 c1.687,52.296-6.478,104.119-7.018,156.348c24.832-11.471,52.566-5.871,76.453,5.128c-21.931,0.54-43.996-5.533-65.724,0 c12.079,9.11,27.531,11.876,40.217,20.109c-18.354-1.552-36.101-6.68-53.443-12.484c-9.514,74.699,5.466,149.33,3.509,224.163 c23.753,0,47.64-2.024,71.392,0.337c-24.63,9.987-54.253,18.624-79.422,5.736c-30.433,12.416-59.854,28.071-92.108,35.089 c10.459-15.183,28.611-19.569,45.143-24.899c-0.067-28.071,1.282-56.277-0.742-84.281c-9.447-62.687-23.078-125.577-18.827-189.277 c4.858-39.138,2.159-79.557-3.644-118.087c-6.478-30.973-46.628-39.88-69.57-21.593c-24.832,40.959-32.12,93.053-21.795,139.613 c25.237,14.71,55.332,8.907,82.931,7.423c-26.587,17.342-57.896,14.373-86.372,4.049c-1.552,36.641-3.711,73.282-3.171,109.99 c23.617,10.797,49.799,5.263,74.766,8.232c-23.145,11.674-49.934,5.466-74.766,5.331c4.251,67.613-11.539,134.755-5.466,202.3 c1.282,3.307,3.914,9.987,5.196,13.293c13.361-12.618,26.249-26.317,42.916-34.886c-12.956,21.796-34.482,37.518-43.861,61.54 c-39.273,85.225-13.901,181.112-17.207,271.263c7.166,49.032,44.571,399.39,87.655,409.527 c32.66,14.171,68.625,5.466,102.837,9.987c-34.212,17.207-71.932,8.232-107.628,2.632c4.116,29.151,3.914,58.639,3.644,88.059 c-16.532-8.367-12.011-29.556-14.035-44.806c2.969-36.776-14.508-69.975-25.44-103.849 c-36.936-138.018-73.933-410.585-62.08-570.598c4.454-25.844,15.048-50.137,23.955-74.631 c-12.349-39.677-10.662-81.986-5.128-122.743c3.509-49.327-2.092-99.058,4.049-148.318c0.135-42.444,5.938-84.685,3.239-127.129 c-1.889-36.506,4.386-73.956,22.47-106.009c16.802-22.133,52.161-28.408,74.361-10.864 c36.421,30.373,22.007,105.729,25.777,231.181c7.558,61.54,21.256,122.473,20.851,184.756c12.348-3.711,28.948-7.288,29.96-23.078 c-7.355-44.536-2.362-89.679-5.061-134.484c-2.362-45.008,0.742-90.016,7.288-134.485c-0.81-43.051,2.092-86.035,4.251-128.884 c-9.649-62.62-7.085-132.123,34.684-183.406c17.882-24.36,56.075-25.507,78.68-7.423c50.971,33.131,29.157,156.37,30.028,223.826 c-8.637,65.724,3.239,130.976,4.521,196.7c6.681,55.805,1.552,112.082,4.184,168.156c8.637,0.135,17.275,0.202,25.979,0.27 c10.594-91.838-14.98-185.701,6.545-276.594c2.227-72.877,13.158-145.821,4.791-218.765 C407.702,149.446,410.671,88.782,441.846,40.94 M951.916,657.221c-16.667,22.268-12.551,50.676-12.281,76.588 c-0.945,12.686,11.404,19.569,18.961,27.531c13.698-30.838,19.636-66.399,11.404-99.193 C969.393,652.902,955.627,647.369,951.916,657.221z M517.759,820.316c-34.954,22.875-72.404,42.579-107.898,65.049c-51.419,19.771-98.721,50.002-152.569,63.43 c-30.703,5.803-60.663,20.109-92.58,13.361c-36.843-10.257-77.735,1.552-111.744-19.434c47.37,3.576,94.875,7.288,142.244,11.471 c33.604-8.637,68.423-13.631,100.34-27.801C443.572,869.246,457.404,835.124,517.759,820.316z M645.563,886.513c26.654-3.239,57.289-3.981,79.422,13.631c-27.261-2.767-54.59-10.392-82.054-5.331 c-83.972,13.138-130.094,63.751-233.813,104.929c-39.07,12.956-76.048,31.242-113.566,47.977 c-43.254,18.287-73.619,56.277-114.916,77.803c21.053-27.599,51.554-45.211,77.263-67.883 c70.582-41.364,150.679-63.025,222.544-102.095C533.684,928.822,584.968,893.733,645.563,886.513z M623.498,991.442c17.342-14.913,38.193-24.495,60.596-28.813c-41.229,20.581-75.711,51.419-114.511,75.846 c-56.345,35.021-99.463,86.71-136.577,140.828c-52.363,73.012-98.316,156.28-105.131,247.646c-1.552-0.202-4.724-0.54-6.275-0.742 c2.479-124.354,99.259-241.435,107.426-258.038C495.682,1080.851,498.857,1073.156,623.498,991.442z';
const HAND_W = 1007.276, HAND_H = 1630.965;
const HAND_TIPS = { 4: [114, 297], 3: [305, 99], 2: [493, 16], 1: [684, 121], T: [930, 610] };

export function renderHandLegend() {
  // Fingers pointing down, as the hands come onto the instrument from
  // above: the drawing flipped top to bottom, so every finger keeps its
  // place (L4 … L1 left to right, thumbs facing the middle) and the labels
  // sit under the fingertips, the hand names above the wrists.
  const k = 0.36, top = 46, gap = 70;
  const w = HAND_W * k, h = HAND_H * k;
  const hand = (side, ox) => {
    const mirror = side === 'R';
    const px = x => ox + (mirror ? HAND_W - x : x) * k;
    const py = y => top + (HAND_H - y) * k;
    const labels = Object.entries(HAND_TIPS).map(([f, [x, y]]) =>
      `<text class="hand-label" x="${px(x)}" y="${py(y) + 26}">${side}${f}</text>`).join('');
    const t = `translate(${mirror ? ox + w : ox} ${top + h}) scale(${mirror ? -k : k} ${-k})`;
    return `<text class="hand-name" x="${ox + w / 2}" y="${top - 18}">${side === 'L' ? 'Left hand' : 'Right hand'}</text>
      <path class="hand-line" transform="${t}" d="${HAND_PATH}"/>${labels}`;
  };
  const W = 2 * w + gap + 40, H = top + h + 50;
  return `<svg class="hand-legend" viewBox="0 0 ${Math.round(W)} ${Math.round(H)}" role="img"
    aria-label="Finger names, hands seen from above with the fingers pointing down: L1 to L4 are the left index to pinky, R1 to R4 the right index to pinky, LT and RT the thumbs">
    ${hand('L', 20)}${hand('R', 20 + w + gap)}</svg>`;
}
