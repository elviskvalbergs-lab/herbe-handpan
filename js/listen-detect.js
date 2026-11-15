// Listen: hearing chords from the microphone (docs/listen-mode.md).
//
// Pure functions, no DOM, no instrument: a spectrum goes in, chord guesses
// with a confidence come out, so a kalimba or tongue drum can reuse all of
// it. Unit tested in Node (tests/listen.test.mjs). The bundle is one script
// scope: every top-level name here starts with "listen" or "LISTEN" or is
// otherwise unique across js/*.js.
//
// Method (measured in spikes/listen/): chroma from spectral peaks that stand
// clear of the noise floor, overtones damped, matched against chord
// templates; smoothed over time; a chord is shown once it holds.

import { CHORD_TYPES } from './data.js';

// The chord types Listen names: the ones that can be told apart reliably
// from a phone microphone. Ids from CHORD_TYPES.
export const LISTEN_TYPES = ['maj', 'min', 'dom7', 'maj7', 'min7', 'sus2', 'sus4', 'dim'];

// Tuning knobs (the debug view changes them).
export const LISTEN_DEFAULTS = {
  fmin: 55, fmax: 2000,     // Hz range the chroma is taken from
  floorBins: 31,            // width of the running median that estimates the noise floor
  peakRatio: 3,             // a peak must be this many times the noise floor
  bassMaxHz: 260,           // the bass note is looked for below this
  alpha: 0.5,               // chroma smoothing per frame (0: none, 0.8: about 1 s at 10 frames/s)
  smoothFrames: 4,          // frames a chord must win in a row before it's shown
  silenceRatio: 0.12,       // a frame quieter than this × the recent loudest is silence
};

const LISTEN_PRIOR = { maj: 0.04, min: 0.04, dom7: 0, maj7: 0, min7: 0, sus2: -0.02, sus4: -0.02, dim: -0.03 };

// AnalyserNode.getFloatFrequencyData gives dB; the maths wants amplitude.
export function listenDbToMagnitudes(db) {
  const m = new Float32Array(db.length);
  for (let i = 0; i < db.length; i++) m[i] = db[i] > -200 ? Math.pow(10, db[i] / 20) : 0;
  return m;
}

function listenMedian(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s[s.length >> 1];
}

// Pitch class of a frequency (A4 = 440 Hz).
export function listenPitchClass(hz, a4 = 440) {
  const midi = Math.round(69 + 12 * Math.log2(hz / a4));
  return ((midi % 12) + 12) % 12;
}

// Chroma from one magnitude spectrum: { chroma[12], bass[12] | null,
// peaks, energy }, chroma and bass normalised to length 1.
//  - Peaks must stand above the noise floor (a running median) by peakRatio
//    and are weighted by how far above it and how loud they are.
//  - A peak at 3, 5, 6 or 7 times a stronger lower peak is mostly that
//    note's overtone (it would read as a fifth, a third or a seventh): it
//    counts for a quarter.
export function listenChroma(mag, sampleRate, fftSize, opts = {}) {
  const o = { ...LISTEN_DEFAULTS, ...opts };
  const binHz = sampleRate / fftSize;
  const i0 = Math.max(2, Math.ceil(o.fmin / binHz)), i1 = Math.min(mag.length - 2, Math.floor(o.fmax / binHz));
  const half = o.floorBins >> 1;
  const peaks = [];
  let energy = 0;
  for (let i = i0; i <= i1; i++) {
    energy += mag[i] * mag[i];
    if (!(mag[i] > mag[i - 1] && mag[i] >= mag[i + 1])) continue;
    const win = [];
    for (let k = Math.max(0, i - half); k <= Math.min(mag.length - 1, i + half); k++) win.push(mag[k]);
    const floor = listenMedian(win) + 1e-12;
    const snr = mag[i] / floor;
    if (snr <= o.peakRatio) continue;
    // Parabolic interpolation on the log magnitude for the exact frequency.
    const a = Math.log(mag[i - 1] + 1e-12), b = Math.log(mag[i] + 1e-12), c = Math.log(mag[i + 1] + 1e-12);
    const den = a - 2 * b + c;
    const off = den ? 0.5 * (a - c) / den : 0;
    peaks.push({ f: (i + off) * binHz, mag: mag[i], snr });
  }
  if (!peaks.length) return { chroma: null, bass: null, peaks: 0, energy };
  const maxMag = Math.max(...peaks.map(p => p.mag));
  for (const p of peaks) p.w = Math.log1p(p.snr - o.peakRatio) * Math.sqrt(p.mag / maxMag);
  const byWeight = [...peaks].sort((x, y) => y.w - x.w);
  for (const p of peaks) {
    for (const q of byWeight) {
      if (q === p || q.f >= p.f || q.w < p.w * 0.7) continue;
      const r = p.f / q.f, k = Math.round(r);
      if ([3, 5, 6, 7].includes(k) && Math.abs(r - k) < 0.03 * k) { p.w *= 0.25; break; }
    }
  }
  const chroma = new Array(12).fill(0), bass = new Array(12).fill(0);
  for (const p of peaks) {
    const pc = listenPitchClass(p.f);
    chroma[pc] += p.w;
    if (p.f < o.bassMaxHz) bass[pc] += p.w;
  }
  const norm = v => { const n = Math.hypot(...v); return n > 0 ? v.map(x => x / n) : null; };
  return { chroma: norm(chroma), bass: norm(bass), peaks: peaks.length, energy };
}

