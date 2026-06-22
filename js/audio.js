import { noteToFreq, noteToMidi } from './data.js';

let ctx = null;
let masterGain = null;
let reverbSend = null; // oscillators connect here to get wet + dry signal

function buildReverb() {
  // Exponentially decaying white noise impulse response — ~1.8 s room tail
  const duration = 1.8;
  const len = Math.floor(ctx.sampleRate * duration);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) {
      // Early reflections boost (first 60 ms), then exponential tail
      const t = i / ctx.sampleRate;
      const earlyBoost = t < 0.06 ? 1.4 : 1.0;
      d[i] = (Math.random() * 2 - 1) * earlyBoost * Math.exp(-t * 3.5);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  return conv;
}

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = ctx.createGain();
  masterGain.gain.value = 0.72;
  masterGain.connect(ctx.destination);

  // Dry path
  const dryGain = ctx.createGain();
  dryGain.gain.value = 0.68;
  dryGain.connect(masterGain);

  // Wet (reverb) path
  const conv = buildReverb();
  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.28;
  conv.connect(reverbReturn);
  reverbReturn.connect(masterGain);

  // Single shared send that feeds both paths
  reverbSend = ctx.createGain();
  reverbSend.gain.value = 1;
  reverbSend.connect(dryGain);
  reverbSend.connect(conv);

  // iOS unlock: start a silent buffer + kick off resume synchronously
  const silentBuf = ctx.createBuffer(1, 1, ctx.sampleRate);
  const silentSrc = ctx.createBufferSource();
  silentSrc.buffer = silentBuf;
  silentSrc.connect(ctx.destination);
  silentSrc.start(0);
  ctx.resume();
}

// Await resume before scheduling so iOS Chrome doesn't silently drop notes.
// ctx.resume() was already called synchronously inside the user-gesture handler,
// so iOS considers the audio permission granted — the .then() still fires in time.
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
  if (!ctx || !reverbSend) return;
  const now = startTime ?? ctx.currentTime;

  // Handpan partials: fundamental + octave (dominant on real pans) + 5th + 2nd octave
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
    // Tiny random detune per partial — gives the slight "alive" shimmer of metal
    osc.detune.value = (Math.random() - 0.5) * 4;

    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(gain, now + 0.004);      // fast metallic attack
    env.gain.exponentialRampToValueAtTime(gain * 0.55, now + 0.18); // initial drop
    env.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    osc.connect(env);
    env.connect(reverbSend);
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
