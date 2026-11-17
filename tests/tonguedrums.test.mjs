// Tongue drums (js/tonguedrums.js): sourced data, links, chords, the picture
// and their place in the setup and My instruments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLayoutFromScale, noteToMidi, getAllNotes } from '../js/data.js';
import { findAllChords } from '../js/chords.js';
import { TONGUE_DRUMS } from '../js/tonguedrums.js';
import { findTuning, layoutInstrument } from '../js/layoutfamilies.js';
import { linkFor, parseLink, linkTitle, layoutFromCustomParams, linkPreview } from '../js/links.js';
import { renderPan } from '../js/pan.js';
import { reconcileInstruments, usesLayout, instrumentStatus } from '../js/instruments.js';
import { rankScalesByNotes } from '../js/scalefinder.js';
import { setupRoots, setupScalesFor, setupTopScales, setupFirstChord } from '../js/setup.js';

test('every tuning names a maker source with a URL, and its notes go up', () => {
  for (const t of TONGUE_DRUMS) {
    assert.ok(t.sources.length && t.sources.every(s => /^https:\/\//.test(s.url) && s.maker), t.id);
    const midis = [t.top.ding, ...t.top.notes].map(noteToMidi);
    assert.ok(midis.every((m, i) => i === 0 || m > midis[i - 1]), `${t.id} ascending`);
    assert.ok(Number.isFinite(midis[0]), t.id);
  }
  assert.equal(new Set(TONGUE_DRUMS.map(t => t.id)).size, TONGUE_DRUMS.length);
});

test('links: /tongue-drum/<slug> round-trips, with tabs and chords', () => {
  for (const t of TONGUE_DRUMS) {
    const path = linkFor({ scaleId: t.id });
    assert.equal(path, `/tongue-drum/${t.slug}`);
    const back = parseLink(path);
    assert.deepEqual([back.kind, back.family, back.scaleId], ['scale', 'tongue-drum', t.id]);
  }
  const l = parseLink('/tongue-drum/d-kurd-9/chords/d-min');
  assert.equal(l.chord, 'd-min');
  assert.equal(linkTitle(l), 'D Kurd tongue drum');
  assert.equal(linkPreview('/tongue-drum/d-kurd-9').image, '/og/tongue-drum.jpg');
});

test('a custom tongue drum link keeps its family and middle note', () => {
  const l = parseLink('/tongue-drum/custom', '?ding=C4&top=D4,E4,G4,A4,C5&tc=5&centre=1&name=Mine');
  assert.equal(l.kind, 'custom');
  const layout = layoutFromCustomParams(l.params, l.family);
  assert.equal(layoutInstrument(layout), 'tongue-drum');
  assert.equal(layout.centre, true);
  assert.equal(layout.bottom.capacity, 0);
  assert.ok(l.path.startsWith('/tongue-drum/custom?'));
});

test('chords are found on every tuning, and a first chord to play', () => {
  for (const t of TONGUE_DRUMS) {
    const chords = findAllChords(createLayoutFromScale(t));
    assert.ok(chords.some(c => c.type.id === 'maj' || c.type.id === 'min'), t.id);
    assert.ok(setupFirstChord(chords, t.top.ding), t.id);
  }
});

test('the picture draws every note as a tongue, the middle one round', () => {
  const kurd = createLayoutFromScale(findTuning('TD-D-Kurd-9'));
  const svg = renderPan(kurd, { highlightNotes: ['D3', 'F4', 'A4'] });
  assert.equal((svg.match(/class="pan-note tongue/g) ?? []).length, 8);
  assert.match(svg, /data-note-id="ding" data-note="D3"/);
  assert.match(svg, /highlight-0/);
  const six = renderPan(createLayoutFromScale(findTuning('TD-C-Major-Pentatonic-6')));
  assert.equal((six.match(/class="pan-note tongue/g) ?? []).length, 6, 'no middle tongue: all six round the edge');
  for (const n of getAllNotes(createLayoutFromScale(findTuning('TD-D-Kurd-15')))) assert.ok(renderPan(createLayoutFromScale(findTuning('TD-D-Kurd-15'))).includes(`data-note="${n}"`), n);
});

test('a saved tongue drum is a Tongue drum in My instruments', () => {
  const layout = createLayoutFromScale(findTuning('TD-D-Amara-9'));
  const { instruments } = reconcileInstruments([], [{ id: 'TD-D-Amara-9', name: 'D Amara (9)', layout, savedAt: 0 }], 'now');
  assert.equal(instruments[0].family, 'tongue-drum');
  assert.ok(usesLayout(instruments[0]));
  assert.equal(instrumentStatus(instruments[0]), 'Tongue drum');
});

test('Listen and the setup work on tongue drums', () => {
  const kurd = findTuning('TD-D-Kurd-9');
  const heard = [kurd.top.ding, ...kurd.top.notes].map(noteToMidi);
  assert.equal(rankScalesByNotes(heard, TONGUE_DRUMS)[0].scale.id, 'TD-D-Kurd-9');
  const roots = setupRoots(TONGUE_DRUMS);
  assert.equal(roots[0].pc, 2, 'D first');
  const inD = setupTopScales(setupScalesFor(TONGUE_DRUMS, 2));
  assert.equal(new Set(inD.map(t => t.family)).size, inD.length);
});

test('a catalogue drum can be drawn with or without a middle tongue, and the link keeps it', () => {
  const l = parseLink('/tongue-drum/d-kurd-9/chords', '?centre=0');
  assert.deepEqual([l.kind, l.scaleId, l.centre, l.tab], ['scale', 'TD-D-Kurd-9', false, 'chords']);
  assert.equal(l.path, '/tongue-drum/d-kurd-9/chords?centre=0');
  assert.equal(parseLink('/tongue-drum/d-kurd-9').centre, undefined, 'the maker\'s drawing when the link says nothing');
  assert.equal(parseLink('/handpan/d-kurd', '?centre=0').centre, undefined, 'only tongue drums');
  const flat = createLayoutFromScale(findTuning('TD-D-Kurd-9'));
  flat.centre = false;
  const svg = renderPan(flat);
  assert.equal((svg.match(/class="pan-note tongue/g) ?? []).length, 9, 'all nine round the edge');
});
