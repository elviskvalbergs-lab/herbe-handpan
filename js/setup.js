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

// What the setup offers after listening (ranked: rankScalesByNotes, best
// first). With the number of notes known (the guided round: `count` places,
// `heard` of them played), only a tuning with exactly that many notes, its
// ding the lowest note played and every note played in it, is offered as
// theirs: a 10-note scale that merely contains 8 notes heard isn't an 8-note
// drum. Without one, best is null and the setup offers the notes as played,
// with the same-size tunings that came closest. Without a count (just
// listening), the best match as ranked.
export function setupMatch(ranked, { count = null, heard = 0 } = {}) {
  const withDing = ranked.filter(r => r.ding !== 'none');
  if (!count) return { best: withDing[0] ?? null, close: [] };
  const sameSize = withDing.filter(r => r.total === count);
  const best = sameSize.find(r => r.ding === 'exact' && r.matched.length === heard) ?? null;
  return { best, close: sameSize.filter(r => r !== best && r.matched.length >= heard - 2).slice(0, 2) };
}

// The common scales a drum, kalimba or handpan is sold in, as steps from the
// root (music theory, the same in every key). The pentatonic ones first.
export const SETUP_SCALE_TYPES = [
  { id: 'minor-pentatonic', name: 'minor pentatonic', steps: [0, 3, 5, 7, 10] },
  { id: 'major-pentatonic', name: 'major pentatonic', steps: [0, 2, 4, 7, 9] },
  { id: 'akebono', name: 'Akebono', steps: [0, 2, 3, 7, 8] },
  { id: 'kumoi', name: 'Kumoi', steps: [0, 2, 3, 7, 9] },
  { id: 'egyptian', name: 'Egyptian', steps: [0, 2, 5, 7, 10] },
  { id: 'minor', name: 'minor', steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'major', name: 'major', steps: [0, 2, 4, 5, 7, 9, 11] },
];

// Which common scale the notes heard (MIDI numbers) are, or are closest to,
// in any key: the best five-note and the best seven-note fit, each
// { root (pitch class), type, off: [midi], instead: { midi: suggested midi } }.
// Fewest notes off first, but a root that is the first note (the ding or
// the lowest note: an instrument's key) over one note fewer off, then the order above. A note off by a semitone from a
// scale note the drum doesn't already have is probably that note, misheard
// or out of tune: `instead`, leaning the way it sounded (devCents: { midi:
// cents from the named note }). Null with fewer than three different notes.
export function scaleFits(notes, { devCents = {}, types = SETUP_SCALE_TYPES } = {}) {
  const pc = m => ((m % 12) + 12) % 12;
  if (new Set(notes.map(pc)).size < 3) return null;
  const low = pc(notes[0]); // the ding, or the lowest note: listed first
  const best = {};
  types.forEach((type, order) => {
    for (let root = 0; root < 12; root++) {
      const set = new Set(type.steps.map(s => (root + s) % 12));
      const off = notes.filter(m => !set.has(pc(m)));
      // A root that isn't the lowest note counts for more than one note off.
      const rank = off.length * 100 + (root === low ? 0 : 150) + order;
      const size = type.steps.length;
      if (!best[size] || rank < best[size].rank) best[size] = { rank, root, type, off, set };
    }
  });
  const finish = f => {
    if (!f) return null;
    const instead = {};
    for (const m of f.off) {
      const lean = devCents[m] ?? 0;
      const tries = lean < 0 ? [m - 1, m + 1] : [m + 1, m - 1];
      const s = tries.find(x => f.set.has(pc(x)) && !notes.includes(x));
      if (s != null) instead[m] = s;
    }
    // A note off the scale heard in two octaves is the drum's, not a slip.
    const repeated = f.off.some(m => notes.some(x => x !== m && pc(x) === pc(m)));
    return { root: f.root, type: f.type, off: f.off, instead, repeated };
  };
  return { five: finish(best[5]), seven: finish(best[7]) };
}
