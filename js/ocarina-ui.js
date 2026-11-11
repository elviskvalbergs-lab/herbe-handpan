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
// Diagram coordinates (viewBox units). Seen from above with the holes up,
// as the player looks down at it: a transverse ("sweet potato") body with
// the mouthpiece sticking out of its wide left end and the tail tapering to
// the right; left hand on the wide part, right hand towards the tail.

const FG_W = 300;
const FG_TRANSVERSE = {
  bodyH: 110,
  pos: {
    L1: [140, 48], L2: [112, 42], L3: [86, 48], L4: [62, 66],
    R1: [178, 50], R2: [206, 46], R3: [234, 52], R4: [260, 64],
  },
};

// Body outlines (y relative to the chamber's top). Sweet potato for
// soprano to tenor; bass chambers (closed note below C3) are drawn as the
// fatter, aubergine-like body bass ocarinas have.
const FG_SWEET_POTATO = 'M 34 61 C 34 24, 72 14, 122 18 C 176 22, 240 28, 278 48 C 297 58, 294 76, 272 84 C 232 100, 172 108, 112 106 C 62 104, 34 96, 34 61 Z';
const FG_AUBERGINE = 'M 30 62 C 30 6, 112 4, 152 22 C 190 38, 246 34, 280 48 C 298 56, 297 76, 278 82 C 246 92, 198 90, 162 104 C 122 118, 30 118, 30 62 Z';

function fgBodyPath(chamber, y0) {
  const d = (chamber.notes?.[0] ?? 60) < 48 ? FG_AUBERGINE : FG_SWEET_POTATO;
  // Shift every y coordinate (the odd-numbered numbers) by y0.
  let i = 0;
  return d.replace(/-?\d+(\.\d+)?/g, n => (i++ % 2 === 1 ? String(Number(n) + y0) : n));
}
const FG_PENDANT = {
  bodyH: 170,
  pos: {
    L1: [112, 58], L2: [96, 92], L3: [96, 126], L4: [112, 156],
    R1: [188, 58], R2: [204, 92], R3: [204, 126], R4: [188, 156],
  },
};
const FG_THUMB_X = { LT: 100, RT: 200 };
// Flutes: a tube seen from above, mouthpiece on the left, holes evenly
// along it in the order the chart lists them (mouthpiece first), with a
// gap between the two hands.
const FG_TUBE = { bodyH: 70, pos: {} };

