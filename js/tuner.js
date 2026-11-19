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

// YIN's estimate, checked against the spectrum: the strongest peak within a
// semitone of it (Goertzel over a Hann-windowed window, 5-cent steps, then a
// parabola through the top three). On a drum played without damping the
// last note still rings under the new one and YIN can settle between the
// two; the spectrum still shows each note where it is.
// YIN can also land a whole number of periods too long: on a tongue drum
// whose other tongues ring along, the common period of them all (a B4 at
// 483 Hz read as 161 or 242 Hz, with nothing at all there). So when there is
// no peak near the estimate, or a weak one under a much stronger peak at
// twice, three or four times it, the note is that stronger peak, provided it
// carries a good part of the sound. Otherwise null: not a note.
const _hann = new Map();
const REFINE_MULTIPLE_MIN_SHARE = 0.25; // of the window's sound, for a multiple to be the note
const REFINE_FUNDAMENTAL_MIN = 0.1;   // of the strongest multiple's power, for YIN's own to stand
const REFINE_OCTAVE_DOWN_MIN = 0.1; // of the note's power, for the note an octave down to be it
export function refinePitch(buf, sampleRate, hz, { cents = 100, step = 5 } = {}) {
  const n = buf.length;
  let w = _hann.get(n);
  if (!w) { w = new Float32Array(n).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))); _hann.set(n, w); }
  const x = new Float32Array(n);
  let energy = 0;
  for (let i = 0; i < n; i++) { x[i] = buf[i] * w[i]; energy += x[i] * x[i]; }
  const power = f => {
    const c = 2 * Math.cos(2 * Math.PI * f / sampleRate);
    let s1 = 0, s2 = 0;
    for (let i = 0; i < n; i++) { const s0 = x[i] + c * s1 - s2; s2 = s1; s1 = s0; }
    return s1 * s1 + s2 * s2 - c * s1 * s2;
  };
  // The peak within `span` cents of f: { hz, p }, or null when the strongest
  // point is at the edge (something stronger lies further away).
  const peakNear = (f, span) => {
    const vals = [];
    let bi = 0;
    for (let k = -span, j = 0; k <= span; k += step, j++) {
      vals.push(power(f * 2 ** (k / 1200)));
      if (vals[j] > vals[bi]) bi = j;
    }
    if (bi === 0 || bi === vals.length - 1) return null;
    const a = vals[bi - 1], b = vals[bi], c = vals[bi + 1];
    const den = a - 2 * b + c;
    const d = den ? (a - c) / (2 * den) : 0;
    return { hz: f * 2 ** ((-span + (bi + d) * step) / 1200), p: b };
  };
  const own = peakNear(hz, cents);
  let multiple = null;
  for (let k = 2; k <= 4 && k * hz < Math.min(5000, sampleRate / 2.5); k++) {
    const m = peakNear(k * hz, 50);
    if (m && (!multiple || m.p > multiple.p)) multiple = m;
  }
  let pick = null;
  if (own && (!multiple || own.p >= REFINE_FUNDAMENTAL_MIN * multiple.p)) pick = own;
  // A pure tone's Goertzel power is about a third of energy × n (Hann window).
  else if (multiple && energy > 0 && (3 * multiple.p) / (energy * n) >= REFINE_MULTIPLE_MIN_SHARE) pick = multiple;
  if (!pick) return null;
  // A handpan note's octave partial can outlast the note and be taken for it:
  // the note an octave down, when it sounds too.
  const half = pick.hz / 2 >= 60 ? peakNear(pick.hz / 2, 50) : null;
  return half && half.p >= REFINE_OCTAVE_DOWN_MIN * pick.p ? half.hz : pick.hz;
}

