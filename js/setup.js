// The beginner setup (docs/free-to-play.md §2; the approved mock-up): "What
// do you play?" as plain tiles, then for a handpan "Play my notes" (the app
// listens and works out the scale, js/scalefinder.js) or "I know my scale"
// (the middle note first, then the common scales in that key, the rest
// behind "Show all"), and a ready screen with a first chord to play.
//
// Pure helpers, unit tested in Node. The screens are in js/app.js (viewBeginnerSetup).

import { notePC } from './data.js';

// Scale families from the most to the least often met, for "the common ones
// first". An ordering only: every scale stays one tap away under Show all.
const SETUP_FAMILY_ORDER = [
  'Kurd', 'Celtic Minor', 'Integral', 'Pygmy', 'Hijaz', 'Equinox', 'Amara', 'Aegean', 'La Sirena',
  'Sabye', 'Mystic', 'Akebono', 'Dorian', 'Major', 'Mixolydian', 'Harmonic Minor', 'Phrygian', 'Other',
];

// How many scales "Which D scale?" shows before Show all.
export const SETUP_TOP = 5;

// The middle notes (dings) handpans come in, as pitch classes, D first and
// then by how many scales use them.
export function setupRoots(scales) {
  const count = new Map();
  for (const s of scales) {
    const pc = notePC(s.top.ding);
    count.set(pc, (count.get(pc) ?? 0) + 1);
  }
  return [...count.entries()]
    .sort((a, b) => (a[0] === 2 ? -1 : b[0] === 2 ? 1 : b[1] - a[1] || a[0] - b[0]))
    .map(([pc, n]) => ({ pc, count: n }));
}

function setupFamilyRank(scale) {
  const i = SETUP_FAMILY_ORDER.indexOf(scale.family);
  return i < 0 ? SETUP_FAMILY_ORDER.length : i;
}

// The scales with this middle note, the common ones first (a lower ding
// before a higher one within a family, then fewer notes first).
export function setupScalesFor(scales, pc) {
  return scales
    .map((s, order) => ({ s, order }))
    .filter(({ s }) => notePC(s.top.ding) === pc)
    .sort((a, b) => setupFamilyRank(a.s) - setupFamilyRank(b.s) || a.order - b.order)
    .map(({ s }) => s);
}

// The chord to start with on a tuning: the minor or major chord on its
// middle note when it has one, else the first minor or major chord found.
// Chords are findAllChords' results.
export function setupFirstChord(chords, ding) {
  const triads = chords.filter(c => c.type.id === 'min' || c.type.id === 'maj');
  const dpc = notePC(ding);
  return triads.find(c => notePC(c.rootName + '4') === dpc && c.type.id === 'min')
    ?? triads.find(c => notePC(c.rootName + '4') === dpc)
    ?? triads[0] ?? null;
}

// When listening can stop by itself: enough notes, and the best match has
// all of them and all of its own (the player has played every note).
export function setupHeardEnough(ranked, heardCount) {
  const best = ranked[0];
  return !!best && heardCount >= 5 && best.ding === 'exact' && best.matched.length === best.total && best.missing.length === 0;
}

// The first few to show: one scale per family (D Kurd, not also D Kurd 10
// and 11), the common families first. The rest are behind Show all.
export function setupTopScales(list, n = SETUP_TOP) {
  const seen = new Set();
  const out = [];
  for (const s of list) {
    if (seen.has(s.family)) continue;
    seen.add(s.family);
    out.push(s);
    if (out.length === n) break;
  }
  return out;
}
