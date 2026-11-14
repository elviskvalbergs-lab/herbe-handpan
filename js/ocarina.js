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

import { noteToMidi, displayNote, SHARP_NAMES } from './data.js';

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

// ── Pitch as text (record fields) ────────────────────────────────────────────

// A measured frequency as the nearest note and how far off it is, in the
// user's notation: { midi, note: 'D4' | 'Re4' | 'Eb4', cents, text: 'D4 −3 ¢' }.
export function pitchLabel(hz, { useFlats = false, useSolfege = false, a4 = OC_DEFAULT_A4 } = {}) {
  const exact = hzToMidi(hz, a4);
  const midi = Math.round(exact);
  const cents = Math.round((exact - midi) * 100);
  const name = SHARP_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  const note = displayNote(name, useFlats, useSolfege);
  const off = cents === 0 ? '' : ` ${cents > 0 ? '+' : '−'}${Math.abs(cents)} ¢`;
  return { midi, note, cents, text: note + off };
}

// What a person types into a record field, as a frequency in Hz, or null.
// Accepts a frequency ("293.7", "293,7 Hz") or a note in letters or solfège
// with an optional octave (default 4) and cents: "D4", "Eb4", "d#3",
// "Re4", "Sib3", "D4 -3", "Re4 +12 ¢".
export function parsePitch(text, a4 = OC_DEFAULT_A4) {
  const t = String(text ?? '').trim().replace(',', '.').replace(/[−–]/g, '-');
  if (!t) return null;
  const num = t.match(/^(\d+(?:\.\d+)?)\s*(hz)?$/i);
  if (num) { const hz = parseFloat(num[1]); return hz > 0 ? hz : null; }
  const m = t.match(/^(do|re|mi|fa|sol|la|si|ti|[a-g])\s*([#♯b♭]?)\s*(-?\d)?\s*(?:([+-]\s*\d+(?:\.\d+)?)\s*(?:¢|c|cents?)?)?$/i);
  if (!m) return null;
  const solf = { do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11, ti: 11 };
  const letter = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const base = m[1].toLowerCase();
  let pc = base.length > 1 ? solf[base] : letter[base];
  if (m[2] === '#' || m[2] === '♯') pc += 1;
  if (m[2] === 'b' || m[2] === '♭') pc -= 1;
  const octave = m[3] != null ? parseInt(m[3], 10) : 4;
  const midi = (octave + 1) * 12 + pc;
  const cents = m[4] ? parseFloat(m[4].replace(/\s/g, '')) : 0;
  return midiToHz(midi + cents / 100, a4);
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

// Sub-holes (12-hole style, see docs/ocarina-mode.md "Sub-holes"): small
// holes beside a finger's hole that give the chamber's lowest notes. In
// opening order: going up from the lowest note the first one opens, then the
// second. Two sub-holes: 'taiwanese' beside each middle finger, 'japanese'
// beside the right index and middle fingers; one: beside the left middle
// finger (Pure Ocarinas: it shares the work between the hands).
export const OC_SUB_LAYOUTS = { taiwanese: ['L2', 'R2'], japanese: ['R1', 'R2'] };

// One chamber of a scale-built ocarina: holes in opening order and a
// cumulative fingering per note (note k = first k holes open). With
// subs: 1 or 2, the first holes are sub-holes, the rest finger holes.
// Hole positions (x, y) and sizes are filled in later by the UI / builder.
export function buildChamber(notes, { subs = 0, layout = 'taiwanese' } = {}) {
  const sorted = [...notes].sort((a, b) => a - b);
  const n = sorted.length - 1;
  const k = Math.max(0, Math.min(subs, 2, n));
  const subFingers = k === 1 ? ['L2'] : k === 2 ? (OC_SUB_LAYOUTS[layout] ?? OC_SUB_LAYOUTS.taiwanese) : [];
  const fingers = fingersForHoleCount(n - k);
  const holes = [
    ...subFingers.map(f => ({ id: `${f}s`, finger: f, side: 'top', sub: true, x: null, y: null, sizeMm: null })),
    ...fingers.map(f => ({
      id: f,
      finger: f,
      side: OC_THUMBS.includes(f) ? 'bottom' : 'top',
      x: null,
      y: null,
      sizeMm: null,
    })),
  ];
  const fingerings = {};
  sorted.forEach((midi, k) => {
    fingerings[midi] = holes.map((_, h) => (h < k ? 'o' : 'c'));
  });
  return { notes: sorted, holes, fingerings };
}

// Chambers, holes and fingerings for a scale-built ocarina from MIDI notes.
// Notes the sub-holes add below a scale: from its lowest note down, `count`
// notes, each a semitone or a tone lower. A note of the scale's key (pitch
// classes `pcs`) is taken when one is that close; otherwise a tone down.
// Sub-holes are small, so they never take a bigger step than that.
export function subExtensionNotes(lowest, pcs, count) {
  const inKey = m => pcs.has(((m % 12) + 12) % 12);
  const out = [];
  let cur = lowest;
  for (let i = 0; i < count; i++) {
    const next = inKey(cur - 1) ? cur - 1 : cur - 2;
    out.unshift(next);
    cur = next;
  }
  return out;
}

// subs / layout: sub-holes on the lowest chamber. They don't take any of the
// scale's notes: they add `subs` notes below it (subExtensionNotes, from the
// scale's pitch classes `pcs`), so the finger holes play the scale as before.
export function buildScaleChambers(midis, { subs = 0, layout = 'taiwanese', pcs = null } = {}) {
  const chambers = splitChambers(midis);
  if (subs > 0 && chambers.length) {
    const keyPcs = pcs ?? new Set(midis.map(m => ((m % 12) + 12) % 12));
    chambers[0] = [...subExtensionNotes(chambers[0][0], keyPcs, Math.min(subs, 2)), ...chambers[0]];
  }
  return chambers.map((c, i) => buildChamber(c, i === 0 ? { subs, layout } : {}));
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

// A hole over 12 mm becomes two holes of half the diameter, opened together
// (the brief's rule). A hole over 24 mm would still leave halves over 12 mm,
// so it becomes as many equal holes as it takes to stay at or under 12 mm.
// Returns the diameters.
export function splitHole(diameter, maxMm = OC_MAX_HOLE_MM) {
  const n = Math.ceil(diameter / maxMm);
  return n <= 1 ? [diameter] : Array.from({ length: n }, () => diameter / n);
}

// Applies diameters (one per hole, opening order) to a chamber from
// buildChamber, splitting holes over 12 mm into holes 'R4a', 'R4b', …
// that share the finger and the state in every fingering.
export function applyHoleSizes(chamber, diameters, maxMm = OC_MAX_HOLE_MM) {
  const holes = [];
  const source = []; // index of the original hole for each new hole
  chamber.holes.forEach((hole, i) => {
    const parts = splitHole(diameters[i], maxMm);
    parts.forEach((size, p) => {
      holes.push({ ...hole, id: parts.length > 1 ? hole.id + 'abcd'[p] : hole.id, sizeMm: size });
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

// ── Building fewer chambers than the full scale needs ───────────────────────

// How many chambers the full set of notes needs.
export function chambersNeeded(midis) {
  return splitChambers(midis).length;
}

// Every way to keep a run of consecutive scale notes that fits in
// `chambers` chambers, longest runs only: for each starting note, the most
// notes upward that still split into at most `chambers` chambers. Runs that
// sit wholly inside a longer run are dropped. Lowest start first.
//   e.g. F Low Pygmy (17), 1 chamber → Ab2–Bb3, …, F3–Gb4 (starts on the ding), …
// Returns [{ start, notes }] with start = MIDI of the lowest kept note.
export function noteWindows(midis, chambers = 1) {
  const notes = [...new Set(midis)].sort((a, b) => a - b);
  const runs = [];
  for (let i = 0; i < notes.length; i++) {
    let end = i;
    while (end + 1 < notes.length && chambersNeeded(notes.slice(i, end + 2)) <= chambers) end++;
    runs.push({ i, end });
  }
  return runs
    .filter(r => !runs.some(o => o !== r && o.i <= r.i && o.end >= r.end && (o.end - o.i) > (r.end - r.i)))
    .map(r => ({ start: notes[r.i], notes: notes.slice(r.i, r.end + 1) }));
}

// ── Calibration: fingerings from the instrument itself ──────────────────────
//
// For an ocarina whose maker chart is unknown. The pitch of a vessel flute
// depends on the total open hole size, not on where the holes are:
//   f = f0 × √(1 + Σ wᵢ·rᵢ)
// where f0 is the all-closed pitch, rᵢ = Dᵢ / W is hole i's size relative to
// the window, and wᵢ is 1 for an open hole, 0 for a covered one and about ½
// for a half-covered one (an approximation; the tuner confirms it). Measure a
// few fingerings, solve for r, then predict every fingering.

const OC_STATE_WEIGHT = { c: 0, o: 1, h: 0.5 };

// Pitch of any fingering (states, one per hole) from the hole ratios.
export function predictFingeringHz(f0, ratios, states) {
  const sum = states.reduce((acc, s, i) => acc + OC_STATE_WEIGHT[s] * ratios[i], 0);
  return f0 * Math.sqrt(1 + sum);
}

// Hole ratios rᵢ from measurements [{ states, hz }] by least squares on
// (hz/f0)² − 1 = Σ wᵢ rᵢ. The simplest calibration is one measurement per
// hole with only that hole open, which gives rᵢ = (fᵢ/f0)² − 1 directly.
// Throws if the measurements don't pin down every hole.
export function solveHoleRatios(f0, measurements) {
  const n = measurements[0].states.length;
  const AtA = Array.from({ length: n }, () => new Array(n).fill(0));
  const Atb = new Array(n).fill(0);
  for (const { states, hz } of measurements) {
    const w = states.map(s => OC_STATE_WEIGHT[s]);
    const y = (hz / f0) ** 2 - 1;
    for (let i = 0; i < n; i++) {
      Atb[i] += w[i] * y;
      for (let j = 0; j < n; j++) AtA[i][j] += w[i] * w[j];
    }
  }
  // Gaussian elimination with partial pivoting.
  const M = AtA.map((row, i) => [...row, Atb[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new RangeError(`Hole ${c} is not covered by the measurements`);
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// How awkward a fingering is: 10 per half-holed hole, plus 1 for every open
// hole that comes after a covered one in opening order (holes are listed in
// opening order, so the standard scale scores 0).
export function fingeringAwkwardness(states) {
  let score = 0;
  let seenClosed = false;
  for (const s of states) {
    if (s === 'h') score += 10;
    if (s === 'o' && seenClosed) score += 1;
    if (s !== 'o') seenClosed = true;
  }
  return score;
}

// Fingerings that give `targetHz` within `toleranceCents`, easiest first
// (least awkward, then closest). At most `maxHalf` half-holed holes.
// Returns [{ states, hz, cents }].
export function findFingerings(f0, ratios, targetHz, { toleranceCents = 20, maxHalf = 1, limit = 3 } = {}) {
  const n = ratios.length;
  const found = [];
  const consider = states => {
    const hz = predictFingeringHz(f0, ratios, states);
    const cents = centsBetween(hz, targetHz);
    if (Math.abs(cents) <= toleranceCents) found.push({ states, hz, cents });
  };
  for (let mask = 0; mask < (1 << n); mask++) {
    const base = Array.from({ length: n }, (_, i) => (mask >> i & 1 ? 'o' : 'c'));
    consider(base);
    if (maxHalf >= 1) {
      base.forEach((s, i) => {
        if (s === 'c') { const h = [...base]; h[i] = 'h'; consider(h); }
      });
    }
  }
  found.sort((a, b) =>
    fingeringAwkwardness(a.states) - fingeringAwkwardness(b.states) ||
    Math.abs(a.cents) - Math.abs(b.cents));
  return found.slice(0, limit);
}

// A full chromatic fingering chart predicted from calibration: for every
// semitone from the all-closed note to the all-open note, the easiest
// fingering within tolerance. Notes with no fingering in tolerance are left
// out. Returns { [midi]: { states, hz, cents } }.
export function calibratedChart(f0, ratios, { a4 = OC_DEFAULT_A4, toleranceCents = 20, maxHalf = 1 } = {}) {
  const top = predictFingeringHz(f0, ratios, ratios.map(() => 'o'));
  const chart = {};
  for (let midi = Math.ceil(hzToMidi(f0, a4) - toleranceCents / 100);
       midi <= Math.floor(hzToMidi(top, a4) + toleranceCents / 100); midi++) {
    const [best] = findFingerings(f0, ratios, midiToHz(midi, a4), { toleranceCents, maxHalf, limit: 1 });
    if (best) chart[midi] = best;
  }
  return chart;
}

// ── Traditional charts ───────────────────────────────────────────────────────
// Moved to js/charts.js (sourced charts only). Ocarinas of unknown make are
// charted by calibration (calibratedChart above, js/builder.js).
