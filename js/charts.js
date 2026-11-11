// Traditional fingering charts: bought ocarinas and flutes whose fingerings
// are fixed by the instrument type. See docs/ocarina-mode.md, "Ocarinas and
// flutes", and CLAUDE.md: every chart comes from a published source, noted
// with its URL; nothing is filled in from memory.
//
// A chart is written once, relative to its lowest note, and serves every key
// of that type: concert pitch = the key's lowest note + offset.
//
//   {
//     id, family: 'ocarina' | 'flute', name, source: [urls], notes: '…',
//     holes: [{ id, finger, side: 'top' | 'bottom', sub? }],   // opening order
//     keys: [{ id, name, lowest: 'D4' }],                       // lowest sounding note per key
//     fingerings: [{ offset, states: ['c'|'o'|'h', …], alt?: true, overblow?: true }],
//   }
//
// Pure data and functions; unit tested in Node.

import { noteToMidi } from './data.js';

export const TRADITIONAL_CHARTS = [];

export function getChart(id) {
  return TRADITIONAL_CHARTS.find(c => c.id === id) ?? null;
}

export function chartsForFamily(family) {
  return TRADITIONAL_CHARTS.filter(c => c.family === family);
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
  for (const f of chart.fingerings) {
    const midi = base + f.offset;
    if (!fingerings[midi] && !f.alt) fingerings[midi] = f.states;
    else (alternates[midi] ??= []).push(f.states);
  }
  const notes = Object.keys(fingerings).map(Number).sort((a, b) => a - b);
  return {
    id: (chart.family === 'flute' ? 'fl-' : 'oc-') + Math.random().toString(36).slice(2, 10),
    family: chart.family,
    kind: 'traditional',
    type: chart.id,
    key: key.id,
    name: name || `${chart.name}, ${key.name}`,
    chambers: [{ notes, holes: chart.holes.map(h => ({ ...h, x: null, y: null, sizeMm: null })), fingerings, alternates }],
    createdAt: now,
    updatedAt: now,
    lastPlayedAt: now,
  };
}
