// Traditional fingering charts: bought ocarinas and flutes whose fingerings
// are fixed by the instrument type. See docs/ocarina-mode.md, "Ocarinas and
// flutes", and CLAUDE.md: every chart comes from a published source, noted
// with its URL; nothing is filled in from memory.
//
// A chart is written once, relative to its lowest note, and serves every key
// of that type: concert pitch = the key's lowest note + offset.
//
//   {
//     id, family: 'ocarina' | 'flute' | 'recorder', name, source: [urls], notes: '…',
//     sourceName: 'High Spirits Flutes booklet',   // shown to users as plain text ("Chart: …")
//     holes: [{ id, finger, side: 'top' | 'bottom', sub? }],   // flutes: mouthpiece first
//     keys: [{ id, name, lowest: 'D4', instName?, slug? }],     // lowest sounding note per key; a size's own
//                                                               // instrument name and link slug (recorders)
//     fingerings: [{ offset, states: ['c'|'o'|'h', …], alt?: true, overblow?: true }],
//     octaves?: [3, 4, 5],   // any-key charts: keys are every root × these octaves
//     defaultKey?, shortName?,  // and the key picked first, and the name before " in G"
//     writtenKey?, tonicOffset?, lowestOctaves?,  // transposing charts (below)
//   }
//
// A transposing chart is published for one key (writtenKey) and serves every
// key by shifting it: the key is named by its tonic, tonicOffset semitones
// above the lowest note, and its id is `${tonic}-${lowest}` (e.g. 'G-E4').
//
// Charts with readings taken from images (High Spirits, STL) were read at
// high resolution; their `notes` say so where something looked doubtful.
//
// Pure data and functions; unit tested in Node.

import { noteToMidi } from './data.js';

// Row strings list one symbol per hole in the chart's `holes` order:
// X covered, O open, H half-covered (½ in the sources).
function rows(list) {
  return list.map(([offset, row, extra = {}]) => ({
    offset,
    states: [...row.replace(/[\s|]/g, '')].map(ch => (ch === 'X' ? 'c' : ch === 'O' ? 'o' : 'h')),
    ...extra,
  }));
}

// Flutes list holes from the mouthpiece down; ocarinas by finger.
const WHISTLE_HOLES = ['L1', 'L2', 'L3', 'R1', 'R2', 'R3'].map(f => ({ id: f, finger: f, side: 'top' }));
// High Spirits doesn't name fingers; these are the usual upper/lower-hand ones.
const NAF6_HOLES = ['L1', 'L2', 'L3', 'R1', 'R2', 'R3'].map(f => ({ id: f, finger: f, side: 'top' }));
const NAF5_HOLES = ['L1', 'L2', 'R1', 'R2', 'R3'].map(f => ({ id: f, finger: f, side: 'top' }));

// Recorder: the thumb hole underneath, then seven finger holes. The two
// lowest (right ring and little finger) are double holes on most recorders:
// 'h' there means one of the pair open (half the hole on a single-hole model).
const RECORDER_HOLES = [
  { id: 'LT', finger: 'LT', side: 'bottom' },
  ...['L1', 'L2', 'L3', 'R1', 'R2', 'R3', 'R4'].map(f => ({ id: f, finger: f, side: 'top' })),
];
const RECORDER_SOURCES = {
  wfg: ['https://www.wfg.woodwind.org/recorder/rec_bas_1.html', 'https://www.wfg.woodwind.org/recorder/rec_bas_2.html', 'https://www.wfg.woodwind.org/recorder/rec_bas_3.html', 'https://www.wfg.woodwind.org/recorder/rec_fing.html'],
  yamahaBaroque: 'https://www.yamaha.com/en/musical_instrument_guide/common/images/recorder/fingering_baroque.pdf',
  yamahaGerman: 'https://www.yamaha.com/en/musical_instrument_guide/common/images/recorder/fingering_german.pdf',
  yamahaAlto: 'https://www.yamaha.com/en/musical_instrument_guide/common/images/recorder/fingering_alto.pdf',
  yamahaSizes: 'https://www.yamaha.com/en/musical_instrument_guide/recorder/structure/structure004.html',
  yamahaStyles: 'https://www.yamaha.com/en/musical_instrument_guide/recorder/selection/selection002.html',
  mollenhauerBaroque: 'https://www.mollenhauer.com/files/73/Soprano-baroque/72/Swing--Prima.pdf',
  mollenhauerGerman: 'https://www.mollenhauer.com/files/76/Soprano-German/82/Swing--Prima.pdf',
};
// A recorder size: its key id, names and lowest sounding note.
const recorderSize = (id, name, lowest, system) => ({
  id, lowest, name: `${name} (lowest note ${lowest})`,
  instName: `${name.replace(/ \(.*\)$/, '')} recorder, ${system} fingering`, slug: `${id}-${system.toLowerCase()}`,
});

