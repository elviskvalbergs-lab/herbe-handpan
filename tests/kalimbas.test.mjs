// Kalimbas (js/kalimbas.js): sourced data, links, chords, the picture and
// their place in the setup and My instruments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLayoutFromScale, noteToMidi, getAllNotes } from '../js/data.js';
import { findAllChords } from '../js/chords.js';
import { KALIMBAS, kalimbaOrder } from '../js/kalimbas.js';
import { findTuning, layoutInstrument, familyOfTuningId } from '../js/layoutfamilies.js';
import { linkFor, parseLink, linkTitle, layoutFromCustomParams, linkPreview } from '../js/links.js';
import { renderPan } from '../js/pan.js';
import { reconcileInstruments, usesLayout, instrumentStatus } from '../js/instruments.js';
import { rankScalesByNotes } from '../js/scalefinder.js';
import { setupRoots, setupScalesFor, setupFirstChord, setupKeyNote } from '../js/setup.js';

const all = t => [t.top.ding, ...t.top.notes];

test('every tuning names a maker source with a URL; notes go up from the lowest', () => {
  for (const t of KALIMBAS) {
    assert.ok(t.sources.length && t.sources.every(s => /^https:\/\//.test(s.url) && s.maker), t.id);
    const midis = all(t).map(noteToMidi);
    assert.ok(midis.every(Number.isFinite), t.id);
    assert.ok(midis.every((m, i) => i === 0 || m >= midis[i - 1]), `${t.id} ascending`);
    assert.equal(familyOfTuningId(t.id), 'kalimba');
    if (t.order) assert.deepEqual([...t.order].sort(), [...all(t)].sort(), `${t.id}: the key order uses every note once`);
  }
  assert.equal(new Set(KALIMBAS.map(t => t.id)).size, KALIMBAS.length);
});

test('the standard key order: lowest in the middle, alternating outwards', () => {
  assert.deepEqual(kalimbaOrder(['C4', 'D4', 'E4', 'F4', 'G4']), ['F4', 'D4', 'C4', 'E4', 'G4']);
});

test('links: /kalimba/<slug> round-trips, with tabs and chords', () => {
  for (const t of KALIMBAS) {
    const path = linkFor({ scaleId: t.id });
    assert.equal(path, `/kalimba/${t.slug}`);
    const back = parseLink(path);
    assert.deepEqual([back.kind, back.family, back.scaleId], ['scale', 'kalimba', t.id]);
  }
  const l = parseLink('/kalimba/c-major-17/chords/c-maj');
  assert.equal(l.chord, 'c-maj');
  assert.match(linkTitle(l), /kalimba$/);
  assert.equal(linkPreview('/kalimba/c-major-17').image, '/og/kalimba.jpg');
});

test('a custom kalimba link keeps its family and up to 21 keys', () => {
  const l = parseLink('/kalimba/custom', '?ding=C4&top=D4,E4,F4,G4&tc=9&name=Mine');
  assert.equal(l.kind, 'custom');
  const layout = layoutFromCustomParams(l.params, l.family);
  assert.equal(layoutInstrument(layout), 'kalimba');
  assert.equal(layout.top.capacity, 9);
  assert.equal(layout.bottom.capacity, 0);
  assert.equal(layoutFromCustomParams(new URLSearchParams({ tc: '40' }), 'kalimba').top.capacity, 20);
});

test('chords are found on every tuning, and a first chord to play', () => {
  for (const t of KALIMBAS) {
    const chords = findAllChords(createLayoutFromScale(t));
    assert.ok(chords.some(c => c.type.id === 'maj' || c.type.id === 'min'), t.id);
    assert.ok(setupFirstChord(chords, setupKeyNote(t)), t.id);
  }
});

test('the picture draws every note as a key', () => {
  for (const t of KALIMBAS) {
    const layout = createLayoutFromScale(t);
    const svg = renderPan(layout);
    assert.equal((svg.match(/class="pan-note kalimba-key/g) ?? []).length, all(t).length, t.id);
    for (const n of getAllNotes(layout)) assert.ok(svg.includes(`data-note="${n}"`), `${t.id} ${n}`);
  }
  const c17 = renderPan(createLayoutFromScale(findTuning('KL-C-Major-17')), { highlightNotes: ['C4', 'E4', 'G4'] });
  assert.match(c17, /highlight-0/);
});

test('a saved kalimba is a Kalimba in My instruments', () => {
  const layout = createLayoutFromScale(findTuning('KL-C-Major-17'));
  assert.equal(layout.instrument, 'kalimba');
  const { instruments } = reconcileInstruments([], [{ id: 'KL-C-Major-17', name: 'C major (17)', layout, savedAt: 0 }], 'now');
  assert.equal(instruments[0].family, 'kalimba');
  assert.ok(usesLayout(instruments[0]));
  assert.equal(instrumentStatus(instruments[0]), 'Kalimba');
});

test('Listen and the setup work on kalimbas', () => {
  const t = findTuning('KL-C-Major-10');
  assert.equal(rankScalesByNotes(all(t).map(noteToMidi), KALIMBAS)[0].scale.id, 'KL-C-Major-10');
  // "I know my key" goes by the key it is sold in, not its lowest key.
  const roots = setupRoots(KALIMBAS).map(r => r.pc);
  assert.deepEqual(roots.slice(0, 1), [0], 'C first: most kalimbas are in C');
  assert.ok(setupScalesFor(KALIMBAS, 0).some(s => s.id === 'KL-C-Major-21'), 'the 21-key C kalimba (lowest F3) is a C kalimba');
  assert.equal(setupKeyNote(findTuning('KL-G-Alto-15')), 'G4');
});

test('kalimba numbers: 1–7 from the key, dots for octaves, the sold key found from the notes', async () => {
  const { kalimbaNumbers, kalimbaKeyPc } = await import('../js/kalimbas.js');
  const notesOf = id => { const k = KALIMBAS.find(x => x.id === id); return [k.top.ding, ...k.top.notes]; };
  const c17 = kalimbaNumbers(notesOf('KL-C-Major-17'));
  assert.equal(c17.get('C4'), '1');
  assert.equal(c17.get('B4'), '7');
  assert.equal(c17.get('C5'), '1̇');
  assert.equal(c17.get('E6'), '3̈');
  // A 21-key C kalimba from F3: F3 is 4 with a dot below.
  const c21 = kalimbaNumbers(notesOf('KL-C-Major-21'));
  assert.equal(c21.get('F3'), '4̣');
  assert.equal(c21.get('C4'), '1');
  // G alto from G3: G3 = 1; A minor counts from C (A3 = 6 below).
  assert.equal(kalimbaNumbers(notesOf('KL-G-Alto-15')).get('G3'), '1');
  assert.equal(kalimbaKeyPc(notesOf('KL-A-Minor-9')), 0);
  assert.equal(kalimbaNumbers(notesOf('KL-A-Minor-9')).get('A3'), '6̣');
  // C pentatonic from G4 is still counted in C: G4 sits below its first C.
  assert.equal(kalimbaNumbers(notesOf('KL-C-Pentatonic-8')).get('G4'), '5\u0323');
  assert.equal(kalimbaNumbers(notesOf('KL-C-Pentatonic-8')).get('C5'), '1');
  // A custom kalimba (not in the list): the major key that holds its notes.
  assert.equal(kalimbaKeyPc(['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5']), 2);
  assert.equal(kalimbaNumbers(['C4', 'D4', 'F#4'], 0).get('F#4'), '#4');
});
