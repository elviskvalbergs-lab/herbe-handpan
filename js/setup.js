// The beginner setup (docs/free-to-play.md §2; the approved mock-up): "What
// do you play?" as plain tiles, then for a handpan "Play my notes" (the app
// listens and works out the scale, js/scalefinder.js) or "I know my scale"
// (the middle note first, then the common scales in that key, the rest
// behind "Show all"), and a ready screen with a first chord to play.
//
// Pure helpers, unit tested in Node. The screens are in js/app.js (viewBeginnerSetup).

import { notePC } from './data.js';
import { midiToNoteName } from './instruments.js';
import { chartsForFamily, instrumentFromChart } from './charts.js';
import { linkFor, linkTitle, parseLink } from './links.js';

// Scale families from the most to the least often met, for "the common ones
// first". An ordering only: every scale stays one tap away under Show all.
const SETUP_FAMILY_ORDER = [
  'Kurd', 'Celtic Minor', 'Integral', 'Pygmy', 'Hijaz', 'Equinox', 'Amara', 'Aegean', 'La Sirena',
  'Sabye', 'Mystic', 'Akebono', 'Dorian', 'Major', 'Mixolydian', 'Harmonic Minor', 'Phrygian', 'Other',
];

// How many scales "Which D scale?" shows before Show all.
export const SETUP_TOP = 5;

// The note a tuning is known by: a handpan's middle note, a tongue drum's
// lowest, a kalimba's key (js/kalimbas.js).
export function setupKeyNote(s) { return s.key ? `${s.key}4` : s.top.ding; }

// The notes tunings come in, as pitch classes, D first and then by how many
// tunings use them.
export function setupRoots(scales, { first = 2 } = {}) {
  const count = new Map();
  for (const s of scales) {
    const pc = notePC(setupKeyNote(s));
    count.set(pc, (count.get(pc) ?? 0) + 1);
  }
  return [...count.entries()]
    .sort((a, b) => (a[0] === first ? -1 : b[0] === first ? 1 : b[1] - a[1] || a[0] - b[0]))
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
    .filter(({ s }) => notePC(setupKeyNote(s)) === pc)
    .sort((a, b) => setupFamilyRank(a.s) - setupFamilyRank(b.s) || a.order - b.order)
    .map(({ s }) => s);
}

// The chord to start with on a tuning: the minor or major chord on its
// middle note when it has one, else the first minor or major chord found.
// Chords are findAllChords' results.
// prefer: 'min' for a handpan-like tuning (most are minor), 'maj' for an
// ocarina or flute in a major key.
export function setupFirstChord(chords, ding, { prefer = 'min' } = {}) {
  const triads = chords.filter(c => c.type.id === 'min' || c.type.id === 'maj');
  const dpc = notePC(ding);
  return triads.find(c => notePC(c.rootName + '4') === dpc && c.type.id === prefer)
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

// Ocarinas and flutes in the same setup: every key of every published chart
// of the family as a "tuning" the setup can match and list, its playable
// notes low to high (the lowest, every hole closed, first) and named as its
// link is ("Alto C 12-hole ocarina"). key: the key it is sold in (the tonic
// of a transposing ocarina, a whistle's D). family: its chart, so "the
// common ones first" shows one per chart.
const chartTuningCache = new Map();
export function chartSetupTunings(family) {
  if (chartTuningCache.has(family)) return chartTuningCache.get(family);
  const list = chartsForFamily(family).flatMap(chart => chart.keys.map(key => {
    const inst = instrumentFromChart(chart.id, key.id, { now: '2026-01-01T00:00:00.000Z' });
    const names = inst.chambers[0].notes.map(midiToNoteName);
    const link = { chartId: chart.id, keyId: key.id };
    return {
      id: `chart:${chart.id}/${key.id}`, ...link,
      name: linkTitle(parseLink(linkFor(link))) || inst.name,
      family: chart.id, desc: null,
      key: key.root ?? names[0].replace(/-?\d+$/, ''),
      top: { ding: names[0], notes: names.slice(1) }, bottom: { notes: [] },
    };
  }));
  chartTuningCache.set(family, list);
  return list;
}
