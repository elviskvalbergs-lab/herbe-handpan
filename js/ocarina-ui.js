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
    // Wooden tube: the mouth end tapers and rounds off, the foot is open.
    const L = FG_W - 6;
    g.push(`<path class="fg-wood" d="M 6 ${cy} C 6 ${cy - r + 4}, 16 ${cy - r}, 34 ${cy - r} L ${L - r} ${cy - r} Q ${L} ${cy - r}, ${L} ${cy} Q ${L} ${cy + r}, ${L - r} ${cy + r} L 34 ${cy + r} C 16 ${cy + r}, 6 ${cy + r - 4}, 6 ${cy} Z"/>`);
    g.push(`<path class="fg-wood-grain" d="M 30 ${cy - 6} C 110 ${cy - 8}, 190 ${cy - 4}, ${L - 14} ${cy - 6} M 44 ${cy + 3} C 130 ${cy + 5}, 200 ${cy + 1}, ${L - 20} ${cy + 4} M 70 ${cy + 9} L ${L - 40} ${cy + 9}"/>`);
    g.push(`<path class="fg-mouth-lip ${blown ? 'fg-blow' : ''}" d="M 12 ${cy - 6} Q 5 ${cy}, 12 ${cy + 6}"/>`);
    g.push(`<ellipse class="fg-bore" cx="${L - 3}" cy="${cy}" rx="2.5" ry="${r - 5}"/>`);
    // Fetish: a long carved block over the sound hole, tied on with
    // leather, the ends hanging down; the sound hole just in front of it.
    g.push(`<path class="fg-tie-end" d="M 92 ${cy + r} q 3 12, -4 24 M 96 ${cy + r} q 8 10, 6 22 M 124 ${cy + r} q 3 12, -2 26 M 128 ${cy + r} q 8 9, 8 20"/>`);
    g.push(`<path class="fg-block" d="M 76 ${cy - 9} C 82 ${cy - 12}, 112 ${cy - 12}, 128 ${cy - 10} C 136 ${cy - 17}, 146 ${cy - 16}, 147 ${cy - 9} C 148 ${cy - 4}, 142 ${cy - 3}, 138 ${cy - 3} L 138 ${cy + 9} C 112 ${cy + 11}, 84 ${cy + 11}, 76 ${cy + 9} Z"/>`);
    g.push(`<rect class="fg-tie" x="90" y="${cy - r - 1}" width="7" height="${r * 2 + 2}" rx="2"/>`);
    g.push(`<rect class="fg-tie" x="122" y="${cy - r - 1}" width="7" height="${r * 2 + 2}" rx="2"/>`);
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
export function renderHandLegend() {
  const hand = (cx, side) => {
    // Seen from behind the hands: index fingers and thumbs face the middle.
    const s = side === 'L' ? -1 : 1;
    const fingers = [1, 2, 3, 4].map(n => {
      const x = cx - s * (2.5 - n) * 22;
      const len = [44, 50, 46, 36][n - 1];
      return `<rect class="hand-finger" x="${x - 9}" y="${70 - len}" width="18" height="${len + 14}" rx="9"/>
        <text class="hand-label" x="${x}" y="${70 - len + 14}">${side}${n}</text>`;
    }).join('');
    const tx = cx - s * 62;
    return `<rect class="hand-palm" x="${cx - 48}" y="70" width="96" height="62" rx="18"/>${fingers}
      <rect class="hand-finger" x="${tx - 26}" y="96" width="44" height="18" rx="9" transform="rotate(${s * 25} ${tx} 105)"/>
      <text class="hand-label" x="${tx - 4}" y="109">${side}T</text>
      <text class="hand-name" x="${cx}" y="152">${side === 'L' ? 'Left hand' : 'Right hand'}</text>`;
  };
  return `<svg class="hand-legend" viewBox="0 0 400 160" role="img"
    aria-label="Finger names: L1 to L4 are the left index to pinky, R1 to R4 the right index to pinky, LT and RT the thumbs">
    ${hand(100, 'L')}${hand(300, 'R')}</svg>`;
}
