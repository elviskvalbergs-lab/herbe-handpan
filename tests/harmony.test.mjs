// Unit tests for js/harmony.js. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALES, createLayoutFromScale, notePC, getAllNotes } from '../js/data.js';
import { findAllChords } from '../js/chords.js';
import { instrumentKey, chordDegree, goesWellWith } from '../js/harmony.js';

const setup = id => {
  const s = SCALES.find(x => x.id === id);
  const layout = createLayoutFromScale(s);
  const chords = findAllChords(layout);
  const key = instrumentKey(new Set(getAllNotes(layout).map(notePC)), notePC(s.top.ding));
  const find = (root, type) => chords.find(c => c.rootName === root && c.type.id === type);
  return { chords, key, find };
};
const names = cs => cs.map(c => `${c.rootName}${c.type.id === 'min' ? 'm' : c.type.id === 'dim' ? '°' : ''}`).join(' ');

test('a D Kurd is in D minor; its chords have their roles', () => {
  const { key, find } = setup('D-Kurd');
  assert.deepEqual(key, { tonic: 2, mode: 'minor' });
  assert.equal(chordDegree(key, find('D', 'min')), 'i');
  assert.equal(chordDegree(key, find('Bb', 'maj')), 'VI');
  assert.equal(chordDegree(key, find('C', 'maj')), 'VII');
  assert.equal(chordDegree(key, find('D', 'min7')), 'i', 'a 7th counts as its triad');
});

test('what goes well with D minor on a D Kurd: only chords it can play', () => {
  const { chords, key, find } = setup('D-Kurd');
  const g = goesWellWith(find('D', 'min'), chords, key);
  assert.equal(names(g.next), 'Gm Bb C Am');
  assert.deepEqual(g.progressions.map(p => `${p.name}: ${names(p.chords)}`), [
    'Epic: Dm Bb F C', 'Minor pop: Dm Bb C Dm', 'Folk: Dm Gm Am Dm',
  ]);
  // The Andalusian needs A major, which a D Kurd doesn't have.
  assert.ok(!goesWellWith(find('D', 'min'), chords, key, { progressions: 9 }).progressions.some(p => p.name === 'Andalusian'));
});

test('a major-key instrument gets the major progressions', () => {
  const s = { top: { ding: 'C4', notes: ['D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'] }, bottom: { notes: [] } };
  const layout = createLayoutFromScale(s);
  const chords = findAllChords(layout);
  const key = instrumentKey(new Set(getAllNotes(layout).map(notePC)), 0);
  assert.equal(key.mode, 'major');
  const g = goesWellWith(chords.find(c => c.rootName === 'G' && c.type.id === 'maj'), chords, key);
  assert.equal(g.degree, 'V');
  assert.equal(names(g.next), 'C Am F');
  assert.ok(g.progressions.some(p => p.name === 'Pop' && names(p.chords) === 'C G Am F'));
  // A chord outside the key has no suggestions.
  assert.equal(goesWellWith({ rootNote: 'C#4', type: { intervals: [0, 4, 7] } }, chords, key), null);
});
