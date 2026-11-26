// Unit tests for the song player's pure parts (js/songs.js): loop, wait mode,
// a song across instruments. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALES, createLayoutFromScale, getAllNotes, noteToMidi } from '../js/data.js';
import { instrumentFromChart } from '../js/charts.js';
import { SONGS, songLoopTap, songInLoop, songNextIndex, songWaitTarget, songWaitHeard, songCoverage, songsAcross, playableSongs } from '../js/songs.js';

test('loop: from, to (either order), clear', () => {
  assert.deepEqual(songLoopTap(null, 4), { from: 4, to: null });
  assert.deepEqual(songLoopTap({ from: 4, to: null }, 9), { from: 4, to: 9 });
  assert.deepEqual(songLoopTap({ from: 9, to: null }, 4), { from: 4, to: 9 }, 'the end set before the start');
  assert.deepEqual(songLoopTap({ from: 4, to: null }, 4), { from: 4, to: 4 }, 'one note');
  assert.equal(songLoopTap({ from: 4, to: 9 }, 6), null);
  assert.ok(songInLoop({ from: 4, to: 9 }, 4) && songInLoop({ from: 4, to: 9 }, 9));
  assert.ok(!songInLoop({ from: 4, to: 9 }, 3) && !songInLoop({ from: 4, to: 9 }, 10));
  assert.ok(!songInLoop({ from: 4, to: null }, 4), 'not a loop until it has an end');
  assert.ok(!songInLoop(null, 0));
});

test('the next note: on, round the loop, or the end', () => {
  assert.equal(songNextIndex(0, 10), 1);
  assert.equal(songNextIndex(10, 10), null);
  assert.equal(songNextIndex(5, 10, { from: 2, to: 5 }), 2);
  assert.equal(songNextIndex(4, 10, { from: 2, to: 5 }), 5);
  assert.equal(songNextIndex(10, 10, { from: 8, to: 10 }), 8, 'a loop at the end of the song');
  assert.equal(songNextIndex(7, 10, { from: 2, to: 5 }), 2, 'started after the loop: back into it');
  assert.equal(songNextIndex(5, 10, { from: 2, to: null }), 6, 'a loop still being set does nothing');
});

test('wait mode steps over rests and the missing note', () => {
  const notes = [{ midi: 60 }, { midi: null }, { midi: 72, gone: true }, { midi: 62 }, { midi: null }];
  assert.equal(songWaitTarget(notes, 0), 0);
  assert.equal(songWaitTarget(notes, 1), 3);
  assert.equal(songWaitTarget(notes, 2), 3);
  assert.equal(songWaitTarget(notes, 4), null, 'only a rest left');
  assert.equal(songWaitTarget(notes, 4, { from: 3, to: 4 }), 3, 'round the loop to its first note');
  assert.equal(songWaitTarget([{ midi: null }, { midi: null }], 0, { from: 0, to: 1 }), null, 'a loop of rests ends');
});

test('wait mode hears the right note, played anew', () => {
  const w0 = { at: 1000, low: Infinity };
  const r = (midi, since, level = 0.05, stable = true) => ({ midi, hz: 1, stable, since, level });
  // The right note, started after the last one counted.
  let res = songWaitHeard(w0, 62, r(62.2, 1300), 1600);
  assert.equal(res.heard, true);
  assert.equal(res.w.at, 1600);
  // Wrong note, not steady yet, silence, too soon.
  assert.equal(songWaitHeard(w0, 62, r(64, 1300), 1600).heard, false);
  assert.equal(songWaitHeard(w0, 62, r(62, 1300, 0.05, false), 1600).heard, false);
  assert.equal(songWaitHeard(w0, 62, { midi: null, hz: null, stable: false, since: null, level: 0 }, 1600).heard, false);
  assert.equal(songWaitHeard(w0, 62, r(62, 1050), 1100).heard, false, 'within the gap');
  assert.equal(songWaitHeard(w0, 62, r(62.6, 1300), 1600).heard, false, 'more than half a semitone off');
  assert.equal(songWaitHeard(w0, null, r(62, 1300), 1600).heard, false);
  // An octave off: only where the octave is free (drums, kalimbas).
  assert.equal(songWaitHeard(w0, 62, r(74, 1300), 1600).heard, false);
  assert.equal(songWaitHeard(w0, 62, r(74, 1300), 1600, { anyOctave: true }).heard, true);
  assert.equal(songWaitHeard(w0, 62, r(50.1, 1300), 1600, { anyOctave: true }).heard, true);
});

test('wait mode: the same note twice needs a new strike', () => {
  const r = (since, level) => ({ midi: 62, hz: 1, stable: true, since, level });
  // G G: the first G counted at 1000 and still ringing (same "since").
  let w = { at: 1000, low: 0.08 };
  let res = songWaitHeard(w, 62, r(800, 0.07), 1300);
  assert.equal(res.heard, false, 'still the first strike');
  w = res.w;
  res = songWaitHeard(w, 62, r(800, 0.03), 1600);
  assert.equal(res.heard, false, 'fading');
  w = res.w;
  assert.equal(w.low, 0.03);
  res = songWaitHeard(w, 62, r(800, 0.09), 1900);
  assert.equal(res.heard, true, 'struck again: three times as loud as it had faded to');
  assert.deepEqual(res.w, { at: 1900, low: 0.09 });
  // Silence in between also counts as a new note (a new "since").
  w = songWaitHeard({ at: 1000, low: 0.08 }, 62, { midi: null, level: 0 }, 1200).w;
  assert.equal(w.low, 0);
  assert.equal(songWaitHeard(w, 62, r(1400, 0.05), 1700).heard, true);
});

test('a song across instruments: fits, almost fits, not', () => {
  const have = id => new Set(getAllNotes(createLayoutFromScale(SCALES.find(x => x.id === id))).map(noteToMidi));
  const whistle = instrumentFromChart('tin-whistle-d', 'D');
  const list = [
    { id: 'aka', name: 'D Akebono', have: have('D-Akebono') },
    { id: 'kurd', name: 'D Kurd', have: have('D-Kurd') },
    { id: 'gone', name: 'A layout that was deleted', have: null },
    { id: 'tw', name: 'Tin whistle', have: new Set(whistle.chambers[0].notes) },
  ];
  const grace = SONGS.find(x => x.id === 'amazing-grace');
  const cov = songCoverage(grace, list);
  assert.deepEqual(cov.map(x => x.id), ['tw', 'kurd', 'aka', 'gone']);
  assert.equal(cov[0].fit.missing, null);
  assert.ok(cov[1].fit.missing != null, 'one note missing on a D Kurd');
  assert.equal(cov[2].fit, null);
  assert.equal(cov[3].fit, null);
  assert.equal(cov[0].name, 'Tin whistle');
  const across = songsAcross(list.slice(0, 2));
  const kurdOnly = playableSongs(have('D-Kurd')).length;
  assert.ok(across.length >= kurdOnly, 'two instruments cover at least what one does');
  assert.ok(across.every(x => x.on.length && x.on.every(o => o.fit.missing == null)));
  assert.ok(songsAcross(list.slice(0, 2), SONGS, { near: true }).length > across.length);
});
