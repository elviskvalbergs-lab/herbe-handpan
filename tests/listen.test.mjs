// Unit tests for js/listen-detect.js. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SCALES, createLayoutFromScale, getAllNotes, noteToMidi } from '../js/data.js';
import {
  listenChroma, listenCandidates, listenTracker, listenFrameConfidence, listenConfidenceLevel,
  listenOverallConfidence, listenChordOnNotes, listenPitchClass, listenDbToMagnitudes, LISTEN_TYPES,
} from '../js/listen-detect.js';
import { instrumentFromChart } from '../js/charts.js';
import { playableMidis } from '../js/ocarina-ui.js';

const SR = 48000, FFT = 16384;
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const hz = m => 440 * 2 ** ((m - 69) / 12);

// A magnitude spectrum like a struck or strummed chord: each note with its
// first `partials` overtones (amplitude 1/k), a little smeared, over a
// noise floor. seed makes the noise repeatable.
function spectrum(midis, { partials = 6, noise = 0.002, seed = 1 } = {}) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const mag = new Float32Array(FFT / 2 + 1);
  for (let i = 0; i < mag.length; i++) mag[i] = noise * (0.5 + rnd());
  for (const m of midis) {
    for (let k = 1; k <= partials; k++) {
      const bin = (hz(m) * k) / (SR / FFT);
      const i = Math.round(bin);
      if (i + 1 >= mag.length) continue;
      mag[i] += 1 / k;
      mag[i - 1] += 0.4 / k;
      mag[i + 1] += 0.4 / k;
    }
  }
  return mag;
}

const nameOf = c => `${NAMES[c.rootPC]}${{ maj: '', min: 'm', dom7: '7', maj7: 'maj7', min7: 'm7', sus2: 'sus2', sus4: 'sus4', dim: 'dim' }[c.typeId]}`;
const best = midis => nameOf(listenCandidates(...Object.values(pick(listenChroma(spectrum(midis), SR, FFT))))[0]);
const pick = r => ({ chroma: r.chroma, bass: r.bass });

test('pitch classes and dB conversion', () => {
  assert.equal(listenPitchClass(440), 9);
  assert.equal(listenPitchClass(261.63), 0);
  assert.equal(listenPitchClass(82.41), 4);
  const m = listenDbToMagnitudes(new Float32Array([0, -20, -Infinity]));
  assert.ok(Math.abs(m[0] - 1) < 1e-6 && Math.abs(m[1] - 0.1) < 1e-6 && m[2] === 0);
});

test('chords from spectra with overtones: guitar and piano voicings', () => {
  // Open guitar voicings (MIDI) and piano block chords, overtones included.
  const cases = {
    C: [48, 52, 55, 60, 64], G: [43, 47, 50, 55, 59, 67], Am: [45, 52, 57, 60, 64], F: [41, 48, 53, 57, 60, 65],
    D: [50, 57, 62, 66], Em: [40, 47, 52, 55, 59, 64], E: [40, 47, 52, 56, 59, 64], Dm: [50, 57, 62, 65],
    A7: [45, 52, 55, 61, 64], Dm7: [50, 57, 60, 65], Cmaj7: [48, 52, 55, 59, 64], Bdim: [47, 50, 53, 59],
    Gsus4: [43, 50, 55, 60, 67], Dsus2: [50, 57, 62, 64],
  };
  for (const [want, midis] of Object.entries(cases)) assert.equal(best(midis), want, want);
});

test('overtones alone do not add a seventh', () => {
  // E's 3rd overtone is B, C's 5th is E: a plain C triad with strong
  // overtones stays C, not Cmaj7.
  assert.equal(nameOf(listenCandidates(...Object.values(pick(listenChroma(spectrum([48, 52, 55], { partials: 8 }), SR, FFT))))[0]), 'C');
});

test('noise floor: quiet hiss gives no chroma, a chord over hiss still reads', () => {
  const hiss = listenChroma(spectrum([], { noise: 0.01 }), SR, FFT);
  assert.equal(hiss.chroma, null);
  assert.equal(best([45, 52, 57, 60, 64]), 'Am');
  const noisy = listenChroma(spectrum([45, 52, 57, 60, 64], { noise: 0.05, seed: 3 }), SR, FFT);
  assert.equal(nameOf(listenCandidates(noisy.chroma, noisy.bass)[0]).slice(0, 1), 'A');
});

test('confidence: a clean chord is sure, a muddle is not', () => {
  const clean = listenChroma(spectrum([48, 52, 55, 60, 64]), SR, FFT);
  const cc = listenFrameConfidence(listenCandidates(clean.chroma, clean.bass));
  assert.ok(cc.chord > 0.6, `clean ${cc.chord}`);
  // A cluster C–C#–D–Eb–E: nothing fits well.
  const mud = listenChroma(spectrum([60, 61, 62, 63, 64]), SR, FFT);
  const mc = listenFrameConfidence(listenCandidates(mud.chroma, mud.bass));
  assert.ok(mc.chord < cc.chord, `mud ${mc.chord}`);
  assert.equal(listenConfidenceLevel(0.8), 'sure');
  assert.equal(listenConfidenceLevel(0.5), 'likely');
  assert.equal(listenConfidenceLevel(0.2), 'unsure');
});

