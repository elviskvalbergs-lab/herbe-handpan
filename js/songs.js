// Songs to learn: traditional folk songs, melody only.
//
// The tunes are traditional and in the public domain. Each melody was read
// from the score in its Wikipedia article (the source of each song), which
// is published under CC BY-SA 4.0; this file is shared under the same
// licence, with that attribution. The notation was converted by a LilyPond
// reader (docs/design-system.md, "Songs"), not typed from memory.
//
// notes: "C4:0.5 D4:1 r:1 …": note and length in beats (a quarter note is
// 1), r a rest. key and time as the score gives them.
//
// Pure helpers, unit-tested in tests/songs.test.mjs. The screens are in
// js/app.js (songsSectionHtml, viewSong).
import { noteToMidi } from './data.js';

export const SONG_LICENCE = 'Melodies from Wikipedia, CC BY-SA 4.0';
export const SONG_ORIGINS = { de: 'Germany', ie: 'Ireland', 'gb-sct': 'Scotland' };

export const SONGS = [
  {
    id: "alle-meine-entchen", title: "Alle meine Entchen", origin: "de", key: "C major", time: "4/4",
    source: "https://de.wikipedia.org/wiki/Alle_meine_Entchen",
    notes: "C4:0.5 D4:0.5 E4:0.5 F4:0.5 G4:1 G4:1 A4:0.5 A4:0.5 A4:0.5 A4:0.5 G4:2 A4:0.5 A4:0.5 A4:0.5 A4:0.5 G4:2 F4:0.5 F4:0.5 F4:0.5 F4:0.5 E4:1 E4:1 D4:0.5 D4:0.5 D4:0.5 D4:0.5 C4:2",
  },
  {
    id: "haenschen-klein", title: "Hänschen klein", origin: "de", key: "F major", time: "2/4",
    source: "https://de.wikipedia.org/wiki/H%C3%A4nschen_klein",
    notes: "C5:0.5 A4:0.5 A4:1 Bb4:0.5 G4:0.5 G4:1 F4:0.5 G4:0.5 A4:0.5 Bb4:0.5 C5:0.5 C5:0.5 C5:1 C5:0.5 A4:0.5 A4:1 Bb4:0.5 G4:0.5 G4:1 F4:0.5 A4:0.5 C5:0.5 C5:0.5 F4:1 r:1 G4:0.5 G4:0.5 G4:0.5 G4:0.5 G4:0.5 A4:0.5 Bb4:1 A4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:0.5 Bb4:0.5 C5:1 C5:0.5 A4:0.5 A4:1 Bb4:0.5 G4:0.5 G4:1 F4:0.5 A4:0.5 C5:0.5 C5:0.5 F4:2",
  },
  {
    id: "kommt-ein-vogel-geflogen", title: "Kommt ein Vogel geflogen", origin: "de", key: "F major", time: "3/4",
    source: "https://de.wikipedia.org/wiki/Kommt_ein_Vogel_geflogen",
    notes: "A4:0.5 Bb4:0.5 C5:1 A4:1 A4:1 A4:1 G4:1 G4:0.5 A4:0.5 Bb4:1 G4:1 G4:0.5 D5:0.5 C5:1 r:1 A4:0.5 Bb4:0.5 C5:1 A4:1 A4:1 A4:1 G4:1 G4:0.5 A4:0.5 Bb4:1 E4:1 E4:1 F4:1 r:1",
  },
  {
    id: "die-gedanken-sind-frei", title: "Die Gedanken sind frei", origin: "de", key: "C major", time: "3/4",
    source: "https://de.wikipedia.org/wiki/Die_Gedanken_sind_frei",
    notes: "G4:0.5 G4:0.5 C5:1 C5:1 E5:0.5 C5:0.5 G4:2 G4:1 F4:1 D4:1 G4:1 E4:1 C4:1 G4:1 C5:1 C5:1 E5:0.5 C5:0.5 G4:2 G4:1 F4:1 D4:1 G4:1 E4:1 C4:1 C5:1 B4:1 D5:1 D5:1 C5:1 E5:1 E5:1 B4:1 D5:1 D5:1 C5:1 E5:1 C5:1 A4:1 A4:1 C5:0.5 A4:0.5 G4:2 G4:0.5 E5:0.5 E5:0.5 D5:0.5 C5:1 B4:1 C5:2",
  },
  {
    id: "kein-schoener-land", title: "Kein schöner Land in dieser Zeit", origin: "de", key: "A major", time: "3/4",
    source: "https://de.wikipedia.org/wiki/Kein_sch%C3%B6ner_Land_in_dieser_Zeit",
    notes: "E4:0.5 E4:0.5 E4:0.5 A4:1 C#5:1 B4:0.5 A4:0.5 B4:1 r:0.5 E4:0.5 E4:0.5 E4:0.5 A4:1 C#5:1 B4:0.5 A4:0.5 B4:1 r:0.5 C#5:0.5 A4:0.5 B4:0.5 C#5:0.5 E5:0.5 D5:0.5 C#5:0.5 B4:0.5 A4:0.5 B4:0.5 D5:0.5 C#5:0.5 B4:0.5 A4:0.5 B4:0.5 C#5:1 r:0.5 C#5:0.5 A4:0.5 B4:0.5 C#5:0.5 E5:0.5 D5:0.5 C#5:0.5 B4:0.5 A4:0.5 B4:0.5 D5:0.5 C#5:0.5 B4:0.5 A4:0.5 Ab4:0.5 A4:1 r:0.5",
  },
  {
    id: "alle-voegel-sind-schon-da", title: "Alle Vögel sind schon da", origin: "de", key: "D major", time: "4/4",
    source: "https://de.wikipedia.org/wiki/Alle_V%C3%B6gel_sind_schon_da",
    notes: "D4:1.5 F#4:0.5 A4:1 D5:1 B4:1 D5:0.5 B4:0.5 A4:2 G4:1.5 A4:0.5 F#4:1 D4:1 E4:2 D4:1 r:1 A4:1 A4:1 G4:1 G4:1 F#4:1 A4:0.5 F#4:0.5 E4:2 A4:1 A4:1 G4:1 G4:1 F#4:1 A4:0.5 F#4:0.5 E4:2 D4:1.5 F#4:0.5 A4:1 D5:1 B4:1 D5:0.5 B4:0.5 A4:2 G4:1.5 A4:0.5 F#4:1 D4:1 E4:2 D4:1 r:1",
  },
  {
    id: "der-kuckuck-und-der-esel", title: "Der Kuckuck und der Esel", origin: "de", key: "F major", time: "4/4",
    source: "https://de.wikipedia.org/wiki/Der_Kuckuck_und_der_Esel",
    notes: "C5:1 A4:1 C5:1 A4:1 C5:1 Bb4:1 Bb4:1 r:1 Bb4:1 G4:1 Bb4:1 G4:1 Bb4:1 A4:2 r:1 C5:0.5 Bb4:0.5 A4:1 A4:1 A4:1 A4:1 Bb4:1 Bb4:1 r:1 Bb4:0.5 A4:0.5 G4:1 G4:1 G4:1 G4:1 A4:1 A4:1 r:1 F4:1 F4:1 G4:1 A4:1 Bb4:1 C5:1.5 D5:0.5 C5:1 Bb4:1 A4:1 A4:1 G4:1 G4:1 F4:2 r:1",
  },
  {
    id: "summ-summ-summ", title: "Summ, summ, summ", origin: "de", key: "G major", time: "2/4",
    source: "https://de.wikipedia.org/wiki/Summ,_summ,_summ",
    notes: "D5:1 C5:1 B4:1 r:1 A4:0.5 B4:0.5 C5:0.5 A4:0.5 G4:1 r:1 B4:0.5 C5:0.5 D5:0.5 B4:0.5 A4:0.5 B4:0.5 C5:0.5 A4:0.5 B4:0.5 C5:0.5 D5:0.5 B4:0.5 A4:0.5 B4:0.5 C5:0.5 A4:0.5 D5:1 C5:1 B4:1 r:1 A4:0.5 B4:0.5 C5:0.5 A4:0.5 G4:1 r:1",
  },
  {
    id: "kuckuck-kuckuck", title: "Kuckuck, Kuckuck, ruft’s aus dem Wald", origin: "de", key: "G major", time: "3/4",
    source: "https://de.wikipedia.org/wiki/Kuckuck,_Kuckuck,_ruft%E2%80%99s_aus_dem_Wald",
    notes: "D5:1 B4:1 r:1 D5:1 B4:1 r:1 A4:1 G4:1 A4:1 G4:3 A4:1 A4:1 B4:1 C5:2 A4:1 B4:1 B4:1 C5:1 D5:2 B4:1 D5:2 B4:1 D5:2 B4:1 C5:1 B4:1 A4:1 G4:3",
  },
  {
    id: "guter-mond", title: "Guter Mond, du gehst so stille", origin: "de", key: "F major", time: "4/4",
    source: "https://de.wikipedia.org/wiki/Guter_Mond,_du_gehst_so_stille",
    notes: "C5:0.75 Bb4:0.25 A4:1 A4:1 A4:0.5 Bb4:0.5 C5:0.5 D5:0.5 C5:0.75 Bb4:0.25 G4:1 r:1 C5:0.75 Bb4:0.25 A4:1.5 A4:0.5 G4:0.5 F4:0.5 G4:0.5 A4:0.5 F4:2 r:1 C5:0.75 Bb4:0.25 A4:1 A4:1 A4:0.5 Bb4:0.5 C5:0.5 D5:0.5 C5:0.75 Bb4:0.25 G4:1 r:1 C5:0.75 Bb4:0.25 A4:1.5 A4:0.5 G4:0.5 F4:0.5 G4:0.5 A4:0.5 F4:2 r:1 G4:0.75 A4:0.25 Bb4:1 G4:1 r:1 A4:0.75 Bb4:0.25 C5:1 A4:1 r:1 A4:0.5 C5:0.5 D5:1.5 C5:0.5 D5:0.5 C5:0.5 Bb4:0.5 A4:0.5 A4:1 G4:1 r:1 C5:0.75 Bb4:0.25 A4:1 A4:1 A4:0.5 Bb4:0.5 C5:0.5 D5:0.5 C5:0.75 Bb4:0.25 G4:1 r:1 C5:0.75 Bb4:0.25 A4:1.5 A4:0.5 G4:0.5 F4:0.5 G4:0.5 A4:0.5 F4:2 r:1",
  },
  {
    id: "wenn-ich-ein-voeglein-waer", title: "Wenn ich ein Vöglein wär", origin: "de", key: "G major", time: "3/4",
    source: "https://de.wikipedia.org/wiki/Wenn_ich_ein_V%C3%B6glein_w%C3%A4r",
    notes: "G4:1 G4:1 G4:1 B4:1.5 A4:0.5 G4:1 B4:1 B4:1 B4:1 D5:1.5 C5:0.5 B4:1 D5:1 C5:1 B4:1 A4:2 r:1 A4:2 G4:0.5 F#4:0.5 G4:1 A4:1 B4:1 C5:2 B4:0.5 A4:0.5 B4:1 C5:1 D5:1 D5:0.5 C5:0.5 B4:1 A4:1 G4:2 r:1",
  },
  {
    id: "heidenroeslein", title: "Heidenröslein", origin: "de", key: "D major", time: "6/8",
    source: "https://de.wikipedia.org/wiki/Heidenr%C3%B6slein",
    notes: "F#4:1 F#4:0.5 A4:0.75 G4:0.25 F#4:0.5 E4:1 E4:0.5 E4:1.5 F#4:1 F#4:0.5 G4:0.5 A4:0.5 B4:0.5 B4:1.5 A4:1 r:0.5 A4:1 G4:0.5 F#4:1 F#4:0.5 F#4:1 E4:0.5 D4:1.5 D4:1 D4:0.5 D4:0.5 E4:0.5 F#4:0.5 G4:1 F#4:0.5 E4:1 r:0.5 F#4:1 F#4:0.5 A4:0.75 G4:0.25 F#4:0.5 F#4:1.5 E4:1 r:0.5 F#4:1 A4:0.5 B4:1 B4:0.5 A4:0.5 B4:0.5 C#5:0.5 D5:1.5 D5:1 B4:0.5 A4:1 F#4:0.5 E4:0.75 F#4:0.25 E4:0.5 D4:1 r:0.5",
  },
  {
    id: "im-maerzen-der-bauer", title: "Im Märzen der Bauer", origin: "de", key: "B♭ major", time: "3/4",
    source: "https://de.wikipedia.org/wiki/Im_M%C3%A4rzen_der_Bauer",
    notes: "F4:1 Bb4:1 Bb4:1 D5:1 C5:1 C5:1 Eb5:1 A4:1 A4:1 C5:1 Bb4:2 F4:1 Bb4:1 Bb4:1 D5:1 C5:1 C5:1 Eb5:1 A4:1 A4:1 C5:1 Bb4:2 F5:1 C5:1 C5:1 F5:1 D5:1 D5:1 F5:1 Eb5:1 Eb5:1 F5:1 D5:2 F4:1 Bb4:1 Bb4:1 D5:1 C5:1 C5:1 Eb5:1 A4:1 A4:1 C5:1 Bb4:2",
  },
  {
    id: "der-mai-ist-gekommen", title: "Der Mai ist gekommen", origin: "de", key: "D major", time: "3/4",
    source: "https://de.wikipedia.org/wiki/Der_Mai_ist_gekommen",
    notes: "D4:0.5 E4:0.5 F#4:1 F#4:1.5 G4:0.5 B4:1 A4:1.5 F#4:0.5 A4:0.75 G4:0.25 G4:1 A4:1 F#4:2 D4:0.5 E4:0.5 F#4:1 F#4:1.5 G4:0.5 B4:1 A4:1.5 F#4:0.5 A4:0.75 G4:0.25 G4:1 A4:1 F#4:2 F#4:0.75 F#4:0.25 E4:1 A4:1.5 A4:0.5 Ab4:1 B4:1.5 B4:0.5 E5:0.75 D5:0.25 C#5:0.75 B4:0.25 A4:0.75 Ab4:0.25 A4:2 A4:0.5 G4:0.5 F#4:0.75 F#4:0.25 F#4:1.5 G4:0.5 B4:1 A4:1.5 F#4:0.5 A4:0.75 G4:0.25 G4:1 A4:1 F#4:2",
  },
  {
    id: "fuchs-du-hast-die-gans-gestohlen", title: "Fuchs, du hast die Gans gestohlen", origin: "de", key: "D major", time: "4/4",
    source: "https://de.wikipedia.org/wiki/Fuchs,_du_hast_die_Gans_gestohlen",
    notes: "D4:1 E4:1 F#4:1 G4:1 A4:1 A4:1 A4:1 A4:1 B4:1 G4:1 D5:1 B4:1 A4:4 B4:1 G4:1 D5:1 B4:1 A4:4 A4:1 G4:1 G4:1 G4:1 G4:1 F#4:1 F#4:1 F#4:1 F#4:1 E4:1 F#4:1 E4:1 D4:1 F#4:1 A4:2 A4:1 G4:1 G4:1 G4:1 G4:1 F#4:1 F#4:1 F#4:1 F#4:1 E4:1 F#4:1 E4:1 D4:4",
  },
  {
    id: "londonderry-air", title: "Londonderry Air (Danny Boy)", origin: "ie", key: "E♭ major", time: "4/4",
    source: "https://en.wikipedia.org/wiki/Londonderry_Air",
    notes: "D4:0.5 Eb4:0.5 F4:0.5 G4:1.5 F4:0.5 G4:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:0.5 Eb4:0.5 C4:1 r:0.5 Eb4:0.5 G4:0.5 Ab4:0.5 Bb4:1.5 C5:0.5 Bb4:0.5 G4:0.5 Eb4:0.5 G4:0.5 F4:2 r:0.5 D4:0.5 Eb4:0.5 F4:0.5 G4:1.5 F4:0.5 G4:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:0.5 Eb4:0.5 C4:0.5 B3:0.5 C4:0.5 D4:0.5 Eb4:0.5 F4:0.5 G4:1.5 Ab4:0.5 G4:0.5 F4:0.5 Eb4:0.5 F4:0.5 Eb4:2 r:0.5 Bb4:0.5 C5:0.5 D5:0.5 Eb5:1.5 D5:0.5 D5:0.5 C5:0.5 Bb4:0.5 G4:0.5 Bb4:0.5 G4:0.5 Eb4:1 r:0.5 Bb4:0.5 C5:0.5 D5:0.5 Eb5:1.5 D5:0.5 D5:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:2 r:0.5 Bb4:0.5 Bb4:0.5 Bb4:0.5 G5:1.5 F5:0.5 F5:0.5 Eb5:0.5 C5:0.5 Eb5:0.5 Bb4:0.5 G4:0.5 Eb4:1 r:0.5 D4:0.5 Eb4:0.5 F4:0.5 G4:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:0.5 Eb4:0.5 C4:0.5 D4:0.5 Eb4:2.5",
  },
  {
    id: "auld-lang-syne", title: "Auld Lang Syne", origin: "gb-sct", key: "F major", time: "4/4",
    source: "https://en.wikipedia.org/wiki/Auld_Lang_Syne",
    notes: "C4:1 F4:1.5 F4:0.5 F4:1 A4:1 G4:1.5 F4:0.5 G4:1 A4:1 F4:1.5 F4:0.5 A4:1 C5:1 D5:3 D5:1 C5:1.5 A4:0.5 A4:1 F4:1 G4:1.5 F4:0.5 G4:1 A4:1 F4:1.5 D4:0.5 D4:1 C4:1 F4:3 D5:1 C5:1.5 A4:0.5 A4:1 F4:1 G4:1.5 F4:0.5 G4:1 D5:1 C5:1.5 A4:0.5 A4:1 C5:1 D5:3 D5:1 C5:1.5 A4:0.5 A4:1 F4:1 G4:1.5 F4:0.5 G4:1 A4:1 F4:1.5 D4:0.5 D4:1 C4:1 F4:3",
  },
];

