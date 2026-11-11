// Unit tests for js/ocarina.js. Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SCALES, noteToMidi } from '../js/data.js';
import {
  midiToHz, hzToMidi, centsBetween, scaleToMidis, splitChambers,
  fingersForHoleCount, buildChamber, buildScaleChambers,
  windowEquivalent, totalOpenDiameter, holeSizes, relativeHoleSizes,
  splitHole, applyHoleSizes, windowArea, defaultWindow, helmholtzVolume,
  ballDiameter, chamberVolume, leatherTarget, firedPitch, learnedShrinkage,
  canPlayTogether, playablePairs,
} from '../js/ocarina.js';

const m = n => noteToMidi(n);
const ms = names => names.split(' ').map(m);
const close = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= eps, `${actual} ≠ ${expected} (±${eps})`);
const scale = id => SCALES.find(s => s.id === id);

// ── Pitch ────────────────────────────────────────────────────────────────────

test('midiToHz: A4 = 440, A4 reference respected', () => {
  close(midiToHz(69), 440);
  close(midiToHz(57), 220);
  close(midiToHz(60), 261.6255653005986);
  close(midiToHz(69, 442), 442);
  close(hzToMidi(midiToHz(62, 432), 432), 62);
  close(centsBetween(440 * 2 ** (12 / 1200), 440), 12);
});

// ── Chambers ─────────────────────────────────────────────────────────────────

test('D Kurd splits into D3–D4 and E4–A4', () => {
  const midis = scaleToMidis(scale('D-Kurd'));
  assert.deepEqual(midis, ms('D3 A3 Bb3 C4 D4 E4 F4 G4 A4'));
  assert.deepEqual(splitChambers(midis), [ms('D3 A3 Bb3 C4 D4'), ms('E4 F4 G4 A4')]);
});

test('F Low Pygmy with gu notes splits into three chambers', () => {
  const midis = scaleToMidis(scale('F-Low-Pygmy-17'), { includeGu: true });
  assert.equal(midis.length, 17);
  const chambers = splitChambers(midis);
  assert.equal(chambers.length, 3);
  // Walk gives Ab2–Ab3 | Bb3–Bb4 | C5; the lone C5 takes Bb4 from below.
  assert.deepEqual(chambers, [
    ms('Ab2 Bb2 C3 Db3 Eb3 F3 Gb3 Ab3'),
    ms('Bb3 C4 Db4 Eb4 F4 Gb4 Ab4'),
    ms('Bb4 C5'),
  ]);
  assert.deepEqual(chambers.flat(), midis);
});

test('F Low Pygmy without gu notes', () => {
  const midis = scaleToMidis(scale('F-Low-Pygmy-17'), { includeGu: false });
  assert.deepEqual(midis[0], m('F3'));
  const chambers = splitChambers(midis);
  assert.deepEqual(chambers.flat(), midis);
  chambers.forEach(c => assert.ok(c.length >= 2));
});

test('span of 14 semitones or less stays in one chamber', () => {
  assert.deepEqual(splitChambers(ms('C4 D4 E4 D5')), [ms('C4 D4 E4 D5')]);
  assert.deepEqual(splitChambers([]), []);
});

test('a lone top note merges when the chamber below cannot spare one', () => {
  // C4 D4 | E5 (16 semitones): lower chamber has only 2 notes, so merge.
  assert.deepEqual(splitChambers(ms('C4 D4 E5')), [ms('C4 D4 E5')]);
});

test('transpose shifts every note', () => {
  const midis = scaleToMidis(scale('D-Kurd'), { transpose: 2 });
  assert.deepEqual(midis, scaleToMidis(scale('D-Kurd')).map(x => x + 2));
});

// ── Fingerings ───────────────────────────────────────────────────────────────

test('finger order: right pinky first, thumbs last above 8 holes', () => {
  assert.deepEqual(fingersForHoleCount(4), ['R4', 'R3', 'R2', 'R1']);
  assert.deepEqual(fingersForHoleCount(8), ['R4', 'R3', 'R2', 'R1', 'L4', 'L3', 'L2', 'L1']);
  assert.deepEqual(fingersForHoleCount(9), ['R4', 'R3', 'R2', 'R1', 'L4', 'L3', 'L2', 'LT', 'RT']);
  assert.deepEqual(fingersForHoleCount(10), ['R4', 'R3', 'R2', 'R1', 'L4', 'L3', 'L2', 'L1', 'LT', 'RT']);
  assert.throws(() => fingersForHoleCount(11), RangeError);
});

