// Unit tests for js/chordsheet.js. Run with: node --test
// Examples use chord-only lines, a traditional song (Scarborough Fair) and
// invented lines: no copyrighted lyrics.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseChordSymbol, chordTypeForIntervals, transposeChordSymbol, parseChordSheet, splitBarBeats,
  mergeRepeatedSteps, stepLength, matchSheetChord, sheetCoverage, rankTranspositions, coverageBand,
  stackVoicing, strikePattern, strikeNumbers, FAST_BPM,
} from '../js/chordsheet.js';
import { findAllChords } from '../js/chords.js';
import { SCALES, createLayoutFromScale, getAllNotes } from '../js/data.js';

const typeOf = s => parseChordSymbol(s)?.type?.id ?? null;
const dKurd = createLayoutFromScale(SCALES.find(s => s.id === 'D-Kurd'));
const dKurdChords = findAllChords(dKurd);

test('chord symbols: roots with sharps and flats', () => {
  assert.equal(parseChordSymbol('C').rootPC, 0);
  assert.equal(parseChordSymbol('C#').rootPC, 1);
  assert.equal(parseChordSymbol('Db').rootPC, 1);
  assert.equal(parseChordSymbol('Bb').rootPC, 10);
  assert.equal(parseChordSymbol('Cb').rootPC, 11);
  assert.equal(parseChordSymbol('E#').rootPC, 5);
  assert.equal(parseChordSymbol('F♯m').root, 'F#');
  assert.equal(parseChordSymbol('B♭').rootPC, 10);
  assert.equal(parseChordSymbol('Hello'), null);
  assert.equal(parseChordSymbol('Go'), null);
  assert.equal(parseChordSymbol('Be'), null);
  assert.equal(parseChordSymbol(''), null);
});

test('chord symbols: qualities map onto CHORD_TYPES by intervals', () => {
  const cases = {
    C: 'maj', Cmaj: 'maj', CM: 'maj',
    Am: 'min', Amin: 'min', 'A-': 'min', Ami: 'min',
    G7: 'dom7', Cmaj7: 'maj7', CM7: 'maj7', 'CΔ7': 'maj7', Am7: 'min7', Amin7: 'min7', 'A-7': 'min7',
    Bdim: 'dim', 'B°': 'dim', Bdim7: 'dim7', Bm7b5: 'hdim7', 'Bø': 'hdim7',
    Caug: 'aug', 'C+': 'aug',
    Dsus2: 'sus2', Dsus4: 'sus4', Dsus: 'sus4',
    Cadd9: 'add9', Cadd2: 'add9', Cmadd9: 'madd9', 'Cm(add9)': 'madd9',
    C6: 'maj6', Am6: 'min6',
    C9: 'dom9', Cmaj9: 'maj9', Am9: 'min9',
    C5: 'p5', AmM7: 'mmaj7', 'Am(maj7)': 'mmaj7',
  };
  for (const [sym, id] of Object.entries(cases)) assert.equal(typeOf(sym), id, sym);
});

test('chord symbols: slash chords play the chord and keep the bass', () => {
  const c = parseChordSymbol('C/G');
  assert.equal(c.type.id, 'maj');
  assert.equal(c.rootPC, 0);
  assert.equal(c.bass, 'G');
  assert.equal(c.bassPC, 7);
  const d = parseChordSymbol('D/F#');
  assert.equal(d.bass, 'F#');
  assert.equal(d.bassPC, 6);
  assert.equal(parseChordSymbol('Am7/G').type.id, 'min7');
});

test('chord symbols that are chords but not in CHORD_TYPES are reported, not dropped', () => {
  for (const sym of ['C7sus4', 'G13', 'F11']) {
    const c = parseChordSymbol(sym);
    assert.ok(c, sym);
    assert.equal(c.type, null, sym);
  }
  const unknown = parseChordSymbol('C7b9#11');
  assert.ok(unknown);
  assert.equal(unknown.type, null);
});

test('interval sets match in any order', () => {
  assert.equal(chordTypeForIntervals([0, 7, 4]).id, 'maj');
  assert.equal(chordTypeForIntervals([0, 2, 4, 7]).id, 'add9');
  assert.equal(chordTypeForIntervals([0, 1]), null);
  assert.equal(chordTypeForIntervals(null), null);
});

