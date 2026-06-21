import { noteToFreq, noteToMidi } from './data.js';

let ctx = null;
let masterGain = null;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.65;
  masterGain.connect(ctx.destination);
  // iOS Safari requires a resume() call AND a silent buffer played inside the
  // user gesture handler to fully unlock audio output.
  ctx.resume();
  const silentBuf = ctx.createBuffer(1, 1, 22050);
  const silentSrc = ctx.createBufferSource();
  silentSrc.buffer = silentBuf;
  silentSrc.connect(ctx.destination);
  silentSrc.start(0);
}

function playFreq(freq, startTime) {
  if (!ctx) return;
  const now = startTime ?? ctx.currentTime;

  // Fundamental + 2nd harmonic + 3rd harmonic with individual decay envelopes
  const harmonics = [
    { mult: 1,   gain: 0.65, decay: 5.0 },
    { mult: 2,   gain: 0.30, decay: 2.8 },
    { mult: 3,   gain: 0.10, decay: 1.4 },
  ];

  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 0;
  reverbSend.connect(masterGain);

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

    // Reverb: feed fundamental into delay loop
    if (mult === 1) {
      const delayNode = ctx.createDelay(0.7);
      const feedbackGain = ctx.createGain();
      const delayEnv = ctx.createGain();

      delayNode.delayTime.value = 0.24;
      feedbackGain.gain.value = 0.26;

      delayEnv.gain.setValueAtTime(0.14, now + 0.003);
      delayEnv.gain.exponentialRampToValueAtTime(0.0001, now + 4);

      env.connect(delayNode);
      delayNode.connect(feedbackGain);
      feedbackGain.connect(delayNode);
      delayNode.connect(delayEnv);
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
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => playFreq(noteToFreq(noteName)));
    return;
  }
  playFreq(noteToFreq(noteName));
}

// Returns { arpTimings: [{note, delayMs}], togetherMs } for visual sync.
export function playChord(noteNames) {
  initAudio();
  if (ctx.state === 'suspended') ctx.resume();
  const sorted = [...noteNames].sort((a, b) => noteToMidi(a) - noteToMidi(b));
  const ARP = 0.3;
  const now = ctx.currentTime;
  sorted.forEach((n, i) => playFreq(noteToFreq(n), now + i * ARP));
  const togetherOffset = sorted.length * ARP + 0.35;
  sorted.forEach(n => playFreq(noteToFreq(n), now + togetherOffset));
  return {
    arpTimings: sorted.map((note, i) => ({ note, delayMs: Math.round(i * ARP * 1000) })),
    togetherMs: Math.round(togetherOffset * 1000),
  };
}

// Returns [{note, delayMs}] for visual sync. Notes play at 0.4s intervals.
export function playScale(noteNames) {
  initAudio();
  if (ctx.state === 'suspended') ctx.resume();
  const sorted = [...noteNames].sort((a, b) => noteToMidi(a) - noteToMidi(b));
  const INTERVAL = 0.4;
  const now = ctx.currentTime;
  sorted.forEach((n, i) => playFreq(noteToFreq(n), now + i * INTERVAL));
  return sorted.map((note, i) => ({ note, delayMs: Math.round(i * INTERVAL * 1000) }));
}
