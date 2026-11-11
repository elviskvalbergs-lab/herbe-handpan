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
    assert.equal(d.name, 'Test pipe, D');
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
