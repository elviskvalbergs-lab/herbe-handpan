import { noteToFreq, noteToMidi } from './data.js';

let ctx = null;
let masterGain = null;
let reverbSend = null; // set after reverb setup; null = reverb not ready, use masterGain

function buildReverb() {
  // ~1.8 s exponentially-decaying white-noise impulse response
  const len = Math.floor(ctx.sampleRate * 1.8);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 3.5);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  return conv;
}

function setupReverb() {
  const conv = buildReverb();

  const dryGain = ctx.createGain();
  dryGain.gain.value = 0.7;
  dryGain.connect(masterGain);

  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.25;
  conv.connect(reverbReturn);
  reverbReturn.connect(masterGain);

  reverbSend = ctx.createGain();
  reverbSend.gain.value = 1;
  reverbSend.connect(dryGain);
  reverbSend.connect(conv);
}

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = ctx.createGain();
  masterGain.gain.value = 0.7;
  masterGain.connect(ctx.destination);

  // iOS unlock: play a silent buffer + resume() synchronously in the gesture handler
  const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
  ctx.resume();

  // iOS sometimes routes Web Audio through the earpiece instead of the main speaker.
  // Playing a silent <audio> element forces the OS to use the media playback session
  // which routes through the main speaker.
  // Tiny valid silent WAV (44 bytes): RIFF header + fmt chunk + empty data chunk.
  const silentWav = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
  const audioEl = document.createElement('audio');
  audioEl.src = silentWav;
  audioEl.setAttribute('playsinline', '');
  audioEl.play().catch(() => {});

  // Reverb is non-critical — build it asynchronously so it never blocks
  // the gesture window or kills audio if buildReverb() throws on some browser.
  setTimeout(() => {
    try { setupReverb(); } catch (_) {}
  }, 0);
}

// Wait for the context to actually be running before scheduling audio.
// On iOS Chrome the context can still be 'suspended' right after resume() is called;
// scheduling on a suspended context drops the audio silently.
function whenRunning(fn) {
  if (!ctx) initAudio();
  if (ctx.state === 'running') {
    fn();
  } else {
    ctx.resume().then(() => fn());
  }
}

const START_OFFSET = 0.05;

function playFreq(freq, startTime) {
  if (!ctx) return;
  const now = startTime ?? ctx.currentTime;
  const sink = reverbSend ?? masterGain; // fall back if reverb not ready yet

  const harmonics = [
    { mult: 1,   gain: 0.52, decay: 5.5 },
    { mult: 2,   gain: 0.34, decay: 3.2 },
    { mult: 3,   gain: 0.11, decay: 2.0 },
    { mult: 4,   gain: 0.05, decay: 1.3 },
  ];

  harmonics.forEach(({ mult, gain, decay }) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * mult;
    osc.detune.value = (Math.random() - 0.5) * 4;

    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(gain, now + 0.004);
    env.gain.exponentialRampToValueAtTime(gain * 0.55, now + 0.18);
    env.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    osc.connect(env);
    env.connect(sink);
    osc.start(now);
    osc.stop(now + decay + 0.1);
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
