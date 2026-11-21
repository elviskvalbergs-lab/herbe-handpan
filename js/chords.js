import { getAllNotes, noteToMidi, notePC, CHORD_TYPES, getNoteName } from './data.js';

// Returns all chords playable on this layout, deduped by root + type
export function findAllChords(layout) {
  const allNotes = getAllNotes(layout);
  const pcs = allNotes.map(notePC);
  const uniquePCs = [...new Set(pcs)];
  const results = [];
  const seen = new Set();

  for (const rootPC of uniquePCs) {
    for (const type of CHORD_TYPES) {
      const key = `${rootPC}-${type.id}`;
      if (seen.has(key)) continue;

      // Octave dyad: same pitch class, different octave
      if (type.id === 'oct') {
        const rootNotes = allNotes.filter(n => notePC(n) === rootPC);
        if (rootNotes.length >= 2) {
          const sorted = [...rootNotes].sort((a, b) => noteToMidi(a) - noteToMidi(b));
          seen.add(key);
          results.push({
            id: `${getNoteName(sorted[0])}-oct`,
            rootName: getNoteName(sorted[0]),
            rootNote: sorted[0],
            type,
            notes: sorted,
            noteCount: 2,
          });
        }
        continue;
      }

      const requiredPCs = type.intervals.map(i => (rootPC + i) % 12);
      if (!requiredPCs.every(pc => uniquePCs.includes(pc))) continue;

      // Pick one representative note per required PC (lowest pitch on instrument)
      const chordNotes = requiredPCs.map(pc => {
        const matches = allNotes.filter(n => notePC(n) === pc);
        return matches.sort((a, b) => noteToMidi(a) - noteToMidi(b))[0];
      });

      const rootNote = allNotes
        .filter(n => notePC(n) === rootPC)
        .sort((a, b) => noteToMidi(a) - noteToMidi(b))[0];

      seen.add(key);
      results.push({
        id: `${getNoteName(rootNote)}-${type.id}`,
        rootName: getNoteName(rootNote),
        rootNote,
        type,
        notes: chordNotes,
        noteCount: type.intervals.length,
      });
    }
  }

  return results;
}

// Identify which known chord type(s) an arbitrary set of notes forms (Discover mode).
// Tries each selected note as a candidate root and checks the resulting interval
// set against every CHORD_TYPES entry. Returns [] if fewer than 2 distinct
// pitch classes are given, or nothing matches.
export function identifyChord(selectedNotes) {
  const byPC = new Map();
  selectedNotes.forEach(n => byPC.set(notePC(n), n)); // last-clicked note wins per pitch class
  const uniqueNotes = [...byPC.values()];
  if (uniqueNotes.length < 2) return [];
  const pcs = uniqueNotes.map(notePC);

  const matches = [];
  for (const rootNote of uniqueNotes) {
    const rootPC = notePC(rootNote);
    const intervals = pcs.map(pc => (pc - rootPC + 12) % 12).sort((a, b) => a - b);
    for (const type of CHORD_TYPES) {
      if (type.id === 'oct') continue;
      const typeIntervals = [...type.intervals].sort((a, b) => a - b);
      if (typeIntervals.length !== intervals.length) continue;
      if (!typeIntervals.every((iv, i) => iv === intervals[i])) continue;
      const notes = type.intervals.map(iv => uniqueNotes.find(n => notePC(n) === (rootPC + iv) % 12));
      matches.push({
        id: `${getNoteName(rootNote)}-${type.id}`,
        rootNote, rootName: getNoteName(rootNote),
        type, notes, noteCount: notes.length,
      });
    }
  }
  return matches;
}

// Returns related chords: same type / other roots, and chords sharing 2+ notes
export function getRelatedChords(chord, allChords) {
  const sameType = allChords.filter(c =>
    c.type.id === chord.type.id && c.id !== chord.id
  );

  const chordPCs = new Set(chord.notes.map(notePC));
  const sharedNotes = allChords.filter(c => {
    if (c.id === chord.id || c.type.id === chord.type.id) return false;
    const sharedCount = c.notes.filter(n => chordPCs.has(notePC(n))).length;
    return sharedCount >= 2;
  });

  return { sameType, sharedNotes };
}

// ── Main chords ───────────────────────────────────────────────────────────────
// The plain major and minor chords (triads): most songs are made mostly of
// them. The Chords screens show these first ("main chords"), everything else
// (7ths, 6ths, sus, add9, 9ths, diminished, augmented, intervals) behind
// "Show all".
export const MAIN_CHORD_TYPES = ['maj', 'min'];
export function isMainChord(chord) { return MAIN_CHORD_TYPES.includes(chord.type.id); }

// Main chords in the instrument's own order: the chord on its home note (a
// handpan's ding, an ocarina's or whistle's key note) first, then up the
// scale from it; on the same root, the fuller voicing first. tonic: pitch
// class 0–11. An instrument that plays every semitone (a 12-hole ocarina, a
// whistle with half-holing: pcs, its pitch classes, more than 7) would have
// all 24; its main chords are those of the major key on its home note.
const MAJOR_KEY = [0, 2, 4, 5, 7, 9, 11];
export function mainChordsInKey(chords, tonic, pcs = null) {
  const pc = c => notePC(c.rootNote);
  const step = c => (pc(c) - tonic + 12) % 12;
  const key = pcs && pcs.size > 7 ? new Set(MAJOR_KEY.map(s => (tonic + s) % 12)) : null;
  return chords.filter(isMainChord)
    .filter(c => !key || c.notes.every(n => key.has(notePC(n))))
    .sort((a, b) => step(a) - step(b) || b.noteCount - a.noteCount || MAIN_CHORD_TYPES.indexOf(a.type.id) - MAIN_CHORD_TYPES.indexOf(b.type.id));
}
