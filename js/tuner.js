// Tuner: microphone → AnalyserNode → YIN pitch detection. See
// docs/ocarina-mode.md, "Tuner".
//
// yinPitch() and createStabilityTracker() are pure and unit tested in Node
// with synthetic tones; startTuner() is the browser part. Microphone access
// needs HTTPS (Vercel provides it) or localhost.

// YIN (de Cheveigné & Kawahara, 2002) on one window of samples. Returns
// { hz, clarity } (clarity 0–1, higher is cleaner) or null when no pitch is
// found. Ocarinas are close to pure sine tones, so a plain YIN is enough;
// the 4096-sample window covers bass notes down to ~70 Hz at 48 kHz.
export function yinPitch(buf, sampleRate, { threshold = 0.15, minHz = 70, maxHz = 2500, minRms = 0.01 } = {}) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / n) < minRms) return null;

  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  const tauMax = Math.min(Math.floor(n / 2), Math.ceil(sampleRate / minHz));
  const w = n - tauMax;
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < w; i++) {
      const delta = buf[i] - buf[i + tau];
      sum += delta * delta;
    }
    d[tau] = sum;
  }
  // Cumulative mean normalised difference.
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    cmnd[tau] = running > 0 ? d[tau] * tau / running : 1;
  }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // Parabolic interpolation around the minimum.
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const a = cmnd[tau - 1], b = cmnd[tau], c = cmnd[tau + 1];
    const denom = a - 2 * b + c;
    if (denom !== 0) better = tau + (a - c) / (2 * denom);
  }
  return { hz: sampleRate / better, clarity: 1 - cmnd[tau] };
}

// Reports a note only after it has held for `holdMs` within `toleranceCents`.
// push(hz | null, timeMs) → { hz, midi, stable, since } where midi is
// fractional and `since` is when the current stable stretch began.
export function createStabilityTracker({ holdMs = 200, toleranceCents = 35, a4 = 440 } = {}) {
  let anchor = null; // { midi, since }
  let lastHz = null;
  return {
    push(hz, t) {
      if (!hz) { anchor = null; lastHz = null; return { hz: null, midi: null, stable: false, since: null }; }
      const midi = 69 + 12 * Math.log2(hz / a4);
      if (!anchor || Math.abs(midi - anchor.midi) * 100 > toleranceCents) anchor = { midi, since: t };
      else anchor.midi = anchor.midi * 0.7 + midi * 0.3; // smooth
      lastHz = hz;
      return { hz: lastHz, midi: anchor.midi, stable: t - anchor.since >= holdMs, since: anchor.since };
    },
    reset() { anchor = null; lastHz = null; },
  };
}

// The quietest sound the live tuner looks for a pitch in (RMS, full scale 1).
// With the phone's automatic gain off, a drum or kalimba an arm's length
// away often arrives around −45 dB; YIN's clarity, not loudness, tells a
// note from room noise.
export const TUNER_MIN_RMS = 0.002;

// The microphone as an AudioContext source, opened from a tap. The context
// is made before the permission prompt (still inside the tap) and woken up
// after it: Safari leaves a context made later paused, and a paused one
// hears only silence. Shared by the tuner and Listen (listen-audio.js).
export async function openMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no microphone access');
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (err) {
    ctx.close();
    throw err;
  }
  if (ctx.state !== 'running') await ctx.resume().catch(() => {});
  const source = ctx.createMediaStreamSource(stream);
  const close = () => {
    stream.getTracks().forEach(t => t.stop());
    source.disconnect();
    ctx.close();
  };
  return { ctx, source, close };
}

// Root mean square of a window of samples: how loud it is.
export function rmsLevel(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

// Starts listening. onReading({ hz, midi, stable, since, level }) is called
// about 20 times a second (level: rmsLevel of the window). Returns a promise
// of a stop() function; rejects if the microphone can't be opened (no
// permission, no HTTPS, no device).
export async function startTuner(onReading, { a4 = 440, minRms = TUNER_MIN_RMS } = {}) {
  const { ctx, source, close } = await openMicrophone();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const tracker = createStabilityTracker({ a4 });
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    const res = yinPitch(buf, ctx.sampleRate, { minRms });
    onReading({ ...tracker.push(res && res.clarity > 0.8 ? res.hz : null, performance.now()), level: rmsLevel(buf) });
  }, 50);
  return () => {
    clearInterval(timer);
    close();
  };
}
