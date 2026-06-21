import { noteToFreq, noteToMidi } from './data.js';

let ctx = null;
let masterGain = null;

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.7;
  masterGain.connect(ctx.destination);
  // iOS unlock: resume() + silent buffer inside the user-gesture handler.
  ctx.resume();
  const silentBuf = ctx.createBuffer(1, 1, 22050);
  const silentSrc = ctx.createBufferSource();
  silentSrc.buffer = silentBuf;
  silentSrc.connect(ctx.destination);
  silentSrc.start(0);
  // iOS auto-suspends AudioContext after silence between interactions.
  // Tick a 1-sample silent buffer every 2s so whenRunning() always takes
  // the fast synchronous path and notes schedule at the correct time.
  setInterval(() => {
    if (!ctx) return;
    if (ctx.state === 'suspended') { ctx.resume(); return; }
    const b = ctx.createBuffer(1, 1, ctx.sampleRate);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(masterGain);
    s.start();
  }, 2000);
}

function whenRunning(fn) {
  if (!ctx) initAudio();
  if (ctx.state === 'running') { fn(); return; }
  ctx.resume().then(fn);
}

const START_OFFSET = 0.02;

function playFreq(freq, startTime) {
  if (!ctx) return;
  const now = startTime ?? ctx.currentTime;

  // Two harmonics only — fundamental + octave. Three harmonics + a delay
  // feedback loop per note creates ~50+ simultaneous nodes for a full scale,
  // which overloads iOS audio processing and causes garbling.
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
    env.gain.linearRampToValueAtTime(gain, now + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.connect(env);
    env.connect(masterGain);
    osc.start(now);
    osc.stop(now + decay + 0.05);
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
