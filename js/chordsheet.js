// Chord sheets: from a pasted ChordPro or chord-over-lyrics sheet to a timed
// list of chords, fitted to an instrument, and from a chord to a pattern the
// player can strike (docs/ocarina-mode.md, "Next project: songs on any
// instrument" and "From chord sheet to playing").
//
// Pure functions, no DOM: everything here is unit-tested in Node
// (tests/chordsheet.test.mjs). The bundle is one script scope, so every
// top-level name here is unique across js/*.js.

import { CHORD_TYPES, noteToMidi, notePC } from './data.js';

// ── Chord symbols ────────────────────────────────────────────────────────────

const CS_LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const CS_SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CS_FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Quality (normalised suffix) → intervals above the root. A quality whose
// interval set isn't one of CHORD_TYPES (7sus4, 11, 13) is still a chord,
// it just can't be mapped, and is reported as such.
const CS_QUALITIES = {
  '': [0, 4, 7], maj: [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6], aug: [0, 4, 8],
  sus2: [0, 2, 7], sus4: [0, 5, 7],
  5: [0, 7],
  6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
  7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], mmaj7: [0, 3, 7, 11],
  dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], augmaj7: [0, 4, 8, 11], aug7: [0, 4, 8, 10],
  add9: [0, 4, 7, 2], madd9: [0, 3, 7, 2],
  9: [0, 4, 7, 10, 2], maj9: [0, 4, 7, 11, 2], m9: [0, 3, 7, 10, 2],
  '7sus4': [0, 5, 7, 10], '7sus2': [0, 2, 7, 10],
  11: [0, 4, 7, 10, 2, 5], m11: [0, 3, 7, 10, 2, 5],
  13: [0, 4, 7, 10, 2, 9], maj13: [0, 4, 7, 11, 2, 9], m13: [0, 3, 7, 10, 2, 9],
};

// The ways sheets write a quality, rewritten to the keys above.
function csNormalizeQuality(raw) {
  let q = raw.replace(/[()]/g, '').replace(/♯/g, '#').replace(/♭/g, 'b');
  q = q.replace(/^Δ7?/, 'maj7').replace(/^M(?=7|9|13)/, 'maj').replace(/^Maj/, 'maj').replace(/^ma(?=7|9|13)/, 'maj');
  q = q.replace(/^ø7?/, 'm7b5').replace(/^°7/, 'dim7').replace(/^°/, 'dim');
  q = q.replace(/^min/, 'm').replace(/^mi(?!n)/, 'm').replace(/^-/, 'm');
  q = q.replace(/^\+/, 'aug').replace(/^aug5?/, 'aug');
  q = q.replace(/^m(maj|M)7/, 'mmaj7');
  q = q.replace(/^maj$/, '').replace(/^M$/, '');
  q = q.replace(/sus$/, 'sus4').replace(/add2$/, 'add9');
  if (q === '2') q = 'sus2';
  if (q === 'm7-5') q = 'm7b5';
  if (q === '7+' || q === '+7') q = 'aug7';
  if (q === 'maj7+5' || q === 'maj7#5') q = 'augmaj7';
  return q;
}

// The CHORD_TYPES entry with exactly these intervals (in any order), or null.
// The octave dyad has no symbol and is never matched.
export function chordTypeForIntervals(intervals) {
  if (!intervals) return null;
  const key = [...new Set(intervals.map(i => ((i % 12) + 12) % 12))].sort((a, b) => a - b).join(',');
  return CHORD_TYPES.find(t => t.id !== 'oct'
    && [...new Set(t.intervals)].sort((a, b) => a - b).join(',') === key) ?? null;
}

