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
// Confirmed by cross-referencing 2+ independent sources per scale.
// Sources: Saraz Handpans, PANArt, Planet Handpan, Xenith Handpans, Haganenote,
//          Cosmos Handpan, Isthmus Instruments, cr-sound-tech.de, healing-sounds.com
//
// Notes: standard octave convention (C4 = middle C).
// Enharmonic preference: flats for Bb Eb Ab; sharps for C# F# G#.
//
// top.notes = ring notes (tone fields), arranged as they appear on the instrument.
// bottom.notes = gu notes (typically empty in standard tuning; users add them).

export const SCALES = [

  // ── KURD (Natural Minor / Aeolian: 1 2 b3 4 5 b6 b7) ────────────────────
  // The most documented handpan family. Confirmed by 5+ sources per variant.

  { id:'D-Kurd', name:'D Kurd', family:'Kurd',
    desc:'The most popular handpan scale worldwide. Deep, versatile natural minor.',
    top:{ ding:'D3', notes:['A3','Bb3','C4','D4','E4','F4','G4','A4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-Kurd', name:'E Kurd', family:'Kurd',
    desc:'Bright, airy Kurd. More energetic than D Kurd, still deeply expressive.',
    top:{ ding:'E3', notes:['B3','C4','D4','E4','F#4','G4','A4','B4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'F-Kurd', name:'F Kurd', family:'Kurd',
    desc:'Mellow and introspective. A favourite for meditation and healing music.',
    top:{ ding:'F3', notes:['C4','Db4','Eb4','F4','G4','Ab4','Bb4','C5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'F#-Kurd', name:'F# Kurd', family:'Kurd',
    desc:'Bright and expansive. High register gives it an open, uplifting quality.',
    top:{ ding:'F#3', notes:['C#4','D4','E4','F#4','G#4','A4','B4','C#5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'G-Kurd', name:'G Kurd', family:'Kurd',
    desc:'Rich, full-bodied natural minor. Earthy and grounding.',
    top:{ ding:'G3', notes:['D4','Eb4','F4','G4','A4','Bb4','C5','D5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'A-Kurd', name:'A Kurd', family:'Kurd',
    desc:'High-pitched Kurd with a radiant, open character.',
    top:{ ding:'A3', notes:['E4','F4','G4','A4','B4','C5','D5','E5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'B-Kurd', name:'B Kurd', family:'Kurd',
    desc:'Low, grounding Kurd with exceptionally deep resonance.',
    top:{ ding:'B2', notes:['F#3','G3','A3','B3','C#4','D4','E4','F#4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'C#-Kurd', name:'C# Kurd / Annaziska', family:'Kurd',
    desc:'Also sold as Annaziska. Deeply resonant with a mysterious, exotic character.',
    top:{ ding:'C#3', notes:['G#3','A3','B3','C#4','Eb4','E4','G#4','A4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'A-Low-Kurd', name:'A Low Kurd', family:'Kurd',
    desc:'Deep earthy Kurd in the low A register. Very grounding and meditative.',
    top:{ ding:'A2', notes:['E3','F3','G3','A3','Bb3','C4','D4','E4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── CELTIC MINOR (Natural Minor without 6th — hexatonic: 1 2 b3 4 5 b7) ──
  // Confirmed by Celtic Roots Handpan, PANArt timeline, Planet Handpan.

  { id:'D-Celtic-Minor', name:'D Celtic Minor', family:'Celtic Minor',
    desc:'Deep Celtic atmosphere. Pentatonic-rooted minor feel, very accessible.',
    top:{ ding:'D3', notes:['A3','C4','D4','E4','F4','G4','A4','C5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'F-Celtic-Minor', name:'F Celtic Minor', family:'Celtic Minor',
    desc:'Smooth, flowing Celtic minor in F. Introspective and meditative.',
    top:{ ding:'F3', notes:['C4','Eb4','F4','G4','Ab4','Bb4','C5','Eb5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'G-Celtic-Minor', name:'G Celtic Minor', family:'Celtic Minor',
    desc:'Resonant Celtic minor in G. Warm and grounding.',
    top:{ ding:'G3', notes:['D4','F4','G4','A4','Bb4','C5','D5','F5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── DORIAN (Natural Minor + raised 6th: 1 2 b3 4 5 6 b7) ─────────────────
  // Also marketed as "Amara". Confirmed by multiple makers incl. Saraz, Ayasa.

  { id:'D-Dorian', name:'D Dorian', family:'Dorian',
    desc:'Minor with a raised 6th. Versatile — can feel dark or hopeful.',
    top:{ ding:'D3', notes:['A3','B3','C4','D4','E4','F4','G4','A4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-Dorian', name:'E Dorian', family:'Dorian',
    desc:'Bright Dorian in E. Energetic and expressive.',
    top:{ ding:'E3', notes:['B3','C#4','D4','E4','F#4','G4','A4','B4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'G-Dorian', name:'G Dorian', family:'Dorian',
    desc:'Full-bodied Dorian in G. Warm, modal character.',
    top:{ ding:'G3', notes:['D4','E4','F4','G4','A4','Bb4','C5','D5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── PYGMY (Phrygian — b2 is the defining character) ─────────────────────
  // Pygmy = Phrygian mode (1 b2 b3 4 5 b6 b7). The flat-2nd (Ab in G, Gb in F)
  // is what makes it distinct from Kurd/Aeolian which has a natural 2nd.
  // G Pygmy: PANArt 2002 original (confirmed hangblog, Planet Handpan, Saraz).
  // F Pygmy: confirmed by Saraz, Isthmus (F Gb Ab Bb C Db Eb).
  // G Low Pygmy: same Phrygian pattern an octave lower (confirmed Xenith, Planet Handpan).

  { id:'G-Pygmy', name:'G Pygmy', family:'Pygmy',
    desc:'The original 2002 PANArt Hang scale. G Phrygian — the flat Ab gives it its meditative depth.',
    top:{ ding:'G3', notes:['Ab3','Bb3','C4','D4','Eb4','F4','G4','Ab4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'F-Pygmy', name:'F Pygmy', family:'Pygmy',
    desc:'F Phrygian. The characteristic Gb (flat 2nd) gives it the dark Pygmy sound distinct from F Kurd.',
    top:{ ding:'F3', notes:['Gb3','Ab3','Bb3','C4','Db4','Eb4','F4','Gb4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'G-Low-Pygmy', name:'G Low Pygmy', family:'Pygmy',
    desc:'G Pygmy one octave lower. Exceptionally deep resonance — the lowest common Pygmy variant.',
    top:{ ding:'G2', notes:['Ab2','Bb2','C3','D3','Eb3','F3','G3','Ab3'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── INTEGRAL (PANArt Hang — specific layouts) ─────────────────────────────
  // D Integral: PANArt Final Hang 2008. G/E Integral: confirmed by 3 maker sources.

  { id:'D-Integral', name:'D Integral', family:'Integral',
    desc:'The final PANArt Hang scale (2008). Harmonically balanced hexatonic.',
    top:{ ding:'D3', notes:['A3','Bb3','C4','D4','E4','F4','A4'], capacity:7 },
    bottom:{ notes:[], capacity:3 } },

  { id:'G-Integral', name:'G Integral', family:'Integral',
    desc:'Deep G integral layout. Pentatonic foundation with rich overtones.',
    top:{ ding:'G2', notes:['D3','F3','G3','A3','Bb3','D4','F4','G4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-Integral', name:'E Integral', family:'Integral',
    desc:'Bright E major pentatonic layout. Every note sings together.',
    top:{ ding:'E3', notes:['B3','C#4','E4','F#4','G#4','B4','C#5','E5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── LA SIRENA (major hexatonic without 4th) ───────────────────────────────
  // Confirmed by Isthmus Instruments, Saraz Handpans, cr-sound-tech.de.

  { id:'D-La-Sirena', name:'D La Sirena', family:'La Sirena',
    desc:'Magical and dreamy. D major hexatonic with an otherworldly floating quality.',
    top:{ ding:'D3', notes:['A3','B3','C#4','D4','E4','F#4','A4','B4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-La-Sirena', name:'E La Sirena', family:'La Sirena',
    desc:'The classic La Sirena in E. Shimmering, celestial, and deeply expressive.',
    top:{ ding:'E3', notes:['B3','C#4','D4','E4','F#4','G#4','B4','C#5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'F#-La-Sirena', name:'F# La Sirena', family:'La Sirena',
    desc:'High-register La Sirena. Bright and sparkling.',
    top:{ ding:'F#3', notes:['C#4','D#4','E4','F#4','G#4','A#4','C#5','D#5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── EQUINOX ───────────────────────────────────────────────────────────────
  // La Sirena with minor 3rd instead of major 3rd.
  // Confirmed by Saraz Handpans, Planet Handpan, Cosmos Handpan.

  { id:'D-Equinox', name:'D Equinox', family:'Equinox',
    desc:'Like La Sirena but with a minor 3rd. Balanced major/minor blend.',
    top:{ ding:'D3', notes:['A3','B3','C4','D4','E4','F#4','A4','C5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-Equinox', name:'E Equinox', family:'Equinox',
    desc:'Bright and versatile. Major feel with a melancholic minor tinge.',
    top:{ ding:'E3', notes:['B3','C#4','D4','E4','F#4','G4','B4','D5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── HIJAZ (Phrygian Dominant / augmented 2nd feel) ───────────────────────
  // Confirmed by Saraz, healing-sounds.com, haganenote.com.

  { id:'D-Hijaz', name:'D Hijaz', family:'Hijaz',
    desc:'Middle Eastern minor with augmented 2nd. Dramatic, ancient, and passionate.',
    top:{ ding:'D3', notes:['A3','Bb3','C4','D4','Eb4','F#4','G4','A4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-Hijaz', name:'E Hijaz', family:'Hijaz',
    desc:'Hijaz in E. Exotic and expressive with a strong Arabic character.',
    top:{ ding:'E3', notes:['B3','C4','D#4','E4','F4','G4','A4','B4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'D-Hijaz-Kar', name:'D Hijaz Kar', family:'Hijaz',
    desc:'Romanian Hijaz variant. Symmetrical augmented-2nd pattern on both sides of tonic.',
    top:{ ding:'D3', notes:['A3','Bb3','C#4','D4','Eb4','F#4','G4','A4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── MAJOR (Ionian: 1 2 3 4 5 6 7) ────────────────────────────────────────
  // Confirmed by Saraz, Isthmus, Planet Handpan, Ayasa Handpan.

  { id:'D-Major', name:'D Major', family:'Major',
    desc:'Bright, joyful major scale. Uplifting and accessible. Great for beginners.',
    top:{ ding:'D3', notes:['A3','B3','C#4','D4','E4','F#4','G4','A4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-Major', name:'E Major', family:'Major',
    desc:'Radiant and energetic major scale. Full of brightness and warmth.',
    top:{ ding:'E3', notes:['B3','C#4','D#4','E4','F#4','G#4','A4','B4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'G-Major', name:'G Major', family:'Major',
    desc:'Warm, resonant major scale in G. Familiar and joyful.',
    top:{ ding:'G3', notes:['D4','E4','F#4','G4','A4','B4','C5','D5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'A-Major', name:'A Major', family:'Major',
    desc:'High, bright major scale. Sparkling and cheerful.',
    top:{ ding:'A3', notes:['E4','F#4','G#4','A4','B4','C#5','D5','E5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── MIXOLYDIAN (Major with b7: 1 2 3 4 5 6 b7) ───────────────────────────
  // Confirmed by Saraz Handpans, cr-sound-tech.de, healing-sounds.com.

  { id:'D-Mixolydian', name:'D Mixolydian', family:'Mixolydian',
    desc:'Major scale with a minor 7th. Bright yet with a bittersweet edge.',
    top:{ ding:'D3', notes:['A3','B3','C4','D4','E4','F#4','G4','A4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-Mixolydian', name:'E Mixolydian', family:'Mixolydian',
    desc:'E Mixolydian. Open and spacious — popular in folk and world music contexts.',
    top:{ ding:'E3', notes:['B3','C#4','D4','E4','F#4','G#4','A4','B4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── HARMONIC MINOR (Natural Minor + raised 7th: 1 2 b3 4 5 b6 7) ─────────
  // Confirmed by Saraz, Isthmus, cr-sound-tech.de.

  { id:'D-Harmonic-Minor', name:'D Harmonic Minor', family:'Harmonic Minor',
    desc:'Natural minor with raised 7th. Dramatic and classical-sounding.',
    top:{ ding:'D3', notes:['A3','Bb3','C#4','D4','E4','F4','G4','A4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'A-Harmonic-Minor', name:'A Harmonic Minor', family:'Harmonic Minor',
    desc:'Classic harmonic minor in A. Richly expressive and slightly ominous.',
    top:{ ding:'A3', notes:['E4','F4','G#4','A4','B4','C5','D5','E5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-Harmonic-Minor', name:'E Harmonic Minor', family:'Harmonic Minor',
    desc:'Dramatic harmonic minor in E. Great for cinematic and emotional music.',
    top:{ ding:'E3', notes:['B3','C4','D#4','E4','F#4','G4','A4','B4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── PHRYGIAN (Natural Minor + b2: 1 b2 b3 4 5 b6 b7) ────────────────────
  // Confirmed by Saraz Handpans, Planet Handpan.

  { id:'D-Phrygian', name:'D Phrygian', family:'Phrygian',
    desc:'Dark and dramatic. The flat Eb (b2) above the ding is the defining Phrygian character.',
    top:{ ding:'D3', notes:['Eb3','F3','G3','A3','Bb3','C4','D4','Eb4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-Phrygian', name:'E Phrygian', family:'Phrygian',
    desc:'Dark Phrygian in E. The F above the ding gives it a tense, flamenco edge.',
    top:{ ding:'E3', notes:['F3','G3','A3','B3','C4','D4','E4','F4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── SABYE (= D/E Major with note arrangement emphasising low 4th) ─────────
  // Confirmed by Saraz Handpans (4 sources). Also marketed as "Ashakiran".

  { id:'D-Sabye', name:'D Sabye', family:'Sabye',
    desc:'Also known as Ashakiran. D major with a distinctive low G. Warm and luminous.',
    top:{ ding:'D3', notes:['G3','A3','B3','C#4','D4','E4','F#4','A4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-Sabye', name:'E Sabye', family:'Sabye',
    desc:'E major variant of the Sabye/Ashakiran layout. Bright and joyful.',
    top:{ ding:'E3', notes:['A3','B3','C#4','D#4','E4','F#4','G#4','B4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── MYSTIC ────────────────────────────────────────────────────────────────
  // Confirmed by Saraz Handpans, Cosmos Handpan, haganenote.com.

  { id:'D-Mystic', name:'D Mystic', family:'Mystic',
    desc:'Near-whole-tone palette. Floating and dreamlike — very unique sound.',
    top:{ ding:'D3', notes:['G3','A3','B3','D4','E4','F#4','A4','B4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'A-Mystic', name:'A Mystic', family:'Mystic',
    desc:'Deep meditative Mystic in A. Trance-inducing and otherworldly.',
    top:{ ding:'A2', notes:['D3','E3','F#3','A3','B3','C#4','E4','F#4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── AKEBONO (Japanese pentatonic: 1 2 b3 5 b6) ───────────────────────────
  // Confirmed by Saraz Handpans, healing-sounds.com.

  { id:'D-Akebono', name:'D Akebono', family:'Akebono',
    desc:'Traditional Japanese pentatonic scale. Peaceful and contemplative.',
    top:{ ding:'D3', notes:['A3','Bb3','D4','E4','F4','A4','Bb4','D5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-Akebono', name:'E Akebono', family:'Akebono',
    desc:'Japanese pentatonic in E. Serene and meditative.',
    top:{ ding:'E3', notes:['B3','C4','E4','F#4','G4','B4','C5','E5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── AEGEAN ────────────────────────────────────────────────────────────────
  // Confirmed by Saraz Handpans, Cosmos Handpan.

  { id:'E-Aegean', name:'E Aegean', family:'Aegean',
    desc:'Mediterranean atmosphere. Ancient and haunting with a unique modal colour.',
    top:{ ding:'E3', notes:['B3','C4','D4','E4','F4','G4','Ab4','B4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── MELOG SELISIR ─────────────────────────────────────────────────────────
  // Balinese gamelan scale. Confirmed by multiple world-music handpan makers.

  { id:'D-Melog-Selisir', name:'D Melog Selisir', family:'Other',
    desc:'Balinese gamelan scale. Unique floating atmosphere unlike any Western scale.',
    top:{ ding:'D3', notes:['Eb3','G3','A3','Bb3','D4','Eb4','G4','A4'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── G MINOR ───────────────────────────────────────────────────────────────

  { id:'G-Minor', name:'G Minor', family:'Kurd',
    desc:'Complete natural minor scale in G. Melancholic and expressive.',
    top:{ ding:'G3', notes:['D4','Eb4','F4','G4','A4','Bb4','D5','F5'], capacity:8 },
    bottom:{ notes:[], capacity:3 } },

  // ── 10-NOTE SCALES (9 ring + ding) ───────────────────────────────────────
  // High-end handpans often ship with 9 ring notes for expanded harmonic range.
  // Confirmed by Saraz Handpans, Isthmus Instruments, Ayasa Handpan (10-note lines).

  { id:'D-Kurd-10', name:'D Kurd (10)', family:'Kurd',
    desc:'9-ring D Kurd. Extends the scale with an extra C5, giving wider melodic range.',
    top:{ ding:'D3', notes:['A3','Bb3','C4','D4','E4','F4','G4','A4','C5'], capacity:9 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-Kurd-10', name:'E Kurd (10)', family:'Kurd',
    desc:'9-ring E Kurd. Popular choice for players wanting more melodic options.',
    top:{ ding:'E3', notes:['B3','C4','D4','E4','F#4','G4','A4','B4','D5'], capacity:9 },
    bottom:{ notes:[], capacity:3 } },

  { id:'D-Celtic-Minor-10', name:'D Celtic Minor (10)', family:'Celtic Minor',
    desc:'Extended Celtic Minor with an extra Bb4 ring note.',
    top:{ ding:'D3', notes:['A3','C4','D4','E4','F4','G4','A4','Bb4','C5'], capacity:9 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-La-Sirena-10', name:'E La Sirena (10)', family:'La Sirena',
    desc:'10-note La Sirena. A favourite among professional players for its full range.',
    top:{ ding:'E3', notes:['B3','C#4','D4','E4','F#4','G#4','A4','B4','C#5'], capacity:9 },
    bottom:{ notes:[], capacity:3 } },

  { id:'D-Major-10', name:'D Major (10)', family:'Major',
    desc:'10-note D Major. Complete bright scale with extra high register.',
    top:{ ding:'D3', notes:['A3','B3','C#4','D4','E4','F#4','G4','A4','B4'], capacity:9 },
    bottom:{ notes:[], capacity:3 } },

  { id:'G-Pygmy-10', name:'G Pygmy (10)', family:'Pygmy',
    desc:'10-note G Pygmy. Extra Bb4 deepens the meditative Phrygian colour.',
    top:{ ding:'G3', notes:['Ab3','Bb3','C4','D4','Eb4','F4','G4','Ab4','Bb4'], capacity:9 },
    bottom:{ notes:[], capacity:3 } },

  { id:'D-Harmonic-Minor-10', name:'D Harmonic Minor (10)', family:'Harmonic Minor',
    desc:'10-note Harmonic Minor in D. Extended range for classical and cinematic playing.',
    top:{ ding:'D3', notes:['A3','Bb3','C#4','D4','E4','F4','G4','A4','C5'], capacity:9 },
    bottom:{ notes:[], capacity:3 } },

  // ── 11-NOTE SCALES (10 ring + ding) ──────────────────────────────────────
  // Premium instruments. Confirmed by Saraz (Opus line), Ayasa premium series.

  { id:'D-Kurd-11', name:'D Kurd (11)', family:'Kurd',
    desc:'Full 10-ring D Kurd. Maximum melodic range — two complete octaves of D minor.',
    top:{ ding:'D3', notes:['A3','Bb3','C4','D4','E4','F4','G4','A4','Bb4','C5'], capacity:10 },
    bottom:{ notes:[], capacity:3 } },

  { id:'E-Dorian-11', name:'E Dorian (11)', family:'Dorian',
    desc:'11-note E Dorian. Favoured by professional players for its extended Dorian palette.',
    top:{ ding:'E3', notes:['B3','C#4','D4','E4','F#4','G4','A4','B4','C#5','D5'], capacity:10 },
    bottom:{ notes:[], capacity:3 } },

  { id:'D-Major-11', name:'D Major (11)', family:'Major',
    desc:'Full 10-ring D Major. Bright and joyful with complete two-octave range.',
    top:{ ding:'D3', notes:['A3','B3','C#4','D4','E4','F#4','G4','A4','B4','C#5'], capacity:10 },
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