test('transposing a symbol keeps its suffix and bass', () => {
  assert.equal(transposeChordSymbol(parseChordSymbol('C'), 5), 'F');
  assert.equal(transposeChordSymbol(parseChordSymbol('Am7'), 5), 'Dm7');
  assert.equal(transposeChordSymbol(parseChordSymbol('G'), 3), 'Bb');
  assert.equal(transposeChordSymbol(parseChordSymbol('F#m'), 1), 'Gm');
  assert.equal(transposeChordSymbol(parseChordSymbol('C#'), 2), 'D#');
  assert.equal(transposeChordSymbol(parseChordSymbol('D/F#'), -2), 'C/E');
  assert.equal(transposeChordSymbol(parseChordSymbol('Bbm'), 0), 'Bbm');
});

test('a plain chord line: one chord per bar', () => {
  const s = parseChordSheet('Am  Dm  Am  Bbm');
  assert.deepEqual(s.steps.map(x => [x.symbol, x.beats]), [['Am', 4], ['Dm', 4], ['Am', 4], ['Bbm', 4]]);
  assert.equal(s.beatsPerBar, 4);
  assert.equal(s.bpm, null);
  assert.deepEqual(s.unknown, []);
});

test('bar lines: | delimits bars, two chords in a bar are half bars, % repeats', () => {
  const s = parseChordSheet('| Am | Dm | Am | Bbm |', { merge: false });
  assert.deepEqual(s.steps.map(x => [x.symbol, x.beats]), [['Am', 4], ['Dm', 4], ['Am', 4], ['Bbm', 4]]);
  const h = parseChordSheet('| C G | Am F | % | G |', { merge: false });
  assert.deepEqual(h.steps.map(x => [x.symbol, x.beats]),
    [['C', 2], ['G', 2], ['Am', 2], ['F', 2], ['Am', 2], ['F', 2], ['G', 4]]);
  assert.deepEqual(splitBarBeats(3, 4), [2, 1, 1]);
  assert.deepEqual(splitBarBeats(2, 3), [2, 1]);
  assert.deepEqual(splitBarBeats(1, 3), [3]);
});

test('the same chord in bars that follow each other becomes one step', () => {
  const s = parseChordSheet('| F | F | Dm | Dm | Bb | C | F | F |');
  assert.deepEqual(s.steps.map(x => [x.symbol, x.beats]), [['F', 8], ['Dm', 8], ['Bb', 4], ['C', 4], ['F', 8]]);
  assert.deepEqual(mergeRepeatedSteps([{ symbol: 'A', beats: 2, section: 'V' }, { symbol: 'A', beats: 2, section: 'C' }]).length, 2);
  assert.deepEqual(stepLength(8, 4), { bars: 2 });
  assert.deepEqual(stepLength(2, 4), { bars: 1, beats: 2 });
});

test('repeat counts on a chord line', () => {
  const s = parseChordSheet('| Am | G | x2', { merge: false });
  assert.deepEqual(s.steps.map(x => x.symbol), ['Am', 'G', 'Am', 'G']);
});

test('chord-over-lyrics: lyric lines are dropped, section headings recorded', () => {
  const sheet = [
    'Title: Morning walk',
    'Tempo: 96',
    '',
    '[Verse 1]',
    'C        G         Am       F',
    'Here is a line of words I made up',
    'C        G         F',
    'And another line to sing along',
    '',
    'Chorus:',
    'F  G  C  C',
    'La la la',
  ].join('\n');
  const s = parseChordSheet(sheet);
  assert.equal(s.title, 'Morning walk');
  assert.equal(s.bpm, 96);
  assert.deepEqual(s.sections, ['Verse 1', 'Chorus']);
  assert.deepEqual(s.steps.map(x => [x.symbol, x.section]), [
    ['C', 'Verse 1'], ['G', 'Verse 1'], ['Am', 'Verse 1'], ['F', 'Verse 1'],
    ['C', 'Verse 1'], ['G', 'Verse 1'], ['F', 'Verse 1'],
    ['F', 'Chorus'], ['G', 'Chorus'], ['C', 'Chorus'],
  ]);
  assert.equal(s.steps[s.steps.length - 1].beats, 8);
});

test('a section name in front of a chord line', () => {
  const s = parseChordSheet('Intro: | Am | Em |\nOutro: Am');
  assert.deepEqual(s.steps.map(x => [x.symbol, x.section]), [['Am', 'Intro'], ['Em', 'Intro'], ['Am', 'Outro']]);
});