function fgTubePositions(holes, y0) {
  const top = holes.map((h, i) => ({ h, i })).filter(x => x.h.side !== 'bottom');
  const xs = {};
  top.forEach((x, k) => {
    const t = top.length === 1 ? 0.5 : k / (top.length - 1);
    const handGap = x.h.finger.startsWith('R') ? 14 : 0;
    xs[x.i] = [96 + t * 150 + handGap, y0 + 40];
  });
  return xs;
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
  const geo = tube ? FG_TUBE : fgIsPendant(inst) ? FG_PENDANT : FG_TRANSVERSE;
  const chambers = inst.chambers ?? [];
  const main = fingeringFor(inst, midi);
  const second = blowBoth != null ? fingeringFor(inst, blowBoth) : null;
  // Arrows show either how this note was reached (previousMidi) or, in
  // practice mode, what to change next (nextMidi).
  const moves = nextMidi != null && nextMidi !== midi ? fingeringMoves(inst, midi, nextMidi)
    : previousMidi != null && previousMidi !== midi ? fingeringMoves(inst, previousMidi, midi) : null;
  const label = displayNote(midiToNoteName(midi), useFlats, useSolfege);
  const aria = describeFingering(inst, midi, label);
  const hasThumbs = chambers.some(c => c.holes.some(h => h.side === 'bottom'));
  const pad = 22; // room for arrows and the mouthpiece
  const chamberH = geo.bodyH + (hasThumbs ? FG_STRIP_H : 0) + 14;
  const labelH = size === 'mini' ? 26 : 30;
  const H = pad + chambers.length * chamberH + labelH;

  const parts = [];
  chambers.forEach((ch, ci) => {
    const y0 = pad + ci * chamberH;
    const blown = main?.chamberIndex === ci || second?.chamberIndex === ci;
    const f = main?.chamberIndex === ci ? main : second?.chamberIndex === ci ? second : null;
    const states = f ? f.states : ch.holes.map(() => 'c');
    // Proportions from target notes only make sense for scale-built vessel
    // ocarinas; charts (and flutes, where position sets pitch) draw equal holes.
    const rel = relativeSizes(ch, a4, { fromNotes: inst.kind === 'scale' });
    const g = [];
    // Body
    const tubeXY = tube ? fgTubePositions(ch.holes, y0) : null;
    if (tube) {
      g.push(`<rect class="fg-body" x="38" y="${y0 + 22}" width="${FG_W - 52}" height="36" rx="18"/>`);
    } else if (geo === FG_PENDANT) {
      g.push(`<ellipse class="fg-body" cx="${FG_W / 2}" cy="${y0 + geo.bodyH / 2}" rx="${FG_W / 2 - 60}" ry="${geo.bodyH / 2}"/>`);
    } else {
      g.push(`<path class="fg-body" d="${fgBodyPath(ch, y0)}"/>`);
    }
    // Mouthpiece, marked when this chamber is blown
    if (tube) g.push(`<rect class="fg-mouth ${blown ? 'fg-blow' : ''}" x="8" y="${y0 + 27}" width="34" height="26" rx="6"/>`);
    else if (geo === FG_PENDANT) g.push(`<rect class="fg-mouth ${blown ? 'fg-blow' : ''}" x="${FG_W / 2 - 13}" y="${y0 - 4}" width="26" height="18" rx="4"/>`);
    // Transverse: the windway sticks out of the wide end, slightly down.
    else g.push(`<rect class="fg-mouth ${blown ? 'fg-blow' : ''}" x="2" y="${y0 + 58}" width="38" height="20" rx="5" transform="rotate(12 40 ${y0 + 68})"/>`);
    if (blown && chambers.length > 1) {
      const lx = geo === FG_PENDANT ? FG_W / 2 + 22 : 4;
      const ly = geo === FG_PENDANT ? y0 + 9 : y0 + 42;
      g.push(`<text class="fg-blow-label" x="${lx}" y="${ly}">${second ? 'blow both' : 'blow'}</text>`);
    }
    // Underside strip for thumb holes
    if (hasThumbs) {
      const sy = y0 + geo.bodyH + 6;
      g.push(`<rect class="fg-strip" x="60" y="${sy}" width="${FG_W - 120}" height="${FG_STRIP_H - 6}" rx="6"/>`);
      if (size === 'large') g.push(`<text class="fg-strip-label" x="${FG_W / 2}" y="${sy + FG_STRIP_H / 2 - 2}">underside</text>`);
    }
    // Holes
    const seen = {};
    ch.holes.forEach((h, i) => {
      // k numbers the holes under one finger; a sub-hole gets its own arrow.
      const k = h.sub ? 0 : (seen[h.finger] = (seen[h.finger] ?? -1) + 1);
      // Holes a finger shares because one was split (over 12 mm); a sub-hole
      // is not a split, it sits on its own beside its main hole.
      const sameFinger = ch.holes.filter(x => x.finger === h.finger && !x.sub);
      const split = !h.sub && sameFinger.length > 1;
      let x, y;
      if (h.side === 'bottom') {
        x = FG_THUMB_X[h.finger] ?? FG_W / 2;
        y = y0 + geo.bodyH + 6 + (FG_STRIP_H - 6) / 2;
      } else if (tube) {
        [x, y] = tubeXY[i];
      } else {
        [x, y] = geo.pos[h.finger] ?? [FG_W / 2, y0 + geo.bodyH / 2];
        y += y0;
      }
      if (h.x != null && h.y != null) { x = h.x; y = y0 + h.y; }
      const count = sameFinger.length;
      if (split) y += (sameFinger.indexOf(h) - (count - 1) / 2) * (16 / Math.max(1, count - 1));
      if (h.sub) { x += 13; y += 15; }
      const r = Math.max(4, (split ? 18 / count : 13) * rel[i] * (h.sub && !(h.rel > 0) ? 0.5 : 1));
      const hk = fgHoleName(h);
      const changed = moves && (moves.lift.includes(hk) || moves.cover.includes(hk)) && f;
      const cls = `${changed ? 'fg-changed' : ''}`;
      g.push(fgHoleShape(x, y, r, states[i], cls));
      if (changed && size !== 'mini' && k === 0) {
        g.push(fgArrow(x, y, r, moves.lift.includes(hk) ? 'up' : 'down'));
      }
      if (showFingers && size !== 'mini' && k === 0) {
        g.push(`<text class="fg-finger ${states[i] === 'c' ? 'on-dark' : ''}" x="${x}" y="${y}">${h.finger}</text>`);
      }
      if (showSizes && size !== 'mini' && h.sizeMm > 0) {
        g.push(`<text class="fg-size" x="${x}" y="${y + r + 9}">${h.sizeMm.toFixed(1)}</text>`);
      }
    });
    parts.push(`<g class="fg-chamber ${blown ? '' : 'fg-dim'}">${g.join('')}</g>`);
  });

  const noteY = pad + chambers.length * chamberH + (size === 'mini' ? 14 : 16);
  const overblow = main && main.chamber.overblow?.includes(midi);
  parts.push(`<text class="fg-note" x="${FG_W / 2}" y="${noteY}">${main ? label : label + ' ✕'}${overblow ? '<tspan class="fg-overblow" dx="6">↑ blow harder</tspan>' : ''}</text>`);

  return `<svg class="fingering fingering-${size}" viewBox="0 0 ${FG_W} ${H}" role="img"
    aria-label="${aria.replace(/"/g, '&quot;')}" data-midi="${midi}">${parts.join('')}</svg>`;
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