// One reading of the live tuner from the latest samples (at least
// TUNER_LONG_WINDOW of them): YIN on the last TUNER_WINDOW, then the
// spectral check. Low notes are checked on the longer window: 85 ms can't
// tell two low notes a semitone or so apart (a handpan's Eb3 at 156 Hz next
// to a 142 Hz tone ringing on). Returns { hz | null, level }. Shared by
// startTuner and scripts/replay-listen.mjs.
export const TUNER_WINDOW = 4096;
export const TUNER_LONG_WINDOW = 8192;
export const TUNER_LOW_HZ = 330;
export function tunerFrame(buf, sampleRate, { minRms = TUNER_MIN_RMS } = {}) {
  const short = buf.length > TUNER_WINDOW ? buf.subarray(buf.length - TUNER_WINDOW) : buf;
  const level = rmsLevel(short);
  const res = yinPitch(short, sampleRate, { minRms });
  if (!res || res.clarity <= 0.8) return { hz: null, level };
  const win = res.hz < TUNER_LOW_HZ && buf.length >= TUNER_LONG_WINDOW ? buf.subarray(buf.length - TUNER_LONG_WINDOW) : short;
  return { hz: refinePitch(win, sampleRate, res.hz), level };
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

// The microphone that is open, if any: { ctx, scope, buf }.
let _mic = null;
export function openMic() { return _mic; }

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
  // Safari only runs analysers that lead to the speakers: everything the
  // microphone feeds ends in this silent node, or the analysers read zeros.
  const sink = ctx.createGain();
  sink.gain.value = 0;
  sink.connect(ctx.destination);
  // The live picture of the sound (drawMicWave) reads this one.
  const scope = ctx.createAnalyser();
  scope.fftSize = 2048;
  source.connect(scope);
  scope.connect(sink);
  const mic = { ctx, scope, buf: new Float32Array(scope.fftSize), stream };
  _mic = mic;
  _micRecStart();
  const close = () => {
    if (_rec?.mic === mic) _micRecStop();
    if (_mic === mic) _mic = null;
    stream.getTracks().forEach(t => t.stop());
    source.disconnect();
    sink.disconnect();
    ctx.close();
  };
  return { ctx, source, sink, close };
}

// What the microphone hears while Listen is on is recorded, so that someone
// whose instrument Oakhum heard wrong can send it to us (the listening report
// in js/app.js). It stays in memory on the device, is sent only when they say
// so, and is gone when the page closes. One take per listening session; the
// last three are kept, each at most three minutes (small enough to send).
const MIC_TAKE_MS = 3 * 60 * 1000;
const MIC_TAKES_KEPT = 3;
let _recWanted = false;
let _rec = null; // { r, mic, timer, take }
const _takes = [];
let _recDone = Promise.resolve();

export function micRecordingSupported() { return typeof MediaRecorder !== 'undefined'; }

/** Turns recording on (for the open microphone and any opened later) or off. */
export function recordMic(on) {
  _recWanted = !!on;
  if (on) _micRecStart(); else _micRecStop();
}

function _micRecStart() {
  if (!_recWanted || _rec || !_mic?.stream || !micRecordingSupported()) return;
  const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm']
    .find(t => MediaRecorder.isTypeSupported?.(t)) ?? '';
  let r;
  try { r = new MediaRecorder(_mic.stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 48000 }); } catch { return; }
  const take = { chunks: [], type: (r.mimeType || type || 'audio/webm').split(';')[0], start: Date.now(), ms: 0 };
  r.ondataavailable = e => { if (e.data?.size) take.chunks.push(e.data); };
  _recDone = new Promise(resolve => {
    r.onstop = () => {
      take.ms = Date.now() - take.start;
      if (take.chunks.length && take.ms > 500) _takes.push(take);
      while (_takes.length > MIC_TAKES_KEPT) _takes.shift();
      resolve();
    };
  });
  try { r.start(1000); } catch { return; }
  _rec = { r, mic: _mic, take, timer: setTimeout(_micRecStop, MIC_TAKE_MS) };
}

function _micRecStop() {
  if (!_rec) return;
  clearTimeout(_rec.timer);
  try { if (_rec.r.state !== 'inactive') _rec.r.stop(); } catch { /* already stopped */ }
  _rec = null;
}

/** The takes recorded so far, oldest first: [{ blob, seconds, type }]. Waits
 *  for a take that is still being finished. */
export async function micTakes() {
  await _recDone;
  return _takes.map(t => ({ blob: new Blob(t.chunks, { type: t.type }), seconds: Math.max(1, Math.round(t.ms / 1000)), type: t.type }));
}

/** Forgets every take (a new setup, Clear). Keeps recording if it's on. */
export function clearMicTakes() {
  const on = !!_rec;
  _micRecStop();
  _takes.length = 0;
  _recDone.then(() => { _takes.length = 0; if (on) _micRecStart(); });
}

