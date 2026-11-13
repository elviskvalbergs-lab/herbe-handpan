// Unit tests for the pure parts of js/ocarina-ui.js. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { noteToMidi } from '../js/data.js';
import { buildScaleChambers, scaleToMidis, applyHoleSizes } from '../js/ocarina.js';
import { SCALES } from '../js/data.js';
import {
  playableMidis, fingeringFor, fingeringMoves, describeFingering,
  relativeSizes, renderFingering, renderHandLegend,
} from '../js/ocarina-ui.js';

const m = n => noteToMidi(n);
const dKurd = { chambers: buildScaleChambers(scaleToMidis(SCALES.find(s => s.id === 'D-Kurd'))) };

test('playable notes and fingering lookup', () => {
  assert.deepEqual(playableMidis(dKurd), ['D3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'].map(m));
  const f = fingeringFor(dKurd, m('F4'));
  assert.equal(f.chamberIndex, 1);
  assert.deepEqual(f.states, ['o', 'c', 'c']);
  assert.equal(fingeringFor(dKurd, m('B3')), null);
});

test('moves between notes', () => {
  assert.deepEqual(fingeringMoves(dKurd, m('D3'), m('Bb3')), {
    lift: ['R4', 'R3'], cover: [], half: [], switchChamber: false, text: 'Lift R4 and R3',
  });
  assert.equal(fingeringMoves(dKurd, m('C4'), m('A3')).text, 'Cover R3 and R2');
  // Changing chamber: D4 (all four open) → F4 on chamber 2 (only R4 open).
  const mv = fingeringMoves(dKurd, m('D4'), m('F4'));
  assert.equal(mv.switchChamber, true);
  assert.equal(mv.text, 'Blow chamber 2, cover R3 and R2');
  assert.equal(fingeringMoves(dKurd, m('D3'), m('D3')).text, 'No change');
});

test('moves include half-covering a hole', () => {
  const inst = { family: 'ocarina', chambers: [{ notes: [60, 61, 62], holes: [{ id: 'R1', finger: 'R1', side: 'top' }, { id: 'R2', finger: 'R2', side: 'top' }],
    fingerings: { 60: ['c', 'c'], 61: ['c', 'h'], 62: ['c', 'o'] } }] };
  const ab = fingeringMoves(inst, 60, 61);
  assert.deepEqual(ab.half, ['R2']);
  assert.equal(ab.text, 'Half-cover R2');
  assert.equal(fingeringMoves(inst, 61, 62).text, 'Lift R2');
  assert.equal(fingeringMoves(inst, 62, 61).text, 'Half-cover R2');
  assert.equal(fingeringMoves(inst, 61, 60).text, 'Cover R2');
});

test('mixed moves read as "Cover …, lift …"', () => {
  const inst = { chambers: [{ notes: [60, 62, 64], holes: [{ finger: 'R4' }, { finger: 'L1' }],
    fingerings: { 60: ['c', 'c'], 62: ['o', 'c'], 64: ['c', 'o'] } }] };
  assert.equal(fingeringMoves(inst, 64, 62).text, 'Cover L1, lift R4');
});

test('accessible description', () => {
  assert.equal(describeFingering(dKurd, m('Bb3'), 'Bb3'), 'Bb3 (chamber 1): R4 and R3 open, all others closed');
  assert.equal(describeFingering(dKurd, m('D3'), 'D3'), 'D3 (chamber 1): all holes closed');
  assert.equal(describeFingering(dKurd, m('D4'), 'D4'), 'D4 (chamber 1): R4, R3, R2 and R1 open');
  assert.equal(describeFingering(dKurd, m('B3'), 'B3'), 'B3: not on this instrument');
});

test('hole sizes in proportion: target notes, then measured mm', () => {
  const ch = dKurd.chambers[0];
  const rel = relativeSizes(ch);
  assert.equal(Math.max(...rel), 1);
  assert.ok(rel.every(r => r > 0 && r <= 1));
  const sized = applyHoleSizes(ch, [4, 5, 6, 8]);
  assert.deepEqual(relativeSizes(sized), [0.5, 0.625, 0.75, 1]);
});

test('renderFingering: SVG with label, states and moves', () => {
  const svg = renderFingering(dKurd, m('Bb3'), { size: 'large', previousMidi: m('D3'), showFingers: true });
  assert.match(svg, /^<svg class="fingering fingering-large"/);
  assert.match(svg, /aria-label="A#3 \(chamber 1\): R4 and R3 open, all others closed"/);
  assert.equal((svg.match(/fg-hole fg-o/g) || []).length, 2);
  assert.equal((svg.match(/fg-arrow-up/g) || []).length, 2);
  assert.match(svg, />R4</);
  assert.match(svg, /blow( \d)?</); // which chamber to blow
  // Mini drops arrows and labels.
  const mini = renderFingering(dKurd, m('Bb3'), { size: 'mini', previousMidi: m('D3'), showFingers: true });
  assert.doesNotMatch(mini, /fg-arrow|>R4</);
  assert.match(renderHandLegend(), /L1.*L4|LT/s);
});

// ── Chords ───────────────────────────────────────────────────────────────────
import { ocarinaToLayout, arpeggioOrder, fitChordToInstrument, nextVoicing } from '../js/ocarina-ui.js';
import { findAllChords } from '../js/chords.js';

test('ocarinaToLayout feeds findAllChords', () => {
  const layout = ocarinaToLayout({ id: 'x', name: 'DK', ...dKurd });
  assert.equal(layout.top.ding, 'D3');
  assert.equal(layout.top.slots.length, 8);
  const chords = findAllChords(layout);
  assert.ok(chords.some(c => c.id === 'D-min'));
  // Scale filter: only the pitch classes of D minor triad.
  const dm = ocarinaToLayout({ id: 'x', ...dKurd }, new Set([2, 5, 9]));
  assert.deepEqual([dm.top.ding, ...dm.top.slots.map(s => s.note)], ['D3', 'A3', 'D4', 'F4', 'A4']);
});

test('arpeggio order: root first, then up, then the notes below', () => {
  assert.deepEqual(arpeggioOrder(['D3', 'F4', 'A3'], 'D3'), [m('D3'), m('A3'), m('F4')]);
  assert.deepEqual(arpeggioOrder(['A3', 'C4', 'F4'], 'F4'), [m('F4'), m('A3'), m('C4')]);
});

test('fitting a chord: octave moves, then missing notes', () => {
  // G3 isn't on the D Kurd ocarina but G4 is; B is nowhere.
  assert.deepEqual(fitChordToInstrument(dKurd, ['G3', 'Bb3', 'D4']), { midis: [m('Bb3'), m('D4'), m('G4')], missing: [] });
  assert.deepEqual(fitChordToInstrument(dKurd, ['G3', 'B3', 'D4']).missing, ['B3']);
});

test('voicing swap cycles a note through its octaves', () => {
  const d = [m('D3'), m('F4'), m('A3')].sort((a, b) => a - b);
  assert.deepEqual(nextVoicing(dKurd, d, m('A3')), [m('D3'), m('F4'), m('A4')]);
  assert.deepEqual(nextVoicing(dKurd, [m('D3'), m('F4'), m('A4')], m('A4')), [m('D3'), m('A3'), m('F4')]);
  // Only one F on the instrument: unchanged.
  assert.deepEqual(nextVoicing(dKurd, d, m('F4')), d);
});
