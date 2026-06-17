// Note name → semitone offset (0–11)
const NOTE_TO_SEMI = {
  'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,
  'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11
};

// Normalize to preferred flat/sharp spelling
const ENHARMONIC = { 'D#':'Eb','A#':'Bb','G#':'Ab','Db':'C#','Gb':'F#' };

export function normalizeNote(note) {
  const m = note.match(/^([A-G][#b]?)(\d)$/);
  if (!m) return note;
  const name = ENHARMONIC[m[1]] ?? m[1];
  return name + m[2];
}

export function noteToMidi(note) {
  const m = note.match(/^([A-G][#b]?)(\d)$/);
  if (!m) return 0;
  return (parseInt(m[2]) + 1) * 12 + NOTE_TO_SEMI[m[1]];
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function noteToFreq(note) { return midiToFreq(noteToMidi(note)); }

export function getNoteName(note) {
  const m = note.match(/^([A-G][#b]?)/);
  return m ? m[1] : note;
}

export function notePC(note) { return noteToMidi(note) % 12; }

// 12 preferred note names in chromatic order
export const NOTE_NAMES = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];

// ── Chord type catalog ───────────────────────────────────────────────────────
// intervals: semitone offsets from root (mod-12 for pitch-class detection)
export const CHORD_TYPES = [
  // Dyads / intervals
  { id:'p5',    name:'Perfect 5th',         category:'Interval',   intervals:[0,7] },
  { id:'m3i',   name:'Minor 3rd',           category:'Interval',   intervals:[0,3] },
  { id:'M3i',   name:'Major 3rd',           category:'Interval',   intervals:[0,4] },
  { id:'p4',    name:'Perfect 4th',         category:'Interval',   intervals:[0,5] },
  { id:'M6i',   name:'Major 6th',           category:'Interval',   intervals:[0,9] },
  // Triads
  { id:'maj',   name:'Major',               category:'Major',      intervals:[0,4,7] },
  { id:'min',   name:'Minor',               category:'Minor',      intervals:[0,3,7] },
  { id:'dim',   name:'Diminished',          category:'Diminished', intervals:[0,3,6] },
  { id:'aug',   name:'Augmented',           category:'Augmented',  intervals:[0,4,8] },
  { id:'sus2',  name:'Sus2',                category:'Suspended',  intervals:[0,2,7] },
  { id:'sus4',  name:'Sus4',                category:'Suspended',  intervals:[0,5,7] },
  // Seventh chords
  { id:'maj7',  name:'Major 7th',           category:'Major',      intervals:[0,4,7,11] },
  { id:'min7',  name:'Minor 7th',           category:'Minor',      intervals:[0,3,7,10] },
  { id:'dom7',  name:'Dominant 7th',        category:'Dominant',   intervals:[0,4,7,10] },
  { id:'dim7',  name:'Diminished 7th',      category:'Diminished', intervals:[0,3,6,9] },
  { id:'hdim7', name:'Half-Dim 7th',        category:'Diminished', intervals:[0,3,6,10] },
  { id:'mmaj7', name:'Minor-Major 7th',     category:'Minor',      intervals:[0,3,7,11] },
  { id:'augM7', name:'Augmented Maj 7th',   category:'Augmented',  intervals:[0,4,8,11] },
  // 6th chords
  { id:'maj6',  name:'Major 6th',           category:'Major',      intervals:[0,4,7,9] },
  { id:'min6',  name:'Minor 6th',           category:'Minor',      intervals:[0,3,7,9] },
  // Add/extended chords
  { id:'add9',  name:'Add9',                category:'Extended',   intervals:[0,4,7,2] },
  { id:'madd9', name:'Minor Add9',          category:'Extended',   intervals:[0,3,7,2] },
  { id:'maj9',  name:'Major 9th',           category:'Extended',   intervals:[0,4,7,11,2] },
  { id:'min9',  name:'Minor 9th',           category:'Extended',   intervals:[0,3,7,10,2] },
  { id:'dom9',  name:'Dominant 9th',        category:'Dominant',   intervals:[0,4,7,10,2] },
];

export const CHORD_CATEGORIES = ['All','Major','Minor','Suspended','Diminished','Augmented','Dominant','Extended','Interval'];

// ── Scale definitions ────────────────────────────────────────────────────────
// top.notes = ring notes (clockwise, not including ding)
// bottom.notes = gu notes (usually empty in standard; users add them)
export const SCALES = [
  { id:'D-Kurd', name:'D Kurd', desc:'The most popular handpan scale. Deep, ethereal minor.',
    top:{ ding:'D3', notes:['A3','Bb3','C4','D4','E4','F4','G4','A4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'D-Celtic-Minor', name:'D Celtic Minor', desc:'Deep Celtic atmosphere. Natural minor feel.',
    top:{ ding:'D3', notes:['A3','C4','D4','E4','F4','G4','A4','C5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'A-Pygmy', name:'A Pygmy', desc:'Meditative African scale. Deep bass, hypnotic groove.',
    top:{ ding:'A2', notes:['E3','F3','G3','A3','C4','D4','E4','G4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'D-Major', name:'D Major', desc:'Bright, uplifting major scale. Full of joy.',
    top:{ ding:'D3', notes:['A3','B3','D4','E4','F#4','A4','B4','D5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'F#-Kurd', name:'F# Kurd', desc:'Higher-pitched Kurd. Bright and expansive minor.',
    top:{ ding:'F#3', notes:['C#4','D4','E4','F#4','G#4','A4','B4','C#5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'C#-Annaziska', name:'C# Annaziska', desc:'Exotic Middle Eastern flavor. Deeply resonant.',
    top:{ ding:'C#3', notes:['G#3','A3','C#4','Eb4','E4','G#4','A4','C#5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-La-Sirena', name:'E La Sirena', desc:'Magical and otherworldly. Floats like a dream.',
    top:{ ding:'E3', notes:['B3','C#4','D4','E4','F#4','G#4','B4','C#5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'G-Minor', name:'G Minor', desc:'Melancholic natural minor. Very expressive.',
    top:{ ding:'G3', notes:['D4','Eb4','F4','G4','A4','Bb4','D5','F5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'B-Kurd', name:'B Kurd', desc:'Rich resonant Kurd with a grounding deep bass.',
    top:{ ding:'B2', notes:['F#3','G3','A3','B3','C#4','D4','E4','F#4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'D-Hijaz', name:'D Hijaz', desc:'Oriental minor with augmented 2nd. Dramatic and ancient.',
    top:{ ding:'D3', notes:['A3','Bb3','C#4','D4','Eb4','F4','G4','A4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-Integral', name:'E Integral', desc:'Harmonically rich. Every note resonates together.',
    top:{ ding:'E3', notes:['B3','C#4','E4','F#4','G#4','B4','C#5','E5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'C#-Minor', name:'C# Minor', desc:'Haunting natural minor. Popular for healing music.',
    top:{ ding:'C#3', notes:['G#3','A3','B3','C#4','Eb4','E4','G#4','B4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'A-Low-Kurd', name:'A Low Kurd', desc:'Deep earthy Kurd in low A. Very grounding.',
    top:{ ding:'A2', notes:['E3','F3','G3','A3','Bb3','C4','D4','E4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'F-Celtic', name:'F Celtic', desc:'Celtic minor in F. Smooth, flowing, introspective.',
    top:{ ding:'F3', notes:['C4','Db4','Eb4','F4','G4','Ab4','C5','Db5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'D-Amara', name:'D Amara', desc:'Dorian-minor blend. Versatile and emotionally rich.',
    top:{ ding:'D3', notes:['A3','B3','C4','D4','E4','F4','A4','C5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'G-Integral', name:'G Integral', desc:'Natural resonant warmth. Like a singing bowl.',
    top:{ ding:'G2', notes:['D3','F3','G3','A3','Bb3','D4','F4','G4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-Aegean', name:'E Aegean', desc:'Mediterranean atmosphere. Haunting and ancient.',
    top:{ ding:'E3', notes:['B3','C4','D4','E4','F4','G4','Ab4','B4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'D-Sabye', name:'D Sabye', desc:'Middle Eastern color with chromatic richness.',
    top:{ ding:'D3', notes:['A3','C4','C#4','D4','F4','G4','A4','C5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'A-Mystic', name:'A Mystic', desc:'Meditative near-whole-tone palette.',
    top:{ ding:'A2', notes:['D3','E3','F#3','A3','B3','C#4','E4','F#4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-Equinox', name:'E Equinox', desc:'Balanced major/minor blend. Bright and versatile.',
    top:{ ding:'E3', notes:['B3','C#4','D4','E4','F#4','G4','B4','D5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },
];

// Build a mutable Layout from a Scale (deep copy with slot wrapping)
export function createLayoutFromScale(scale) {
  return {
    id: scale.id,
    name: scale.name,
    isCustom: false,
    top: {
      ding: scale.top.ding,
      slots: scale.top.notes.map(n => ({ note: n })),
      capacity: scale.top.capacity,
    },
    bottom: {
      slots: Array.from({ length: scale.bottom.capacity }, (_, i) => ({
        note: scale.bottom.notes[i] ?? null,
      })),
      capacity: scale.bottom.capacity,
    },
  };
}

// Collect all non-null notes from a layout (ding + ring + gu)
export function getAllNotes(layout) {
  const notes = [layout.top.ding];
  layout.top.slots.forEach(s => { if (s.note) notes.push(s.note); });
  layout.bottom.slots.forEach(s => { if (s.note) notes.push(s.note); });
  return notes;
}