// Templates: chord tones +1, every other note −0.25, normalised.
const LISTEN_TEMPLATES = (() => {
  const out = [];
  for (const id of LISTEN_TYPES) {
    const type = CHORD_TYPES.find(t => t.id === id);
    for (let r = 0; r < 12; r++) {
      const v = new Array(12).fill(-0.25);
      for (const d of type.intervals) v[(r + d) % 12] = 1;
      const n = Math.hypot(...v);
      out.push({ rootPC: r, typeId: id, intervals: type.intervals, v: v.map(x => x / n) });
    }
  }
  return out;
})();

// Chord guesses for a chroma, best first: [{ rootPC, typeId, score }].
// The bass note nudges the root; plain triads come before extensions; a
// seventh only counts when its note is clearly there (≥ 45% of the triad's
// average). keyBoost: { set: Set of "rootPC-family", amount } prefers the
// song's key once it's known.
export function listenCandidates(chroma, bass = null, { keyBoost = null } = {}) {
  if (!chroma) return [];
  let bassPC = null;
  if (bass) { const m = Math.max(...bass); if (m > 0.5) bassPC = bass.indexOf(m); }
  const out = LISTEN_TEMPLATES.map(t => {
    let s = 0;
    for (let i = 0; i < 12; i++) s += chroma[i] * t.v[i];
    s += LISTEN_PRIOR[t.typeId] ?? 0;
    if (bassPC === t.rootPC) s += 0.08;
    if (t.intervals.length === 4) {
      const triad = (chroma[t.rootPC] + chroma[(t.rootPC + t.intervals[1]) % 12] + chroma[(t.rootPC + t.intervals[2]) % 12]) / 3;
      if (chroma[(t.rootPC + t.intervals[3]) % 12] < 0.45 * triad) s -= 0.2;
    }
    if (keyBoost?.set?.has(`${t.rootPC}-${listenFamily(t.typeId)}`)) s += keyBoost.amount ?? 0.12;
    return { rootPC: t.rootPC, typeId: t.typeId, score: s };
  });
  return out.sort((a, b) => b.score - a.score);
}

// Major, minor or diminished family of a chord type (sus: none).
export function listenFamily(typeId) {
  return { maj: 'maj', dom7: 'maj', maj7: 'maj', min: 'min', min7: 'min', dim: 'dim' }[typeId] ?? 'sus';
}

const listenClamp01 = x => Math.max(0, Math.min(1, x));

// How sure one frame's best guess is (0–1), for the chord and for its root:
// how well it fits and how far ahead of the next guess (any other chord;
// for the root, the best guess with another root).
export function listenFrameConfidence(cands) {
  if (!cands.length) return { chord: 0, root: 0 };
  const [best] = cands;
  const second = cands[1]?.score ?? 0;
  const otherRoot = cands.find(c => c.rootPC !== best.rootPC)?.score ?? 0;
  const fit = listenClamp01((best.score - 0.45) / 0.4);
  return {
    chord: listenClamp01(0.5 * fit + 0.5 * listenClamp01((best.score - second) / 0.12)),
    root: listenClamp01(0.5 * fit + 0.5 * listenClamp01((best.score - otherRoot) / 0.12)),
  };
}

// Words for a confidence: 'sure' ≥ 0.7, 'likely' ≥ 0.4, else 'unsure'.
export function listenConfidenceLevel(c) {
  return c >= 0.7 ? 'sure' : c >= 0.4 ? 'likely' : 'unsure';
}

