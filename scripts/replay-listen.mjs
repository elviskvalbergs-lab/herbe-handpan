#!/usr/bin/env node
// Replays a recording through what the app does while it listens: the tuner
// (tunerFrame: YIN, then the spectral check) every 50 ms, the stability
// tracker, and the free "just listen" collection with the instrument's own
// tuning (collectHeardNote). Prints each note as it is taken, what it would
// be named, and the best matches. Used for listening reports from the app
// (docs/design-system.md, "Listening to real instruments").
//
//   node scripts/replay-listen.mjs <recording> [--family tongue-drum] [--tuned 0|1] [--frames]
//
// Needs ffmpeg to decode the recording (webm, m4a, ogg, wav, …).
import { execFileSync } from 'node:child_process';
import { yinPitch, tunerFrame, createStabilityTracker, rmsLevel, TUNER_WINDOW, TUNER_LONG_WINDOW } from '../js/tuner.js';
import { collectHeardNote, a4ForOffset, chartSetupTunings } from '../js/setup.js';
import { rankScalesByNotes } from '../js/scalefinder.js';
import { LAYOUT_FAMILIES } from '../js/layoutfamilies.js';
import { midiToNoteName } from '../js/instruments.js';

const args = process.argv.slice(2);
const file = args.find((a, i) => !a.startsWith('--') && !['--family', '--tuned'].includes(args[i - 1]));
const opt = (name, d) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : d; };
if (!file) { console.error('Usage: node scripts/replay-listen.mjs <recording> [--family tongue-drum] [--tuned 0|1] [--frames]'); process.exit(1); }
const family = opt('family', 'handpan');
const tuned = opt('tuned', '1') !== '0';
const showFrames = args.includes('--frames');

const SR = 48000, WINDOW = TUNER_WINDOW, HOP = SR / 20; // 50 ms, as startTuner
const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
console.log(`${file}: ${(x.length / SR).toFixed(1)} s, ${family}, ${tuned ? 'named on its own tuning' : 'named on A = 440'}`);

const tracker = createStabilityTracker();
let L = { raw: [], notes: [] }, lastSince = null, offset = 0;
const cents = m => Math.round((m - Math.round(m)) * 100);
// As startTuner: the analyser holds the last TUNER_LONG_WINDOW samples.
const padded = new Float32Array(TUNER_LONG_WINDOW + x.length);
padded.set(x, TUNER_LONG_WINDOW);
for (let s = 0; s + WINDOW <= x.length; s += HOP) {
  const end = TUNER_LONG_WINDOW + s + WINDOW;
  const buf = padded.subarray(end - TUNER_LONG_WINDOW, end);
  const t = (s / SR) * 1000;
  const { hz } = tunerFrame(buf, SR);
  const r = tracker.push(hz, t);
  if (showFrames) {
    const res = yinPitch(buf.subarray(buf.length - TUNER_WINDOW), SR);
    if (res || hz) console.log(`  ${(t / 1000).toFixed(2)}s  rms ${rmsLevel(buf.subarray(buf.length - TUNER_WINDOW)).toFixed(4)}  yin ${res ? res.hz.toFixed(1) : '-'} (${res ? res.clarity.toFixed(2) : '-'})  → ${hz ? hz.toFixed(1) : 'dropped'}`);
  }
  if (!r.stable || !(r.hz > 0) || r.since === lastSince) continue;
  lastSince = r.since;
  const next = collectHeardNote(L, r.midi, { tuned });
  const name = `${midiToNoteName(Math.round(r.midi))} ${cents(r.midi) >= 0 ? '+' : ''}${cents(r.midi)}c (${r.hz.toFixed(1)} Hz)`;
  if (!next) { console.log(`${(r.since / 1000).toFixed(2)}s  ${name}  · not new`); continue; }
  L = next; offset = next.offset;
  console.log(`${(r.since / 1000).toFixed(2)}s  ${name}  → ${L.notes.map(midiToNoteName).join(' ')}`);
}

console.log(`\nHeard: ${L.notes.map(midiToNoteName).join(' ') || 'nothing'}`);
console.log(`Tuning: ${offset ? `A = ${a4ForOffset(offset)} Hz (${offset} cents)` : 'A = 440 Hz'}`);
const tunings = LAYOUT_FAMILIES[family]?.tunings ?? chartSetupTunings(family);
const ranked = rankScalesByNotes(L.notes, tunings).filter(r => r.ding !== 'none').slice(0, 5);
console.log('Best matches:');
for (const r of ranked) console.log(`  ${r.scale.name} (${r.scale.id}): ${r.reasons.join(' · ')}`);
