// Unit tests for js/charts.js with a made-up chart (not real data).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteToMidi } from '../js/data.js';
import { TRADITIONAL_CHARTS, getChart, chartsForFamily, instrumentFromChart } from '../js/charts.js';

const fake = {
  id: 'test-3', family: 'flute', name: 'Test pipe', source: ['https://example.com/chart'],
  holes: [{ id: 'R1', finger: 'R1', side: 'top' }, { id: 'L1', finger: 'L1', side: 'top' }],
  keys: [{ id: 'D', name: 'D', lowest: 'D4' }, { id: 'C', name: 'C', lowest: 'C4' }],
  fingerings: [
    { offset: 0, states: ['c', 'c'] },
    { offset: 2, states: ['o', 'c'] },
    { offset: 4, states: ['o', 'o'] },
    { offset: 4, states: ['h', 'o'], alt: true },
  ],
};

test('instrument from a chart, in any of its keys', () => {
  TRADITIONAL_CHARTS.push(fake);
  try {
    assert.equal(getChart('test-3'), fake);
    assert.ok(chartsForFamily('flute').includes(fake));
    const d = instrumentFromChart('test-3', 'D', { now: 'T' });
    assert.equal(d.kind, 'traditional');
    assert.equal(d.name, 'Test pipe (D4)');
    assert.match(d.id, /^fl-/);
    assert.deepEqual(d.chambers[0].notes, ['D4', 'E4', 'F#4'].map(noteToMidi));
    assert.deepEqual(d.chambers[0].fingerings[noteToMidi('F#4')], ['o', 'o']);
    assert.deepEqual(d.chambers[0].alternates[noteToMidi('F#4')], [['h', 'o']]);
    const c = instrumentFromChart('test-3', 'C');
    assert.deepEqual(c.chambers[0].notes, ['C4', 'D4', 'E4'].map(noteToMidi));
    assert.throws(() => instrumentFromChart('nope', 'D'), RangeError);
  } finally {
    TRADITIONAL_CHARTS.splice(TRADITIONAL_CHARTS.indexOf(fake), 1);
  }
});

test('sourced charts are well formed', () => {
  const real = TRADITIONAL_CHARTS.filter(c => c.id !== 'test-3');
  assert.ok(real.length >= 6);
  for (const c of real) {
    assert.ok(c.source.length > 0 && c.source.every(u => u.startsWith('https://')), `${c.id} source`);
    for (const f of c.fingerings) {
      assert.equal(f.states.length, c.holes.length, `${c.id} offset ${f.offset}`);
      assert.ok(f.states.every(st => ['c', 'o', 'h'].includes(st)));
    }
    for (const k of c.keys) assert.ok(noteToMidi(k.lowest) > 0, `${c.id} key ${k.id}`);
  }
});

test('tin whistle: D4 all closed, C natural half-holed, second octave overblown', () => {
  const w = instrumentFromChart('tin-whistle-d', 'D');
  const ch = w.chambers[0];
  assert.deepEqual(ch.fingerings[noteToMidi('D4')], ['c', 'c', 'c', 'c', 'c', 'c']);
  assert.deepEqual(ch.fingerings[noteToMidi('C5')], ['h', 'o', 'o', 'o', 'o', 'o']);
  assert.deepEqual(ch.alternates[noteToMidi('C5')], [['o', 'c', 'c', 'o', 'o', 'o']]);
  assert.ok(ch.overblow.includes(noteToMidi('E5')));
  assert.ok(!ch.overblow.includes(noteToMidi('E4')));
  assert.equal(ch.notes.length, 25); // D4 to D6, chromatic
});

test('12-hole STL ocarina: A3 to F5, sub-holes on the middle fingers', () => {
  const o = instrumentFromChart('ocarina-12-stl-c', 'C-A3');
  const ch = o.chambers[0];
  assert.equal(ch.notes[0], noteToMidi('A3'));
  assert.equal(ch.notes.at(-1), noteToMidi('F5'));
  assert.equal(ch.notes.length, 21);
  assert.deepEqual(ch.holes.filter(h => h.sub).map(h => h.finger), ['L2', 'R2']);
  // C4: the ten main holes covered, both sub-holes open.
  const c4 = ch.fingerings[noteToMidi('C4')];
  ch.holes.forEach((h, i) => assert.equal(c4[i], h.sub ? 'o' : 'c'));
});

test('Native American flutes: pentatonic minor notes present', () => {
  const f = instrumentFromChart('naf6-a', 'A4');
  for (const n of ['A4', 'C5', 'D5', 'E5', 'G5', 'A5']) assert.ok(f.chambers[0].fingerings[noteToMidi(n)], n);
  assert.deepEqual(f.chambers[0].fingerings[noteToMidi('G5')], ['c', 'o', 'c', 'o', 'o', 'o']);
});

test('sub-holes are named and moved on their own', async () => {
  const { fingeringMoves, describeFingering } = await import('../js/ocarina-ui.js');
  const o = instrumentFromChart('ocarina-12-stl-c', 'C-A3');
  assert.equal(fingeringMoves(o, noteToMidi('A3'), noteToMidi('Bb3')).text, 'Lift R2 sub-hole');
  assert.equal(describeFingering(o, noteToMidi('Bb3'), 'Bb3'), 'Bb3: R2 sub-hole open, all others closed');
  assert.equal(o.name, '12-hole ocarina in C (STL chart, Asian top notes) (A3)');
});
