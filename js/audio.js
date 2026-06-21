import { noteToFreq, noteToMidi } from './data.js';

let ctx = null;
let masterGain = null;

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.7;
  masterGain.connect(ctx.destination);

  // iOS unlock: play a 1-sample buffer + resume() synchronously in the
  // user-gesture handler. The buffer must be started before resume() resolves.
  const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
  ctx.resume();
}

function whenRunning(fn) {
  if (!ctx) initAudio();
  if (ctx.state === 'running') { fn(); return; }
  // This is always called from a user-gesture handler (click/touch),
  // so resume() is allowed by iOS regardless of prior suspension.
  ctx.resume().then(fn);
}

// 80ms — enough time for ctx.resume() to resolve asynchronously on iOS
// before the scheduled note start time.
const START_OFFSET = 0.08;

function playFreq(freq, startTime) {
  if (!ctx) return;
  const now = startTime ?? ctx.currentTime;

  // Two harmonics: fundamental + octave. Three or more overloads iOS
  // audio processing during chord/scale playback.
  const harmonics = [
    { mult: 1, gain: 0.60, decay: 4.5 },
    { mult: 2, gain: 0.28, decay: 2.2 },
  ];

  harmonics.forEach(({ mult, gain, decay }) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * mult;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(gain, now + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.connect(env);
    env.connect(masterGain);
    osc.start(now);
    osc.stop(now + decay + 0.05);
    // Disconnect after stop so iOS can release the nodes promptly.
    osc.onended = () => { osc.disconnect(); env.disconnect(); };
  });
}

export function playNote(noteName) {
  initAudio();
  whenRunning(() => playFreq(noteToFreq(noteName), ctx.currentTime + START_OFFSET));
}

export function playChord(noteNames, onArp, onTogether) {
  initAudio();
  const sorted = [...noteNames].sort((a, b) => noteToMidi(a) - noteToMidi(b));
  const ARP = 0.3;
  const togetherOffset = sorted.length * ARP + 0.35;
  whenRunning(() => {
    const now = ctx.currentTime + START_OFFSET;
    sorted.forEach((n, i) => {
      playFreq(noteToFreq(n), now + i * ARP);
      if (onArp) setTimeout(() => onArp(n), Math.round(i * ARP * 1000));
    });
    sorted.forEach(n => playFreq(noteToFreq(n), now + togetherOffset));
    if (onTogether) setTimeout(() => onTogether(sorted), Math.round(togetherOffset * 1000));
  });
}

export function playScale(noteNames, onNote) {
  initAudio();
  const asc = [...noteNames].sort((a, b) => noteToMidi(a) - noteToMidi(b));
  const desc = asc.slice(0, -1).reverse();
  const all = [...asc, ...desc];
  const INTERVAL = 0.4;
  whenRunning(() => {
    const now = ctx.currentTime + START_OFFSET;
    all.forEach((n, i) => {
      playFreq(noteToFreq(n), now + i * INTERVAL);
      if (onNote) setTimeout(() => onNote(n), Math.round(i * INTERVAL * 1000));
    });
  });
}
