// The fingering diagram: one SVG component that draws every ocarina (and
// later flute) fingering in the app, at three sizes. See docs/ocarina-mode.md,
// "The fingering diagram".
//
// renderFingering() returns an SVG string, like renderPan() does. The helpers
// above it (fingeringFor, fingeringMoves, describeFingering) are pure and unit
// tested in Node.

import { displayNote } from './data.js';
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

// Per finger, whether it is on a hole ('c' or 'h' anywhere under it).
function fgFingersDown(chamber, states) {
  const down = {};
  chamber.holes.forEach((h, i) => {
    down[h.finger] = (down[h.finger] ?? false) || states[i] !== 'o';
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
    if (f.states[i] === 'o' && !open.includes(h.finger)) open.push(h.finger);
    if (f.states[i] === 'h' && !half.includes(h.finger)) half.push(h.finger);
  });
  const chamber = (inst.chambers.length > 1) ? ` (chamber ${f.chamberIndex + 1})` : '';
  const parts = [];
  if (open.length) parts.push(`${fgJoinFingers(open)} open`);
  if (half.length) parts.push(`${fgJoinFingers(half)} half-covered`);
  if (!parts.length) return `${noteLabel}${chamber}: all holes closed`;
  const rest = (open.length + half.length) < new Set(f.chamber.holes.map(h => h.finger)).size ? ', all others closed' : '';
  return `${noteLabel}${chamber}: ${parts.join(', ')}${rest}`;
}

// Hole sizes relative to the largest hole of the chamber (1 = largest).
// Uses measured sizes when the builder has stored them, otherwise the
// proportions from the target notes, otherwise all the same.
export function relativeSizes(chamber, a4 = 440) {
  const mm = chamber.holes.map(h => h.sizeMm);
  if (mm.every(x => x > 0)) {
    const max = Math.max(...mm);
    return mm.map(x => x / max);
  }
  if (chamber.notes?.length === chamber.holes.length + 1) {
    const [closed, ...rest] = chamber.notes;
    return relativeHoleSizes(midiToHz(closed, a4), rest.map(m => midiToHz(m, a4)));
  }
  return chamber.holes.map(() => 1);
}

// ── Geometry ─────────────────────────────────────────────────────────────────
// Diagram coordinates (viewBox units). Seen from above, mouthpiece at the
// top, left hand on the left with the index finger nearest the middle.

const FG_W = 300;
const FG_TRANSVERSE = {
  bodyH: 110,
  pos: {
    L1: [128, 52], L2: [98, 46], L3: [68, 50], L4: [42, 64],
    R1: [172, 52], R2: [202, 46], R3: [232, 50], R4: [258, 64],
  },
};
const FG_PENDANT = {
  bodyH: 170,
  pos: {
    L1: [112, 58], L2: [96, 92], L3: [96, 126], L4: [112, 156],
    R1: [188, 58], R2: [204, 92], R3: [204, 126], R4: [188, 156],
  },
};
const FG_THUMB_X = { LT: 100, RT: 200 };
const FG_STRIP_H = 34;

function fgIsPendant(inst) {
  const holes = Math.max(0, ...(inst.chambers ?? []).map(c => c.holes.length));
  return holes <= 6;
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
    useFlats = false, useSolfege = false, blowBoth = null, a4 = 440,
  } = opts;
  const geo = fgIsPendant(inst) ? FG_PENDANT : FG_TRANSVERSE;
  const chambers = inst.chambers ?? [];
  const main = fingeringFor(inst, midi);
  const second = blowBoth != null ? fingeringFor(inst, blowBoth) : null;
  const moves = previousMidi != null && previousMidi !== midi ? fingeringMoves(inst, previousMidi, midi) : null;
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
    const rel = relativeSizes(ch, a4);
    const g = [];
    // Body
    if (geo === FG_PENDANT) {
      g.push(`<ellipse class="fg-body" cx="${FG_W / 2}" cy="${y0 + geo.bodyH / 2}" rx="${FG_W / 2 - 60}" ry="${geo.bodyH / 2}"/>`);
    } else {
      g.push(`<rect class="fg-body" x="14" y="${y0 + 12}" width="${FG_W - 28}" height="${geo.bodyH - 12}" rx="${(geo.bodyH - 12) / 2}"/>`);
    }
    // Mouthpiece, marked when this chamber is blown
    g.push(`<rect class="fg-mouth ${blown ? 'fg-blow' : ''}" x="${FG_W / 2 - 13}" y="${y0 - 4}" width="26" height="18" rx="4"/>`);
    if (blown && chambers.length > 1) {
      g.push(`<text class="fg-blow-label" x="${FG_W / 2 + 22}" y="${y0 + 9}">${second ? 'blow both' : 'blow'}</text>`);
    }
    // Underside strip for thumb holes
    if (hasThumbs) {
      const sy = y0 + geo.bodyH + 6;
      g.push(`<rect class="fg-strip" x="60" y="${sy}" width="${FG_W - 120}" height="${FG_STRIP_H - 6}" rx="6"/>`);
      if (size !== 'mini') g.push(`<text class="fg-strip-label" x="${FG_W / 2}" y="${sy + FG_STRIP_H / 2 - 2}">underside</text>`);
    }
    // Holes
    const seen = {};
    ch.holes.forEach((h, i) => {
      const k = seen[h.finger] = (seen[h.finger] ?? -1) + 1;
      const split = ch.holes.filter(x => x.finger === h.finger).length > 1;
      let x, y;
      if (h.side === 'bottom') {
        x = FG_THUMB_X[h.finger] ?? FG_W / 2;
        y = y0 + geo.bodyH + 6 + (FG_STRIP_H - 6) / 2;
      } else {
        [x, y] = geo.pos[h.finger] ?? [FG_W / 2, y0 + geo.bodyH / 2];
        y += y0;
      }
      if (h.x != null && h.y != null) { x = h.x; y = y0 + h.y; }
      if (split) y += k === 0 ? -8 : 8;
      const r = Math.max(4, (split ? 9 : 13) * rel[i]);
      const changed = moves && (moves.lift.includes(h.finger) || moves.cover.includes(h.finger)) && f;
      const cls = `${changed ? 'fg-changed' : ''}`;
      g.push(fgHoleShape(x, y, r, states[i], cls));
      if (changed && size !== 'mini' && k === 0) {
        g.push(fgArrow(x, y, r, moves.lift.includes(h.finger) ? 'up' : 'down'));
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
  parts.push(`<text class="fg-note" x="${FG_W / 2}" y="${noteY}">${main ? label : label + ' ✕'}</text>`);

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