// Octave choice where the source doesn't say which octave the flute sounds in.
const octaves = (note, name) => [
  { id: `${note}4`, name: `${name}, lowest note ${name}4` },
  { id: `${note}3`, name: `${name}, lowest note ${name}3 (low flute)` },
  { id: `${note}5`, name: `${name}, lowest note ${name}5 (high flute)` },
].map(k => ({ ...k, lowest: k.id }));

// Every root in every octave a chart lists (charts whose fingerings are the
// same in any key). Key ids are the lowest note with sharps, e.g. 'F#3'.
export const CHART_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const anyKey = (octs = [3, 4, 5]) => octs.flatMap(o => CHART_ROOTS.map(r => ({
  id: `${r}${o}`, name: `${r}, lowest note ${r}${o}`, lowest: `${r}${o}`, root: r, octave: o,
})));

// Every lowest note in these octaves, named by the tonic tonicOffset
// semitones above it: tonicKeys(3, [4]) has { id: 'G-E4', name: 'G (lowest E4)' }.
const tonicKeys = (tonicOffset, octs) => octs.flatMap(o => CHART_ROOTS.map((r, pc) => {
  const tonic = CHART_ROOTS[(pc + tonicOffset) % 12];
  return { id: `${tonic}-${r}${o}`, name: `${tonic} (lowest ${r}${o})`, lowest: `${r}${o}`, root: tonic, octave: o };
}));

