// Scale finder: which handpan scale has the notes a player strikes into the
// tuner ("Listen" on Try a scale and in the wizard's handpan step).
//
// The first note collected is taken as the ding. Notes are compared by exact
// MIDI number; a note of the scale in another octave counts for less (the
// tuner can jump an octave on a ringing note).
//
// Pure functions; unit tested in Node.

import { noteToMidi, FLAT_NAMES } from './data.js';

// Weights of the ranking (see rankScalesByNotes).
const SF_DING_EXACT = 10;   // first note heard = the scale's ding
const SF_DING_OCTAVE = 4;   // ding's pitch class, another octave
const SF_NOTE_EXACT = 3;    // any other heard note in the scale
const SF_NOTE_OCTAVE = 1;   // its pitch class is in the scale, another octave
const SF_NOTE_MISSING = -4; // not in the scale at all
const SF_COVERAGE = 4;      // × the share of the scale's notes heard

// 'Bb3' style name of a MIDI number (the spelling SCALES uses most).
export function heardNoteName(midi) {
  return FLAT_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

// Adds a stable reading (fractional MIDI) to the notes collected so far,
// in the order heard. Returns the new list, or null when the reading is not
// a new note: within ±tolCents of a note already collected (a note still
// ringing, heard again) or rounding to one already there. A note an octave
// or two below a collected one and below the ding is ring-over too: two
// notes sounding together (D3 and A3) read as their common lower octave
// (D2), and no handpan scale has a note an octave below its ding.
export function addHeardNote(notes, midi, { tolCents = 30 } = {}) {
  if (!Number.isFinite(midi)) return null;
  const m = Math.round(midi);
  if (notes.includes(m)) return null;
  if (notes.some(n => Math.abs(midi - n) * 100 <= tolCents)) return null;
  if (notes.length && m < notes[0] && notes.some(n => n - m === 12 || n - m === 24)) return null;
  return [...notes, m];
}

// Every note of a scale (ding, top, bottom) as MIDI numbers.
function sfScaleMidis(scale) {
  return [scale.top.ding, ...scale.top.notes, ...scale.bottom.notes].map(noteToMidi);
}

// Ranks scales by the notes heard (MIDI numbers, the first is the ding).
// Returns [{ scale, score, matched, total, missing: [midi], octave: [midi],
// ding: 'exact' | 'higher' | 'lower' | 'none', reasons: [text] }], best first.
// ding 'higher' means the scale's ding is an octave (or more) above the note
// heard first. name(midi) spells notes in the reasons.
export function rankScalesByNotes(heard, scales, { name = heardNoteName } = {}) {
  if (!heard.length) return [];
  const [first] = heard;
  const out = scales.map((scale, order) => {
    const midis = sfScaleMidis(scale);
    const set = new Set(midis);
    const pcs = new Set(midis.map(m => ((m % 12) + 12) % 12));
    const ding = midis[0];
    const pc = m => ((m % 12) + 12) % 12;
    let score = 0;
    const matched = [], octave = [], missing = [];
    let dingMatch = 'none';
    heard.forEach((m, i) => {
      if (i === 0 && m === ding) { dingMatch = 'exact'; score += SF_DING_EXACT; matched.push(m); return; }
      if (i === 0 && pc(m) === pc(ding)) {
        dingMatch = ding > m ? 'higher' : 'lower';
        score += SF_DING_OCTAVE;
        if (set.has(m)) matched.push(m); else octave.push(m);
        return;
      }
      if (set.has(m)) { score += SF_NOTE_EXACT; matched.push(m); } else if (pcs.has(pc(m))) { score += SF_NOTE_OCTAVE; octave.push(m); } else { score += SF_NOTE_MISSING; missing.push(m); }
    });
    score += SF_COVERAGE * (matched.length / set.size);
    const reasons = [];
    if (heard.length > 1) {
      reasons.push(matched.length === heard.length ? `all ${heard.length} notes match` : `${matched.length} of ${heard.length} notes match`);
    }
    if (dingMatch === 'exact') reasons.push('ding matches');
    else if (dingMatch !== 'none') reasons.push(`ding ${name(ding)}: an octave ${dingMatch} than ${name(first)}`);
    else if (set.has(first)) reasons.push(`${name(first)} isn't its ding`);
    for (const m of octave) if (!(m === first && dingMatch !== 'none')) reasons.push(`${name(m)} is here only in another octave`);
    for (const m of missing) reasons.push(`${name(m)} isn't in this scale`);
    if (heard.length > 1 && matched.length === set.size) reasons.push('all its notes heard');
    return { scale, score, matched, total: set.size, octave, missing, ding: dingMatch, reasons, order };
  });
  out.sort((a, b) => b.score - a.score || a.order - b.order);
  return out.map(({ order, ...r }) => r);
}