test('ChordPro: directives, inline chords, sections and chorus repeats', () => {
  // Scarborough Fair is a traditional English ballad (public domain).
  const sheet = [
    '{title: Scarborough Fair}',
    '{subtitle: Traditional}',
    '{key: Am}',
    '{tempo: 100}',
    '{time: 3/4}',
    '# a comment line',
    '{start_of_verse}',
    '[Am]Are you going to [G]Scarborough [Am]Fair?',
    '[C]Parsley, [Am]sage, rose[D]mary and [Am]thyme',
    '{end_of_verse}',
    '{start_of_chorus: Refrain}',
    '[C]Remember [G]me to [Am]one who lives there',
    '{end_of_chorus}',
    '{start_of_tab}',
    'e|---0---|',
    '{end_of_tab}',
    '{chorus}',
  ].join('\n');
  const s = parseChordSheet(sheet, { merge: false });
  assert.equal(s.title, 'Scarborough Fair');
  assert.equal(s.subtitle, 'Traditional');
  assert.equal(s.key, 'Am');
  assert.equal(s.bpm, 100);
  assert.equal(s.beatsPerBar, 3);
  assert.equal(s.beatUnit, 4);
  assert.deepEqual(s.sections, ['Verse', 'Refrain']);
  assert.deepEqual(s.steps.map(x => x.symbol), ['Am', 'G', 'Am', 'C', 'Am', 'D', 'Am', 'C', 'G', 'Am', 'C', 'G', 'Am']);
  assert.ok(s.steps.every(x => x.beats === 3));
  assert.deepEqual(s.steps.map(x => x.section), [...Array(7).fill('Verse'), ...Array(6).fill('Refrain')]);
});

test('ChordPro short forms {soc} {eoc} {t:} and inline bar lines', () => {
  const s = parseChordSheet('{t: Short}\n{soc}\n| [Am] [Dm] | [E7] |\n{eoc}', { merge: false });
  assert.equal(s.title, 'Short');
  assert.deepEqual(s.steps.map(x => [x.symbol, x.beats, x.section]), [['Am', 2, 'Chorus'], ['Dm', 2, 'Chorus'], ['E7', 4, 'Chorus']]);
});

test('symbols that do not map are reported once', () => {
  const s = parseChordSheet('C7sus4 G13 C7sus4 Am');
  assert.deepEqual(s.unknown, ['C7sus4', 'G13']);
  assert.equal(s.steps.length, 4);
});

test('coverage: share of steps whose chord the instrument plays', () => {
  const s = parseChordSheet('| C | Am | F | G |');
  const c0 = sheetCoverage(s.steps, dKurdChords, 0);
  assert.equal(c0.playable, 3);
  assert.equal(c0.total, 4);
  assert.equal(c0.score, 0.75);
  assert.deepEqual(c0.missing, ['G']);
  const up5 = sheetCoverage(s.steps, dKurdChords, 5);
  assert.equal(up5.score, 1);
  assert.deepEqual(up5.missing, []);
  assert.equal(matchSheetChord(parseChordSymbol('C7sus4'), dKurdChords), null);
});

test('transpositions are ranked best first, smallest move breaking ties', () => {
  const s = parseChordSheet('| C | Am | F | G |');
  const ranked = rankTranspositions(s.steps, dKurdChords);
  assert.equal(ranked.length, 12);
  assert.equal(ranked[0].semis, 5);
  assert.equal(ranked[0].score, 1);
  for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].score >= ranked[i].score);
  // Already in F: as written comes first.
  assert.equal(rankTranspositions(parseChordSheet('F Dm Bb C').steps, dKurdChords)[0].semis, 0);
  assert.equal(coverageBand(1), 'plays');
  assert.equal(coverageBand(0.85), 'swaps');
  assert.equal(coverageBand(0.5), 'breaks');
});

test('an empty or chordless sheet has no steps', () => {
  assert.equal(parseChordSheet('').steps.length, 0);
  assert.equal(parseChordSheet('just some words\nand more words').steps.length, 0);
  assert.equal(sheetCoverage([], dKurdChords).score, 0);
});

// ── Worked example from docs/ocarina-mode.md: Stand by Me on D Kurd ─────────
// The I–vi–IV–V progression in F (chords only).
const voiced = sym => {
  const ch = matchSheetChord(parseChordSymbol(sym), dKurdChords);
  return stackVoicing(parseChordSymbol(sym).rootPC, ch.type.intervals, getAllNotes(dKurd));
};

