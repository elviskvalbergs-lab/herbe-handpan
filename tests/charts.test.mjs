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

test('any-key pentatonic NAF charts: every root in octaves 3–5, fingerings by degree (High Spirits pp.14–15)', async () => {
  const { chartDefaultKey, chartKeyFor } = await import('../js/charts.js');
  const order = chartsForFamily('flute').map(c => c.id);
  assert.deepEqual(order.slice(0, 3), ['tin-whistle-d', 'naf6-penta', 'naf5-penta']);
  for (const id of ['naf6-penta', 'naf5-penta']) {
    const c = getChart(id);
    assert.deepEqual(c.octaves, [3, 4, 5]);
    assert.equal(c.keys.length, 36);
    assert.equal(chartDefaultKey(c), 'A4');
    assert.deepEqual(c.fingerings.map(f => f.offset), [0, 3, 5, 7, 10, 12]);
    assert.equal(c.source[0], getChart('naf6-a').source[0]);
    assert.equal(chartKeyFor(c, 'Bb', 3).id, 'A#3');
    assert.equal(chartKeyFor(c, 'G', 6), null);
  }
  const g = instrumentFromChart('naf6-penta', 'G3', { now: 'T' });
  const ch = g.chambers[0];
  assert.equal(g.name, 'Native American flute, 6 holes in G (G3)');
  assert.deepEqual(ch.notes, ['G3', 'Bb3', 'C4', 'D4', 'F4', 'G4'].map(noteToMidi));
  const row = n => ch.fingerings[noteToMidi(n)].map(s => (s === 'c' ? 'X' : 'O')).join('');
  assert.deepEqual(['G3', 'Bb3', 'C4', 'D4', 'F4', 'G4'].map(row), ['XXXXXX', 'XXXXXO', 'XXXXOO', 'XXXOOO', 'XOXOOO', 'OOXOOO']);
  const e = instrumentFromChart('naf5-penta', 'E4').chambers[0];
  assert.deepEqual(e.notes, ['E4', 'G4', 'A4', 'B4', 'D5', 'E5'].map(noteToMidi));
  assert.deepEqual(e.fingerings[noteToMidi('D5')], ['c', 'o', 'o', 'o', 'o']);
  // The pentatonic chart in A matches the A chromatic chart's scale notes.
  for (const [p, c] of [['naf6-penta', 'naf6-a'], ['naf5-penta', 'naf5-a'], ['naf6-penta', 'naf6-fs'], ['naf5-penta', 'naf5-fs']]) {
    const key = c.endsWith('fs') ? 'F#4' : 'A4';
    const pa = instrumentFromChart(p, key).chambers[0];
    const ca = instrumentFromChart(c, key).chambers[0];
    for (const m of pa.notes) assert.deepEqual(pa.fingerings[m], ca.fingerings[m], `${p} vs ${c} at ${m}`);
  }
  // Charts with explicit keys still name instruments as before.
  assert.equal(instrumentFromChart('naf6-a', 'A3').name, 'Native American flute, 6 holes, key of A (A3)');
});