// Loose shape of a chord symbol: what decides whether a line holds chords.
const CS_CHORDISH = /^[A-G](?:#|b|♯|♭)?(?:maj|min|mi|m|M|Maj|ma|dim|aug|sus|add|alt|no|omit|[0-9]|\+|-|°|ø|Δ|\(|\)|#|b|♯|♭|,)*(?:\/[A-G](?:#|b|♯|♭)?)?$/;

// 'C#m7/G#' → { symbol, root 'C#', rootPC 1, suffix 'm7', quality 'm7',
// intervals, type (a CHORD_TYPES entry or null), bass 'G#', bassPC 8 }.
// null when the text isn't a chord symbol at all. A slash chord is played
// as its chord; the bass note is kept for information.
export function parseChordSymbol(text) {
  const s = String(text ?? '').trim();
  if (!CS_CHORDISH.test(s)) return null;
  const m = /^([A-G])(#|b|♯|♭)?([^/]*)(?:\/([A-G])(#|b|♯|♭)?)?$/.exec(s);
  if (!m) return null;
  const acc = (m[2] ?? '').replace('♯', '#').replace('♭', 'b');
  const rootPC = (CS_LETTER_PC[m[1]] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + 12) % 12;
  const quality = csNormalizeQuality(m[3]);
  const intervals = CS_QUALITIES[quality] ?? null;
  const bassAcc = (m[5] ?? '').replace('♯', '#').replace('♭', 'b');
  const bass = m[4] ? m[4] + bassAcc : null;
  return {
    symbol: s,
    root: m[1] + acc,
    rootPC,
    suffix: m[3],
    quality,
    intervals,
    type: chordTypeForIntervals(intervals),
    bass,
    bassPC: bass ? (CS_LETTER_PC[m[4]] + (bassAcc === '#' ? 1 : bassAcc === 'b' ? -1 : 0) + 12) % 12 : null,
  };
}

// A root name for a pitch class: sharps when the sheet spelled the chord
// with a sharp, otherwise the app's usual names (Eb, Ab, Bb, but C#, F#).
function csSpell(pc, preferSharp) {
  const p = ((pc % 12) + 12) % 12;
  if (preferSharp) return CS_SHARP_NAMES[p];
  return [1, 6].includes(p) ? CS_SHARP_NAMES[p] : CS_FLAT_NAMES[p];
}

// The symbol moved by `semis` semitones, keeping its suffix and bass.
export function transposeChordSymbol(chord, semis) {
  if (!chord) return '';
  if (!semis) return chord.symbol;
  const sharp = chord.root.includes('#');
  const bass = chord.bass ? '/' + csSpell(chord.bassPC + semis, chord.bass.includes('#')) : '';
  return csSpell(chord.rootPC + semis, sharp) + chord.suffix + bass;
}

// ── Sheets ───────────────────────────────────────────────────────────────────

const CS_SECTION_WORDS = /^(intro|verse|chorus|pre-?chorus|bridge|outro|interlude|instrumental|solo|refrain|coda|ending|tag|hook|break|riff|vamp)\b/i;

// "Verse 2:", "[Chorus]", "(Bridge)", "Pre-chorus x2" on a line of its own
// → the section name (without the repeat count).
function csSectionHeading(line) {
  const t = line.trim().replace(/^[[(]\s*/, '').replace(/\s*[\])]\s*:?$/, '').replace(/:$/, '').trim();
  const m = /^([a-z-]+(?:[\s-]*\d+)?)(?:\s*\(?(?:x\s?\d+|\d+\s?x)\)?)?$/i.exec(t);
  if (!m || !CS_SECTION_WORDS.test(m[1])) return null;
  return m[1].charAt(0).toUpperCase() + m[1].slice(1);
}

const CS_IGNORED_TOKEN = /^(?:-|–|—|\/|\.|\.\.\.|…|N\.?C\.?|\(|\)|:)$/i;
const CS_REPEAT_TOKEN = /^\(?(?:x\s?(\d+)|(\d+)\s?x)\)?$/i;

// The chord and bar-line tokens of one line, or null when the line is
// lyrics (or anything else that isn't only chords). ChordPro inline chords
// ([Am]) count wherever they are; the words around them are lyrics.
function csLineTokens(line) {
  const inline = [...line.matchAll(/\[([^\]]*)\]/g)];
  if (inline.length) {
    const out = [];
    let repeat = 1;
    let rest = line;
    for (const m of inline) {
      const c = parseChordSymbol(m[1]);
      if (c) out.push({ chord: c, at: m.index });
    }
    if (!out.length) return null;
    // Bar lines outside the brackets, in order with the chords.
    rest = line.replace(/\[[^\]]*\]/g, s => ' '.repeat(s.length));
    const bars = [...rest.matchAll(/\|/g)].map(m => ({ bar: true, at: m.index }));
    const rep = /\(?(?:x\s?(\d+)|(\d+)\s?x)\)?\s*$/i.exec(rest.trim());
    if (rep) repeat = parseInt(rep[1] ?? rep[2], 10);
    return { tokens: [...out, ...bars].sort((a, b) => a.at - b.at), repeat };
  }
  const words = line.replace(/\|/g, ' | ').split(/\s+/).filter(Boolean);
  const tokens = [];
  let repeat = 1;
  for (const w of words) {
    if (/^[|:]*\|[|:]*$/.test(w)) { tokens.push({ bar: true }); continue; }
    if (w === '%') { tokens.push({ same: true }); continue; }
    const rep = CS_REPEAT_TOKEN.exec(w);
    if (rep) { repeat = parseInt(rep[1] ?? rep[2], 10); continue; }
    if (CS_IGNORED_TOKEN.test(w)) continue;
    const c = parseChordSymbol(w);
    if (!c) return null;
    tokens.push({ chord: c });
  }
  if (!tokens.some(t => t.chord)) return null;
  return { tokens, repeat };
}

