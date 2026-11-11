// Unit tests for js/tuner.js with synthetic tones. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yinPitch, createStabilityTracker } from '../js/tuner.js';

function tone(hz, { sr = 48000, n = 4096, harmonics = [1], noise = 0, seed = 1 } = {}) {
  const buf = new Float32Array(n);
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
  for (let i = 0; i < n; i++) {
    let v = 0;
    harmonics.forEach((a, k) => { v += a * Math.sin(2 * Math.PI * hz * (k + 1) * i / sr); });
    buf[i] = 0.3 * v + noise * rand();
  }
  return buf;
}
const cents = (a, b) => 1200 * Math.log2(a / b);

test('YIN finds pure tones across the ocarina range within 3 cents', () => {
  for (const hz of [82.41, 130.81, 261.63, 440, 880, 1760]) {
    const r = yinPitch(tone(hz), 48000);
    assert.ok(r, `no pitch for ${hz}`);
    assert.ok(Math.abs(cents(r.hz, hz)) < 3, `${hz}: got ${r.hz}`);
    assert.ok(r.clarity > 0.9);
  }
});

test('YIN with harmonics, noise and 44.1 kHz', () => {
  const r = yinPitch(tone(293.66, { sr: 44100, harmonics: [1, 0.3, 0.1], noise: 0.05 }), 44100);
  assert.ok(Math.abs(cents(r.hz, 293.66)) < 5, `got ${r.hz}`);
});

test('silence gives no pitch', () => {
  assert.equal(yinPitch(new Float32Array(4096), 48000), null);
});

test('stability: a note is reported after holding 200 ms', () => {
  const tr = createStabilityTracker();
  assert.equal(tr.push(440, 0).stable, false);
  assert.equal(tr.push(441, 100).stable, false);
  const r = tr.push(440, 220);
  assert.equal(r.stable, true);
  assert.ok(Math.abs(r.midi - 69) < 0.05);
  // A jump of a semitone restarts the clock.
  assert.equal(tr.push(466.16, 260).stable, false);
  assert.equal(tr.push(466.16, 470).stable, true);
  // Silence resets.
  assert.equal(tr.push(null, 500).stable, false);
  assert.equal(tr.push(466.16, 520).stable, false);
});
