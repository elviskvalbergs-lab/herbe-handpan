// Ocarina maths: pitch, chamber splitting, hole sizes, body volume, shrinkage,
// generated fingerings and two-note pair checks. See docs/ocarina-mode.md,
// "Maths reference for js/ocarina.js".
//
// Pure functions only: no DOM, no storage, no globals. Everything is unit
// tested in Node (tests/ocarina.test.mjs).
//
// build.py concatenates every js/ file into one <script>, so every top-level
// name here must be unique across the bundle (data.js already has
// midiToFreq, hence midiToHz below).
//
// Units: frequencies in Hz, lengths in mm, volumes in cm³ (= ml).

import { noteToMidi } from './data.js';

export const OC_DEFAULT_A4 = 440;
export const OC_SPEED_OF_SOUND = 343;        // m/s
export const OC_DEFAULT_SHRINK = 0.11;       // generic clay shrinkage fraction
export const OC_MAX_HOLE_MM = 12;            // larger holes are split in two
export const OC_SINGLE_CHAMBER_SPAN = 14;    // semitones
export const OC_CHAMBER_SPAN = 12;           // semitones above a chamber's lowest note

// Order in which holes open, lowest note first: right hand pinky → index,
// then left hand pinky → index, thumbs last.
export const OC_FINGER_ORDER = ['R4', 'R3', 'R2', 'R1', 'L4', 'L3', 'L2', 'L1', 'LT', 'RT'];
export const OC_THUMBS = ['LT', 'RT'];

// ── Pitch ────────────────────────────────────────────────────────────────────