export const TRADITIONAL_CHARTS = [
  {
    // Recorder, baroque (English) fingering. Holes: thumb | left index,
    // middle, ring | right index, middle, ring, little.
    id: 'recorder-baroque',
    family: 'recorder',
    name: 'Recorder, baroque (English) fingering',
    shortName: 'Recorder, baroque',
    sourceName: 'Woodwind Fingering Guide and Yamaha',
    source: [...RECORDER_SOURCES.wfg, RECORDER_SOURCES.yamahaBaroque, RECORDER_SOURCES.yamahaAlto, RECORDER_SOURCES.mollenhauerBaroque, RECORDER_SOURCES.yamahaSizes],
    notes: 'Woodwind Fingering Guide, Basic Fingering Chart for Recorder (the rows marked "Basic" and "Basic for English models"), read from the pages\' text and checked note by note against Yamaha\'s soprano baroque chart, Yamaha\'s alto chart and Mollenhauer\'s soprano baroque chart: all four agree on every note but one. That one is the second-highest note (C#7 on a soprano): WFG and Mollenhauer give a fingering that needs the bell closed against the knee, which a diagram of holes can\'t show, so Yamaha\'s fingering without the bell is used (WFG lists it as an alternate). Two octaves and a tone, fully chromatic. H on the thumb is the pinched (half-open) thumb hole of the upper register; H on the right ring or little finger is one of the double holes open (half the hole on a single-hole recorder). The two alternates (B and C# in the low register, "use in combination with C/F" in WFG, "alternate fingering" on Yamaha\'s chart) are kept as alternates. Notes above the top D are not included: WFG lists them only as alternates that depend on the instrument. Sizes: WFG says "the fingerings apply to all sizes"; Yamaha\'s alto chart is the soprano chart hole for hole. Lowest sounding notes (soprano C5, alto F4, tenor C4, sopranino F5) from Yamaha\'s "Varieties of recorder" range figure and Mollenhauer\'s "Soprano recorder in c\'\'"; soprano music is written an octave lower than it sounds.',
    holes: RECORDER_HOLES,
    keys: [
      recorderSize('soprano', 'Soprano (descant)', 'C5', 'baroque'),
      recorderSize('alto', 'Alto (treble)', 'F4', 'baroque'),
      recorderSize('tenor', 'Tenor', 'C4', 'baroque'),
      recorderSize('sopranino', 'Sopranino', 'F5', 'baroque'),
    ],
    defaultKey: 'soprano',
    fingerings: rows([
      [0, 'X|XXX|XXXX'], [1, 'X|XXX|XXXH'], [2, 'X|XXX|XXXO'], [3, 'X|XXX|XXHO'], [4, 'X|XXX|XXOO'],
      [5, 'X|XXX|XOXX'], [6, 'X|XXX|OXXO'], [7, 'X|XXX|OOOO'], [8, 'X|XXO|XXHO'], [9, 'X|XXO|OOOO'],
      [10, 'X|XOX|XOOO'], [11, 'X|XOO|OOOO'], [11, 'X|OXX|OOOO', { alt: true }], [12, 'X|OXO|OOOO'],
      [13, 'O|XXO|OOOO'], [13, 'X|OOO|OOOO', { alt: true }], [14, 'O|OXO|OOOO'], [15, 'O|OXX|XXXO'],
      [16, 'H|XXX|XXOO'], [17, 'H|XXX|XOXO'], [18, 'H|XXX|OXOO'], [19, 'H|XXX|OOOO'], [20, 'H|XXO|XOOO'],
      [21, 'H|XXO|OOOO'], [22, 'H|XXO|XXXO'], [23, 'H|XXO|XXOO'], [24, 'H|XOO|XXOO'], [25, 'H|XOX|XXOX'],
      [26, 'H|XOX|XOXO'],
    ]),
  },
  {
    // Recorder, German fingering: an easier F, at the cost of other notes.
    // Many school sopranos are German; the hole under the right index
    // finger is smaller than the one under the right middle finger.
    id: 'recorder-german',
    family: 'recorder',
    name: 'Recorder, German fingering',
    shortName: 'Recorder, German',
    sourceName: 'Yamaha and Mollenhauer',
    source: [RECORDER_SOURCES.yamahaGerman, RECORDER_SOURCES.mollenhauerGerman, ...RECORDER_SOURCES.wfg, RECORDER_SOURCES.yamahaStyles],
    notes: 'Yamaha\'s soprano recorder fingering chart, German, read from the chart\'s drawings (twice: by eye and by measuring each hole\'s fill) and checked against Mollenhauer\'s soprano German chart (Swing / Prima): they agree on every main fingering except the second-highest note (C#7), where Mollenhauer closes the bell and Yamaha\'s fingering without it is used. The Woodwind Fingering Guide marks the German F and F# in both octaves the same way ("Basic for German models"); for G# in both octaves it differs from the two makers, and the makers are followed. Alternates as printed on Yamaha\'s chart (B, C# and the upper F#). Soprano only. TODO: German fingering for alto, tenor and sopranino. No German chart for those sizes has been read yet (Mollenhauer publishes alto German charts: https://www.mollenhauer.com/en/service/fingering-charts); Yamaha notes that sizes other than the soprano are mostly made with baroque fingering. Until one is read, a German alto is set up note by note with the tuner.',
    holes: RECORDER_HOLES,
    keys: [recorderSize('soprano', 'Soprano (descant)', 'C5', 'German')],
    defaultKey: 'soprano',
    fingerings: rows([
      [0, 'X|XXX|XXXX'], [1, 'X|XXX|XXXH'], [2, 'X|XXX|XXXO'], [3, 'X|XXX|XXHO'], [4, 'X|XXX|XXOO'],
      [5, 'X|XXX|XOOO'], [6, 'X|XXX|OXXX'], [7, 'X|XXX|OOOO'], [8, 'X|XXO|XXHO'], [9, 'X|XXO|OOOO'],
      [10, 'X|XOX|XOOO'], [11, 'X|XOO|OOOO'], [11, 'X|OXX|OOOO', { alt: true }], [12, 'X|OXO|OOOO'],
      [13, 'O|XXO|OOOO'], [13, 'X|OOO|OOOO', { alt: true }], [14, 'O|OXO|OOOO'], [15, 'O|OXX|XXXO'],
      [16, 'H|XXX|XXOO'], [17, 'H|XXX|XOOO'], [18, 'H|XXX|OXOX'], [18, 'H|XXX|OXHO', { alt: true }],
      [19, 'H|XXX|OOOO'], [20, 'H|XXX|OXXX'], [21, 'H|XXO|OOOO'], [22, 'H|XXO|XXXO'], [23, 'H|XXO|XXOO'],
      [24, 'H|XOO|XXOO'], [25, 'H|XOX|XOXX'], [26, 'H|XOX|XOXO'],
    ]),
  },
  {
    id: 'tin-whistle-d',
    family: 'flute',
    name: 'Tin whistle in D',
    sourceName: 'Woodwind Fingering Guide',
    source: [
      'https://www.wfg.woodwind.org/tinwhistle/tw_bas_1.html',
      'https://www.wfg.woodwind.org/tinwhistle/tw_bas_2.html',
      'https://www.wfg.woodwind.org/tinwhistle/tw_bas_3.html',
    ],
    notes: 'Woodwind Fingering Guide basic chart (tin whistle chart credited to Eoin McAuley). Holes top to bottom: left index, middle, ring, right index, middle, ring. The second octave uses the same fingerings blown harder.',
    holes: WHISTLE_HOLES,
    keys: [{ id: 'D', name: 'D (lowest note D4)', lowest: 'D4' }],
    fingerings: rows([
      [0, 'XXX|XXX'], [1, 'XXX|XXH'], [2, 'XXX|XXO'], [3, 'XXX|XHO'], [4, 'XXX|XOO'],
      [5, 'XXX|OOO'], [6, 'XXH|OOO'], [7, 'XXO|OOO'], [8, 'XHO|OOO'], [9, 'XOO|OOO'],
      [10, 'HOO|OOO'], [10, 'OXX|OOO', { alt: true }], [11, 'OOO|OOO'], [11, 'OOO|OOX', { alt: true }],
      [12, 'OXX|XXX', { overblow: true }], [13, 'XXX|XXH', { overblow: true }], [14, 'XXX|XXO', { overblow: true }],
      [15, 'XXX|XHO', { overblow: true }], [16, 'XXX|XOO', { overblow: true }], [17, 'XXX|OOO', { overblow: true }],
      [18, 'XXH|OOO', { overblow: true }], [19, 'XXO|OOO', { overblow: true }], [20, 'XHO|OOO', { overblow: true }],
      [21, 'XOO|OOO', { overblow: true }], [22, 'HOO|OOO', { overblow: true }], [23, 'OOO|OOO', { overblow: true }],
      [23, 'OOO|OOX', { alt: true, overblow: true }], [24, 'OXX|XXX', { overblow: true }],
    ]),
  },
  {
    id: 'naf6-penta',
    family: 'flute',
    name: 'Native American flute, 6 holes, pentatonic minor (any key)',
    shortName: 'Native American flute, 6 holes',
    sourceName: 'High Spirits Flutes booklet',
    source: ['https://cdn.shopify.com/s/files/1/0775/6597/files/HowToPlayDOWNLOAD.pdf'],
    notes: 'High Spirits Flutes "How to Play" booklet, basic pentatonic minor scale (pp.14–15): the same fingerings by scale degree in every key (the booklet names them for A: A C D E G A, and F#: F# A B C# E F#). Six-hole rule from the booklet: the third hole from the mouthpiece stays closed for this scale. Holes from the mouthpiece down. Pick the key and octave your flute plays and check with the tuner.',
    holes: NAF6_HOLES,
    keys: anyKey(),
    octaves: [3, 4, 5],
    defaultKey: 'A4',
    fingerings: rows([
      [0, 'XXXXXX'], [3, 'XXXXXO'], [5, 'XXXXOO'], [7, 'XXXOOO'], [10, 'XOXOOO'], [12, 'OOXOOO'],
    ]),
  },
  {
    id: 'naf5-penta',
    family: 'flute',
    name: 'Native American flute, 5 holes, pentatonic minor (any key)',
    shortName: 'Native American flute, 5 holes',
    sourceName: 'High Spirits Flutes booklet',
    source: ['https://cdn.shopify.com/s/files/1/0775/6597/files/HowToPlayDOWNLOAD.pdf'],
    notes: 'High Spirits Flutes "How to Play" booklet, basic pentatonic minor scale (pp.14–15), 5-hole fingerings: the same by scale degree in every key. Holes from the mouthpiece down. Pick the key and octave your flute plays and check with the tuner.',
    holes: NAF5_HOLES,
    keys: anyKey(),
    octaves: [3, 4, 5],
    defaultKey: 'A4',
    fingerings: rows([
      [0, 'XXXXX'], [3, 'XXXXO'], [5, 'XXXOO'], [7, 'XXOOO'], [10, 'XOOOO'], [12, 'OOOOO'],
    ]),
  },
  {
    id: 'naf6-a',
    family: 'flute',
    name: 'Native American flute, 6 holes, key of A',
    sourceName: 'High Spirits Flutes booklet',
    source: ['https://cdn.shopify.com/s/files/1/0775/6597/files/HowToPlayDOWNLOAD.pdf'],
    notes: 'High Spirits Flutes "How to Play" booklet, chromatic chart for A (p.16). Holes from the mouthpiece down. The booklet does not say which octave; pick the one your flute plays and check with the tuner.',
    holes: NAF6_HOLES,
    keys: octaves('A', 'A'),
    fingerings: rows([
      [0, 'XXXXXX'], [2, 'XXXXXH'], [3, 'XXXXXO'], [4, 'XXXXOX'], [5, 'XXXXOO'], [6, 'XXXOXO'],
      [7, 'XXXOOO'], [8, 'XXOXOO'], [9, 'XXOOOO'], [10, 'XOXOOO'], [11, 'XOOOOO'], [12, 'OOXOOO'],
      [13, 'OOOOOO'], [14, 'OXXXOX'], [15, 'OOXXXO'],
    ]),
  },
  {
    id: 'naf5-a',
    family: 'flute',
    name: 'Native American flute, 5 holes, key of A',
    sourceName: 'High Spirits Flutes booklet',
    source: ['https://cdn.shopify.com/s/files/1/0775/6597/files/HowToPlayDOWNLOAD.pdf'],
    notes: 'High Spirits Flutes "How to Play" booklet, chromatic chart for A (p.16), 5-hole column. Holes from the mouthpiece down. Octave not stated; check with the tuner.',
    holes: NAF5_HOLES,
    keys: octaves('A', 'A'),
    fingerings: rows([
      [0, 'XXXXX'], [2, 'XXXXH'], [3, 'XXXXO'], [4, 'XXXOX'], [5, 'XXXOO'], [6, 'XXOXO'],
      [7, 'XXOOO'], [8, 'OXXOO'], [9, 'XOXOO'], [10, 'XOOOO'], [11, 'OOXOO'], [12, 'OOOOO'],
      [13, 'OXXXX'], [14, 'OOXXX'], [15, 'OOXXO'],
    ]),
  },
  {
    id: 'naf6-fs',
    family: 'flute',
    name: 'Native American flute, 6 holes, key of F#',
    sourceName: 'High Spirits Flutes booklet',
    source: ['https://cdn.shopify.com/s/files/1/0775/6597/files/HowToPlayDOWNLOAD.pdf'],
    notes: 'High Spirits Flutes "How to Play" booklet, chromatic chart for F# (p.22). The booklet draws the high G# the same as the high A, which looks like a misprint, so that G# is left out. Octave not stated; check with the tuner.',
    holes: NAF6_HOLES,
    keys: octaves('F#', 'F#'),
    fingerings: rows([
      [0, 'XXXXXX'], [2, 'XXXXXH'], [3, 'XXXXXO'], [4, 'XXXXOX'], [5, 'XXXXOO'], [6, 'XXXOXO'],
      [7, 'XXXOOO'], [8, 'XXOXOO'], [9, 'XXOOOO'], [10, 'XOXOOO'], [11, 'XOOOOO'], [12, 'OOXOOO'],
      [13, 'OOOOOO'], [15, 'OOXXXO'],
    ]),
  },
  {
    id: 'naf5-fs',
    family: 'flute',
    name: 'Native American flute, 5 holes, key of F#',
    sourceName: 'High Spirits Flutes booklet',
    source: ['https://cdn.shopify.com/s/files/1/0775/6597/files/HowToPlayDOWNLOAD.pdf'],
    notes: 'High Spirits Flutes "How to Play" booklet, chromatic chart for F# (p.22), 5-hole column. Octave not stated; check with the tuner.',
    holes: NAF5_HOLES,
    keys: octaves('F#', 'F#'),
    fingerings: rows([
      [0, 'XXXXX'], [2, 'XXXXH'], [3, 'XXXXO'], [4, 'XXXOX'], [5, 'XXXOO'], [6, 'XXOXO'],
      [7, 'XXOOO'], [8, 'XOXXO'], [9, 'XOXOO'], [10, 'XOOOO'], [11, 'OOXOO'], [12, 'OOOOO'],
      [13, 'OXXXX'], [14, 'OXXOX'], [15, 'OXXXO'],
    ]),
  },
  {
    id: 'ocarina-12-stl-c',
    family: 'ocarina',
    name: '12-hole ocarina in C (STL chart, Asian top notes)',
    sourceName: 'STL Ocarina',
    source: [
      'https://cdn.shopify.com/s/files/1/0103/7756/0119/files/12tenorC.pdf',
      'https://cdn.shopify.com/s/files/1/0103/7756/0119/files/12_Hole_Ocarina_Instructions.pdf',
      'https://pureocarinas.com/ocarina-fingering-system',
    ],
    notes: 'STL Ocarina "A Complete Fingering Chart for 12 Hole Tenor and Soprano Ocarinas", read from the scanned chart; written A3–F5. Sub-holes sit beside the middle-finger holes (STL guide, Pure Ocarinas). Top notes follow the Asian order (left thumb, then right thumb); on an Italian-system ocarina the last two notes swap which hole is lifted last. Thumb holes identified by position. Tenor sounds an octave above the written notes. The published chart is for C (lowest note A, the tonic C three semitones above it). Other keys use the same fingering chart shifted: 12-hole ocarinas in G, F etc. are made as transposing instruments of the C chart, so every other key here is "Same fingerings as the C chart, shifted to this key." Keys are named by their tonic (lowest E: key G; lowest D: key F); the ids C-A3 and C-A4 of the first version stay the same.',
    writtenKey: 'C',
    tonicOffset: 3,
    lowestOctaves: [3, 4, 5],
    defaultKey: 'C-A4',
    holes: [
      { id: 'L1', finger: 'L1', side: 'top' }, { id: 'L2', finger: 'L2', side: 'top' },
      { id: 'L3', finger: 'L3', side: 'top' }, { id: 'L4', finger: 'L4', side: 'top' },
      { id: 'L2s', finger: 'L2', side: 'top', sub: true },
      { id: 'R1', finger: 'R1', side: 'top' }, { id: 'R2', finger: 'R2', side: 'top' },
      { id: 'R3', finger: 'R3', side: 'top' }, { id: 'R4', finger: 'R4', side: 'top' },
      { id: 'R2s', finger: 'R2', side: 'top', sub: true },
      { id: 'LT', finger: 'LT', side: 'bottom' }, { id: 'RT', finger: 'RT', side: 'bottom' },
    ],
    keys: tonicKeys(3, [3, 4, 5]),
    fingerings: rows([
      [0, 'XXXXX|XXXXX|XX'], [1, 'XXXXX|XXXXO|XX'], [2, 'XXXXO|XXXXX|XX'], [3, 'XXXXO|XXXXO|XX'],
      [4, 'XXXXO|XXXOX|XX'], [5, 'XXXXO|XXXOO|XX'], [6, 'XXXXO|XXOOX|XX'], [7, 'XXXXO|XXOOO|XX'],
      [8, 'XXXXO|XOOOO|XX'], [9, 'XXXXO|OOXOO|XX'], [10, 'XXXXO|OOOOO|XX'], [11, 'XXOXO|OOXOO|XX'],
      [12, 'XXOXO|OOOOO|XX'], [13, 'XOOXO|OOXOO|XX'], [14, 'XOOXO|OOOOO|XX'], [15, 'OOOXO|OOOOO|XX'],
      [16, 'OOOXO|OOXOO|OX'], [17, 'OOOXO|OOOOO|OX'], [18, 'OOOXO|OOXOO|OO'], [19, 'OOOXO|OOOOO|OO'],
      [20, 'OOOOO|OOOOO|OO'],
    ]),
  },
  {
    // 6-hole pendant ocarina, English system: four finger holes on top in a
    // 2 × 2 grid and two thumb holes underneath.
    id: 'ocarina-6-stl-c',
    family: 'ocarina',
    name: '6-hole pendant ocarina in C',
    sourceName: 'STL Ocarina',
    source: [
      'https://cdn.shopify.com/s/files/1/0103/7756/0119/files/6_Hole_C_Major_Chart.pdf',
      'https://cdn.shopify.com/s/files/1/0103/7756/0119/files/6HoleFinalPDF.pdf',
      'https://www.stlocarina.com/pages/booklets',
    ],
    notes: 'STL Ocarina "A Complete Fingering Chart for 6 Hole Ocarina in C Major" (© 2020), read from the chart at high resolution and checked note by note: 17 notes, C to E an octave and a third up, fully chromatic; the only half-holes are C# (right middle half) and D# (right index half); no alternates. Which finger covers which hole is from STL\'s booklet "The Art of Ocarina – A Guide for Your New 4 or 6-Hole Ocarina", page 2: middle fingers on the upper pair, index fingers on the lower pair, thumbs on the two holes under the body. Hole sizes are relative, as drawn on the chart (upper pair and thumb holes small, lower pair large; not to scale). The chart is written in C and "the actual pitch will be higher than written": STL\'s 6-hole soprano in C sounds C6 to E7. Other keys use the same fingerings shifted, as STL publishes the same chart in E, F, G, B-flat and B. Positions (px, py) place the holes as on the chart\'s drawing.',
    writtenKey: 'C',
    tonicOffset: 0,
    lowestOctaves: [4, 5, 6],
    defaultKey: 'C-C6',
    holes: [
      { id: 'L2', finger: 'L2', side: 'top', rel: 0.6, px: 122, py: 62 },
      { id: 'R2', finger: 'R2', side: 'top', rel: 0.6, px: 178, py: 62 },
      { id: 'L1', finger: 'L1', side: 'top', rel: 1, px: 116, py: 112 },
      { id: 'R1', finger: 'R1', side: 'top', rel: 1, px: 184, py: 112 },
      { id: 'LT', finger: 'LT', side: 'bottom', rel: 0.6 },
      { id: 'RT', finger: 'RT', side: 'bottom', rel: 0.6 },
    ],
    keys: tonicKeys(0, [4, 5, 6]),
    // Holes in the order above: left middle, right middle, left index, right index | left thumb, right thumb.
    fingerings: rows([
      [0, 'XXXX|XX'], [1, 'XHXX|XX'], [2, 'XOXX|XX'], [3, 'XOXH|XX'], [4, 'XXXO|XX'], [5, 'XOXO|XX'],
      [6, 'OXXX|XX'], [7, 'OOXX|XX'], [8, 'OXXO|XX'], [9, 'OOXO|XX'], [10, 'OOOX|XX'], [11, 'OXOO|XX'],
      [12, 'OOOO|XX'], [13, 'OXOO|OX'], [14, 'OOOO|OX'], [15, 'OXOO|OO'], [16, 'OOOO|OO'],
    ]),
  },
];

