// The beginner setup's choices (js/setup.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALES, createLayoutFromScale, noteToMidi, notePC } from '../js/data.js';
import { findAllChords } from '../js/chords.js';
import { rankScalesByNotes } from '../js/scalefinder.js';
import { setupRoots, setupScalesFor, setupTopScales, setupFirstChord, setupHeardEnough, SETUP_TOP } from '../js/setup.js';

test('the middle notes: D first, every ding the scales have, each once', () => {
  const roots = setupRoots(SCALES);
  assert.equal(roots[0].pc, 2);
  assert.equal(new Set(roots.map(r => r.pc)).size, roots.length);
  assert.equal(roots.reduce((n, r) => n + r.count, 0), SCALES.length);
});

test('Which D scale? Kurd first, then the common ones; every D scale is in the list', () => {
  const d = setupScalesFor(SCALES, 2);
  assert.match(d[0].name, /Kurd/);
  const top = setupTopScales(d);
  assert.equal(top.length, SETUP_TOP);
  assert.equal(new Set(top.map(s => s.family)).size, top.length, 'one per family');
  assert.ok(top.some(s => /Celtic/.test(s.name)));
  assert.equal(d.length, SCALES.filter(s => notePC(s.top.ding) === 2).length);
});

test('the first chord on D Kurd is D minor, on the middle note', () => {
  const kurd = SCALES.find(s => s.id === 'D-Kurd');
  const c = setupFirstChord(findAllChords(createLayoutFromScale(kurd)), kurd.top.ding);
  assert.equal(c.rootName, 'D');
  assert.equal(c.type.id, 'min');
});

test('every scale has a first chord', () => {
  for (const s of SCALES) assert.ok(setupFirstChord(findAllChords(createLayoutFromScale(s)), s.top.ding), s.name);
});

test('listening stops by itself once every note of the best match was heard', () => {
  const kurd = SCALES.find(s => s.id === 'D-Kurd');
  const all = [kurd.top.ding, ...kurd.top.notes, ...kurd.bottom.notes].map(noteToMidi);
  const some = all.slice(0, 5);
  assert.equal(setupHeardEnough(rankScalesByNotes(some, SCALES), some.length), false);
  const r = rankScalesByNotes(all, SCALES);
  assert.equal(r[0].scale.id, 'D-Kurd');
  assert.equal(setupHeardEnough(r, all.length), true);
});
