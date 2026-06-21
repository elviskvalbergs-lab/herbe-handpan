import { noteToFreq, noteToMidi } from './data.js';

let ctx = null;
let masterGain = null;

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.65;
  masterGain.connect(ctx.destination);
  // iOS unlock: must call resume() and play a silent buffer inside
  // the user-gesture handler that created the context.
  ctx.resume();
  const silentBuf = ctx.createBuffer(1, 1, 22050);
  const silentSrc = ctx.createBufferSource();
  silentSrc.buffer = silentBuf;
  silentSrc.connect(ctx.destination);
  silentSrc.start(0);
}

// Schedule fn() only once the context is confirmed running.
// IMPORTANT: always go through ctx.resume() — even for a fresh context,
// iOS Safari requires the resume promise to resolve before ctx.currentTime
// is valid. Calling ctx.currentTime while still suspended gives a stale
// value that puts all scheduled notes in the past.
function whenRunning(fn) {
  if (!ctx) initAudio();
  ctx.resume().then(fn);
}

// Extra time (seconds) added to every note's start. Gives iOS audio
// hardware time to spin up so the attack is not clipped.
const START_OFFSET = 0.05;

function playFreq(freq, startTime) {
  if (!ctx) return;
  const now = startTime ?? ctx.currentTime;

  const harmonics = [
    { mult: 1,   gain: 0.65, decay: 5.0 },
    { mult: 2,   gain: 0.30, decay: 2.8 },
    { mult: 3,   gain: 0.10, decay: 1.4 },
  ];

  harmonics.forEach(({ mult, gain, decay }) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * mult;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(gain, now + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.connect(env);
    env.connect(masterGain);

    if (mult === 1) {
      const delay = ctx.createDelay(0.7);
      const fb = ctx.createGain();
      const delayEnv = ctx.createGain();
      delay.delayTime.value = 0.24;
      fb.gain.value = 0.26;
      delayEnv.gain.setValueAtTime(0.14, now + 0.003);
      delayEnv.gain.exponentialRampToValueAtTime(0.0001, now + 4);
      env.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(delayEnv);
      delayEnv.connect(masterGain);
      osc.start(now);
      osc.stop(now + 5);
    } else {
      osc.start(now);
      osc.stop(now + decay + 0.1);
    }
  });
}

export function playNote(noteName) {
  initAudio();
  whenRunning(() => playFreq(noteToFreq(noteName), ctx.currentTime + START_OFFSET));
}

// Returns { arpTimings: [{note, delayMs}], togetherMs } for visual sync.
export function playChord(noteNames) {
  initAudio();
  const sorted = [...noteNames].sort((a, b) => noteToMidi(a) - noteToMidi(b));
  const ARP = 0.3;
  const togetherOffset = sorted.length * ARP + 0.35;
  whenRunning(() => {
    const now = ctx.currentTime + START_OFFSET;
    sorted.forEach((n, i) => playFreq(noteToFreq(n), now + i * ARP));
    sorted.forEach(n => playFreq(noteToFreq(n), now + togetherOffset));
  });
  return {
    arpTimings: sorted.map((note, i) => ({ note, delayMs: Math.round((START_OFFSET + i * ARP) * 1000) })),
    togetherMs: Math.round((START_OFFSET + togetherOffset) * 1000),
  };
}

// Plays ascending then descending (top note played once).
// Returns [{note, delayMs}] for visual sync.
export function playScale(noteNames) {
  initAudio();
  const asc = [...noteNames].sort((a, b) => noteToMidi(a) - noteToMidi(b));
  const desc = asc.slice(0, -1).reverse(); // exclude top note — already played
  const all = [...asc, ...desc];
  const INTERVAL = 0.4;
  whenRunning(() => {
    const now = ctx.currentTime + START_OFFSET;
    all.forEach((n, i) => playFreq(noteToFreq(n), now + i * INTERVAL));
  });
  return all.map((note, i) => ({ note, delayMs: Math.round((START_OFFSET + i * INTERVAL) * 1000) }));
}