export function getChart(id) {
  return TRADITIONAL_CHARTS.find(c => c.id === id) ?? null;
}

export function chartsForFamily(family) {
  return TRADITIONAL_CHARTS.filter(c => c.family === family);
}

// The key a chart starts on in the wizard.
export function chartDefaultKey(chart) {
  return chart.keys.find(k => k.id === chart.defaultKey)?.id ?? chart.keys[0].id;
}

// Key of an any-key chart from a root ('G', 'Gb' or 'F#' spelling) and an
// octave; null if the chart has no such key.
export function chartKeyFor(chart, root, octave) {
  const pc = CHART_ROOTS.indexOf(root) >= 0 ? CHART_ROOTS.indexOf(root)
    : ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'].indexOf(root);
  if (pc < 0) return null;
  return chart.keys.find(k => k.id === `${CHART_ROOTS[pc]}${octave}`) ?? null;
}

// An instrument of a traditional type in a key. Each note keeps its main
// fingering (the first listed for its offset); alternates are kept in
// `alternates` for display.
export function instrumentFromChart(chartId, keyId, { name, now = new Date().toISOString() } = {}) {
  const chart = getChart(chartId);
  if (!chart) throw new RangeError(`Unknown chart: ${chartId}`);
  const key = chart.keys.find(k => k.id === keyId) ?? chart.keys[0];
  const base = noteToMidi(key.lowest);
  const fingerings = {};
  const alternates = {};
  const overblow = [];
  for (const f of chart.fingerings) {
    const midi = base + f.offset;
    if (!fingerings[midi] && !f.alt) {
      fingerings[midi] = f.states;
      if (f.overblow) overblow.push(midi);
    } else (alternates[midi] ??= []).push(f.states);
  }
  const notes = Object.keys(fingerings).map(Number).sort((a, b) => a - b);
  return {
    id: (chart.family === 'flute' ? 'fl-' : chart.family === 'recorder' ? 'rc-' : 'oc-') + Math.random().toString(36).slice(2, 10),
    family: chart.family,
    kind: 'traditional',
    type: chart.id,
    key: key.id,
    name: name || key.instName || (chart.tonicOffset != null ? `${chart.name.replace(` in ${chart.writtenKey}`, ` in ${key.root}`)} (${key.lowest})`
      : chart.octaves ? `${chart.shortName ?? chart.name} in ${key.root} (${key.lowest})`
      : chart.keys.length > 1 ? `${chart.name} (${key.lowest})` : chart.name),
    chambers: [{ notes, holes: chart.holes.map(h => ({ ...h, x: null, y: null, sizeMm: null })), fingerings, alternates, overblow }],
    createdAt: now,
    updatedAt: now,
    lastPlayedAt: now,
  };
}

