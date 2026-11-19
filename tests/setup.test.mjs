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
  const { chartSetupTunings, setupRoots, setupScalesFor, setupFirstChord, setupKeyNote, preferCommonChart } = await import('../js/setup.js');
  const { rankScalesByNotes } = await import('../js/scalefinder.js');
  const { findAllChords } = await import('../js/chords.js');
  const { createLayoutFromScale } = await import('../js/data.js');
  const oc = chartSetupTunings('ocarina');
  assert.equal(oc.filter(t => t.chartId === 'ocarina-12-stl-c').length, 36);
  assert.ok(oc.every(t => t.id.startsWith('chart:ocarina-') && t.chartId && t.keyId));
  // An alto C ocarina: the lowest note (every hole closed) A4, then up the scale.
  // A 6-hole pendant in A plays these notes too: the more common 12-hole goes first.
  const alto = preferCommonChart(rankScalesByNotes([69, 71, 72, 74, 76, 77, 79, 81], oc), 'ocarina')[0].scale;
  assert.equal(alto.id, 'chart:ocarina-12-stl-c/C-A4');
  assert.equal(alto.name, 'Alto C 12-hole ocarina');
  // "I know my key": C first, and C's three ocarinas.
  assert.equal(setupRoots(oc, { first: 0 })[0].pc, 0);
  assert.deepEqual(setupScalesFor(oc, 0).filter(t => t.chartId === 'ocarina-12-stl-c').map(t => t.keyId).sort(), ['C-A3', 'C-A4', 'C-A5']);
  // A tin whistle in D, told from a Native American flute in D by its F#.
  const fl = chartSetupTunings('flute');
  assert.equal(rankScalesByNotes([62, 64, 66, 67, 69, 71, 73, 74], fl)[0].scale.id, 'chart:tin-whistle-d/D');
  // The first chord on an instrument in a major key is its major chord.
  const c = setupFirstChord(findAllChords(createLayoutFromScale(alto)), setupKeyNote(alto), { prefer: 'maj' });
  assert.equal(c.id, 'C-maj');
});

test('the 6-hole pendant ocarina: STL\'s chart, chromatic over 16 semitones, drawn as a pendant', async () => {
  const { getChart, instrumentFromChart } = await import('../js/charts.js');
  const { renderFingering } = await import('../js/ocarina-ui.js');
  const { linkFor, parseLink } = await import('../js/links.js');
  const chart = getChart('ocarina-6-stl-c');
  assert.ok(chart.source.every(u => /^https:\/\//.test(u)));
  assert.deepEqual(chart.fingerings.map(f => f.offset), [...Array(17).keys()]);
  assert.ok(chart.fingerings.every(f => f.states.length === 6));
  const inst = instrumentFromChart(chart.id, 'C-C6');
  assert.equal(inst.name, '6-hole pendant ocarina in C (C6)');
  assert.equal(inst.chambers[0].notes.length, 17);
  // C D E on top of the scale: D lifts the right middle finger, E the right index.
  const f = midi => inst.chambers[0].fingerings[midi].join('');
  assert.equal(f(84), 'cccccc');
  assert.equal(f(86), 'cocccc');
  assert.equal(f(88), 'ccocc'.slice(0, 2) + 'coc' + 'c');
  assert.match(renderFingering(inst, 84), /fg-body/);
  const path = linkFor({ chartId: chart.id, keyId: 'C-C6' });
  assert.equal(path, '/ocarina/pendant-6-c-c6');
  assert.deepEqual([parseLink(path).chartId, parseLink(path).keyId], [chart.id, 'C-C6']);
});

test('an instrument tuned to A = 432 Hz: its lowest note, struck a little low, still gets its name', async () => {
  const { tuningOffsetCents, noteOnTuning, a4ForOffset } = await import('../js/setup.js');
  // A user's tongue drum, as the tuner reads its recording: 252.4, 288.7, 342.1, 385.8, 433.8, 486.8 Hz.
  const raw = [252.4, 288.7, 342.1, 385.8, 433.8, 486.8].map(hz => 69 + 12 * Math.log2(hz / 440));
  assert.equal(Math.round(raw[0]), 59, 'on A = 440 the lowest reads as B3');
  const off = tuningOffsetCents(raw);
  assert.ok(off <= -25 && off >= -40, `offset ${off}`);
  assert.equal(a4ForOffset(off), 432);
  assert.deepEqual(raw.map(m => noteOnTuning(m, off)), [60, 62, 65, 67, 69, 71], 'C4 D4 F4 G4 A4 B4');
  // In tune on 440, or too few notes to tell: nothing moves.
  assert.equal(tuningOffsetCents([60.02, 62.0, 64.05, 67.0]), 0);
  assert.equal(tuningOffsetCents([59.45, 62.7]), 0);
});

test('listening freely on a 432 Hz drum: notes heard before the tuning was clear are renamed', async () => {
  const { collectHeardNote } = await import('../js/setup.js');
  const midi = hz => 69 + 12 * Math.log2(hz / 440);
  let L = { raw: [], notes: [] };
  const named = [];
  for (const hz of [252.4, 288.7, 342.1, 385.8, 433.8, 486.8]) {
    L = collectHeardNote(L, midi(hz));
    named.push(L.notes.join(' '));
  }
  // The lowest is B3 on its own, and becomes C4 once three notes agree on the tuning.
  assert.equal(named[0], '59');
  assert.deepEqual(L.notes, [60, 62, 65, 67, 69, 71]);
  assert.ok(L.offset < -25 && L.offset > -40);
  // A note heard again isn't taken twice; on A = 440 nothing is renamed.
  assert.equal(collectHeardNote(L, midi(343)), null);
  assert.deepEqual(collectHeardNote({ raw: [], notes: [] }, midi(252.4), { tuned: false }).notes, [59]);
});