// Follows the frames of one listening session. push(frame) with
// { chroma, bass, energy } (from listenChroma) returns
// { chord: { rootPC, typeId, confidence, rootConfidence, level } | null,
//   candidates (top 5), heard: false while silent, changed }.
// A chord is shown once it wins smoothFrames frames in a row; its
// confidence is the average of its frames' confidence, scaled by how
// steadily it held. Silence keeps the last chord, marked heard: false.
export function listenTracker(opts = {}) {
  const o = { ...LISTEN_DEFAULTS, ...opts };
  let smooth = null, runKey = null, run = 0, shown = null, loud = 0;
  let confSum = 0, rootSum = 0, frames = 0, agree = 0;
  const key = c => `${c.rootPC}-${c.typeId}`;
  return {
    push(frame, { keyBoost = null } = {}) {
      loud = Math.max(loud * 0.995, frame.energy || 0);
      if (!frame.chroma || (frame.energy || 0) < o.silenceRatio * loud) {
        return { chord: shown, candidates: [], heard: false, changed: false };
      }
      smooth = smooth ? smooth.map((x, i) => o.alpha * x + (1 - o.alpha) * frame.chroma[i]) : [...frame.chroma];
      const n = Math.hypot(...smooth) || 1;
      const cands = listenCandidates(smooth.map(x => x / n), frame.bass, { keyBoost });
      const best = cands[0];
      const fc = listenFrameConfidence(cands);
      const k = key(best);
      run = k === runKey ? run + 1 : 1;
      runKey = k;
      let changed = false;
      if (run >= o.smoothFrames && (!shown || key(shown) !== k)) {
        shown = { rootPC: best.rootPC, typeId: best.typeId };
        confSum = rootSum = frames = agree = 0;
        changed = true;
      }
      if (shown) {
        frames++;
        if (key(shown) === k) { agree++; confSum += fc.chord; rootSum += fc.root; }
        else if (best.rootPC === shown.rootPC) { rootSum += fc.root; }
        const steady = agree / frames;
        shown.confidence = agree ? (confSum / agree) * (0.5 + 0.5 * steady) : 0;
        shown.rootConfidence = frames ? (rootSum / frames) : 0;
        shown.level = listenConfidenceLevel(shown.confidence);
      }
      return { chord: shown && { ...shown }, candidates: cands.slice(0, 5), heard: true, changed };
    },
    reset() { smooth = null; runKey = null; run = 0; shown = null; loud = 0; },
  };
}

// The whole session: [{ confidence, ms }] → { value, level, text }:
// the chords' confidence weighted by how long each was heard.
export function listenOverallConfidence(chords) {
  const total = chords.reduce((s, c) => s + (c.ms || 0), 0);
  if (!total) return { value: 0, level: 'unsure', text: 'Nothing heard yet' };
  const value = chords.reduce((s, c) => s + (c.confidence || 0) * (c.ms || 0), 0) / total;
  const level = listenConfidenceLevel(value);
  const text = level === 'sure' ? 'Heard clearly'
    : level === 'likely' ? 'Mostly clear'
    : 'Hard to hear: ask them to play it again, closer to the phone';
  return { value, level, text };
}

// A chord (root pitch class + type) on any instrument, given the MIDI notes
// it can play: { voicing (one note per chord tone it has, stacked up from
// the lowest root), all (every playable note of the chord's pitch classes),
// missing (pitch classes it doesn't have), hasRoot }.
export function listenChordOnNotes(rootPC, typeId, playable) {
  const type = CHORD_TYPES.find(t => t.id === typeId);
  const notes = [...new Set(playable)].sort((a, b) => a - b);
  const pcOf = m => ((m % 12) + 12) % 12;
  const tones = type.intervals.map(d => (rootPC + d) % 12);
  const all = notes.filter(m => tones.includes(pcOf(m)));
  const missing = tones.filter(pc => !notes.some(m => pcOf(m) === pc));
  const roots = notes.filter(m => pcOf(m) === rootPC);
  // From the lowest root (or the lowest chord note when there's no root),
  // each other tone at its nearest playable note above.
  const base = roots[0] ?? all[0];
  const voicing = base == null ? [] : [base];
  for (const pc of tones) {
    if (pc === pcOf(base)) continue;
    const above = notes.find(m => m > base && pcOf(m) === pc) ?? notes.filter(m => pcOf(m) === pc).pop();
    if (above != null) voicing.push(above);
  }
  return { voicing: voicing.sort((a, b) => a - b), all, missing, hasRoot: roots.length > 0 };
}