// The key and octave of an any-key chart from the pitch heard with every
// hole closed: the nearest note's pitch class and octave. An octave outside
// the chart's octaves is moved to the nearest one (outOfRange: true).
// cents: how far the reading is from that note (positive = sharp).
export function detectChartKey(hz, { octaves: octs = [3, 4, 5], a4 = 440 } = {}) {
  if (!(hz > 0)) return null;
  const exact = 69 + 12 * Math.log2(hz / a4);
  const midi = Math.round(exact);
  const heardOctave = Math.floor(midi / 12) - 1;
  const octave = octs.reduce((best, o) => (Math.abs(o - heardOctave) < Math.abs(best - heardOctave) ? o : best), octs[0]);
  return {
    midi,
    root: CHART_ROOTS[((midi % 12) + 12) % 12],
    heardOctave,
    octave,
    cents: Math.round((exact - midi) * 100),
    outOfRange: octave !== heardOctave,
  };
}

// The key of a chart whose lowest note is the one heard (every hole closed,
// sub-holes too): the nearest note, moved to the nearest octave the chart
// offers when it is outside them (outOfRange). Works for any-key charts
// (key = lowest note) and transposing ones (key named by its tonic).
// Returns detectChartKey's fields plus { key, lowest } or null.
export function detectLowestKey(chart, hz, { a4 = 440 } = {}) {
  const octs = chart?.lowestOctaves ?? chart?.octaves;
  if (!octs) return null;
  const r = detectChartKey(hz, { octaves: octs, a4 });
  if (!r) return null;
  const lowest = `${r.root}${r.octave}`;
  const key = chart.keys.find(k => k.lowest === lowest) ?? null;
  return key ? { ...r, lowest, key } : null;
}