test('cumulative fingerings for a chamber', () => {
  const ch = buildChamber(ms('D3 A3 Bb3 C4 D4'));
  assert.deepEqual(ch.holes.map(h => h.id), ['R4', 'R3', 'R2', 'R1']);
  assert.ok(ch.holes.every(h => h.side === 'top'));
  assert.deepEqual(ch.fingerings[m('D3')], ['c', 'c', 'c', 'c']);
  assert.deepEqual(ch.fingerings[m('A3')], ['o', 'c', 'c', 'c']);
  assert.deepEqual(ch.fingerings[m('C4')], ['o', 'o', 'o', 'c']);
  assert.deepEqual(ch.fingerings[m('D4')], ['o', 'o', 'o', 'o']);
});

test('thumb holes sit underneath', () => {
  const ch = buildChamber([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70]); // 10 holes
  assert.deepEqual(ch.holes.slice(-2).map(h => [h.finger, h.side]), [['LT', 'bottom'], ['RT', 'bottom']]);
  assert.equal(ch.holes.filter(h => h.side === 'top').length, 8);
});

// ── Hole sizes ───────────────────────────────────────────────────────────────

test('hole sizes from tuner readings: worked example', () => {
  // Closed pitch f0 = 300 Hz; a 6 mm test hole raises it to f1 = 330 Hz.
  //   W  = 6 / ((330/300)² − 1) = 6 / (1.21 − 1) = 6 / 0.21 = 28.5714… mm
  // Targets 330, 360, 390 Hz:
  //   D1 = W × (1.1² − 1) = W × 0.21 = 6.0 mm
  //   D2 = W × (1.2² − 1) = W × 0.44 = 12.5714… mm
  //   D3 = W × (1.3² − 1) = W × 0.69 = 19.7142… mm
  // Holes: 6.0, 12.5714 − 6 = 6.5714, 19.7142 − 12.5714 = 7.1428 mm
  const W = 6 / 0.21;
  close(windowEquivalent(300, 6, 330), W, 1e-12);
  close(totalOpenDiameter(W, 300, 360), W * 0.44, 1e-12);

  const r = holeSizes({ f0: 300, d: 6, f1: 330, targets: [330, 360, 390] });
  close(r.W, 28.571428571428573, 1e-9);
  close(r.totals[0], 6, 1e-9);
  close(r.totals[1], 12.571428571428571, 1e-9);
  close(r.totals[2], 19.714285714285715, 1e-9);
  close(r.holes[0], 6, 1e-9);
  close(r.holes[1], 6.571428571428571, 1e-9);
  close(r.holes[2], 7.142857142857144, 1e-9);
  assert.equal(r.testHoleIndex, 0); // first hole ≥ 6 mm
  assert.throws(() => windowEquivalent(300, 6, 300), RangeError);
});

test('relative hole sizes before readings', () => {
  const rel = relativeHoleSizes(300, [330, 360, 390]);
  close(rel[2], 1);
  close(rel[0], 0.21 / 0.25, 1e-12); // hole sizes ∝ 0.21, 0.23, 0.25
  close(rel[1], 0.23 / 0.25, 1e-12);
});

test('holes over 12 mm split in two, sharing finger and state', () => {
  assert.deepEqual(splitHole(12), [12]);
  assert.deepEqual(splitHole(14), [7, 7]);
  const ch = applyHoleSizes(buildChamber(ms('C4 D4 E4')), [8, 14]);
  assert.deepEqual(ch.holes.map(h => [h.id, h.finger, h.sizeMm]), [['R4', 'R4', 8], ['R3a', 'R3', 7], ['R3b', 'R3', 7]]);
  assert.deepEqual(ch.fingerings[m('C4')], ['c', 'c', 'c']);
  assert.deepEqual(ch.fingerings[m('D4')], ['o', 'c', 'c']);
  assert.deepEqual(ch.fingerings[m('E4')], ['o', 'o', 'o']);
});

// ── Window and volume ────────────────────────────────────────────────────────

test('window area by shape', () => {
  close(windowArea({ shape: 'rect', w: 10, l: 7.5 }), 75);
  close(windowArea({ shape: 'round', w: 10 }), Math.PI * 25);
  close(windowArea({ shape: 'oval', w: 10, l: 8 }), Math.PI * 20);
  assert.throws(() => windowArea({ shape: 'hex', w: 1, l: 1 }), RangeError);
});

test('default window', () => {
  assert.deepEqual(defaultWindow(262), { shape: 'rect', w: 10, l: 7.5, t: 4 });
  assert.equal(defaultWindow(2000).w, 6);   // clamped low
  assert.equal(defaultWindow(50).w, 16);    // clamped high
});

