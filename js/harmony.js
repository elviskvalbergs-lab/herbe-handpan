// "Goes well with": which chords go together, from the basics of harmony
// (the same in every key, so no data source is needed). An instrument's key is
// its home note (a handpan's ding, an ocarina's or whistle's key note) and
// major or minor from its third. In a key each chord has a role: home (I,
// vi, iii), moving away (IV, ii), pulling back home (V, vii°); the chords
// that usually come next and the well-known progressions follow from those
// roles. Only chords the instrument can play are suggested.
//
// Pure, unit-tested (tests/harmony.test.mjs). The screens are in js/app.js
// (goesWithHtml, the Goes well with sheet).
import { notePC } from './data.js';

const MAJOR_DEGREES = [
  ['I', 0, 'maj'], ['ii', 2, 'min'], ['iii', 4, 'min'], ['IV', 5, 'maj'], ['V', 7, 'maj'], ['vi', 9, 'min'], ['vii°', 11, 'dim'],
];
// Natural minor, plus the major V (harmonic minor) and major IV (Dorian),
// both common in minor-key songs.
const MINOR_DEGREES = [
  ['i', 0, 'min'], ['ii°', 2, 'dim'], ['III', 3, 'maj'], ['iv', 5, 'min'], ['IV', 5, 'maj'], ['v', 7, 'min'], ['V', 7, 'maj'], ['VI', 8, 'maj'], ['VII', 10, 'maj'],
];

// The chords that usually come next, most usual first.
const HARMONY_NEXT = {
  major: { I: ['IV', 'V', 'vi', 'ii'], ii: ['V', 'IV', 'vii°'], iii: ['vi', 'IV'], IV: ['V', 'I', 'ii'], V: ['I', 'vi', 'IV'], vi: ['IV', 'ii', 'V'], 'vii°': ['I', 'iii'] },
  minor: { i: ['iv', 'VI', 'VII', 'v'], 'ii°': ['V', 'v', 'i'], III: ['VI', 'VII', 'iv'], iv: ['v', 'VII', 'i', 'V'], IV: ['i', 'VII'], v: ['i', 'VI'], V: ['i', 'VI'], VI: ['VII', 'III', 'iv'], VII: ['i', 'III', 'VI'] },
};

// Well-known progressions, by role.
export const HARMONY_PROGRESSIONS = {
  major: [
    { name: 'Pop', degrees: ['I', 'V', 'vi', 'IV'] },
    { name: 'Fifties', degrees: ['I', 'vi', 'IV', 'V'] },
    { name: 'Three chords', degrees: ['I', 'IV', 'V', 'I'] },
    { name: 'Sad pop', degrees: ['vi', 'IV', 'I', 'V'] },
    { name: 'Round the circle', degrees: ['vi', 'ii', 'V', 'I'] },
    { name: 'Jazz turnaround', degrees: ['ii', 'V', 'I'] },
    { name: 'Rising', degrees: ['IV', 'V', 'iii', 'vi'] },
  ],
  minor: [
    { name: 'Epic', degrees: ['i', 'VI', 'III', 'VII'] },
    { name: 'Minor pop', degrees: ['i', 'VI', 'VII', 'i'] },
    { name: 'Folk', degrees: ['i', 'iv', 'v', 'i'] },
    { name: 'Rocking', degrees: ['i', 'VII', 'VI', 'VII'] },
    { name: 'Andalusian', degrees: ['i', 'VII', 'VI', 'V'] },
    { name: 'Minor circle', degrees: ['i', 'iv', 'VII', 'III'] },
    { name: 'Dorian', degrees: ['i', 'IV', 'i', 'IV'] },
  ],
};

/** The key of an instrument: its home note and major or minor (from the third above it). */
export function instrumentKey(pcs, tonic) {
  const minor = pcs.has((tonic + 3) % 12) && !pcs.has((tonic + 4) % 12);
  return { tonic, mode: minor ? 'minor' : 'major' };
}

/** A chord's quality from its type: 'maj', 'min', 'dim' or null (a 7th counts as its triad). */
export function chordQuality(type) {
  const iv = new Set(type.intervals.map(i => ((i % 12) + 12) % 12));
  if (iv.has(4) && iv.has(7)) return 'maj';
  if (iv.has(3) && iv.has(7)) return 'min';
  if (iv.has(3) && iv.has(6)) return 'dim';
  return null;
}

function degreesOf(key) { return key.mode === 'minor' ? MINOR_DEGREES : MAJOR_DEGREES; }

/** A chord's role in the key ('I', 'vi', 'VII'…), or null when it isn't one of the key's. */
export function chordDegree(key, chord) {
  const q = chordQuality(chord.type);
  const step = (notePC(chord.rootNote) - key.tonic + 12) % 12;
  return degreesOf(key).find(([, s, dq]) => s === step && dq === q)?.[0] ?? null;
}

// The instrument's chord for a role: its plain triad (major, minor or
// diminished) on that root, the fullest voicing.
function chordFor(key, degree, chords) {
  const d = degreesOf(key).find(([name]) => name === degree);
  if (!d) return null;
  const [, step, q] = d;
  const root = (key.tonic + step) % 12;
  const typeId = { maj: 'maj', min: 'min', dim: 'dim' }[q];
  return chords.filter(c => c.type.id === typeId && notePC(c.rootNote) === root)
    .sort((a, b) => b.noteCount - a.noteCount)[0] ?? null;
}

/** What goes well with a chord on an instrument: its role, the chords that
 *  usually come next and the well-known progressions it is in, every chord
 *  playable on the instrument. { degree, next: [chord], progressions: [{ name,
 *  degrees, chords, at }] } (at: where the chord is in it), or null when the
 *  chord isn't one of the key's. */
export function goesWellWith(chord, chords, key, { progressions = 3 } = {}) {
  const degree = chordDegree(key, chord);
  if (!degree) return null;
  const next = (HARMONY_NEXT[key.mode][degree] ?? []).map(d => chordFor(key, d, chords)).filter(Boolean)
    .filter((c, i, all) => all.findIndex(x => x.id === c.id) === i && c.id !== chord.id);
  const found = [];
  for (const p of HARMONY_PROGRESSIONS[key.mode]) {
    const at = p.degrees.indexOf(degree);
    if (at < 0) continue;
    const steps = p.degrees.map(d => (d === degree ? chord : chordFor(key, d, chords)));
    if (steps.some(c => !c)) continue;
    found.push({ name: p.name, degrees: p.degrees, chords: steps, at });
  }
  // The ones that start on this chord first.
  found.sort((a, b) => (a.at === 0 ? 0 : 1) - (b.at === 0 ? 0 : 1));
  return { degree, next, progressions: found.slice(0, progressions) };
}
