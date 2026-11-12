// Unit tests for js/scalefinder.js against the real SCALES catalogue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALES, noteToMidi } from '../js/data.js';
import { rankScalesByNotes, addHeardNote, heardNoteName } from '../js/scalefinder.js';

const m = list => list.split(' ').map(noteToMidi);
const KURD = 'D3 A3 Bb3 C4 D4 E4 F4 G4 A4';

test('D Kurd heard in full ranks D Kurd first, its variants next', () => {
  const r = rankScalesByNotes(m(KURD), SCALES);
  assert.equal(r[0].scale.id, 'D-Kurd');
  assert.deepEqual(r[0].reasons, ['all 9 notes match', 'ding matches', 'all its notes heard']);
  assert.ok(r.slice(1, 4).some(x => x.scale.id.startsWith('D-Kurd-')));
  assert.equal(r[0].missing.length, 0);
});

test('only the ding heard: every scale with that ding first', () => {
  const r = rankScalesByNotes(m('D3'), SCALES);
  const d3 = SCALES.filter(s => s.top.ding === 'D3').length;
  assert.ok(d3 > 5);
  assert.ok(r.slice(0, d3).every(x => x.scale.top.ding === 'D3' && x.ding === 'exact'));
  assert.ok(r.slice(d3).every(x => x.ding !== 'exact'));
  assert.deepEqual(r[0].reasons, ['ding matches']);
});

test('an extra wrong note keeps the right scale near the top', () => {
  const r = rankScalesByNotes(m(KURD + ' C#4'), SCALES);
  const at = r.findIndex(x => x.scale.id === 'D-Kurd');
  assert.ok(at >= 0 && at < 3, `D Kurd at ${at}`);
  assert.ok(r[at].reasons.includes("Db4 isn't in this scale"));
  assert.ok(r[at].reasons.includes('9 of 10 notes match'));
  assert.ok(r[0].scale.top.ding === 'D3');
});

test('a ding heard an octave off still finds the scale', () => {
  const r = rankScalesByNotes(m('D4 A3 Bb3 C4 E4 F4 G4 A4'), SCALES);
  assert.equal(r[0].scale.id, 'D-Kurd');
  assert.equal(r[0].ding, 'lower');
  assert.ok(r[0].reasons.includes('ding D3: an octave lower than D4'));
  // Only a ding an octave too high: D3-ding scales follow the D4 ones (none
  // has a D4 ding) and say so.
  const one = rankScalesByNotes(m('D2'), SCALES);
  assert.equal(one[0].ding, 'higher');
  assert.ok(one[0].reasons[0].startsWith('ding D3: an octave higher'));
});

test('collecting notes: ring-over and repeats are ignored', () => {
  let notes = [];
  notes = addHeardNote(notes, 50.02);
  assert.deepEqual(notes, [50]);
  assert.equal(addHeardNote(notes, 50.25), null);   // same note, 25 ¢ sharp
  assert.equal(addHeardNote(notes, 49.8), null);    // 20 ¢ flat
  notes = addHeardNote(notes, 57.1);
  assert.deepEqual(notes, [50, 57]);
  assert.equal(addHeardNote(notes, 57), null);
  assert.equal(addHeardNote(notes, NaN), null);
  // D3 and A3 ringing together read as D2: not a note of its own.
  assert.equal(addHeardNote(notes, 38), null);
  assert.equal(addHeardNote(notes, 45), null);   // A2 below the D3 ding
  assert.equal(addHeardNote([62], 50), null); // so is one an octave below the first note
  assert.deepEqual(addHeardNote(notes, 69), [50, 57, 69]); // an octave above is a note
  assert.equal(heardNoteName(58), 'Bb3');
  assert.deepEqual(rankScalesByNotes([], SCALES), []);
});
