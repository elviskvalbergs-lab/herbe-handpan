// The recorder (js/charts.js: recorder-baroque, recorder-german): the data
// as published, its links, its chords and its place in every family list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteToMidi } from '../js/data.js';
import { findAllChords } from '../js/chords.js';
import { getChart, chartsForFamily, instrumentFromChart } from '../js/charts.js';
import { parseLink, linkFor, linkTitle, linkPreview, catalogueLinks, LINK_FAMILIES, LINK_TABS } from '../js/links.js';
import { INSTRUMENT_FAMILIES, isTubeFamily, windWord } from '../js/instruments.js';
import { ocarinaToLayout, playableMidis, fingeringFor, renderFingering, arpeggioOrder } from '../js/ocarina-ui.js';
import { chartSetupTunings } from '../js/setup.js';
import { VOICES } from '../js/audio.js';

const row = (chart, offset, alt = false) => chart.fingerings.filter(f => f.offset === offset && !!f.alt === alt).map(f => f.states.join(''))[0];

test('recorder charts: sourced, eight holes (thumb first), two octaves and a tone, fully chromatic', () => {
  const charts = chartsForFamily('recorder');
  assert.deepEqual(charts.map(c => c.id), ['recorder-baroque', 'recorder-german']);
  for (const c of charts) {
    assert.ok(c.source.length >= 2 && c.source.every(u => /^https:\/\//.test(u)), `${c.id} names its sources`);
    assert.ok(c.sourceName && c.notes.length > 100);
    assert.deepEqual(c.holes.map(h => h.finger), ['LT', 'L1', 'L2', 'L3', 'R1', 'R2', 'R3', 'R4']);
    assert.equal(c.holes[0].side, 'bottom');
    for (const f of c.fingerings) assert.equal(f.states.length, 8);
    assert.deepEqual([...new Set(c.fingerings.map(f => f.offset))], Array.from({ length: 27 }, (_, i) => i));
    assert.equal(row(c, 0), 'cccccccc', 'every hole covered is the lowest note');
  }
});

test('recorder: the fingerings as published (Woodwind Fingering Guide, Yamaha, Mollenhauer)', () => {
  const b = getChart('recorder-baroque'), g = getChart('recorder-german');
  // Baroque: the forked F and the F sharp; German: F is the next finger after E.
  assert.equal(row(b, 5), 'cccccocc');
  assert.equal(row(b, 6), 'ccccocco');
  assert.equal(row(g, 5), 'cccccooo');
  assert.equal(row(g, 6), 'ccccoccc');
  // Shared: the double holes for C sharp and D sharp, the thumb open for the
  // middle C sharp and D, the pinched thumb from the upper E.
  for (const c of [b, g]) {
    assert.equal(row(c, 1), 'ccccccch');
    assert.equal(row(c, 3), 'ccccccho');
    assert.equal(row(c, 7), 'ccccoooo');
    assert.equal(row(c, 12), 'cocooooo');
    assert.equal(row(c, 13), 'occooooo');
    assert.equal(row(c, 14), 'oocooooo');
    assert.equal(row(c, 16), 'hcccccoo');
    assert.equal(row(c, 26), 'hcoccoco');
    assert.equal(row(c, 11, true), 'coccoooo', 'the alternate B');
    for (const f of c.fingerings) if (f.offset >= 16) assert.equal(f.states[0], 'h', 'upper register: pinched thumb');
  }
  // The two systems differ only on F and F sharp in both octaves, the upper
  // G sharp and the second-highest note.
  const differ = Array.from({ length: 27 }, (_, i) => i).filter(i => row(b, i) !== row(g, i));
  assert.deepEqual(differ, [5, 6, 17, 18, 20, 25]);
});

test('recorder sizes: soprano C5, alto F4, tenor C4, sopranino F5; German soprano only', () => {
  const lows = Object.fromEntries(getChart('recorder-baroque').keys.map(k => [k.id, k.lowest]));
  assert.deepEqual(lows, { soprano: 'C5', alto: 'F4', tenor: 'C4', sopranino: 'F5' });
  assert.deepEqual(getChart('recorder-german').keys.map(k => k.id), ['soprano']);
  const alto = instrumentFromChart('recorder-baroque', 'alto');
  assert.equal(alto.family, 'recorder');
  assert.equal(alto.name, 'Alto recorder, baroque fingering');
  assert.match(alto.id, /^rc-/);
  assert.deepEqual([playableMidis(alto)[0], playableMidis(alto).at(-1)], [noteToMidi('F4'), noteToMidi('G6')]);
  assert.equal(instrumentFromChart('recorder-german', 'soprano').name, 'Soprano recorder, German fingering');
  assert.equal(fingeringFor(alto, noteToMidi('A#4')).states.join(''), 'cccccocc', 'the alto B flat is the soprano F fingering');
});

test('recorder links: every size has one, and it comes back the same', () => {
  const links = catalogueLinks().filter(l => l.family === 'recorder');
  assert.deepEqual(links.map(l => l.path), ['/recorder/soprano-baroque', '/recorder/alto-baroque', '/recorder/tenor-baroque', '/recorder/sopranino-baroque', '/recorder/soprano-german']);
  for (const l of links) {
    const back = parseLink(linkFor({ chartId: l.chartId, keyId: l.keyId }));
    assert.deepEqual([back.kind, back.chartId, back.keyId, back.path], ['chart', l.chartId, l.keyId, l.path]);
  }
  assert.equal(parseLink('/recorder/soprano').path, '/recorder/soprano-baroque');
  assert.equal(parseLink('/recorder/treble').path, '/recorder/alto-baroque');
  assert.equal(parseLink('/recorder/descant').path, '/recorder/soprano-baroque');
  assert.equal(parseLink('/recorder/german').path, '/recorder/soprano-german');
  assert.equal(parseLink('/flute/alto-baroque').path, '/recorder/alto-baroque', 'found from another family');
  assert.equal(parseLink('/recorder/nonsense').kind, 'unknown');
  assert.equal(linkFor({ chartId: 'recorder-baroque', keyId: 'alto' }, { tab: 'chords', chord: 'F-maj' }), '/recorder/alto-baroque/chords/f-maj');
  assert.equal(parseLink('/recorder/alto-baroque/playlists').tab, 'playlists');
  assert.equal(parseLink('/recorder/alto-baroque/listen').tab, 'listen');
  assert.equal(linkTitle(parseLink('/recorder/soprano-german')), 'Soprano recorder, German fingering');
  const card = linkPreview('/recorder/soprano-baroque');
  assert.equal(card.title, 'Soprano recorder, baroque fingering · Oakhum');
  assert.equal(card.image, '/og/recorder.jpg');
});

test('recorder: in every family list, drawn as a tube, with its own voice', () => {
  assert.ok(INSTRUMENT_FAMILIES.some(f => f.id === 'recorder'));
  assert.ok(LINK_FAMILIES.includes('recorder'));
  assert.ok(['notes', 'chords', 'playlists', 'listen'].every(t => LINK_TABS.recorder.includes(t)));
  assert.ok(VOICES.includes('recorder'));
  assert.ok(isTubeFamily('recorder') && isTubeFamily('flute') && !isTubeFamily('ocarina'));
  assert.equal(windWord({ family: 'recorder' }), 'recorder');
  const sop = instrumentFromChart('recorder-baroque', 'soprano');
  const svg = renderFingering(sop, noteToMidi('E6'));
  assert.match(svg, /is-flute/);
  assert.match(svg, /LT half-covered/, 'the pinched thumb is in the description');
});

test('recorder: chords are found, and play as arpeggios from the root', () => {
  const sop = instrumentFromChart('recorder-baroque', 'soprano');
  const chords = findAllChords(ocarinaToLayout(sop));
  const ids = new Set(chords.map(c => c.id));
  for (const id of ['C-maj', 'F-maj', 'G-maj', 'A-min', 'D-min', 'E-min']) assert.ok(ids.has(id), id);
  const c = chords.find(x => x.id === 'C-maj');
  const arp = arpeggioOrder(c.notes, c.notes.find(n => n.startsWith('C')));
  assert.equal(arp[0] % 12, 0);
  for (const m of arp) assert.ok(fingeringFor(sop, m), 'every chord note has a fingering');
});

test('recorder in the setup: every size of both charts can be matched', () => {
  const list = chartSetupTunings('recorder');
  assert.equal(list.length, 5);
  assert.deepEqual(list.map(t => t.key), ['C', 'F', 'C', 'F', 'C']);
  assert.equal(list[0].name, 'Soprano recorder, baroque fingering');
});