test('Stand by Me (I–vi–IV–V in F) on D Kurd: every chord is playable', () => {
  const s = parseChordSheet('| F | F | Dm | Dm | Bb | C | F | F |');
  assert.deepEqual(s.steps.map(x => [x.symbol, x.beats / 4]), [['F', 2], ['Dm', 2], ['Bb', 1], ['C', 1], ['F', 2]]);
  const cov = sheetCoverage(s.steps, dKurdChords, 0);
  assert.equal(cov.score, 1);
  for (const sym of ['F', 'Dm', 'Bb', 'C']) assert.ok(matchSheetChord(parseChordSymbol(sym), dKurdChords), sym);
});

test('Stand by Me on D Kurd: the notes of each chord, as in the docs table', () => {
  assert.deepEqual(voiced('F'), ['C4', 'F4', 'A4']);
  assert.deepEqual(voiced('Dm'), ['D3', 'F4', 'A4']);
  assert.deepEqual(voiced('Bb'), ['Bb3', 'D4', 'F4']);
  assert.deepEqual(voiced('C'), ['C4', 'E4', 'G4']);
});

test('Stand by Me on D Kurd: Level 1 (roots) on beat 1', () => {
  const root = { F: 'F4', Dm: 'D3', Bb: 'Bb3', C: 'C4' };
  for (const sym of ['F', 'Dm', 'Bb', 'C']) {
    const notes = voiced(sym);
    const rootNote = notes.find(n => n.startsWith(parseChordSymbol(sym).root));
    const { hits } = strikePattern({ notes, root: rootNote, beatsPerBar: 4, beats: 4, level: 'roots' });
    assert.deepEqual(hits, [{ beat: 0, notes: [root[sym]], hand: 'R' }], sym);
  }
  // Two bars of F: the root on beat 1 of each bar.
  const two = strikePattern({ notes: voiced('F'), root: 'F4', beatsPerBar: 4, beats: 8, level: 'roots' });
  assert.deepEqual(two.hits.map(h => [h.beat, h.notes[0]]), [[0, 'F4'], [4, 'F4']]);
});

test('Stand by Me on D Kurd: Level 2 (arpeggio) on beats 1-2-3-4', () => {
  const table = {
    F: ['C4', 'F4', 'A4', 'F4'],
    Dm: ['D3', 'F4', 'A4', 'F4'],
    Bb: ['Bb3', 'D4', 'F4', 'D4'],
    C: ['C4', 'E4', 'G4', 'E4'],
  };
  const order = ['F', 'Dm', 'Bb', 'C', 'F'];
  order.forEach((sym, i) => {
    const notes = voiced(sym);
    const next = i + 1 < order.length ? voiced(order[i + 1]) : null;
    const { hits, reduced } = strikePattern({ notes, beatsPerBar: 4, beats: 4, bpm: 80, level: 'arpeggio', next });
    assert.equal(reduced, false);
    assert.deepEqual(hits.map(h => h.notes[0]), table[sym], sym);
    assert.deepEqual(hits.map(h => h.beat), [0, 1, 2, 3]);
    assert.deepEqual(hits.map(h => h.hand), ['R', 'L', 'R', 'L']);
  });
});

test('arpeggio bounces over other chord sizes and time signatures', () => {
  const four = strikePattern({ notes: ['D3', 'F4', 'A4', 'C4'], level: 'arpeggio' });
  assert.deepEqual(four.hits.map(h => h.notes[0]), ['D3', 'C4', 'F4', 'A4']);
  const waltz = strikePattern({ notes: ['C4', 'E4', 'G4'], beatsPerBar: 3, beats: 3, level: 'arpeggio' });
  assert.deepEqual(waltz.hits.map(h => h.notes[0]), ['C4', 'E4', 'G4']);
  const dyad = strikePattern({ notes: ['D3', 'A3'], level: 'arpeggio' });
  assert.deepEqual(dyad.hits.map(h => h.notes[0]), ['D3', 'A3', 'D3', 'A3']);
});

