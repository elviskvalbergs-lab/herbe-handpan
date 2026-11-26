// Unit tests for js/chords.js. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALES, createLayoutFromScale, notePC } from '../js/data.js';
import { findAllChords, isMainChord, mainChordsInKey } from '../js/chords.js';

test('main chords: the major and minor triads, from the home note up', () => {
  const kurd = SCALES.find(s => s.id === 'D-Kurd');
  const all = findAllChords(createLayoutFromScale(kurd));
  const main = mainChordsInKey(all, notePC(kurd.top.ding));
  assert.ok(all.length > 30, 'every chord is still there for Show all');
  assert.deepEqual(main.map(c => `${c.rootName} ${c.type.id}`), ['D min', 'F maj', 'G min', 'A min', 'Bb maj', 'C maj']);
  assert.ok(main.every(isMainChord));
  assert.ok(!all.filter(c => c.type.id === 'min7').some(isMainChord));
});

test('main chords on an instrument with every semitone: the chords of its key', async () => {
  const chromatic = { top: { ding: 'D4', notes: ['D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5', 'C#5', 'D5', 'E5', 'F#5', 'G5', 'A5', 'B5'] }, bottom: { notes: [] } };
  const all = findAllChords(createLayoutFromScale(chromatic));
  const pcs = new Set([chromatic.top.ding, ...chromatic.top.notes].map(notePC));
  const main = mainChordsInKey(all, notePC('D4'), pcs);
  const names = [...new Set(main.map(c => `${c.rootName} ${c.type.id}`))];
  assert.deepEqual(names, ['D maj', 'E min', 'F# min', 'G maj', 'A maj', 'B min']);
});