// Draws the sound coming in on a canvas: a wave that follows the real signal,
// quiet when it is quiet. With a pitch (hz) the wave is held still on its
// period, like an oscilloscope, so a clean note is a calm, steady curve and
// a chord or a voice a richer one; without one it flows. Colours come from
// the canvas's CSS (color: the line; --wave-soft: the echoes).
export function drawMicWave(canvas, mic, { hz = null, level = null, t = 0 } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const css = getComputedStyle(canvas);
  const line = css.color;
  const soft = css.getPropertyValue('--wave-soft').trim() || line;
  const mid = h / 2;
  let buf = null;
  if (mic) { mic.scope.getFloatTimeDomainData(mic.buf); buf = mic.buf; }
  if (level == null) level = buf ? rmsLevel(buf) : 0;
  // How much of the buffer spans the width: three periods of the note when
  // there is one, else about 20 ms.
  const sr = mic?.ctx.sampleRate ?? 48000;
  const span = Math.min(buf?.length ?? 1024, Math.round(hz > 0 ? (sr / hz) * 3 : sr * 0.02));
  // Start on a rising zero crossing so a steady note doesn't jitter.
  let start = 0;
  if (buf && hz > 0) {
    for (let i = 1; i < buf.length - span; i++) if (buf[i - 1] < 0 && buf[i] >= 0) { start = i; break; }
  }
  // Loud enough to see at any level: the wave is scaled to its own peak,
  // then given a height that grows with how loud it is (−60 dB … −10 dB).
  let peak = 0;
  if (buf) for (let i = start; i < start + span; i++) peak = Math.max(peak, Math.abs(buf[i]));
  const db = level > 0 ? 20 * Math.log10(level) : -100;
  const loud = Math.max(0, Math.min(1, (db + 60) / 50));
  const amp = (h * 0.42) * (0.08 + 0.92 * loud);
  const pts = Math.max(32, Math.min(120, Math.round(w / 4)));
  const ys = new Float32Array(pts);
  for (let i = 0; i < pts; i++) {
    const x = i / (pts - 1);
    const taper = Math.sin(Math.PI * x); // the ends rest on the middle line
    let v;
    if (buf && peak > 1e-5 && loud > 0.02) v = buf[start + Math.min(span - 1, Math.round(x * (span - 1)))] / peak;
    else v = Math.sin(x * Math.PI * 3 + t * 0.0025) * 0.25; // breathing while it's quiet: the mic is on
    ys[i] = v * amp * taper;
  }
  // The last frames trail behind the current one, so the sound flows.
  const trail = (canvas._waveTrail ??= []);
  trail.unshift(ys);
  if (trail.length > 3) trail.length = 3;
  const xAt = i => (i / (pts - 1)) * w;
  const path = (arr, k) => {
    g.beginPath();
    g.moveTo(0, mid - arr[0] * k);
    for (let i = 1; i < pts; i++) {
      const xm = (xAt(i - 1) + xAt(i)) / 2, ym = mid - ((arr[i - 1] + arr[i]) / 2) * k;
      g.quadraticCurveTo(xAt(i - 1), mid - arr[i - 1] * k, xm, ym);
    }
    g.lineTo(w, mid - arr[pts - 1] * k);
  };
  // A soft ribbon (the wave and its mirror), the trail, then the line.
  g.beginPath();
  g.moveTo(0, mid);
  for (let i = 0; i < pts; i++) g.lineTo(xAt(i), mid - Math.abs(ys[i]));
  for (let i = pts - 1; i >= 0; i--) g.lineTo(xAt(i), mid + Math.abs(ys[i]));
  g.closePath();
  g.fillStyle = soft;
  g.globalAlpha = 0.12 + 0.18 * loud;
  g.fill();
  g.lineJoin = 'round'; g.lineCap = 'round';
  trail.slice(1).forEach((arr, j) => {
    path(arr, 1);
    g.strokeStyle = soft; g.globalAlpha = 0.3 - j * 0.12; g.lineWidth = 1.5;
    g.stroke();
  });
  path(ys, 1);
  g.strokeStyle = line; g.globalAlpha = 0.7 + 0.3 * loud; g.lineWidth = 2;
  g.stroke();
  g.globalAlpha = 1;
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
  const { ctx, source, sink, close } = await openMicrophone();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = TUNER_LONG_WINDOW;
  source.connect(analyser);
  analyser.connect(sink);
  const buf = new Float32Array(analyser.fftSize);
  const tracker = createStabilityTracker({ a4 });
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    const { hz, level } = tunerFrame(buf, ctx.sampleRate, { minRms });
    onReading({ ...tracker.push(hz, performance.now()), level });
  }, 50);
  return () => {
    clearInterval(timer);
    close();
  };
}