// f = A4 × 2^((midi − 69) / 12)
export function midiToHz(midi, a4 = OC_DEFAULT_A4) {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

// Inverse of midiToHz; returns a fractional MIDI number.
export function hzToMidi(hz, a4 = OC_DEFAULT_A4) {
  return 69 + 12 * Math.log2(hz / a4);
}

// Cents from `targetHz` to `hz` (positive = sharp, negative = flat).
export function centsBetween(hz, targetHz) {
  return 1200 * Math.log2(hz / targetHz);
}

// ── Scale → notes ────────────────────────────────────────────────────────────

// MIDI notes of a handpan scale from data.js (ding + ring, plus gu notes
// unless includeGu is false), transposed and sorted ascending, no duplicates.
export function scaleToMidis(scale, { transpose = 0, includeGu = true } = {}) {
  const names = [scale.top.ding, ...scale.top.notes];
  if (includeGu) names.push(...(scale.bottom?.notes ?? []));
  const midis = names.filter(Boolean).map(n => noteToMidi(n) + transpose);
  return [...new Set(midis)].sort((a, b) => a - b);
}

// ── Chamber splitting ────────────────────────────────────────────────────────

// Splits ascending notes into chambers (arrays of MIDI numbers). Each
// chamber's first note is its all-holes-closed note.
//
// Notes spanning ≤ 14 semitones → one chamber. Otherwise walk up and start a
// new chamber whenever a note is more than 12 semitones above the current
// chamber's lowest note. Then, from the top chamber down, any chamber with
// fewer than 2 notes takes the top notes of the chamber below; if the chamber
// below can't spare them (it would drop under 2 notes), the two are merged.
export function splitChambers(midis) {
  const notes = [...new Set(midis)].sort((a, b) => a - b);
  if (notes.length === 0) return [];
  if (notes[notes.length - 1] - notes[0] <= OC_SINGLE_CHAMBER_SPAN) return [notes];

  const chambers = [[notes[0]]];
  for (const n of notes.slice(1)) {
    const cur = chambers[chambers.length - 1];
    if (n - cur[0] > OC_CHAMBER_SPAN) chambers.push([n]);
    else cur.push(n);
  }

  for (let i = chambers.length - 1; i >= 1; i--) {
    const upper = chambers[i];
    const lower = chambers[i - 1];
    while (upper.length < 2 && lower.length > 2) upper.unshift(lower.pop());
    if (upper.length < 2) {
      chambers[i - 1] = [...lower, ...upper];
      chambers.splice(i, 1);
    }
  }
  return chambers;
}

// ── Fingerings ───────────────────────────────────────────────────────────────

// Finger assignment for a chamber with `holeCount` holes, in opening order.
// Up to 8 holes use the fingers only; with more than 8, the two highest-note
// holes go underneath under the thumbs (LT, then RT).
export function fingersForHoleCount(holeCount) {
  if (holeCount > OC_FINGER_ORDER.length) {
    throw new RangeError(`A chamber can have at most ${OC_FINGER_ORDER.length} holes (got ${holeCount})`);
  }
  if (holeCount <= 8) return OC_FINGER_ORDER.slice(0, holeCount);
  return [...OC_FINGER_ORDER.slice(0, holeCount - 2), ...OC_THUMBS];
}

// One chamber of a scale-built ocarina: holes in opening order and a
// cumulative fingering per note (note k = first k holes open).
// Hole positions (x, y) and sizes are filled in later by the UI / builder.
export function buildChamber(notes) {
  const sorted = [...notes].sort((a, b) => a - b);
  const fingers = fingersForHoleCount(sorted.length - 1);
  const holes = fingers.map(f => ({
    id: f,
    finger: f,
    side: OC_THUMBS.includes(f) ? 'bottom' : 'top',
    x: null,
    y: null,
    sizeMm: null,
  }));
  const fingerings = {};
  sorted.forEach((midi, k) => {
    fingerings[midi] = holes.map((_, h) => (h < k ? 'o' : 'c'));
  });
  return { notes: sorted, holes, fingerings };
}

// Chambers, holes and fingerings for a scale-built ocarina from MIDI notes.
export function buildScaleChambers(midis) {
  return splitChambers(midis).map(buildChamber);
}

// ── Hole sizes ───────────────────────────────────────────────────────────────

// Window equivalent hole size from the tuning readings:
// W = d / ((f1/f0)² − 1)
export function windowEquivalent(f0, d, f1) {
  const r = (f1 / f0) ** 2 - 1;
  if (!(r > 0)) throw new RangeError('f1 must be higher than f0');
  return d / r;
}

// Total open hole diameter for a note at fn: D = W × ((fn/f0)² − 1)
export function totalOpenDiameter(W, f0, fn) {
  return W * ((fn / f0) ** 2 - 1);
}

// Per-hole diameters (mm) for a cumulative fingering.
//   f0       measured closed pitch
//   d, f1    test hole diameter and pitch with it open
//   targets  target frequencies of the open notes, ascending (notes[1..])
// Returns { W, totals, holes, testHoleIndex } where holes[n] = D_n − D_(n−1)
// and testHoleIndex is the first hole whose size is at least d (−1 if none).
export function holeSizes({ f0, d, f1, targets }) {
  const W = windowEquivalent(f0, d, f1);
  const totals = targets.map(fn => totalOpenDiameter(W, f0, fn));
  const holes = totals.map((D, i) => D - (i === 0 ? 0 : totals[i - 1]));
  const testHoleIndex = holes.findIndex(h => h >= d);
  return { W, totals, holes, testHoleIndex };
}

// Before readings exist: relative hole sizes only, as fractions of the
// largest hole (largest = 1). Uses the chamber's closed note as f0; W cancels.
export function relativeHoleSizes(closedHz, targets) {
  const totals = targets.map(fn => (fn / closedHz) ** 2 - 1);
  const holes = totals.map((D, i) => D - (i === 0 ? 0 : totals[i - 1]));
  const max = Math.max(...holes);
  return holes.map(h => h / max);
}

// A hole over 12 mm becomes two holes of half the diameter, opened together.
// Returns an array of 1 or 2 diameters.
export function splitHole(diameter, maxMm = OC_MAX_HOLE_MM) {
  return diameter > maxMm ? [diameter / 2, diameter / 2] : [diameter];
}

// Applies diameters (one per hole, opening order) to a chamber from
// buildChamber, splitting holes over 12 mm into two holes ('R4a', 'R4b')
// that share the finger and the state in every fingering.
export function applyHoleSizes(chamber, diameters, maxMm = OC_MAX_HOLE_MM) {
  const holes = [];
  const source = []; // index of the original hole for each new hole
  chamber.holes.forEach((hole, i) => {
    const parts = splitHole(diameters[i], maxMm);
    parts.forEach((size, p) => {
      holes.push({ ...hole, id: parts.length > 1 ? hole.id + 'ab'[p] : hole.id, sizeMm: size });
      source.push(i);
    });
  });
  const fingerings = {};
  for (const [midi, states] of Object.entries(chamber.fingerings)) {
    fingerings[midi] = source.map(i => states[i]);
  }
  return { ...chamber, holes, fingerings };
}

// ── Window and body volume ───────────────────────────────────────────────────

// Window area (mm²) by shape. For 'round', `w` is the diameter.
export function windowArea({ shape, w, l }) {
  switch (shape) {
    case 'rect': case 'rectangle': return w * l;
    case 'round': return Math.PI * w * w / 4;
    case 'oval': return Math.PI * w * l / 4;
    default: throw new RangeError(`Unknown window shape: ${shape}`);
  }
}

// Default window for a chamber whose closed note is f Hz:
// width = 10 × √(262/f), clamped to 6–16 mm and rounded; length = 0.75 × width;
// wall 4 mm.
export function defaultWindow(f) {
  const w = Math.round(Math.min(16, Math.max(6, 10 * Math.sqrt(262 / f))));
  return { shape: 'rect', w, l: 0.75 * w, t: 4 };
}

// Helmholtz volume (cm³) for a window of area A (mm²), wall t (mm) and
// frequency f (Hz):
//   a = √(A/π), K = A / (t + 1.5a), V = K c² / (4π² f²)
export function helmholtzVolume(areaMm2, tMm, f, c = OC_SPEED_OF_SOUND) {
  const A = areaMm2 * 1e-6;             // m²
  const t = tMm * 1e-3;                 // m
  const a = Math.sqrt(A / Math.PI);     // m
  const K = A / (t + 1.5 * a);          // m
  const V = K * c * c / (4 * Math.PI ** 2 * f * f); // m³
  return V * 1e6;                       // cm³
}

// Diameter (mm) of a ball with volume V (cm³): ∛(6V/π)
export function ballDiameter(volumeCm3) {
  return Math.cbrt(6 * volumeCm3 * 1000 / Math.PI);
}

// Inside volume to form a chamber around, for concert closed pitch f.
// Uses the leather-hard target f × (1 − s).
// Returns { area, leatherHz, volume, firedVolume, ballDiameter }.
export function chamberVolume({ shape = 'rect', w, l, t }, f, shrink = OC_DEFAULT_SHRINK) {
  const area = windowArea({ shape, w, l });
  const leatherHz = leatherTarget(f, shrink);
  const volume = helmholtzVolume(area, t, leatherHz);
  return {
    area,
    leatherHz,
    volume,
    firedVolume: volume * (1 - shrink) ** 3,
    ballDiameter: ballDiameter(volume),
  };
}

// ── Shrinkage ────────────────────────────────────────────────────────────────

// Leather-hard target for a concert pitch: f × (1 − s)
export function leatherTarget(f, shrink = OC_DEFAULT_SHRINK) {
  return f * (1 - shrink);
}

// Pitch after firing for a leather-hard pitch: f / (1 − s)
export function firedPitch(fLeather, shrink = OC_DEFAULT_SHRINK) {
  return fLeather / (1 - shrink);
}

// Learned shrinkage from two sets of readings ({ [midi]: hz }): the mean of
// 1 − f_leather / f_final over notes measured at both stages. Null if none.
export function learnedShrinkage(leather, final) {
  const keys = Object.keys(leather).filter(k => final[k] > 0 && leather[k] > 0);
  if (keys.length === 0) return null;
  const sum = keys.reduce((acc, k) => acc + (1 - leather[k] / final[k]), 0);
  return sum / keys.length;
}

// ── Two-note pairs ───────────────────────────────────────────────────────────

const OC_ON = { c: true, h: true, o: false };

// Can `midiA` on chamber A and `midiB` on chamber B sound together? Yes when
// no finger is asked to be on a hole ('c' or 'h') in one fingering and off a
// hole ('o') in the other. Holes are matched by their finger assignment.
export function canPlayTogether(chamberA, midiA, chamberB, midiB) {
  if (chamberA === chamberB) return false;
  const fa = chamberA.fingerings[midiA];
  const fb = chamberB.fingerings[midiB];
  if (!fa || !fb) return false;
  const need = {}; // finger → Set of on/off
  const add = (holes, states) => holes.forEach((hole, i) => {
    (need[hole.finger] ??= new Set()).add(OC_ON[states[i]]);
  });
  add(chamberA.holes, fa);
  add(chamberB.holes, fb);
  return Object.values(need).every(s => s.size === 1);
}

// Every pair of `midis` (e.g. a chord's notes) playable together on a
// multi-chamber ocarina: [{ a: { chamber, midi }, b: { chamber, midi } }],
// with chamber as an index into `chambers`. Notes present in several
// chambers are tried in each.
export function playablePairs(chambers, midis) {
  const where = midis.flatMap(m =>
    chambers.flatMap((ch, ci) => (ch.fingerings[m] ? [{ chamber: ci, midi: m }] : [])));
  const pairs = [];
  for (let i = 0; i < where.length; i++) {
    for (let j = i + 1; j < where.length; j++) {
      const a = where[i], b = where[j];
      if (a.chamber === b.chamber || a.midi === b.midi) continue;
      if (canPlayTogether(chambers[a.chamber], a.midi, chambers[b.chamber], b.midi)) {
        pairs.push(a.midi <= b.midi ? { a, b } : { a: b, b: a });
      }
    }
  }
  return pairs;
}

// ── Traditional charts ───────────────────────────────────────────────────────

// TODO(phase 1, needs a source): 12-hole Italian system fingering chart.
// Must come from a published maker or manufacturer chart, with the source URL
// recorded here, per docs/ocarina-mode.md and CLAUDE.md. Do not fill in from
// memory. A Nov 2026 search found no maker chart in a checkable text form;
// candidate to review: https://pureocarinas.com/ocarina-fingering-system
// (alto C list, not a full 12-hole chart). Intended shape (fingerings relative to the lowest note, so one
// chart serves every key; concert pitch = lowest note of the key + offset):
//
//   {
//     type: '12-hole', system: 'italian', source: '<url>',
//     holes: [{ id: 'L1', finger: 'L1', side: 'top' }, ..., { id: 'LT', ... }],
//     keys: { 'alto-C': { lowestMidi: <from source> }, ... },
//     fingerings: [{ offset: 0, states: ['c', ...] }, ...],
//   }
export const OC_TRADITIONAL_CHARTS = {};
