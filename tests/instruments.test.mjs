// Unit tests for the pure parts of js/instruments.js. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { noteToMidi } from '../js/data.js';
import {
  midiToNoteName, reconcileInstruments, sortInstruments, createScaleOcarina,
  createCustomOcarina, instrumentStatus, handpanInstrumentId,
} from '../js/instruments.js';

const saved = (id, name, isCustom = false) => ({ id, name, noteCount: 9, layout: { id, isCustom }, savedAt: 1700000000000 });

test('midiToNoteName round-trips with noteToMidi', () => {
  for (const n of ['C4', 'D3', 'Bb3', 'F#4', 'Ab2', 'C5']) {
    assert.equal(noteToMidi(midiToNoteName(noteToMidi(n))), noteToMidi(n));
  }
  assert.equal(midiToNoteName(62), 'D4');
});

test('saved layouts become handpan instruments, once', () => {
  const layouts = [saved('D-Kurd', 'D Kurd'), saved('c-1', 'My pan', true)];
  const r1 = reconcileInstruments([], layouts, 'T1');
  assert.equal(r1.changed, true);
  assert.deepEqual(r1.instruments.map(i => [i.id, i.family, i.kind, i.layoutId]), [
    ['hp-D-Kurd', 'handpan', 'scale', 'D-Kurd'],
    ['hp-c-1', 'handpan', 'custom', 'c-1'],
  ]);
  const r2 = reconcileInstruments(r1.instruments, layouts, 'T2');
  assert.equal(r2.changed, false);
  assert.equal(handpanInstrumentId('D-Kurd'), 'hp-D-Kurd');
});

test('removing a layout removes its instrument; ocarinas are untouched', () => {
  const oc = { id: 'oc-1', family: 'ocarina', name: 'x' };
  const r1 = reconcileInstruments([oc], [saved('D-Kurd', 'D Kurd')], 'T1');
  const r2 = reconcileInstruments(r1.instruments, [], 'T2');
  assert.equal(r2.instruments.find(i => i.id === 'hp-D-Kurd').deletedAt, 'T2');
  assert.equal(r2.instruments.find(i => i.id === 'oc-1').deletedAt, undefined);
  // Saving it again brings it back, with a renamed layout's new name.
  const r3 = reconcileInstruments(r2.instruments, [saved('D-Kurd', 'Blue D Kurd')], 'T3');
  const hp = r3.instruments.find(i => i.id === 'hp-D-Kurd');
  assert.equal(hp.deletedAt, undefined);
  assert.equal(hp.name, 'Blue D Kurd');
});

test('instruments sort by last played, newest first', () => {
  const list = [
    { id: 'a', lastPlayedAt: '2026-01-01' },
    { id: 'b', lastPlayedAt: '2026-03-01' },
    { id: 'c', lastPlayedAt: null, createdAt: '2026-02-01' },
  ];
  assert.deepEqual(sortInstruments(list).map(i => i.id), ['b', 'c', 'a']);
});

test('scale-built ocarina from a chosen note window', () => {
  const notes = ['F3', 'Gb3', 'Ab3', 'Bb3', 'C4', 'Db4', 'Eb4', 'F4', 'Gb4'].map(noteToMidi);
  const oc = createScaleOcarina({ scaleId: 'F-Low-Pygmy-17', notes }, 'T');
  assert.equal(oc.family, 'ocarina');
  assert.equal(oc.kind, 'scale');
  assert.equal(oc.fullChambers, 3);
  assert.equal(oc.chambers.length, 1);
  assert.equal(oc.chambers[0].holes.length, 8);
  assert.equal(oc.name, 'F Low Pygmy (17) ocarina');
  assert.equal(instrumentStatus(oc), 'Design, step 1 of 7 · 9 notes · 1 chamber');
  // Full scale when no window is given.
  assert.equal(createScaleOcarina({ scaleId: 'D-Kurd' }).chambers.length, 2);
  assert.throws(() => createScaleOcarina({ scaleId: 'nope' }), RangeError);
});

test('custom ocarina waits for calibration', () => {
  const oc = createCustomOcarina({ name: 'Blue', holeCount: 12 });
  assert.equal(oc.kind, 'custom');
  assert.equal(instrumentStatus(oc), '12 holes · not set up yet');
});