/** A song's notes: [{ midi | null, beats }]. */
export function songNotes(song) {
  return song.notes.split(' ').map(t => {
    const [n, b] = t.split(':');
    return { midi: n === 'r' ? null : noteToMidi(n), beats: Number(b) };
  });
}

/** How far to move a song (semitones) so every note is one the instrument
 *  has (have: Set of MIDI numbers), or null when it can't be played. Of the
 *  moves that fit, the one with the fewest notes outside `easy` (an ocarina's
 *  or flute's notes played without half-covering a hole), then the smallest,
 *  up before down. */
export function songShift(song, have, { easy = null } = {}) {
  const midis = songNotes(song).map(n => n.midi).filter(m => m != null);
  const uniq = [...new Set(midis)];
  let best = null;
  for (let d = 0; d <= 24; d++) {
    for (const s of d ? [d, -d] : [0]) {
      if (!uniq.every(m => have.has(m + s))) continue;
      const hard = easy ? midis.filter(m => !easy.has(m + s)).length : 0;
      if (!best || hard < best.hard) best = { s, hard };
      if (!easy || hard === 0) return best.s;
    }
  }
  return best ? best.s : null;
}

/** The songs an instrument can play, each with its move: [{ song, shift }]. */
export function playableSongs(have, songs = SONGS, { easy = null } = {}) {
  return songs.map(song => ({ song, shift: songShift(song, have, { easy }) })).filter(x => x.shift != null);
}

// The key a song is played in on the instrument: its written key moved by shift.
const SONG_KEY_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export function songKeyOn(song, shift) {
  const [root, mode] = song.key.split(' ');
  const pc = noteToMidi(`${root.replace('♭', 'b').replace('♯', '#')}4`) % 12;
  return `${SONG_KEY_NAMES[(pc + shift + 120) % 12]} ${mode}`;
}

/** Songs that go well after this one on the same instrument: the ones in the
 *  same key there first (no change of hand position or retuning), then the
 *  same time (a waltz after a waltz), then from the same country. */
export function songsThatGoTogether(song, playable, limit = 3) {
  const here = playable.find(x => x.song.id === song.id);
  if (!here) return [];
  const key = songKeyOn(song, here.shift);
  const score = x => (songKeyOn(x.song, x.shift) === key ? 4 : 0) + (x.song.time === song.time ? 2 : 0) + (x.song.origin === song.origin ? 1 : 0);
  return playable.filter(x => x.song.id !== song.id).sort((a, b) => score(b) - score(a)).slice(0, limit);
}