test('key boost prefers the song key between same-note chords', () => {
  // C D G: Csus2 or Gsus4. In G major with a G boost... both sus, so boost by family has no effect;
  // Am7 vs C6 (A C E G): in C major (C maj family boosted) it reads C-family or Am-family by key.
  const r = listenChroma(spectrum([57, 60, 64, 67]), SR, FFT);
  const plain = listenCandidates(r.chroma, null);
  assert.ok(['Am7', 'C', 'Am'].includes(nameOf(plain[0])), nameOf(plain[0]));
  const inA = listenCandidates(r.chroma, null, { keyBoost: { set: new Set(['9-min']), amount: 0.2 } });
  assert.equal(NAMES[inA[0].rootPC], 'A');
});

test('tracker: a chord shows once it holds, with its confidence; silence keeps it', () => {
  const t = listenTracker({ smoothFrames: 3 });
  const g = listenChroma(spectrum([43, 47, 50, 55, 59, 67]), SR, FFT);
  const frame = { ...g };
  let r;
  r = t.push(frame); assert.equal(r.chord, null);
  r = t.push(frame); assert.equal(r.chord, null);
  r = t.push(frame); assert.equal(nameOf(r.chord), 'G'); assert.ok(r.changed);
  for (let i = 0; i < 5; i++) r = t.push(frame);
  assert.equal(r.chord.level, 'sure');
  assert.equal(r.candidates.length, 5);
  r = t.push({ chroma: null, bass: null, energy: 0 });
  assert.equal(nameOf(r.chord), 'G'); assert.equal(r.heard, false);
  // A change needs its own run.
  const em = listenChroma(spectrum([40, 47, 52, 55, 59, 64]), SR, FFT);
  for (let i = 0; i < 6; i++) r = t.push({ ...em });
  assert.equal(nameOf(r.chord), 'Em');
});

test('overall confidence weights chords by time', () => {
  assert.equal(listenOverallConfidence([]).level, 'unsure');
  const o = listenOverallConfidence([{ confidence: 0.9, ms: 8000 }, { confidence: 0.2, ms: 1000 }]);
  assert.equal(o.level, 'sure');
  assert.equal(listenOverallConfidence([{ confidence: 0.3, ms: 5000 }]).text.startsWith('Hard to hear'), true);
});

// ── The closest version on real instruments ──────────────────────────────
const layoutMidis = id => getAllNotes(createLayoutFromScale(SCALES.find(s => s.id === id))).map(noteToMidi);
const N = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, Bb: 10, B: 11 };

test('closest version on D Kurd 9', () => {
  const pan = layoutMidis('D-Kurd');
  const dm = listenChordOnNotes(N.D, 'min', pan);
  assert.deepEqual(dm.missing, []);
  assert.deepEqual(dm.voicing.map(m => m % 12).sort(), [2, 5, 9].sort((a, b) => a - b));
  assert.equal(dm.voicing[0], noteToMidi('D3'));         // from the ding
  const g = listenChordOnNotes(N.G, 'maj', pan);          // G B D: no B on D Kurd
  assert.deepEqual(g.missing, [N.B]);
  assert.ok(g.hasRoot);
  const e = listenChordOnNotes(N.E, 'maj', pan);          // E G# B
  assert.deepEqual(e.missing.sort((a, b) => a - b), [8, 11]);
});

test('closest version on D Celtic Minor 9', () => {
  const pan = layoutMidis('D-Celtic-Minor');
  const c = listenChordOnNotes(N.C, 'maj', pan);
  const am = listenChordOnNotes(N.A, 'min', pan);
  assert.ok(c.all.length > 0 && am.all.length > 0);
  // Whatever is missing really isn't on the pan, and everything kept is.
  for (const r of [c, am]) {
    for (const pc of r.missing) assert.ok(!pan.some(m => m % 12 === pc));
    for (const m of r.voicing) assert.ok(pan.includes(m));
  }
  assert.ok(listenChordOnNotes(N.Bb, 'maj', pan).missing.includes(N.Bb)); // no Bb on Celtic minor
});

test('closest version on a layout with bottom notes (F Low Pygmy 11)', () => {
  const pan = layoutMidis('F-Low-Pygmy-11');            // F3 | G3 Ab3 C4 Eb4 F4 G4 Ab4 C5, bottoms Db3 Eb3
  const db = listenChordOnNotes(1, 'maj', pan);           // Db F Ab: the root is only on the bottom
  assert.deepEqual(db.missing, []);
  assert.equal(db.voicing[0], noteToMidi('Db3'));
  const fm = listenChordOnNotes(N.F, 'min', pan);
  assert.equal(fm.voicing[0], noteToMidi('F3'));
});

test('closest version on a 12-hole alto C ocarina (one note at a time)', () => {
  const oc = instrumentFromChart('ocarina-12-stl-c', 'C-A4');
  const notes = playableMidis(oc);
  const am = listenChordOnNotes(N.A, 'min', notes);
  assert.deepEqual(am.missing, []);                        // chromatic: every pitch class is there
  assert.ok(am.all.length >= 3);
  for (const m of am.voicing) assert.ok(notes.includes(m));
});

test('chord types Listen names are real chord types', () => {
  assert.deepEqual(LISTEN_TYPES, ['maj', 'min', 'dom7', 'maj7', 'min7', 'sus2', 'sus4', 'dim']);
});
