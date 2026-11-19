// The beginner setup (docs/free-to-play.md §2; the approved mock-up): "What
// do you play?" as plain tiles, then for a handpan "Play my notes" (the app
// listens and works out the scale, js/scalefinder.js) or "I know my scale"
// (the middle note first, then the common scales in that key, the rest
// behind "Show all"), and a ready screen with a first chord to play.
//
// Pure helpers, unit tested in Node. The screens are in js/app.js (viewBeginnerSetup).

import { notePC } from './data.js';
import { addHeardNote } from './scalefinder.js';
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

// Two charts that explain the notes heard equally well (both chromatic from
// the same lowest note: a 12-hole alto C and a 6-hole pendant in A) can't be
// told apart by ear; the more common type, listed first, goes first.
export function preferCommonChart(ranked, family) {
  const order = chartsForFamily(family).map(c => c.id);
  const tie = (a, b) => a.scale.chartId && b.scale.chartId && a.matched.length === b.matched.length
    && a.ding === b.ding && a.missing.length === b.missing.length;
  return [...ranked].sort((a, b) => (tie(a, b) ? order.indexOf(a.scale.chartId) - order.indexOf(b.scale.chartId) : b.score - a.score));
}

// ── Instruments not tuned to A = 440 Hz ─────────────────────────────────────
// Many tongue drums, handpans and kalimbas are tuned to A = 432 Hz: every
// note about 32 cents low, so a note struck a little low (a drum's lowest
// tongue, before it settles) is nearer the semitone below and gets the wrong
// name. From the notes heard (fractional MIDI, as the tuner reads them) this
// is how far the instrument sits from 440, in cents, when at least three
// notes agree on it; 0 otherwise. A circular mean, so -30 and +45 cents
// (a note just past the halfway point) count as the same offset.
export function tuningOffsetCents(raw) {
  // Each note's distance from the nearest semitone, in cents (-50..50).
  const devs = raw.filter(Number.isFinite).map(m => (m - Math.round(m)) * 100);
  if (devs.length < 3) return 0;
  // Circular distance in cents (−62 and +38 are the same place).
  const dist = (a, b) => { const d = Math.abs(a - b) % 100; return Math.min(d, 100 - d); };
  // The offset most notes agree on (within 20 cents); one badly tuned note
  // doesn't move it.
  let best = 0, bestN = -1;
  for (let c = -50; c < 50; c++) {
    const n = devs.filter(d => dist(d, c) <= 20).length;
    if (n > bestN || (n === bestN && Math.abs(c) < Math.abs(best))) { best = c; bestN = n; }
  }
  if (bestN < 3 || bestN < devs.length * 0.6) return 0;
  // The mean of the notes that agree, around that offset.
  const near = devs.filter(d => dist(d, best) <= 20).map(d => best + (((d - best + 150) % 100) - 50));
  const cents = Math.round(near.reduce((a, b) => a + b, 0) / near.length);
  return Math.abs(cents) < 12 ? 0 : cents;
}

// A note heard, named on the instrument's own tuning.
export function noteOnTuning(rawMidi, offsetCents) { return Math.round(rawMidi - offsetCents / 100); }

// What A is tuned to, for "Tuned to A = 432 Hz".
// The common references (432 Hz, 442 Hz…) when it's within 2 Hz of one:
// makers sell drums "in 432 Hz".
export function a4ForOffset(offsetCents) {
  const hz = 440 * 2 ** (offsetCents / 1200);
  const common = [432, 435, 440, 442, 443, 444].find(c => Math.abs(c - hz) <= 2);
  return common ?? Math.round(hz);
}

// One steady note heard while listening freely ({ raw, notes } so far; raw
// are the fractional MIDI numbers as heard). Returns the next { raw, notes,
// offset }, or null when it isn't a new note. With `tuned`, notes are named
// on the instrument's own tuning (tuningOffsetCents) and the ones heard before
// are renamed with it. Shared by the app (onListenReading) and
// scripts/replay-listen.mjs, so a recording replays exactly as the app hears it.
export function collectHeardNote({ raw = [], notes = [] } = {}, midi, { tuned = true } = {}) {
  const offset = tuned ? tuningOffsetCents([...raw, midi]) : 0;
  const next = addHeardNote(notes, midi - offset / 100);
  if (!next) return null;
  const all = [...raw, midi];
  if (!tuned) return { raw: all, notes: next, offset };
  const renamed = [];
  for (const x of all) { const n = noteOnTuning(x, offset); if (!renamed.includes(n)) renamed.push(n); }
  return { raw: all, notes: renamed, offset };
}
