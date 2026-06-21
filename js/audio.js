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
// Fast path: if already running, call synchronously (no delay).
// Slow path: context suspended (first call / iOS auto-suspend) — wait for
// resume before capturing ctx.currentTime, otherwise stale time puts notes
// in the past and only the decay tail is audible.
function whenRunning(fn) {
  if (!ctx) initAudio();
  if (ctx.state === 'running') { fn(); return; }
  ctx.resume().then(fn);
}

// Small buffer (seconds) added to every scheduled note so iOS audio hardware
// has time to output the attack before we start writing frames.
const START_OFFSET = 0.02;

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

// onArp(note) called in sync with each arpeggiated note.
// onTogether(notes) called when all notes strike together.
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

// Plays ascending then descending (top note played once).
// onNote(note) called in sync with each note.
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
