// Unit tests for js/pickmatch.js (the searchable picker's matching). Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pickFold, pickWords, pickMatches, pickIndex, pickFilter, noteSearchWords } from '../js/pickmatch.js';

const scale = (label, group, ding, n) => ({ label, group, keywords: [...noteSearchWords(ding), ...noteSearchWords(ding.replace(/\d/, '')), `${n} notes`] });
const SCALES = [
  scale('D Kurd', 'Kurd', 'D3', 9),
  scale('F# Kurd', 'Kurd', 'F#3', 9),
  scale('C# Kurd / Annaziska', 'Kurd', 'C#3', 10),
  scale('D Celtic Minor', 'Celtic Minor', 'D3', 9),
  scale('G Pygmy', 'Pygmy', 'G3', 9),
  scale('F Low Pygmy (17)', 'Pygmy', 'F2', 17),
  scale('Hijaz', 'Hijaz', 'D3', 9),
];
const labels = (opts, q) => pickFilter(opts, q).map(o => o.label);

test('fold: case, diacritics, sharp and flat signs', () => {
  assert.equal(pickFold('Solfège É'), 'solfege e');
  assert.equal(pickFold('F♯ / B♭'), 'f# / bb');
  assert.deepEqual(pickWords('F Low Pygmy (17)'), ['f', 'low', 'pygmy', '17']);
});

test('empty query keeps every option, in order', () => {
  assert.deepEqual(labels(SCALES, ''), SCALES.map(s => s.label));
  assert.deepEqual(labels(SCALES, '   '), SCALES.map(s => s.label));
});

test('all words must match, in any order, at word starts', () => {
  assert.deepEqual(labels(SCALES, 'kurd'), ['D Kurd', 'F# Kurd', 'C# Kurd / Annaziska']);
  assert.deepEqual(labels(SCALES, 'd k'), ['D Kurd']);
  assert.deepEqual(labels(SCALES, 'k d'), ['D Kurd']);
  assert.deepEqual(labels(SCALES, 'pygmy 17'), ['F Low Pygmy (17)']);
  assert.deepEqual(labels(SCALES, 'KURD 10'), ['C# Kurd / Annaziska']);
  assert.deepEqual(labels(SCALES, 'celtic'), ['D Celtic Minor']);
});

test('group names match', () => {
  assert.ok(pickMatches('celtic', pickIndex({ label: 'Something', group: 'Celtic Minor' })));
});

test('longer words also match inside a word', () => {
  assert.deepEqual(labels(SCALES, 'ziska'), ['C# Kurd / Annaziska']);
  assert.deepEqual(labels(SCALES, 'ur'), []); // too short to match inside
});

test('sharps, flats and solfège find the same note', () => {
  assert.deepEqual(labels(SCALES, 'f#'), ['F# Kurd']);
  assert.deepEqual(labels(SCALES, 'F♯'), ['F# Kurd']);
  assert.deepEqual(labels(SCALES, 'gb'), ['F# Kurd']);
  assert.deepEqual(labels(SCALES, 'fa#'), ['F# Kurd']);
  assert.deepEqual(labels(SCALES, 'ré kurd'), ['D Kurd']);
  assert.ok(!labels(SCALES, 'f#').includes('F Low Pygmy (17)'));
  // a plain note is not its sharp or flat
  assert.deepEqual(labels(SCALES, 'c'), ['D Celtic Minor']); // "Celtic", not C#
  assert.deepEqual(labels(SCALES, 'c#'), ['C# Kurd / Annaziska']);
  assert.deepEqual(labels(SCALES, 'db'), ['C# Kurd / Annaziska']);
  assert.deepEqual(labels(SCALES, 'mi'), ['D Celtic Minor']); // "Minor" is a word, not a note
  assert.deepEqual(labels(SCALES, 'd3'), ['D Kurd', 'D Celtic Minor', 'Hijaz']);
});

test('keys: letter names and solfège, with octaves', () => {
  const key = (label, root, lowest) => ({ label, group: 'Octave 4', keywords: [...noteSearchWords(root), ...noteSearchWords(lowest)] });
  const keys = [key('Sol (lowest Mi4)', 'G', 'E4'), key('Fa (lowest Re4)', 'F', 'D4'), key('Do (lowest La4)', 'C', 'A4')];
  assert.deepEqual(labels(keys, 'e4'), ['Sol (lowest Mi4)']);
  assert.deepEqual(labels(keys, 'mi4'), ['Sol (lowest Mi4)']);
  assert.deepEqual(labels(keys, 're4'), ['Fa (lowest Re4)']);
  assert.deepEqual(labels(keys, 'g'), ['Sol (lowest Mi4)']);
  assert.deepEqual(labels(keys, 'lowest a4'), ['Do (lowest La4)']);
  assert.deepEqual(labels(keys, 'octave 4 c'), ['Do (lowest La4)']);
});

test('no matches gives an empty list', () => {
  assert.deepEqual(labels(SCALES, 'zzz'), []);
});

test('noteSearchWords: every spelling once', () => {
  assert.deepEqual(noteSearchWords('F#3'), ['F#3', 'Gb3', 'Fa#3', 'Solb3']);
  assert.deepEqual(noteSearchWords('D'), ['D', 'Re']);
});