test('groove: root on strong beats, pairs on backbeats, ghost taps between', () => {
  const { hits } = strikePattern({ notes: ['C4', 'F4', 'A4'], root: 'F4', level: 'groove' });
  const at = b => hits.filter(h => h.beat === b);
  assert.deepEqual(at(0), [{ beat: 0, notes: ['F4'], hand: 'R' }]);
  assert.deepEqual(at(0.5), [{ beat: 0.5, notes: ['F4'], hand: 'L', ghost: true }]);
  assert.deepEqual(at(1).map(h => [h.notes[0], h.hand]), [['C4', 'L'], ['A4', 'R']]);
  assert.deepEqual(at(2).map(h => h.notes[0]), ['F4']);
  assert.equal(at(2.5)[0].ghost, true);
  assert.equal(at(3).length, 2);
  assert.deepEqual([...new Set(hits.map(h => h.beat))], [0, 0.5, 1, 2, 2.5, 3]);
});

test('ring rule: a pair that rings into the next chord prefers shared notes', () => {
  // C (C4 E4 G4) into F (C4 F4 A4): the last backbeat's E4 and G4 ring
  // into F, which only shares C4 with C.
  const { hits } = strikePattern({ notes: ['C4', 'E4', 'G4'], root: 'C4', level: 'groove', next: ['C4', 'F4', 'A4'] });
  const last = hits.filter(h => h.beat === 3).flatMap(h => h.notes);
  assert.ok(last.includes('C4'));
  // Without a next chord the pair is the chord's other notes.
  const plain = strikePattern({ notes: ['C4', 'E4', 'G4'], root: 'C4', level: 'groove' });
  assert.deepEqual(plain.hits.filter(h => h.beat === 3).flatMap(h => h.notes), ['E4', 'G4']);
});

test('more than one chord per bar, or a fast tempo: fewer notes', () => {
  const half = strikePattern({ notes: ['C4', 'E4', 'G4'], beatsPerBar: 4, beats: 2, level: 'arpeggio' });
  assert.equal(half.reduced, true);
  assert.deepEqual(half.hits.map(h => [h.beat, h.notes[0]]), [[0, 'C4'], [1, 'E4'], [1, 'G4']]);
  const fast = strikePattern({ notes: ['C4', 'E4', 'G4'], bpm: FAST_BPM, level: 'groove' });
  assert.equal(fast.reduced, true);
  assert.equal(fast.hits.some(h => h.ghost), false);
  assert.deepEqual(fast.hits.map(h => h.beat), [0, 2, 2]);
  const roots = strikePattern({ notes: ['C4', 'E4', 'G4'], beats: 2, level: 'roots' });
  assert.deepEqual(roots.hits.map(h => h.notes[0]), ['C4']);
});

test('a chorus starts the bar with two notes together, then arpeggio', () => {
  const { hits } = strikePattern({ notes: ['C4', 'E4', 'G4'], level: 'arpeggio', section: 'Chorus' });
  assert.deepEqual(hits.filter(h => h.beat === 0).map(h => h.notes[0]).sort(), ['C4', 'G4']);
  assert.deepEqual(hits.filter(h => h.beat > 0).map(h => h.notes[0]), ['E4', 'G4', 'E4']);
});

test('strike numbers for the pan: strike order with hands, shared numbers for pairs', () => {
  const arp = strikePattern({ notes: ['C4', 'F4', 'A4'], level: 'arpeggio' });
  assert.deepEqual(strikeNumbers(arp.hits), [
    { note: 'C4', marks: [{ n: 1, hand: 'R' }] },
    { note: 'F4', marks: [{ n: 2, hand: 'L' }, { n: 4, hand: 'L' }] },
    { note: 'A4', marks: [{ n: 3, hand: 'R' }] },
  ]);
  const groove = strikePattern({ notes: ['C4', 'F4', 'A4'], root: 'F4', level: 'groove' });
  const nums = Object.fromEntries(strikeNumbers(groove.hits).map(x => [x.note, x.marks.map(m => m.n + m.hand).join(' ')]));
  assert.deepEqual(nums, { F4: '1R 3R', C4: '2L 4L', A4: '2R 4R' });
  // Only the first bar is numbered.
  const two = strikePattern({ notes: ['C4'], beats: 8, level: 'roots' });
  assert.deepEqual(strikeNumbers(two.hits), [{ note: 'C4', marks: [{ n: 1, hand: 'R' }] }]);
});

test('stacked voicing returns null when the chord is not on the instrument', () => {
  assert.equal(stackVoicing(11, [0, 4, 7], getAllNotes(dKurd)), null); // B major
  assert.deepEqual(stackVoicing(9, [0, 7], getAllNotes(dKurd)), ['A3', 'E4']);
});
