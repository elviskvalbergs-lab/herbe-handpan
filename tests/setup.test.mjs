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

test('ocarinas and flutes in the same setup: every chart key a tuning, matched by the notes heard', async () => {
  const { chartSetupTunings, setupRoots, setupScalesFor, setupFirstChord, setupKeyNote } = await import('../js/setup.js');
  const { rankScalesByNotes } = await import('../js/scalefinder.js');
  const { findAllChords } = await import('../js/chords.js');
  const { createLayoutFromScale } = await import('../js/data.js');
  const oc = chartSetupTunings('ocarina');
  assert.equal(oc.length, 36);
  assert.ok(oc.every(t => t.id.startsWith('chart:ocarina-12-stl-c/') && t.chartId && t.keyId));
  // An alto C ocarina: the lowest note (every hole closed) A4, then up the scale.
  const alto = rankScalesByNotes([69, 71, 72, 74, 76, 77, 79, 81], oc)[0].scale;
  assert.equal(alto.id, 'chart:ocarina-12-stl-c/C-A4');
  assert.equal(alto.name, 'Alto C 12-hole ocarina');
  // "I know my key": C first, and C's three ocarinas.
  assert.equal(setupRoots(oc, { first: 0 })[0].pc, 0);
  assert.deepEqual(setupScalesFor(oc, 0).map(t => t.keyId).sort(), ['C-A3', 'C-A4', 'C-A5']);
  // A tin whistle in D, told from a Native American flute in D by its F#.
  const fl = chartSetupTunings('flute');
  assert.equal(rankScalesByNotes([62, 64, 66, 67, 69, 71, 73, 74], fl)[0].scale.id, 'chart:tin-whistle-d/D');
  // The first chord on an instrument in a major key is its major chord.
  const c = setupFirstChord(findAllChords(createLayoutFromScale(alto)), setupKeyNote(alto), { prefer: 'maj' });
  assert.equal(c.id, 'C-maj');
});