test('inside volume: worked example', () => {
  // Window 10 × 7.5 mm, wall 4 mm, concert closed pitch 262 Hz, shrinkage 11%.
  //   A  = 75 mm² = 7.5e-5 m²
  //   a  = √(A/π) = 4.886025… mm
  //   K  = A / (t + 1.5a) = 75 / (4 + 7.329038) = 6.620156… mm
  //   f  = 262 × 0.89 = 233.18 Hz (leather-hard target)
  //   V  = K c² / (4π² f²) = 0.006620156 × 343² / (4π² × 233.18²) m³
  //      = 3.6284… e-4 m³ = 362.84 cm³
  //   fired V = V × 0.89³ = 255.79 cm³; ball ∅ = ∛(6V/π) = 88.49 mm
  const a = Math.sqrt(75 / Math.PI);
  const K = 75 / (4 + 1.5 * a);                    // mm
  const f = 262 * 0.89;
  const V = (K / 1000) * 343 ** 2 / (4 * Math.PI ** 2 * f ** 2) * 1e6; // cm³
  close(a, 4.886025119029199, 1e-9);
  close(K, 6.620156, 1e-5);
  close(V, 362.84, 0.01);

  close(helmholtzVolume(75, 4, f), V, 1e-9);
  const r = chamberVolume({ shape: 'rect', w: 10, l: 7.5, t: 4 }, 262, 0.11);
  close(r.area, 75);
  close(r.leatherHz, 233.18, 1e-9);
  close(r.volume, V, 1e-9);
  close(r.firedVolume, V * 0.89 ** 3, 1e-9);
  close(r.ballDiameter, Math.cbrt(6 * V * 1000 / Math.PI), 1e-9);
  close(r.firedVolume, 255.79, 0.01);
  close(r.ballDiameter, 88.49, 0.01); // mm
  close(ballDiameter(Math.PI / 6), 10, 1e-9); // 1 cm ball → π/6 cm³
});

// ── Shrinkage ────────────────────────────────────────────────────────────────

test('shrinkage targets and learned shrinkage', () => {
  close(leatherTarget(440, 0.11), 391.6, 1e-9);
  close(firedPitch(391.6, 0.11), 440, 1e-9);
  const leather = { 62: 261.0, 64: 293.0, 65: 310.0 };
  const final = { 62: 290.0, 64: 330.0, 67: 400.0 };
  const expected = ((1 - 261 / 290) + (1 - 293 / 330)) / 2;
  close(learnedShrinkage(leather, final), expected, 1e-12);
  assert.equal(learnedShrinkage({ 60: 1 }, { 61: 1 }), null);
});

// ── Two-note pairs ───────────────────────────────────────────────────────────

test('two-note pairs on a double ocarina built from D Kurd', () => {
  const [low, high] = buildScaleChambers(scaleToMidis(scale('D-Kurd')));
  // low: D3 A3 Bb3 C4 D4 on R4 R3 R2 R1; high: E4 F4 G4 A4 on R4 R3 R2.
  // Same number of holes open on both → same fingers lifted → playable.
  assert.equal(canPlayTogether(low, m('D3'), high, m('E4')), true);  // all closed
  assert.equal(canPlayTogether(low, m('A3'), high, m('F4')), true);  // R4 open on both
  // D3 needs R4 down, F4 needs R4 up → not playable.
  assert.equal(canPlayTogether(low, m('D3'), high, m('F4')), false);
  // D4 lifts R1, which the high chamber doesn't use, but needs R4–R2 up; A4 has them up.
  assert.equal(canPlayTogether(low, m('D4'), high, m('A4')), true);
  assert.equal(canPlayTogether(low, m('C4'), high, m('A4')), true);
  assert.equal(canPlayTogether(low, m('C4'), high, m('G4')), false);
  // Same chamber or unknown note → never.
  assert.equal(canPlayTogether(low, m('D3'), low, m('A3')), false);
  assert.equal(canPlayTogether(low, m('E4'), high, m('F4')), false);

  // D minor chord (D F A) across both chambers.
  const pairs = playablePairs([low, high], ms('D3 F4 A3 D4 A4'));
  const names = pairs.map(p => `${p.a.midi}/${p.b.midi}`).sort();
  assert.deepEqual(names, [`${m('A3')}/${m('F4')}`, `${m('D4')}/${m('A4')}`].sort());
});

test('half-holed counts as on', () => {
  const a = { holes: [{ finger: 'R4' }], fingerings: { 60: ['h'] } };
  const b = { holes: [{ finger: 'R4' }], fingerings: { 72: ['c'], 74: ['o'] } };
  assert.equal(canPlayTogether(a, 60, b, 72), true);
  assert.equal(canPlayTogether(a, 60, b, 74), false);
});