// n chords in one bar of `beatsPerBar` beats: equal shares, any remainder
// going to the first chords (3 chords in 4/4 → 2, 1, 1).
export function splitBarBeats(n, beatsPerBar) {
  if (n <= 1) return [beatsPerBar];
  if (n >= beatsPerBar) return Array.from({ length: n }, (_, i) => (i < beatsPerBar ? 1 : 0));
  const base = Math.floor(beatsPerBar / n);
  const extra = beatsPerBar - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

// The bars of one chord line: with bar lines (|), each bar holds the chords
// between two of them, sharing its beats; without, one chord per bar. A %
// repeats the bar before.
function csLineBars(tokens) {
  const hasBars = tokens.some(t => t.bar);
  const bars = [];
  if (!hasBars) {
    for (const t of tokens) {
      if (t.chord) bars.push([t.chord]);
      else if (t.same && bars.length) bars.push([...bars[bars.length - 1]]);
    }
    return bars;
  }
  let cur = [];
  let same = false;
  const flush = () => {
    if (cur.length) bars.push(cur);
    else if (same && bars.length) bars.push([...bars[bars.length - 1]]);
    cur = []; same = false;
  };
  for (const t of tokens) {
    if (t.bar) flush();
    else if (t.chord) cur.push(t.chord);
    else if (t.same) same = true;
  }
  flush();
  return bars;
}

// Reads a chord sheet: ChordPro ({title}, {tempo}, {time}, {start_of_chorus}
// … {end_of_chorus}, [Am] inline chords) or plain chord-over-lyrics and
// chord-only lines ("Am  Dm  Am  Bbm", "| Am | Dm | Am | Bbm |"). Lyrics
// are dropped. Returns
//   { title, subtitle, artist, key, bpm (or null), beatsPerBar, beatUnit,
//     steps: [{ symbol, chord, beats, section }], sections, unknown }
// where unknown lists the chord symbols that don't map onto CHORD_TYPES.
// With merge (the default), the same chord in bars that follow each other
// within a section becomes one step.
export function parseChordSheet(text, { merge = true } = {}) {
  const out = { title: '', subtitle: '', artist: '', key: '', bpm: null, beatsPerBar: 4, beatUnit: 4, steps: [], sections: [], unknown: [] };
  let section = null;
  let inSkip = false;   // inside {start_of_tab} … {end_of_tab}
  let chorusStart = -1; // first step of the chorus being read
  let lastChorus = [];
  const bars = [];      // { chords: [...], section }

  const setSection = name => {
    section = name || null;
    if (section && !out.sections.includes(section)) out.sections.push(section);
  };

  for (const rawLine of String(text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.replace(/\t/g, '    ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // ChordPro directives.
    const dir = /^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i.exec(trimmed);
    if (dir) {
      const name = dir[1].toLowerCase();
      const value = (dir[2] ?? '').trim();
      if (inSkip) { if (/^(eot|end_of_tab|eog_tab)$/.test(name)) inSkip = false; continue; }
      if (name === 'title' || name === 't') out.title = value;
      else if (name === 'subtitle' || name === 'st') out.subtitle = value;
      else if (name === 'artist') out.artist = value;
      else if (name === 'key') out.key = value;
      else if (name === 'tempo') { const n = parseFloat(value); if (n > 0) out.bpm = Math.round(n); }
      else if (name === 'time') {
        const t = /^(\d+)\s*\/\s*(\d+)$/.exec(value);
        if (t) { out.beatsPerBar = Math.max(1, parseInt(t[1], 10)); out.beatUnit = parseInt(t[2], 10); }
      } else if (name === 'start_of_tab' || name === 'sot') inSkip = true;
      else if (name === 'start_of_chorus' || name === 'soc') { setSection(value || 'Chorus'); chorusStart = bars.length; }
      else if (name === 'end_of_chorus' || name === 'eoc') {
        if (chorusStart >= 0) lastChorus = bars.slice(chorusStart);
        chorusStart = -1;
        section = null;
      } else if (name === 'chorus') {
        // "Chorus again": the last chorus's bars, once more.
        const label = value || lastChorus[0]?.section || 'Chorus';
        for (const b of lastChorus) bars.push({ chords: b.chords, section: label });
        if (lastChorus.length && !out.sections.includes(label)) out.sections.push(label);
      } else if (name === 'start_of_verse' || name === 'sov') setSection(value || 'Verse');
      else if (name === 'start_of_bridge' || name === 'sob') setSection(value || 'Bridge');
      else if (name === 'start_of_grid' || name === 'sog') setSection(value || section);
      else if (/^start_of_/.test(name)) {
        const kind = name.slice(9);
        setSection(value || kind.charAt(0).toUpperCase() + kind.slice(1));
      } else if (/^(end_of_|eo[vbg]$)/.test(name)) section = null;
      else if (['comment', 'c', 'comment_italic', 'ci', 'comment_box', 'cb', 'highlight'].includes(name)) {
        const h = csSectionHeading(value);
        if (h) setSection(h);
      }
      continue;
    }
    if (inSkip) continue;

    // "Verse 1:", "[Chorus]" on its own line.
    const heading = /\[[^\]]*\]/.test(trimmed) && parseChordSymbol(trimmed.replace(/^\[|\]$/g, '')) ? null : csSectionHeading(trimmed);
    if (heading) { setSection(heading); continue; }

    // "Title: …" / "Tempo: 92" / "Time: 3/4" lines in a plain sheet.
    const meta = /^(title|tempo|bpm|time|key|artist)\s*:\s*(.+)$/i.exec(trimmed);
    if (meta) {
      const k = meta[1].toLowerCase(), v = meta[2].trim();
      if (k === 'title') out.title = v;
      else if (k === 'artist') out.artist = v;
      else if (k === 'key') out.key = v;
      else if (k === 'tempo' || k === 'bpm') { const n = parseFloat(v); if (n > 0) out.bpm = Math.round(n); }
      else if (k === 'time') {
        const t = /^(\d+)\s*\/\s*(\d+)$/.exec(v);
        if (t) { out.beatsPerBar = Math.max(1, parseInt(t[1], 10)); out.beatUnit = parseInt(t[2], 10); }
      }
      continue;
    }

    // "Intro: | Am | Dm |": a section name in front of a chord line.
    let chordText = line;
    const lead = /^\s*[[(]?([A-Za-z][A-Za-z -]*?\d*)[\])]?\s*:\s*(.+)$/.exec(line);
    if (lead && csSectionHeading(lead[1]) && csLineTokens(lead[2])) {
      setSection(csSectionHeading(lead[1]));
      chordText = lead[2];
    }
    const parsed = csLineTokens(chordText);
    if (!parsed) continue; // lyrics
    const lineBars = csLineBars(parsed.tokens);
    for (let r = 0; r < Math.max(1, parsed.repeat); r++) {
      for (const chords of lineBars) bars.push({ chords, section });
    }
  }

  // Bars → steps, each chord with its share of the bar.
  const bpb = out.beatsPerBar;
  for (const b of bars) {
    const shares = splitBarBeats(b.chords.length, bpb);
    b.chords.forEach((chord, i) => {
      if (!shares[i]) return;
      out.steps.push({ symbol: chord.symbol, chord, beats: shares[i], section: b.section });
    });
  }
  if (merge) out.steps = mergeRepeatedSteps(out.steps);
  const unknown = new Set();
  for (const s of out.steps) if (!s.chord.type) unknown.add(s.symbol);
  out.unknown = [...unknown];
  return out;
}

// The same chord in steps that follow each other within one section → one
// longer step.
export function mergeRepeatedSteps(steps) {
  const out = [];
  for (const s of steps) {
    const prev = out[out.length - 1];
    if (prev && prev.symbol === s.symbol && prev.section === s.section) prev.beats += s.beats;
    else out.push({ ...s });
  }
  return out;
}

// A step's length as stored on a progression step: whole bars as `bars`,
// anything else as `beats` (with bars 1, so older code still reads a bar).
export function stepLength(beats, beatsPerBar) {
  return beats % beatsPerBar === 0 ? { bars: beats / beatsPerBar } : { bars: 1, beats };
}

// ── Fitting a sheet to an instrument ─────────────────────────────────────────
// `chords` is findAllChords() of the instrument's layout (a handpan's, or
// ocarinaToLayout() of an ocarina or flute). A sheet chord is playable when
// a chord with the same root pitch class and type is among them.

export function chordKey(rootPC, typeId) { return `${((rootPC % 12) + 12) % 12}-${typeId}`; }

// The instrument's chord for a sheet chord moved by `semis`, or null.
export function matchSheetChord(chord, chords, semis = 0) {
  if (!chord?.type) return null;
  const key = chordKey(chord.rootPC + semis, chord.type.id);
  return chords.find(c => chordKey(notePC(c.rootNote), c.type.id) === key) ?? null;
}

// How much of the sheet the instrument plays when moved by `semis`:
// { semis, playable, total, score (0–1, share of steps whose chord is
// fully playable), missing (transposed symbols, each once) }.
export function sheetCoverage(steps, chords, semis = 0) {
  const missing = [];
  let playable = 0;
  for (const s of steps) {
    if (matchSheetChord(s.chord, chords, semis)) playable += 1;
    else {
      const sym = transposeChordSymbol(s.chord, semis);
      if (!missing.includes(sym)) missing.push(sym);
    }
  }
  const total = steps.length;
  return { semis, playable, total, score: total ? playable / total : 0, missing };
}

// The 12 transpositions (semis from -5 to +6), best first: the highest
// score, then the smallest move, then up before down.
export function rankTranspositions(steps, chords) {
  const all = [];
  for (let s = -5; s <= 6; s++) all.push(sheetCoverage(steps, chords, s));
  return all.sort((a, b) => b.score - a.score || Math.abs(a.semis) - Math.abs(b.semis) || b.semis - a.semis);
}

// Badge for a coverage score, as in the docs' "Can I play it?".
export function coverageBand(score) {
  if (score >= 0.95) return 'plays';
  if (score >= 0.8) return 'swaps';
  return 'breaks';
}

// ── From a chord to what to strike ───────────────────────────────────────────

// A chord's notes stacked from its root: the lowest root on the instrument,
// then each chord tone (in the type's interval order) at the nearest note
// above the one before; a tone with nothing above comes from below the
// root instead. Returns ascending note names, or null when the root or a
// tone isn't on the instrument. On D Kurd: F → C4 F4 A4, Dm → D3 F4 A4.
export function stackVoicing(rootPC, intervals, layoutNotes) {
  const notes = [...new Set(layoutNotes.filter(Boolean))].sort((a, b) => noteToMidi(a) - noteToMidi(b));
  const root = notes.find(n => notePC(n) === ((rootPC % 12) + 12) % 12);
  if (!root) return null;
  const used = [root];
  let prev = noteToMidi(root);
  for (const iv of intervals.slice(1)) {
    const pc = (rootPC + iv) % 12;
    const options = notes.filter(n => notePC(n) === pc && !used.includes(n));
    if (!options.length) {
      if (used.some(n => notePC(n) === pc)) continue;
      return null;
    }
    const above = options.find(n => noteToMidi(n) > prev);
    const below = options.filter(n => noteToMidi(n) < noteToMidi(root));
    const pick = above ?? below[below.length - 1] ?? options[0];
    used.push(pick);
    if (above) prev = noteToMidi(pick);
  }
  return used.sort((a, b) => noteToMidi(a) - noteToMidi(b));
}

export const PLAY_LEVELS = [
  { id: 'roots', name: 'Roots' },
  { id: 'arpeggio', name: 'Arpeggio' },
  { id: 'groove', name: 'Groove' },
];

// From this tempo up a pattern plays fewer notes ("fast tempo" in the docs).
export const FAST_BPM = 132;

// The bounce over n notes, one per beat: 1-2-3-2 for three notes over four
// beats, 1-2-3-4 for four, 1-2-1-2 for two.
function csBounce(n, length) {
  if (n <= 1) return Array(length).fill(0);
  const cycle = [];
  for (let i = 0; i < n; i++) cycle.push(i);
  for (let i = n - 2; i > 0; i--) cycle.push(i);
  return Array.from({ length }, (_, i) => cycle[i % cycle.length]);
}

// Strong beats of a bar: the first, and the middle one in an even bar of 4
// or more (1 and 3 in 4/4, 1 and 4 in 6/8).
function csStrongBeats(beatsPerBar) {
  return beatsPerBar >= 4 && beatsPerBar % 2 === 0 ? [0, beatsPerBar / 2] : [0];
}

// What to strike for one step, at a level:
//   notes        the chord's notes on the instrument (any order)
//   root         its root note (default: the lowest note of the root's
//                pitch class, else the lowest note)
//   beatsPerBar, beats (the step's length in beats), bpm
//   level        'roots' | 'arpeggio' | 'groove'
//   next         the next chord's notes (the ring rule), section (its name)
// Returns { hits: [{ beat, notes, hand: 'L' | 'R', ghost? }], reduced },
// beats counted from 0 at the step's start, in time order. The docs' rules:
// more than one chord per bar or a fast tempo plays fewer notes (reduced);
// a chorus starts each bar with two notes together; when a pair would ring
// into a next chord that lacks one of its notes, a note the two chords
// share is preferred. Arpeggio keeps the 1-2-3-2 of the docs' table.
export function strikePattern({ notes, root = null, beatsPerBar = 4, beats = null, bpm = 80, level = 'arpeggio', next = null, section = null }) {
  const v = [...new Set(notes)].sort((a, b) => noteToMidi(a) - noteToMidi(b));
  const len = beats ?? beatsPerBar;
  if (!v.length || len <= 0) return { hits: [], reduced: false };
  const rootNote = root && v.includes(root) ? root : v[0];
  const others = v.filter(n => n !== rootNote);
  const reduced = bpm >= FAST_BPM || len < beatsPerBar;
  const nextPCs = next?.length ? new Set(next.map(notePC)) : null;
  const hits = [];
  const strike = (beat, ns, hand, extra = {}) => hits.push({ beat, notes: ns, hand, ...extra });

  // Two notes struck together, one per hand, swapped for shared notes when
  // they would ring into the next chord at the step's end.
  const pairAt = (beat, endsStep) => {
    let pair = others.length >= 2 ? [others[0], others[others.length - 1]] : others.length ? [others[0]] : [rootNote];
    if (endsStep && nextPCs) {
      const shared = v.filter(n => nextPCs.has(notePC(n)));
      pair = pair.map(n => {
        if (nextPCs.has(notePC(n))) return n;
        return shared.find(s => !pair.includes(s)) ?? n;
      });
      pair = [...new Set(pair)];
    }
    strike(beat, [pair[0]], 'L');
    if (pair[1]) strike(beat, [pair[1]], 'R');
  };

  const barCount = Math.ceil(len / beatsPerBar);
  for (let b = 0; b < barCount; b++) {
    const start = b * beatsPerBar;
    const inBar = Math.min(beatsPerBar, len - start);
    const lastBar = b === barCount - 1;
    if (level === 'roots') {
      strike(start, [rootNote], 'R');
      continue;
    }
    if (reduced) {
      // Fewer notes: the root, then a pair halfway through when there's room.
      strike(start, [rootNote], 'R');
      if (inBar >= 2 && v.length > 1) pairAt(start + Math.floor(inBar / 2), lastBar);
      continue;
    }
    if (level === 'groove') {
      const strong = csStrongBeats(beatsPerBar);
      for (let i = 0; i < inBar; i++) {
        if (strong.includes(i)) {
          strike(start + i, [rootNote], 'R');
          if (i + 0.5 < inBar) strike(start + i + 0.5, [rootNote], 'L', { ghost: true });
        } else {
          pairAt(start + i, lastBar && i === inBar - 1);
        }
      }
      continue;
    }
    // Arpeggio: one note per beat, hands alternating, R on beat 1.
    const order = csBounce(v.length, inBar);
    const chorus = section && /chorus|refrain|build|pre/i.test(section);
    for (let i = 0; i < inBar; i++) {
      const hand = i % 2 === 0 ? 'R' : 'L';
      if (i === 0 && chorus && v.length > 1) {
        strike(start, [v[0]], 'R');
        strike(start, [v[v.length - 1]], 'L');
        continue;
      }
      strike(start + i, [v[order[i]]], hand);
    }
  }
  hits.sort((a, b) => a.beat - b.beat);
  return { hits, reduced };
}

// Strike numbers for the pan, from the first bar of a pattern: each note
// with the strike numbers (1, 2, … in time order; notes struck together
// share a number) and hands that hit it. Ghost taps aren't numbered.
// Returns [{ note, marks: [{ n, hand }] }].
export function strikeNumbers(hits, beatsPerBar = 4) {
  const first = hits.filter(h => !h.ghost && h.beat < beatsPerBar);
  const beats = [...new Set(first.map(h => h.beat))].sort((a, b) => a - b);
  const byNote = new Map();
  for (const h of first) {
    const n = beats.indexOf(h.beat) + 1;
    for (const note of h.notes) {
      if (!byNote.has(note)) byNote.set(note, []);
      byNote.get(note).push({ n, hand: h.hand });
    }
  }
  return [...byNote.entries()].map(([note, marks]) => ({ note, marks }));
}
