// Listen: the microphone side (browser only). Opens the mic the same way the
// tuner does, reads the spectrum about 10 times a second with a long FFT
// (16384 points ≈ 3 Hz per bin, enough to tell a low E's neighbours apart)
// and hands each frame to onFrame. Sound is analysed and dropped: nothing is
// recorded, kept or sent (docs/listen-mode.md, Privacy).

import { listenDbToMagnitudes, listenChroma } from './listen-detect.js';
import { openMicrophone } from './tuner.js';

export const LISTEN_FFT = 16384;

// onFrame({ chroma, bass, energy, peaks, db, sampleRate, fftSize, timeBuf, time })
// Resolves to stop(); rejects when the mic can't be opened.
export async function startListening(onFrame, { intervalMs = 100, tune = {} } = {}) {
  const { ctx, source, close } = await openMicrophone();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = LISTEN_FFT;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);
  const db = new Float32Array(analyser.frequencyBinCount);
  const timeBuf = new Float32Array(4096);
  const timer = setInterval(() => {
    analyser.getFloatFrequencyData(db);
    analyser.getFloatTimeDomainData(timeBuf);
    const mag = listenDbToMagnitudes(db);
    const res = listenChroma(mag, ctx.sampleRate, LISTEN_FFT, tune);
    onFrame({ ...res, db, sampleRate: ctx.sampleRate, fftSize: LISTEN_FFT, timeBuf, time: performance.now() });
  }, intervalMs);
  return () => {
    clearInterval(timer);
    close();
  };
}
