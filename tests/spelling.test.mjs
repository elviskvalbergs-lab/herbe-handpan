// How a tuning's notes are written: flats or sharps (js/data.js preferFlats). Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SCALES, preferFlats, displayNote, createLayoutFromScale, getAllNotes } from '../js/data.js';

test('a scale is written so that no letter repeats', () => {
  // D Kurd: D A B♭ C D E F G A, never A and A#.
  assert.equal(preferFlats(['D3', 'A3', 'A#3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4']), true);
  // D major: F# and C#, never G♭ and G.
  assert.equal(preferFlats(['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5']), false);
  // C minor: E♭, A♭, B♭.
  assert.equal(preferFlats(['C3', 'D3', 'D#3', 'F3', 'G3', 'G#3', 'A#3']), true);
  // F# minor: F# G# A B C# D E.
  assert.equal(preferFlats(['F#3', 'G#3', 'A3', 'B3', 'C#4', 'D4', 'E4']), false);
});

test('no black keys, or every semitone: the home note decides', () => {
  assert.equal(preferFlats(['C4', 'D4', 'E4', 'G4', 'A4']), false);
  const all = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(n => n + '4');
  assert.equal(preferFlats(all, 'C4'), false);
  assert.equal(preferFlats(all, 'G4'), false);
  assert.equal(preferFlats(all, 'F4'), true);
  assert.equal(preferFlats(all, 'A#4'), true);
  assert.equal(preferFlats([]), false);
});

test('the D Kurd in the catalogue shows a B flat', () => {
  const notes = getAllNotes(createLayoutFromScale(SCALES.find(s => s.id === 'D-Kurd')));
  const flats = preferFlats(notes, notes[0]);
  assert.equal(flats, true);
  assert.ok(notes.map(n => displayNote(n, flats)).includes('Bb3'));
  assert.ok(!notes.map(n => displayNote(n, flats)).some(n => n.includes('#')));
});
