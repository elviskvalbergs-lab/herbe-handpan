// Songs to learn: well-known traditional and public-domain songs from many
// countries (folk, children's, Christmas), melody only, the most familiar first.
//
// The tunes are traditional or long out of copyright (the owner: assume
// public domain unless said otherwise; one known not to be, from the 1930s,
// was left out). Each melody was read
// from the score in its Wikipedia article (the source of each song), which
// is published under CC BY-SA 4.0; this file is shared under the same
// licence, with that attribution. The notation was converted by a LilyPond
// reader (docs/design-system.md, "Songs"), not typed from memory.
//
// notes: "C4:0.5 D4:1 r:1 …": note and length in beats (a quarter note is
// 1), r a rest. key and time as the score gives them. tags: ['christmas'].
//
// Pure helpers, unit-tested in tests/songs.test.mjs. The screens are in
// js/app.js (songsSectionHtml, viewSong).
import { noteToMidi } from './data.js';

export const SONG_LICENCE = 'Melodies from Wikipedia, CC BY-SA 4.0';
export const SONG_ORIGINS = {
  de: 'Germany', at: 'Austria', fr: 'France', it: 'Italy', 'gb-eng': 'England', 'gb-sct': 'Scotland', ie: 'Ireland',
  us: 'USA', mx: 'Mexico', au: 'Australia', il: 'Israel', kr: 'Korea', hu: 'Hungary', cz: 'Czechia', ch: 'Switzerland',
};

export const SONGS = [
  {
    id: "ode-to-joy", title: "Ode to Joy (Freude, schöner Götterfunken)", origin: "de", key: "G major", time: "4/4",
    source: "https://en.wikipedia.org/wiki/Ode_to_Joy",
    notes: "B4:1 B4:1 C5:1 D5:1 D5:1 C5:1 B4:1 A4:1 G4:1 G4:1 A4:1 B4:1 B4:1.5 A4:0.5 A4:2 B4:1 B4:1 C5:1 D5:1 D5:1 C5:1 B4:1 A4:1 G4:1 G4:1 A4:1 B4:1 A4:1.5 G4:0.5 G4:2 A4:1 A4:1 B4:1 G4:1 A4:1 B4:0.5 C5:0.5 B4:1 G4:1 A4:1 B4:0.5 C5:0.5 B4:1 A4:1 G4:1 A4:1 D4:1 B4:2 B4:1 C5:1 D5:1 D5:1 C5:1 B4:1 A4:1 G4:1 G4:1 A4:1 B4:1 A4:1.5 G4:0.5 G4:2",
  },
  {
    id: "twinkle-twinkle", title: "Twinkle, Twinkle, Little Star", origin: "fr", key: "C major", time: "4/4",
    source: "https://en.wikipedia.org/wiki/Twinkle,_Twinkle,_Little_Star",
    notes: "C4:1 C4:1 G4:1 G4:1 A4:1 A4:1 G4:2 F4:1 F4:1 E4:1 E4:1 D4:1 D4:1 C4:2 G4:1 G4:1 F4:1 F4:1 E4:1 E4:1 D4:2 G4:1 G4:1 F4:1 F4:1 E4:1 E4:1 D4:2 C4:1 C4:1 G4:1 G4:1 A4:1 A4:1 G4:2 F4:1 F4:1 E4:1 E4:1 D4:1 D4:1 C4:2",
  },
  {
    id: "happy-birthday", title: "Happy Birthday to You", origin: "us", key: "G major", time: "3/4",
    source: "https://en.wikipedia.org/wiki/Happy_Birthday_to_You",
    notes: "D4:0.75 D4:0.25 E4:1 D4:1 G4:1 F#4:2 D4:0.75 D4:0.25 E4:1 D4:1 A4:1 G4:2 D4:0.75 D4:0.25 D5:1 B4:1 G4:1 F#4:1 E4:1 C5:0.75 C5:0.25 B4:1 G4:1 A4:1 G4:2",
  },
  {
    id: "frere-jacques", title: "Frère Jacques (Bruder Jakob)", origin: "fr", key: "D major", time: "4/4",
    source: "https://de.wikipedia.org/wiki/Bruder_Jakob",
    notes: "D4:1 E4:1 F#4:1 D4:1 D4:1 E4:1 F#4:1 D4:1 F#4:1 G4:1 A4:2 F#4:1 G4:1 A4:2 A4:0.75 B4:0.25 A4:0.5 G4:0.5 F#4:1 D4:1 A4:0.75 B4:0.25 A4:0.5 G4:0.5 F#4:1 D4:1 D4:1 A3:1 D4:2 D4:1 A3:1 D4:2",
  },
  {
    id: "amazing-grace", title: "Amazing Grace", origin: "gb-eng", key: "G major", time: "3/4",
    source: "https://en.wikipedia.org/wiki/Amazing_Grace",
    notes: "D4:1 G4:2 B4:0.5 G4:0.5 B4:2 A4:1 G4:2 E4:1 D4:2 D4:1 G4:2 B4:0.5 G4:0.5 B4:2 A4:1 D5:2 B4:1 D5:1.5 B4:0.5 D5:0.5 B4:0.5 G4:2 D4:1 E4:1.5 G4:0.5 G4:0.5 E4:0.5 D4:2 D4:1 G4:2 B4:0.5 G4:0.5 B4:2 A4:1 G4:3",
  },
  {
    id: "silent-night", title: "Silent Night (Stille Nacht)", origin: "at", key: "D major", time: "6/8", tags: ["christmas"],
    source: "https://en.wikipedia.org/wiki/Silent_Night",
    notes: "A4:0.75 B4:0.25 A4:0.5 F#4:1 r:0.5 A4:0.75 B4:0.25 A4:0.5 F#4:1 r:0.5 E5:0.75 Eb5:0.25 E5:0.5 C#5:1 r:0.5 D5:0.75 C#5:0.25 D5:0.5 A4:1 r:0.5 B4:1 B4:0.5 D5:0.75 C#5:0.25 B4:0.5 A4:0.75 B4:0.25 A4:0.5 F#4:1 r:0.5 B4:1 B4:0.5 D5:0.75 C#5:0.25 B4:0.5 A4:0.75 B4:0.25 A4:0.5 F#4:1 r:0.5 C#5:0.75 C#5:0.25 C#5:0.5 E5:0.75 D5:0.25 C#5:0.5 D5:1.5 F#5:1 r:0.5 D5:0.75 A4:0.25 F#4:0.5 A4:0.75 G4:0.25 E4:0.5 D4:2.5",
  },
  {
    id: "auld-lang-syne", title: "Auld Lang Syne", origin: "gb-sct", key: "F major", time: "4/4",
    source: "https://en.wikipedia.org/wiki/Auld_Lang_Syne",
    notes: "C4:1 F4:1.5 F4:0.5 F4:1 A4:1 G4:1.5 F4:0.5 G4:1 A4:1 F4:1.5 F4:0.5 A4:1 C5:1 D5:3 D5:1 C5:1.5 A4:0.5 A4:1 F4:1 G4:1.5 F4:0.5 G4:1 A4:1 F4:1.5 D4:0.5 D4:1 C4:1 F4:3 D5:1 C5:1.5 A4:0.5 A4:1 F4:1 G4:1.5 F4:0.5 G4:1 D5:1 C5:1.5 A4:0.5 A4:1 C5:1 D5:3 D5:1 C5:1.5 A4:0.5 A4:1 F4:1 G4:1.5 F4:0.5 G4:1 A4:1 F4:1.5 D4:0.5 D4:1 C4:1 F4:3",
  },
  {
    id: "londonderry-air", title: "Londonderry Air (Danny Boy)", origin: "ie", key: "E♭ major", time: "4/4",
    source: "https://en.wikipedia.org/wiki/Londonderry_Air",
    notes: "D4:0.5 Eb4:0.5 F4:0.5 G4:1.5 F4:0.5 G4:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:0.5 Eb4:0.5 C4:1 r:0.5 Eb4:0.5 G4:0.5 Ab4:0.5 Bb4:1.5 C5:0.5 Bb4:0.5 G4:0.5 Eb4:0.5 G4:0.5 F4:2 r:0.5 D4:0.5 Eb4:0.5 F4:0.5 G4:1.5 F4:0.5 G4:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:0.5 Eb4:0.5 C4:0.5 B3:0.5 C4:0.5 D4:0.5 Eb4:0.5 F4:0.5 G4:1.5 Ab4:0.5 G4:0.5 F4:0.5 Eb4:0.5 F4:0.5 Eb4:2 r:0.5 Bb4:0.5 C5:0.5 D5:0.5 Eb5:1.5 D5:0.5 D5:0.5 C5:0.5 Bb4:0.5 G4:0.5 Bb4:0.5 G4:0.5 Eb4:1 r:0.5 Bb4:0.5 C5:0.5 D5:0.5 Eb5:1.5 D5:0.5 D5:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:2 r:0.5 Bb4:0.5 Bb4:0.5 Bb4:0.5 G5:1.5 F5:0.5 F5:0.5 Eb5:0.5 C5:0.5 Eb5:0.5 Bb4:0.5 G4:0.5 Eb4:1 r:0.5 D4:0.5 Eb4:0.5 F4:0.5 G4:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:0.5 Eb4:0.5 C4:0.5 D4:0.5 Eb4:2.5",
  },
  {
    id: "bella-ciao", title: "Bella ciao", origin: "it", key: "D minor", time: "4/4",
    source: "https://en.wikipedia.org/wiki/Bella_ciao",
    notes: "A3:0.5 D4:0.5 E4:0.5 F4:0.5 D4:2 A3:0.5 D4:0.5 E4:0.5 F4:0.5 D4:2 A3:0.5 D4:0.5 E4:0.5 F4:1 E4:0.5 D4:0.5 F4:1 E4:0.5 D4:0.5 A4:1 A4:1 A4:0.5 A4:0.5 G4:0.5 A4:0.5 Bb4:0.5 Bb4:2 Bb4:0.5 A4:0.5 G4:0.5 Bb4:0.5 A4:2 A4:0.5 G4:0.5 F4:0.5 E4:1 A4:1 F4:1 E4:1 D4:2",
  },
  {
    id: "hava-nagila", title: "Hava Nagila", origin: "il", key: "G minor", time: "4/4",
    source: "https://en.wikipedia.org/wiki/Hava_Nagila",
    notes: "D4:1 D4:1.5 F#4:0.5 Eb4:0.5 D4:0.5 F#4:1 F#4:1.5 A4:0.5 G4:0.5 F#4:0.5 G4:1 G4:1.5 Bb4:0.5 A4:0.5 G4:0.5 F#4:1 Eb4:0.25 D4:0.25 Eb4:0.5 D4:2 D4:1 D4:1.5 F#4:0.5 Eb4:0.5 D4:0.5 F#4:1 F#4:1.5 A4:0.5 G4:0.5 F#4:0.5 G4:1 G4:1.5 Bb4:0.5 A4:0.5 G4:0.5 F#4:1 Eb4:0.25 D4:0.25 Eb4:0.5 D4:2 F#4:0.5 F#4:1 Eb4:0.5 D4:0.5 D4:0.5 D4:1 Eb4:0.5 Eb4:1 D4:0.5 C4:0.5 C4:0.5 C4:1 C4:1 Eb4:0.75 D4:0.25 C4:0.5 C4:0.5 G4:1 F#4:1 Eb4:0.25 D4:0.25 Eb4:0.5 D4:2 F#4:0.5 F#4:1 Eb4:0.5 D4:0.5 D4:0.5 D4:1 Eb4:0.5 Eb4:1 D4:0.5 C4:0.5 C4:0.5 C4:1 C4:1 Eb4:0.75 D4:0.25 C4:0.5 C4:0.5 G4:1 F#4:1 Eb4:0.25 D4:0.25 Eb4:0.5 D4:2 G4:2 G4:2 G4:1 G4:1 G4:1 G4:1 G4:0.5 G4:0.5 Bb4:0.75 A4:0.25 G4:0.5 Bb4:0.5 A4:0.5 G4:0.5 G4:0.5 G4:0.5 Bb4:0.75 A4:0.25 G4:0.5 Bb4:0.5 A4:0.5 G4:0.5 A4:0.5 A4:0.5 C5:0.75 Bb4:0.25 A4:0.5 C5:0.5 Bb4:0.5 A4:0.5 A4:0.5 A4:0.5 C5:0.75 Bb4:0.25 A4:0.5 C5:0.5 Bb4:0.5 A4:0.5 A4:0.5 A4:0.5 D5:1 D4:0.5 D4:0.5 D5:1 r:0.5 D4:0.5 D4:0.5 D4:0.5 Bb4:0.5 A4:0.5 G4:0.5 F#4:0.5 G4:3",
  },
  {
    id: "la-cucaracha", title: "La Cucaracha", origin: "mx", key: "F major", time: "3/4",
    source: "https://en.wikipedia.org/wiki/La_Cucaracha",
    notes: "C4:0.5 C4:0.5 F4:0.5 F4:0.5 A4:0.5 A4:0.5 C5:1 A4:2 C5:0.5 D5:0.5 C5:0.5 Bb4:0.5 A4:0.5 C5:0.5 Bb4:1 G4:2 C4:0.5 C4:0.5 E4:0.5 E4:0.5 G4:0.5 G4:0.5 Bb4:1 G4:2 C5:0.5 D5:0.5 C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 A4:1 F4:2 C4:0.5 C4:0.5 F4:0.5 F4:0.5 A4:0.5 A4:0.5 C5:1 A4:2 C5:0.5 D5:0.5 C5:0.5 Bb4:0.5 A4:0.5 C5:0.5 Bb4:1 G4:2 C4:0.5 C4:0.5 E4:0.5 E4:0.5 G4:0.5 G4:0.5 Bb4:1 G4:2 C5:0.5 D5:0.5 C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 A4:1 F4:2",
  },
  {
    id: "drunken-sailor", title: "Drunken Sailor", origin: "gb-eng", key: "D minor", time: "2/4",
    source: "https://de.wikipedia.org/wiki/What_Shall_We_Do_with_the_Drunken_Sailor%3F",
    notes: "A4:0.5 A4:0.25 A4:0.25 A4:0.5 A4:0.25 A4:0.25 A4:0.5 D4:0.5 F4:0.5 A4:0.5 G4:0.5 G4:0.25 G4:0.25 G4:0.5 G4:0.25 G4:0.25 G4:0.5 C4:0.5 E4:0.5 G4:0.5 A4:0.5 A4:0.25 A4:0.25 A4:0.5 A4:0.25 A4:0.25 A4:0.5 B4:0.5 C5:0.5 D5:0.5 C5:0.5 A4:0.5 G4:0.5 E4:0.5 D4:1 D4:1 A4:1 A4:0.75 A4:0.25 A4:0.5 D4:0.5 F4:0.5 A4:0.5 G4:1 G4:0.75 G4:0.25 G4:0.5 C4:0.5 E4:0.5 G4:0.5 A4:1 A4:0.75 A4:0.25 A4:0.5 B4:0.5 C5:0.5 D5:0.5 C5:0.5 A4:0.5 G4:0.5 E4:0.5 D4:1 D4:1",
  },
  {
    id: "my-bonnie", title: "My Bonnie Lies over the Ocean", origin: "gb-sct", key: "G major", time: "3/4",
    source: "https://en.wikipedia.org/wiki/My_Bonnie_Lies_over_the_Ocean",
    notes: "D4:1 B4:1 A4:1 G4:1 A4:1 G4:1 E4:1 D4:1 B3:4 D4:1 B4:1 A4:1 G4:1 G4:1 F#4:1 G4:1 A4:5 D4:1 B4:1 A4:1 G4:1 A4:1 G4:1 E4:1 D4:1 B3:4 D4:1 E4:1 A4:1 G4:1 F#4:1 E4:1 F#4:1 G4:5 r:1 D4:3 G4:3 E4:3 A4:3 F#4:1 F#4:1 F#4:1 F#4:1 E4:1 F#4:1 G4:2 A4:1 B4:3 D4:3 G4:3 E4:3 A4:3 F#4:1 F#4:1 F#4:1 F#4:1 E4:1 F#4:1 G4:6",
  },
  {
    id: "red-river-valley", title: "Red River Valley", origin: "us", key: "G major", time: "4/4",
    source: "https://en.wikipedia.org/wiki/Red_River_Valley_(song)",
    notes: "D4:0.5 G4:0.5 B4:1 B4:0.5 B4:0.5 B4:1 A4:0.5 B4:0.5 A4:1 G4:2 B4:0.5 B4:0.5 B4:1 G4:0.5 B4:0.5 D5:1 C5:0.5 B4:0.5 A4:3 D5:0.5 C5:0.5 B4:1 B4:0.5 A4:0.5 G4:1 A4:0.5 B4:0.5 D5:1 C5:2 E4:0.5 E4:0.5 D4:1 F#4:0.5 G4:0.5 A4:1 B4:0.5 A4:0.5 G4:4",
  },
  {
    id: "brahms-lullaby", title: "Brahms’ Lullaby (Guten Abend, gut’ Nacht)", origin: "de", key: "E♭ major", time: "3/4",
    source: "https://en.wikipedia.org/wiki/Brahms'_Lullaby",
    notes: "G4:0.5 G4:0.5 Bb4:1.5 G4:0.5 G4:1 Bb4:1 r:1 G4:0.5 Bb4:0.5 Eb5:1 D5:1.5 C5:0.5 C5:1 Bb4:1 F4:0.5 G4:0.5 Ab4:1 F4:1 F4:0.5 G4:0.5 Ab4:1 r:1 F4:0.5 Ab4:0.5 D5:0.5 C5:0.5 Bb4:1 D5:1 Eb5:1 r:1 Eb4:0.5 Eb4:0.5 Eb5:2 C5:0.5 Ab4:0.5 Bb4:2 G4:0.5 Eb4:0.5 Ab4:1 Bb4:1 C5:1 Bb4:2 Eb4:0.5 Eb4:0.5 Eb5:2 C5:0.5 Ab4:0.5 Bb4:2 G4:0.5 Eb4:0.5 Bb3:0.25 Ab3:0.25 G3:1 F3:1 Eb3:2",
  },
  {
    id: "joy-to-the-world", title: "Joy to the World", origin: "gb-eng", key: "D major", time: "2/4", tags: ["christmas"],
    source: "https://en.wikipedia.org/wiki/Joy_to_the_World",
    notes: "D5:1 C#5:0.75 B4:0.25 A4:1.5 G4:0.5 F#4:1 E4:1 D4:1.5 A4:0.5 B4:1.5 B4:0.5 C#5:1.5 C#5:0.5 D5:3.5 D5:0.5 D5:0.5 C#5:0.5 B4:0.5 A4:0.5 A4:0.75 G4:0.25 F#4:0.5 D5:0.5 D5:0.5 C#5:0.5 B4:0.5 A4:0.5 A4:0.75 G4:0.25 F#4:0.5 F#4:0.5 F#4:0.5 F#4:0.5 F#4:0.5 F#4:0.25 G4:0.25 A4:1.5 G4:0.25 F#4:0.25 E4:0.5 E4:0.5 E4:0.5 E4:0.25 F#4:0.25 G4:1.5 F#4:0.25 E4:0.25 F#4:0.5 D5:1 B4:0.5 A4:0.75 G4:0.25 F#4:0.5 G4:0.5 F#4:1 E4:1 D4:2",
  },
  {
    id: "au-clair-de-la-lune", title: "Au clair de la lune", origin: "fr", key: "C major", time: "2/2",
    source: "https://fr.wikipedia.org/wiki/Au_clair_de_la_lune",
    notes: "C5:1 C5:1 C5:1 D5:1 E5:2 D5:2 C5:1 E5:1 D5:1 D5:1 C5:4 C5:1 C5:1 C5:1 D5:1 E5:2 D5:2 C5:1 E5:1 D5:1 D5:1 C5:4 D5:1 D5:1 D5:1 D5:1 A4:2 A4:2 D5:1 C5:1 B4:1 A4:1 G4:4 C5:1 C5:1 C5:1 D5:1 E5:2 D5:2 C5:1 E5:1 D5:1 D5:1 C5:4",
  },
  {
    id: "arirang", title: "Arirang", origin: "kr", key: "F major", time: "9/8",
    source: "https://en.wikipedia.org/wiki/Arirang",
    notes: "C4:2.5 D4:0.5 C4:1 D4:0.5 F4:2.5 G4:0.5 F4:1 G4:0.5 A4:1.5 G4:0.5 A4:0.5 G4:0.5 F4:1 D4:0.5 C4:2.5 D4:0.5 C4:0.5 D4:0.5 r:0.5 F4:2.5 G4:0.5 F4:1 G4:0.5 A4:1 G4:0.5 F4:1 D4:0.5 C4:1 D4:0.5 F4:2.5 G4:0.5 F4:1.5 F4:3 r:1.5 C5:3 C5:1.5 C5:1.5 A4:1.5 G4:1.5 A4:1.5 G4:1 A4:0.5 F4:1 D4:0.5 C4:2.5 D4:0.5 C4:0.5 D4:0.5 r:0.5 F4:2.5 G4:0.5 F4:1 G4:0.5 A4:1 G4:0.5 F4:1 D4:0.5 C4:1 D4:0.5 F4:2.5 G4:0.5 F4:1.5 F4:3",
  },
  {
    id: "waltzing-matilda", title: "Waltzing Matilda", origin: "au", key: "F major", time: "4/4",
    source: "https://en.wikipedia.org/wiki/Waltzing_Matilda",
    notes: "A4:0.75 A4:0.25 A4:0.5 A4:0.5 G4:1 G4:1 F4:1 A4:0.5 F4:0.5 D4:0.5 E4:0.5 F4:1 C4:1 F4:0.75 A4:0.25 C5:1 C5:0.5 C5:0.5 C5:0.5 C5:0.5 C5:1 C5:0.5 r:0.5 F4:0.5 G4:0.5 A4:1 A4:0.5 A4:0.5 G4:1 G4:1 F4:0.5 G4:0.5 A4:0.5 F4:0.5 D4:0.5 E4:0.5 F4:1 C4:1 F4:0.75 A4:0.25 C5:1 Bb4:0.5 A4:0.5 G4:1 G4:0.5 G4:0.5 F4:1 r:1 C5:1 C5:0.75 C5:0.25 C5:1 A4:1 F5:1 F5:0.75 E5:0.25 D5:1 C5:1 C5:1 C5:0.75 C5:0.25 D5:1 C5:0.75 C5:0.25 C5:1 Bb4:0.5 A4:0.5 G4:0.5 r:0.5 F4:0.5 G4:0.5 A4:1 A4:0.5 A4:0.5 G4:1 G4:1 F4:0.5 G4:0.5 A4:0.5 F4:0.5 D4:0.5 E4:0.5 F4:1 C4:1 F4:0.75 A4:0.25 C5:1 Bb4:0.5 A4:0.5 G4:1 G4:0.5 G4:0.5 F4:1",
  },
  {
    id: "skye-boat-song", title: "Skye Boat Song", origin: "gb-sct", key: "G major", time: "6/8",
    source: "https://en.wikipedia.org/wiki/Skye_Boat_Song",
    notes: "D4:0.75 E4:0.25 D4:0.5 G4:1 G4:0.25 G4:0.25 A4:0.75 B4:0.25 A4:0.5 D5:1.5 B4:0.75 A4:0.25 B4:0.5 E4:1 E4:0.5 D4:1.5 r:1.5 D4:0.75 E4:0.25 D4:0.5 G4:1 G4:0.5 A4:0.75 B4:0.25 A4:0.5 D5:1.5 B4:0.75 A4:0.25 B4:0.5 E4:1 E4:0.5 G4:3 B4:0.5 G4:0.5 B4:0.5 B4:1.5 A4:0.5 E4:0.5 A4:0.5 A4:1.5 G4:0.5 E4:0.5 G4:0.5 G4:1 G4:0.5 E4:3 B4:0.5 G4:0.5 B4:0.5 B4:1.5 A4:0.5 E4:0.5 A4:0.5 A4:1.5 G4:0.5 E4:0.5 G4:0.5 G4:1 G4:0.5 E4:1.5 D4:1.5",
  },
  {
    id: "malbrough", title: "For He’s a Jolly Good Fellow (Malbrough s’en va-t-en guerre)", origin: "fr", key: "G major", time: "6/8",
    source: "https://fr.wikipedia.org/wiki/Malbrough_s'en_va-t-en_guerre",
    notes: "D4:0.5 B4:1 B4:0.5 B4:1 A4:0.5 C5:1.5 B4:0.5 C5:0.5 B4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:0.5 G4:0.5 A4:0.5 B4:1.5 G4:1 D4:0.5 B4:1 B4:0.5 B4:1 A4:0.5 C5:1.5 B4:1 D5:0.5 B4:1 G4:0.5 A4:1 A4:0.5 G4:2.5 D5:0.5 D5:1 B4:0.5 E5:1 E5:0.5 D5:1.5 D5:1.5 D5:1 B4:0.5 E5:1 E5:0.5 D5:2.5",
  },
  {
    id: "row-your-boat", title: "Row, Row, Row Your Boat", origin: "us", key: "C major", time: "6/8",
    source: "https://en.wikipedia.org/wiki/Row,_Row,_Row_Your_Boat",
    notes: "C4:1.5 C4:1.5 C4:1 D4:0.5 E4:1.5 E4:1 D4:0.5 E4:1 F4:0.5 G4:3 C5:0.5 C5:0.5 C5:0.5 G4:0.5 G4:0.5 G4:0.5 E4:0.5 E4:0.5 E4:0.5 C4:0.5 C4:0.5 C4:0.5 G4:1 F4:0.5 E4:1 D4:0.5 C4:3",
  },
  {
    id: "london-bridge", title: "London Bridge Is Falling Down", origin: "gb-eng", key: "F major", time: "2/4",
    source: "https://en.wikipedia.org/wiki/London_Bridge_Is_Falling_Down",
    notes: "C5:0.75 D5:0.25 C5:0.5 Bb4:0.5 A4:0.5 Bb4:0.5 C5:1 G4:0.5 A4:0.5 Bb4:1 A4:0.5 Bb4:0.5 C5:1 C5:0.75 D5:0.25 C5:0.5 Bb4:0.5 A4:0.5 Bb4:0.5 C5:1 G4:1 C5:1 A4:0.5 F4:1.5",
  },
  {
    id: "o-du-froehliche", title: "O du fröhliche", origin: "de", key: "C major", time: "2/2", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/O_du_fr%C3%B6hliche",
    notes: "G4:2 A4:2 G4:1.5 F4:0.5 E4:1 F4:1 G4:2 A4:2 G4:1.5 F4:0.5 E4:1 F4:1 G4:2 G4:2 A4:2 B4:1 C5:1 B4:2 A4:2 G4:4 D4:1.5 E4:0.5 D4:1 E4:1 F4:1.5 G4:0.5 F4:2 E4:1.5 F4:0.5 E4:1 F4:1 G4:1.5 A4:0.5 G4:2 C5:1 B4:1 A4:1 G4:1 C5:1 A4:1 G4:1 F4:1 E4:2 D4:2 C4:4",
  },
  {
    id: "kling-gloeckchen", title: "Kling, Glöckchen, klingelingeling", origin: "de", key: "F major", time: "2/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Kling,_Gl%C3%B6ckchen,_klingelingeling",
    notes: "C5:1 A4:0.5 Bb4:0.5 C5:0.25 D5:0.25 C5:0.25 D5:0.25 C5:1 Bb4:1 G4:0.5 C5:0.5 A4:2 G4:0.5 G4:0.5 A4:0.5 F4:0.5 A4:1 G4:1 Bb4:0.5 Bb4:0.5 C5:0.5 G4:0.5 Bb4:1 A4:1 G4:0.5 G4:0.5 A4:0.5 B4:0.5 C5:1 G4:1 A4:0.5 D5:0.5 C5:0.5 B4:0.5 D5:1 C5:1 C5:1 A4:0.5 Bb4:0.5 C5:0.25 D5:0.25 C5:0.25 D5:0.25 C5:1 Bb4:1 G4:0.5 C5:0.5 A4:2",
  },
  {
    id: "we-three-kings", title: "We Three Kings", origin: "us", key: "D minor", time: "6/8", tags: ["christmas"],
    source: "https://fr.wikipedia.org/wiki/We_Three_Kings",
    notes: "A4:1 G4:0.5 F4:1 D4:0.5 E4:0.5 F4:0.5 E4:0.5 D4:1.5 A4:1 G4:0.5 F4:1 D4:0.5 E4:0.5 F4:0.5 E4:0.5 D4:1.5 F4:1 F4:0.5 G4:1 G4:0.5 A4:1 A4:0.5 C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 A4:0.5 G4:0.5 F4:1 E4:0.5 D4:1.5 E4:1.5 F4:1 F4:0.5 F4:1 C4:0.5 F4:1 D4:0.5 F4:1.5 F4:1 F4:0.5 F4:1 C4:0.5 F4:1 D4:0.5 F4:1.5 F4:1 F4:0.5 G4:1 A4:0.5 Bb4:1 A4:0.5 G4:1 A4:0.5 F4:1 F4:0.5 F4:1 D4:0.5 F4:1 D4:0.5 F4:1.5",
  },
  {
    id: "o-little-town-of-bethlehem", title: "O Little Town of Bethlehem", origin: "us", key: "G major", time: "4/4", tags: ["christmas"],
    source: "https://fr.wikipedia.org/wiki/O_Little_Town_of_Bethlehem",
    notes: "B4:1 B4:1 B4:1 Bb4:1 B4:1 D5:1 C5:1 E4:1 A4:1 G4:1 F#4:0.5 G4:0.5 A4:1 D4:1 B4:3 B4:1 B4:1 B4:1 E5:1 D5:1 D5:1 C5:1 E4:1 A4:1 G4:1 F#4:0.5 G4:0.5 B4:1 A4:1 G4:3 B4:1 B4:1 B4:1 A4:1 G4:1 F#4:2 F#4:1 F#4:1 E4:1 F#4:1 G4:1 A4:1 B4:3 B4:1 B4:1 B4:1 Bb4:1 B4:1 D5:1 C5:1 E4:1 E5:1 D5:1 G4:1 B4:1.5 A4:0.5 G4:3",
  },
  {
    id: "hark-the-herald", title: "Hark! The Herald Angels Sing", origin: "gb-eng", key: "F major", time: "4/4", tags: ["christmas"],
    source: "https://en.wikipedia.org/wiki/Hark!_The_Herald_Angels_Sing",
    notes: "C4:1 F4:1 F4:1.5 E4:0.5 F4:1 A4:1 A4:1 G4:1 C5:1 C5:1 C5:1.5 Bb4:0.5 A4:1 G4:1 A4:2 C4:1 F4:1 F4:1.5 E4:0.5 F4:1 A4:1 A4:1 G4:1 C5:1 G4:1 G4:1.5 E4:0.5 E4:1 D4:1 C4:2 C5:1 C5:1 C5:1 F4:1 Bb4:1 A4:1 A4:1 G4:1 C5:1 C5:1 C5:1 F4:1 Bb4:1 A4:1 A4:1 G4:1 D5:1 D5:1 D5:1 C5:1 Bb4:1 A4:1 Bb4:2 G4:1 A4:0.5 Bb4:0.5 C5:1.5 F4:0.5 F4:1 G4:1 A4:2 D5:1.5 D5:0.5 D5:1 C5:1 Bb4:1 A4:1 Bb4:2 G4:1 A4:0.5 Bb4:0.5 C5:1.5 F4:0.5 F4:1 G4:1 F4:2",
  },
  {
    id: "away-in-a-manger", title: "Away in a Manger", origin: "us", key: "F major", time: "3/4", tags: ["christmas"],
    source: "https://en.wikipedia.org/wiki/Away_in_a_Manger",
    notes: "C5:1 C5:1.5 Bb4:0.5 A4:1 A4:1.5 G4:0.5 F4:1 F4:1 E4:1 D4:1 C4:2 C4:1 C4:1.5 D4:0.5 C4:1 C4:1 G4:1 E4:1 D4:1 C4:1 F4:1 A4:2 C5:1 C5:1.5 Bb4:0.5 A4:1 A4:1.5 G4:0.5 F4:1 F4:1 E4:1 D4:1 C4:2 C4:1 Bb4:1.5 A4:0.5 G4:1 A4:1 G4:1 F4:1 G4:1 D4:1 E4:1 F4:2",
  },
  {
    id: "god-rest-ye", title: "God Rest Ye Merry, Gentlemen", origin: "gb-eng", key: "E minor", time: "4/4", tags: ["christmas"],
    source: "https://en.wikipedia.org/wiki/God_Rest_Ye_Merry,_Gentlemen",
    notes: "E4:1 E4:1 B4:1 B4:1 A4:1 G4:1 F#4:1 E4:1 D4:1 E4:1 F#4:1 G4:1 A4:1 B4:3 E4:1 E4:1 B4:1 B4:1 A4:1 G4:1 F#4:1 E4:1 D4:1 E4:1 F#4:1 G4:1 A4:1 B4:3 B4:1 C5:1 A4:1 B4:1 C5:1 D5:1 E5:1 B4:1 A4:1 G4:1 E4:1 F#4:1 G4:1 A4:2 G4:1 A4:1 B4:2 C5:1 B4:1 B4:1 A4:1 G4:1 F#4:1 E4:2 G4:0.5 F#4:0.5 E4:1 A4:2 G4:1 A4:1 B4:1 C5:1 D5:1 E5:1 B4:1 A4:1 G4:1 F#4:1 E4:3",
  },
  {
    id: "ding-dong-merrily", title: "Ding Dong Merrily on High", origin: "gb-eng", key: "B♭ major", time: "4/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Ding!_Dong!_Merrily_on_High",
    notes: "Bb4:1 Bb4:1 C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 F4:3 F4:1 G4:1 Bb4:1 Bb4:1 A4:1 Bb4:2 Bb4:2 Bb4:1 Bb4:1 C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 F4:3 F4:1 G4:1 Bb4:1 Bb4:1 A4:1 Bb4:2 Bb4:2 F5:1.5 Eb5:0.5 D5:0.5 Eb5:0.5 F5:0.5 D5:0.5 Eb5:1.5 D5:0.5 C5:0.5 D5:0.5 Eb5:0.5 C5:0.5 D5:1.5 C5:0.5 Bb4:0.5 C5:0.5 D5:0.5 Bb4:0.5 C5:1.5 Bb4:0.5 A4:0.5 Bb4:0.5 C5:0.5 A4:0.5 Bb4:1.5 A4:0.5 G4:0.5 A4:0.5 Bb4:0.5 G4:0.5 A4:1.5 G4:0.5 F4:1 F4:1 G4:1 Bb4:1 Bb4:1 A4:1 Bb4:2 Bb4:2",
  },
  {
    id: "in-dulci-jubilo", title: "In dulci jubilo", origin: "de", key: "F major", time: "3/4", tags: ["christmas"],
    source: "https://fr.wikipedia.org/wiki/In_dulci_jubilo",
    notes: "F4:1 F4:2 F4:1 A4:2 Bb4:1 C5:2 D5:1 C5:3 F4:2 F4:1 A4:2 Bb4:1 C5:2 D5:1 C5:3 C5:2 D5:1 C5:2 Bb4:1 A4:1.5 Bb4:0.5 A4:0.5 G4:0.5 F4:2 F4:1 G4:2 G4:1 A4:2 G4:1 F4:2 G4:1 A4:3 C5:2 D5:1 C5:2 Bb4:1 A4:1.5 Bb4:0.5 A4:0.5 G4:0.5 F4:2 F4:1 G4:2 G4:1 A4:2 G4:1 F4:2 G4:1 A4:3 D4:2 D4:1 E4:2 E4:1 F4:0.5 E4:0.5 F4:0.5 G4:0.5 A4:0.5 Bb4:0.5 C5:3 A4:2 A4:1 G4:2 G4:1 F4:5",
  },
  {
    id: "it-came-upon-the-midnight-clear", title: "It Came Upon the Midnight Clear", origin: "us", key: "B♭ major", time: "6/8", tags: ["christmas"],
    source: "https://fr.wikipedia.org/wiki/It_Came_Upon_the_Midnight_Clear",
    notes: "F4:0.5 D5:1 A4:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:1 G4:0.5 F4:1 F4:0.5 G4:0.5 A4:0.5 Bb4:0.5 Bb4:0.5 C5:0.5 D5:0.5 C5:2.5 F4:0.5 D5:1 A4:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:1 G4:0.5 F4:1 F4:0.5 G4:1 G4:0.5 A4:0.5 G4:0.5 F4:0.5 Bb4:2.5 D5:0.5 D5:1 D4:0.5 D4:0.5 E4:0.5 F#4:0.5 G4:1 A4:0.5 Bb4:1 D5:0.5 C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 A4:0.5 G4:0.5 F4:2.5 F4:0.5 D5:1 A4:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:1 G4:0.5 F4:1 F4:0.5 G4:1 G4:0.5 A4:0.5 G4:0.5 F4:0.5 Bb4:2.5",
  },
  {
    id: "leise-rieselt-der-schnee", title: "Leise rieselt der Schnee", origin: "de", key: "G major", time: "6/8", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Leise_rieselt_der_Schnee",
    notes: "B4:1 B4:0.5 A4:0.5 B4:0.5 A4:0.5 G4:2.5 r:0.5 G4:1 E4:0.5 G4:0.5 F#4:0.5 E4:0.5 D4:2.5 r:0.5 A4:0.5 Ab4:0.5 A4:0.5 C5:0.5 B4:0.5 A4:0.5 G4:2.5 r:0.5 A4:0.75 E4:0.25 E4:0.5 F#4:0.5 E4:0.5 F#4:0.5 G4:2.5",
  },
  {
    id: "alle-jahre-wieder", title: "Alle Jahre wieder", origin: "de", key: "D major", time: "4/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Alle_Jahre_wieder",
    notes: "A4:1.5 B4:0.5 A4:1 G4:1 F#4:2 E4:2 D4:1 E4:0.5 F#4:0.5 G4:1 F#4:1 E4:3 r:1 F#4:1 A4:1 B4:1 A4:1 D5:2 C#5:1 B4:1 A4:1 G4:0.5 F#4:0.5 G4:1 A4:1 F#4:3",
  },
  {
    id: "lasst-uns-froh-und-munter-sein", title: "Lasst uns froh und munter sein", origin: "de", key: "C major", time: "4/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Lasst_uns_froh_und_munter_sein",
    notes: "G4:1 G4:1 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4:1 E4:1 E4:1 r:1 F4:1 F4:1 F4:0.5 G4:0.5 F4:0.5 E4:0.5 D4:1 D4:1 D4:1 r:1 C4:1 D4:1 E4:1 F4:1 G4:0.5 A4:0.5 G4:0.5 A4:0.5 G4:1 r:1 C5:1 G4:1 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4:1 D4:1 G4:1 r:1 C5:1 G4:1 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4:1 D4:1 C4:1",
  },
  {
    id: "suesser-die-glocken", title: "Süßer die Glocken nie klingen", origin: "de", key: "F major", time: "6/8", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/S%C3%BC%C3%9Fer_die_Glocken_nie_klingen",
    notes: "A4:0.75 A4:0.25 A4:0.5 A4:0.5 G4:0.5 A4:0.5 C5:1 Bb4:0.5 G4:1.5 G4:0.75 G4:0.25 G4:0.5 G4:0.5 F4:0.5 G4:0.5 A4:2.5 r:0.5 C5:0.75 C5:0.25 C5:0.5 C5:0.5 A4:0.5 F4:0.5 F5:1 D5:0.5 D5:1.5 C5:0.75 D5:0.25 C5:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:2.5 r:0.5 G4:0.75 G4:0.25 Bb4:0.5 A4:0.5 A4:0.5 C5:0.5 C5:0.75 Bb4:0.25 A4:0.5 G4:1.5 G4:0.75 G4:0.25 Bb4:0.5 A4:0.5 A4:0.5 C5:0.5 C5:0.75 Bb4:0.25 A4:0.5 G4:1.5 C5:0.75 Bb4:0.25 A4:0.5 A4:0.5 G4:0.5 F4:0.5 F5:1.5 D5:1.5 C5:0.75 D5:0.25 C5:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:2.5",
  },
  {
    id: "ihr-kinderlein-kommet", title: "Ihr Kinderlein, kommet", origin: "de", key: "D major", time: "2/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Ihr_Kinderlein,_kommet",
    notes: "A4:0.5 A4:1 F#4:0.5 A4:0.5 A4:1 F#4:0.5 A4:0.5 G4:1 E4:0.5 G4:0.5 F#4:1 r:0.5 A4:0.5 A4:1 F#4:0.5 A4:0.5 A4:1 F#4:0.5 A4:0.5 G4:1 E4:0.5 G4:0.5 F#4:1 r:0.5 F#4:0.5 E4:1 E4:0.5 E4:0.5 G4:1 G4:0.5 G4:0.5 F#4:1 F#4:0.5 F#4:0.5 B4:1 r:0.5 B4:0.5 A4:1 A4:0.5 A4:0.5 D5:1 A4:0.5 F#4:0.5 G4:1 E4:0.5 C#4:0.5 D4:1.5",
  },
  {
    id: "tu-scendi-dalle-stelle", title: "Tu scendi dalle stelle", origin: "it", key: "E♭ major", time: "6/8", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Tu_scendi_dalle_stelle",
    notes: "Bb4:0.5 Bb4:1 C5:0.5 Bb4:1 Ab4:0.5 Ab4:0.5 G4:2 F4:0.5 G4:0.5 Ab4:0.5 Bb4:0.5 Bb4:0.5 Ab4:0.5 G4:0.5 F4:2.5 G4:0.5 F4:1 G4:0.5 Ab4:1 G4:0.5 F4:1.5 C5:1.5 Bb4:0.5 C5:0.5 Bb4:0.5 Ab4:0.5 G4:0.5 F4:0.5 G4:2.5 G4:0.5 F4:1 G4:0.5 Ab4:1 G4:0.5 F4:1.5 C5:1.5 Bb4:0.5 C5:0.5 Bb4:0.5 Ab4:0.5 G4:0.5 F4:0.5 Eb4:1.5 G4:0.5 Ab4:0.5 Bb4:0.5 Ab4:1 Ab4:0.5 F4:0.5 G4:0.5 Ab4:0.5 G4:1 G4:0.5 G4:0.5 Ab4:0.5 Bb4:0.5 Ab4:1 Ab4:0.5 F4:0.5 G4:0.5 Ab4:0.5 G4:2.5 F4:0.5 G4:0.5 Ab4:0.5 Bb4:0.5 Bb4:0.5 Ab4:0.5 G4:0.5 F4:2.5 G4:0.5 F4:1 G4:0.5 Ab4:1 G4:0.5 F4:1.5 C5:1.5 Bb4:0.5 C5:0.5 Bb4:0.5 Ab4:0.5 G4:0.5 F4:0.5 G4:2.5 G4:0.5 F4:1 G4:0.5 Ab4:1 G4:0.5 F4:1.5 C5:1.5 Bb4:0.5 C5:0.5 Bb4:0.5 Ab4:0.5 G4:0.5 F4:0.5 Eb4:3",
  },
  {
    id: "es-ist-ein-ros-entsprungen", title: "Es ist ein Ros entsprungen", origin: "de", key: "F major", time: "4/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Es_ist_ein_Ros_entsprungen",
    notes: "C5:2 C5:1 C5:1 D5:1 C5:1 C5:2 A4:2 Bb4:2 A4:1 G4:2 F4:2 E4:1 F4:2 C5:2 C5:1 C5:1 D5:1 C5:1 C5:2 A4:2 Bb4:2 A4:1 G4:2 F4:2 E4:1 F4:2 r:1 A4:1 G4:1 E4:1 F4:1 D4:1 C4:2 r:1 C5:1 C5:1 C5:1 D5:1 C5:1 C5:2 A4:2 Bb4:2 A4:1 G4:2 F4:2 E4:1 F4:2",
  },
  {
    id: "still-still-still", title: "Still, still, still", origin: "at", key: "F major", time: "2/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Still,_still,_still",
    notes: "C5:1 F5:1 A4:1 C5:1 F4:1 F4:0.5 A4:0.5 G4:1 G4:0.5 Bb4:0.5 E4:1 E4:0.5 G4:0.5 F4:2 r:1 F4:1 G4:1 G4:0.5 A4:0.5 Bb4:1 G4:1 A4:1 A4:0.5 Bb4:0.5 C5:1 A4:1 G4:1 G4:0.5 A4:0.5 Bb4:1 G4:1 A4:1 A4:0.5 Bb4:0.5 C5:1 A4:1 C5:1 F5:1 A4:1 C5:1 F4:1 F4:0.5 A4:0.5 G4:1 G4:0.5 Bb4:0.5 E4:1 E4:0.5 G4:0.5 F4:2",
  },
  {
    id: "morgen-kinder", title: "Morgen, Kinder, wird’s was geben", origin: "de", key: "G major", time: "2/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Morgen,_Kinder,_wird%E2%80%99s_was_geben",
    notes: "G4:0.5 D4:0.5 E4:0.5 D4:0.5 E4:0.25 G4:0.25 F#4:0.25 A4:0.25 G4:0.5 D4:0.5 B4:0.5 B4:0.25 C5:0.25 D5:0.5 B4:0.5 C5:0.5 B4:0.5 A4:1 G4:0.5 D4:0.5 E4:0.5 D4:0.5 E4:0.25 G4:0.25 F#4:0.25 A4:0.25 G4:0.5 D4:0.5 B4:0.5 B4:0.25 C5:0.25 D5:0.5 B4:0.5 C5:0.5 B4:0.5 A4:1 C5:0.5 C5:0.5 E5:0.5 E5:0.5 A4:0.5 A4:0.5 D5:1 G4:0.5 G4:0.5 C5:0.5 C5:0.5 B4:0.25 A4:0.25 G4:0.25 F#4:0.25 G4:1",
  },
  {
    id: "la-marche-des-rois", title: "La Marche des rois", origin: "fr", key: "C minor", time: "4/4", tags: ["christmas"],
    source: "https://fr.wikipedia.org/wiki/La_Marche_des_rois",
    notes: "C4:1 G3:1 C4:1.5 r:0.25 D4:0.25 Eb4:0.5 r:0.25 D4:0.25 Eb4:0.5 r:0.25 C4:0.25 G4:1.5 r:0.25 Eb4:0.25 F4:1 G4:1 Ab4:0.5 G4:0.5 F4:0.5 Eb4:0.5 D4:1 G4:1 F4:0.5 Eb4:0.5 D4:0.5 Eb4:0.5 C4:1 G3:1 C4:1.5 r:0.25 D4:0.25 Eb4:0.5 r:0.25 D4:0.25 Eb4:0.5 r:0.25 C4:0.25 G4:1.5 r:0.25 Eb4:0.25 F4:1 G4:1 Ab4:0.5 G4:0.5 F4:0.5 Eb4:0.5 Eb4:1 D4:1 C4:1.5 r:0.25 D4:0.25 D4:1 D4:1 Eb4:1 D4:0.5 r:0.25 C4:0.25 D4:1 Eb4:1 F4:1.5 r:0.25 Eb4:0.25 F4:1 G4:1 C4:1 D4:0.5 F4:0.5 Eb4:0.5 D4:0.5 C4:0.5 C4:0.5 B3:0.5 G3:0.5 r:0.25 D4:0.25 D4:1 D4:1 Eb4:1 D4:0.5 r:0.25 C4:0.25 D4:1 Eb4:1 F4:1.5 r:0.25 Eb4:0.25 F4:1 G4:1 Ab4:0.5 G4:0.5 F4:0.5 Eb4:0.5 Eb4:1 D4:1 C4:1.5",
  },
  {
    id: "entre-le-boeuf", title: "Entre le bœuf et l’âne gris", origin: "fr", key: "E minor", time: "2/2", tags: ["christmas"],
    source: "https://fr.wikipedia.org/wiki/Entre_le_b%C5%93uf_et_l'%C3%A2ne_gris",
    notes: "E4:2 E4:1 F#4:1 G4:2 E4:2 B4:2 B4:2 B4:4 E5:4 B4:4 B4:1 A4:1 G4:1 A4:1 B4:4 E4:1 F#4:1 G4:1 A4:1 A4:4 B4:1 A4:1 G4:1 F#4:1 E4:4 E4:1 F#4:1 G4:1 A4:1 B4:1.5 G4:0.5 A4:1 B4:1 G4:2 F#4:2 E4:4",
  },
  {
    id: "be-thou-my-vision", title: "Be Thou My Vision (Slane)", origin: "ie", key: "F major", time: "3/2",
    source: "https://fr.wikipedia.org/wiki/Be_thou_my_vision",
    notes: "F4:2 F4:2 G4:1 F4:1 E4:2 C4:2 C4:1 D4:1 F4:2 F4:2 G4:2 A4:6 G4:2 G4:2 G4:2 G4:2 A4:2 C5:2 D5:2 C5:2 A4:2 C5:6 D5:2 D5:1 E5:1 F5:1 E5:1 D5:2 C5:2 A4:2 C5:2 F4:2 E4:2 D4:4 C4:2 F4:2 A4:2 C5:2 D5:1 C5:1 A4:2 F4:1 A4:1 G4:2 F4:2 F4:2 F4:6",
  },
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
    id: "sur-le-pont-davignon", title: "Sur le pont d’Avignon", origin: "fr", key: "F major", time: "2/4",
    source: "https://fr.wikipedia.org/wiki/Sur_le_pont_d'Avignon",
    notes: "F4:0.5 F4:0.5 F4:1 G4:0.5 G4:0.5 G4:1 A4:0.5 Bb4:0.5 C5:0.5 F4:0.5 E4:0.5 F4:0.5 G4:0.5 C4:0.5 F4:0.5 F4:0.5 F4:1 G4:0.5 G4:0.5 G4:1 A4:0.5 Bb4:0.5 C5:0.5 F4:0.5 G4:0.5 E4:0.5 F4:1 F4:0.5 F4:0.5 F4:0.5 F4:0.5 G4:1 F4:1 F4:0.5 F4:0.5 F4:0.5 F4:0.5 G4:1 F4:1 F4:0.5 F4:0.5 F4:1 G4:0.5 G4:0.5 G4:1 A4:0.5 Bb4:0.5 C5:0.5 F4:0.5 E4:0.5 F4:0.5 G4:0.5 C4:0.5 F4:0.5 F4:0.5 F4:1 G4:0.5 G4:0.5 G4:1 A4:0.5 Bb4:0.5 C5:0.5 F4:0.5 G4:0.5 E4:0.5 F4:1",
  },
  {
    id: "itsy-bitsy-spider", title: "Itsy Bitsy Spider", origin: "us", key: "G major", time: "6/8",
    source: "https://en.wikipedia.org/wiki/Itsy_Bitsy_Spider",
    notes: "D4:0.5 G4:1 G4:0.5 G4:1 A4:0.5 B4:1.5 B4:1 B4:0.5 A4:1 G4:0.5 A4:1 B4:0.5 G4:3 B4:1.5 B4:1 C5:0.5 D5:1.5 D5:1.5 C5:1 B4:0.5 C5:1 D5:0.5 B4:3 G4:1.5 G4:1 A4:0.5 B4:1.5 B4:1.5 A4:1 G4:0.5 A4:1 B4:0.5 G4:1.5 F#4:1 F#4:0.5 G4:1 G4:0.5 G4:1 A4:0.5 B4:1.5 B4:1 B4:0.5 A4:1 G4:0.5 A4:1 B4:0.5 G4:2.5",
  },
  {
    id: "lavenders-blue", title: "Lavender’s Blue", origin: "gb-eng", key: "G major", time: "3/8",
    source: "https://en.wikipedia.org/wiki/Lavender's_Blue",
    notes: "G4:0.5 D5:0.5 D5:0.5 D5:0.5 C5:0.25 B4:0.25 A4:0.25 G4:0.25 G4:0.5 E5:0.5 E5:0.5 E5:1.5 G4:0.5 D5:0.5 D5:0.5 D5:0.5 C5:0.25 B4:0.25 A4:0.25 G4:0.25 C5:0.5 B4:0.5 A4:0.5 G4:1.5",
  },
  {
    id: "pop-goes-the-weasel", title: "Pop Goes the Weasel", origin: "gb-eng", key: "C major", time: "6/8",
    source: "https://en.wikipedia.org/wiki/Pop_Goes_the_Weasel",
    notes: "C4:1 C4:0.5 D4:1 D4:0.5 E4:0.5 G4:0.5 E4:0.5 C4:1.5 C4:1 C4:0.5 D4:1 D4:0.5 E4:1.5 C4:0.5 r:0.5 r:0.5 C4:1 C4:0.5 D4:1 D4:0.5 E4:0.5 G4:0.5 E4:0.5 C4:1.5 A4:0.5 r:0.5 r:0.5 D4:1 F4:0.5 E4:1.5 C4:0.5",
  },
  {
    id: "lustig-ist-das-zigeunerleben", title: "Lustig ist das Zigeunerleben", origin: "de", key: "C major", time: "6/8",
    source: "https://de.wikipedia.org/wiki/Lustig_ist_das_Zigeunerleben",
    notes: "G4:1 G4:0.5 G4:0.5 A4:0.5 G4:0.5 E4:1 E4:0.5 E4:0.5 D4:0.5 E4:0.5 F4:0.75 F4:0.25 F4:0.5 G4:0.75 G4:0.25 G4:0.5 E4:2 r:0.5 r:0.5 G4:1 G4:0.5 G4:0.5 A4:0.5 G4:0.5 E4:1 E4:0.5 E4:0.5 D4:0.5 E4:0.5 F4:0.75 F4:0.25 F4:0.5 G4:0.75 G4:0.25 G4:0.5 E4:2 r:0.5 r:0.5 C5:1 C5:0.5 C5:0.5 B4:0.5 A4:0.5 A4:1 G4:0.5 G4:1 r:0.5 A4:1 A4:0.25 A4:0.25 A4:0.5 G4:0.5 F4:0.5 F4:1 E4:0.5 E4:1 r:0.5 G4:0.75 G4:0.25 G4:0.5 G4:0.5 A4:0.5 B4:0.5 C5:0.75 C5:0.25 C5:0.5 C5:0.5 B4:0.5 C5:0.5 D5:0.75 D5:0.25 D5:0.5 B4:0.5 A4:0.5 B4:0.5 C5:2",
  },
  {
    id: "ich-geh-mit-meiner-laterne", title: "Ich geh mit meiner Laterne", origin: "de", key: "G major", time: "6/8",
    source: "https://de.wikipedia.org/wiki/Ich_geh_mit_meiner_Laterne",
    notes: "D4:0.5 G4:1 G4:0.5 B4:0.5 G4:0.5 B4:0.5 D5:1.5 B4:1 G4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:0.5 B4:0.5 A4:0.5 G4:1.5 r:1 D4:0.5 G4:1 G4:0.5 B4:0.5 G4:0.5 B4:0.5 D5:1.5 B4:1 G4:0.5 A4:1 A4:0.5 A4:0.5 B4:0.5 A4:0.5 G4:1.5 r:1 B4:0.5 D5:1 B4:0.5 G4:1 B4:0.5 D5:1 B4:0.5 G4:1 G4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:0.5 B4:0.5 A4:0.5 G4:1.5 r:1 B4:0.5 D5:1 B4:0.5 G4:1 B4:0.5 D5:1 B4:0.5 G4:1 G4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:0.5 B4:0.5 A4:0.5 G4:1.5",
  },
  {
    id: "die-vogelhochzeit", title: "Die Vogelhochzeit", origin: "de", key: "G major", time: "2/4",
    source: "https://de.wikipedia.org/wiki/Die_Vogelhochzeit",
    notes: "B4:0.5 D5:0.5 B4:0.5 D5:0.5 B4:0.5 C5:0.5 A4:0.5 C5:0.5 A4:0.5 B4:0.5 G4:0.5 D5:0.5 B4:0.5 A4:0.5 D5:0.5 D5:0.5 D5:0.25 B4:0.25 G4:0.5 G4:0.5 G4:0.5 D5:0.25 B4:0.25 A4:0.5 A4:0.5 A4:0.5 D5:0.25 C5:0.25 B4:0.5 G4:0.5 A4:0.5 F#4:0.5 G4:1",
  },
  {
    id: "der-mond-ist-aufgegangen", title: "Der Mond ist aufgegangen", origin: "de", key: "F major", time: "4/4",
    source: "https://de.wikipedia.org/wiki/Abendlied_(Matthias_Claudius)",
    notes: "F4:1 G4:1 F4:1 Bb4:1 A4:1 G4:2 F4:1 A4:1 A4:1 A4:1 D5:1 C5:1 Bb4:2 A4:1 A4:1 A4:1 A4:1 Bb4:1 A4:1 G4:3 F4:1 G4:1 F4:1 Bb4:1 A4:1 G4:2 F4:1 A4:1 A4:1 A4:1 D5:1 C5:1 Bb4:2 A4:1 A4:1 A4:1 A4:1 Bb4:1 A4:1 G4:1 G4:1 F4:1",
  },
  {
    id: "auf-einem-baum-ein-kuckuck", title: "Auf einem Baum ein Kuckuck", origin: "de", key: "G major", time: "5/4",
    source: "https://de.wikipedia.org/wiki/Auf_einem_Baum_ein_Kuckuck",
    notes: "D5:1 B4:0.5 G4:0.5 A4:0.5 D5:0.5 D5:0.5 C5:0.5 A4:1 G4:0.5 G4:0.25 G4:0.25 G4:0.5 G4:0.5 G4:0.5 G4:0.25 G4:0.25 A4:0.5 F#4:0.25 F#4:0.25 D4:1 D5:1 B4:0.5 G4:0.5 A4:0.5 D5:0.5 D5:0.5 C5:0.5 A4:0.75 r:0.25 G4:1",
  },
  {
    id: "backe-backe-kuchen", title: "Backe, backe Kuchen", origin: "de", key: "D major", time: "2/2",
    source: "https://de.wikipedia.org/wiki/Backe,_backe_Kuchen",
    notes: "A4:1 A4:1 B4:1 B4:1 A4:2 F#4:1 D4:1 A4:1 A4:1 B4:1 B4:1 A4:2 F#4:2 A4:1 A4:1 B4:1 B4:1 A4:1 A4:1 F#4:1 D4:1 A4:1 A4:1 B4:1 B4:1 A4:1 A4:1 F#4:1 F#4:1 A4:0.5 A4:0.5 A4:1 F#4:2 A4:0.5 A4:0.5 A4:1 F#4:2 A4:1 A4:1 F#4:2 A4:1 A4:1 B4:1 B4:1 A4:1 A4:1 F#4:2 D5:2 A4:1 G4:1 F#4:1 E4:1 D4:2",
  },
  {
    id: "tochter-zion", title: "Tochter Zion, freue dich", origin: "de", key: "G major", time: "4/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Tochter_Zion,_freue_dich",
    notes: "B4:0.5 A4:0.5 B4:0.5 C5:0.5 B4:1 B4:1 A4:2 G4:2 C5:1 B4:1 A4:1 G4:1 F#4:4 G4:0.5 F#4:0.5 G4:0.5 A4:0.5 G4:1 G4:1 E5:2 C#5:2 D5:1 E5:0.5 D5:0.5 C#5:1.5 D5:0.5 D5:4 B4:0.5 A4:0.5 B4:0.5 C5:0.5 B4:1 B4:1 A4:2 G4:2 C5:1 B4:1 A4:1 G4:1 F#4:4 G4:0.5 F#4:0.5 G4:0.5 A4:0.5 G4:1 G4:1 E5:2 C#5:2 D5:1 E5:0.5 D5:0.5 C#5:1.5 D5:0.5 D5:4",
  },
  {
    id: "le-bon-roi-dagobert", title: "Le bon roi Dagobert", origin: "fr", key: "G major", time: "6/8",
    source: "https://fr.wikipedia.org/wiki/Le_bon_roi_Dagobert",
    notes: "B4:0.5 B4:1 A4:0.5 A4:1 G4:0.5 G4:1.5 A4:1.5 B4:0.5 C5:0.5 B4:0.5 A4:0.5 G4:0.5 A4:0.5 G4:1.5 r:0.5 G4:0.5 A4:0.5 B4:1 B4:0.5 B4:0.5 C5:0.5 D5:0.5 A4:1 A4:0.5 A4:0.5 G4:0.5 A4:0.5 B4:1 B4:0.5 B4:0.5 C5:0.5 D5:0.5 A4:1 A4:0.5 A4:1 B4:0.5 B4:1 A4:0.5 A4:1 G4:0.5 G4:1.5 A4:1.5 B4:0.5 C5:0.5 B4:0.5 A4:0.5 G4:0.5 A4:0.5 G4:2.5",
  },
  {
    id: "le-temps-des-cerises", title: "Le Temps des cerises", origin: "fr", key: "D minor", time: "6/8",
    source: "https://fr.wikipedia.org/wiki/Le_Temps_des_cerises",
    notes: "C4:0.5 F4:0.5 F4:0.5 F4:0.5 F4:1 F4:0.5 G4:0.5 G4:0.5 G4:0.5 G4:0.5 G4:0.5 G4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:1 A4:0.5 Bb4:0.5 Bb4:0.5 Bb4:0.5 Bb4:0.5 r:0.5 A4:0.5 A4:0.5 A4:0.5 Bb4:0.5 A4:1.5 G4:1.5 F4:0.5 r:0.5 F4:0.5 Bb4:0.5 Bb4:0.5 Bb4:0.5 Bb4:1 Bb4:0.5 Bb4:0.5 D5:0.5 Bb4:0.5 Bb4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:0.5 C5:1 A4:0.5 A4:0.5 G4:0.5 F4:0.5 G4:3.5 r:0.5 C4:0.5 F4:0.5 F4:0.5 F4:0.5 F4:1 F4:0.5 G4:0.5 G4:0.5 G4:0.5 G4:0.5 G4:0.5 G4:0.5 A4:0.5 A4:0.5 A4:0.5 C5:1 A4:0.5 A4:0.5 G4:0.5 F4:0.5 F4:3.5",
  },
  {
    id: "mennybol-az-angyal", title: "Mennyből az angyal", origin: "hu", key: "F major", time: "2/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Mennyb%C5%91l_az_angyal",
    notes: "F4:1 F4:0.5 E4:0.5 F4:1 C4:1 A4:1 A4:0.5 G4:0.5 A4:1 F4:1 A4:1 D5:1 C5:2 A4:1 D5:1 C5:2 C5:1 C5:0.5 D5:0.5 C5:1 A4:1 Bb4:1 Bb4:0.5 C5:0.5 Bb4:1 G4:1 A4:1 G4:1 F4:2 A4:1 G4:1 F4:2",
  },
  {
    id: "am-weihnachtsbaum", title: "Am Weihnachtsbaum die Lichter brennen", origin: "de", key: "C major", time: "3/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Am_Weihnachtsbaum_die_Lichter_brennen",
    notes: "C4:0.5 C4:0.5 E4:0.5 G4:1 E4:0.5 G4:0.5 C5:0.5 A4:0.5 G4:1 E4:0.5 G4:0.5 A4:0.5 G4:0.5 F4:1 D4:1 G4:0.5 G4:0.5 E4:1 r:0.5 E4:0.5 E4:0.5 G4:0.5 F4:1 D4:0.5 F4:0.5 F4:0.5 A4:0.5 G4:1 E4:0.5 E4:0.5 E4:0.5 G4:0.5 F4:1 D4:1 G4:0.5 G4:0.5 E4:1",
  },
  {
    id: "quem-pastores", title: "Quem pastores laudavere", origin: "de", key: "A♭ major", time: "3/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Quem_pastores_laudavere",
    notes: "Ab4:2 C5:1 Eb5:2 C5:1 C#5:1 Eb5:1 F5:1 Eb5:1 Bb4:2 C5:1 C#5:1 Eb5:1 C#5:1 C5:1 Bb4:1 Ab4:2 F4:1 G4:1 Eb4:2 C5:2 C#5:1 Eb5:2 F5:1 Eb5:2 Bb4:1 C5:1 Ab4:2 C#5:2 C#5:1 C5:1 Bb4:1 Ab4:1 Ab4:1 F4:1 G4:1 Ab4:3",
  },
  {
    id: "ich-steh-an-deiner-krippen", title: "Ich steh an deiner Krippen hier", origin: "de", key: "C minor", time: "4/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Ich_steh_an_deiner_Krippen_hier",
    notes: "G4:1 C5:1 D5:1 Eb5:1 C5:1 Bb4:1.5 Ab4:0.5 G4:1 Bb4:1 Eb4:1.5 D4:0.5 Eb4:1 F4:1 G4:2 G4:1 G4:1 C5:1 D5:1 Eb5:1 C5:1 Bb4:1.5 Ab4:0.5 G4:1 Bb4:1 Eb4:1.5 D4:0.5 Eb4:1 F4:1 G4:2 G4:1 Bb4:1 Eb5:1 Bb4:1 C5:1 Bb4:1 Ab4:1.5 Bb4:0.5 G4:1 Bb4:1 Eb5:1 Bb4:1 C5:1 Bb4:1 Ab4:1.5 Bb4:0.5 G4:1 G4:1 A4:1 B4:1 C5:0.5 Eb5:0.5 D5:0.5 C5:0.5 B4:2 C5:1",
  },
  {
    id: "es-wird-scho-glei-dumpa", title: "Es wird scho glei dumpa", origin: "at", key: "A♭ major", time: "3/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Es_wird_scho_glei_dumpa",
    notes: "Eb4:1 Ab4:1 Ab4:1 Bb4:1 C5:0.75 Eb5:0.25 Eb5:1.5 C#5:0.5 C5:1 C5:1 Bb4:1 Ab4:2 Eb4:1 Ab4:1 Ab4:1 Bb4:1 C5:0.75 Eb5:0.25 Eb5:1.5 C#5:0.5 C5:1 C5:1 Bb4:1 Ab4:2 C5:0.5 C#5:0.5 Eb5:1 C5:1 Eb5:1 Eb5:0.5 C#5:0.5 Bb4:1.5 C#5:0.5 C5:1 Ab4:1 C5:1 Bb4:2 Eb4:1 Ab4:1 Ab4:1 Bb4:1 C5:0.75 Eb5:0.25 Eb5:1.5 C#5:0.5 C5:1 C5:1 Bb4:1 Ab4:2 C5:0.5 Eb4:0.5 Ab4:2 C5:0.5 Eb4:0.5 Ab4:1.5 Eb4:0.5 Ab4:0.5 C5:0.5 Eb5:1 C5:0.5 Ab4:0.5 Bb4:0.5 Eb4:0.5 Ab4:2",
  },
  {
    id: "freu-dich-erd-und-sternenzelt", title: "Freu dich, Erd und Sternenzelt", origin: "cz", key: "G major", time: "2/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Freu_dich,_Erd_und_Sternenzelt",
    notes: "G4:0.5 A4:0.5 B4:0.5 C5:0.5 D5:0.5 D5:0.5 D5:1 C5:0.5 D5:0.5 E5:1 D5:1.5 r:0.5 D5:0.5 D5:0.5 C5:0.5 C5:0.5 B4:0.5 B4:0.5 A4:1 B4:0.5 C5:0.5 A4:1 G4:1.5 r:0.5 B4:0.5 A4:0.5 B4:0.5 C5:0.5 D5:1 A4:1 B4:0.5 A4:0.5 B4:0.5 C5:0.5 D5:1 A4:1 G4:1 E5:1 D5:0.5 B4:0.5 A4:1 G4:2",
  },
  {
    id: "auf-auf-ihr-hirten", title: "Auf, auf, ihr Hirten", origin: "at", key: "A major", time: "3/8", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Auf,_auf,_ihr_Hirten,_euch_nicht_verweilet",
    notes: "E4:0.5 A4:0.5 A4:0.5 Ab4:1 B4:0.5 A4:0.5 C#5:0.5 C#5:0.5 B4:1 D5:0.5 E5:0.5 C#5:0.5 B4:0.5 A4:1 r:0.5 E5:0.5 D5:0.5 C#5:0.5 D5:0.5 B4:1 D5:0.5 C#5:0.5 B4:0.5 C#5:0.5 A4:1 A4:0.5 Ab4:0.5 A4:0.5 B4:0.5 A4:0.5 B4:0.5 E5:0.5 C#5:0.5 B4:0.5 A4:1 r:0.5 E5:0.5 C#5:0.5 B4:0.5 A4:1",
  },
  {
    id: "zu-bethlehem-geboren", title: "Zu Bethlehem geboren", origin: "de", key: "F major", time: "4/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Zu_Bethlehem_geboren",
    notes: "C4:1 F4:1.5 G4:0.5 A4:1 G4:1 F4:2 E4:1 F4:1 G4:1 F4:0.5 G4:0.5 A4:1 G4:1 F4:2 r:1 C5:1 C5:1 A4:1 Bb4:1 C5:1 D5:2 Bb4:1 Bb4:1 A4:1 Bb4:1 C5:1 Bb4:0.5 A4:0.5 G4:3 r:1 C5:2 G4:2 A4:2 G4:1 A4:0.5 Bb4:0.5 C5:1 F4:0.5 G4:0.5 A4:1 G4:1 F4:3",
  },
  {
    id: "der-christbaum", title: "Der Christbaum ist der schönste Baum", origin: "de", key: "A major", time: "4/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Der_Christbaum_ist_der_sch%C3%B6nste_Baum",
    notes: "E4:1 C#5:1 A4:1 D5:1 B4:1 E5:1.5 D5:0.5 C#5:1 B4:1 A4:1 E4:1 D5:1 C#5:1 C#5:1 B4:1 r:1 E5:1 E5:1 C#5:1 F#5:1.5 E5:0.5 E5:0.5 D5:0.5 D5:0.5 C#5:0.5 D5:1 D5:1 D5:1 B4:1 E5:1.5 D5:0.5 D5:0.5 C#5:0.5 C#5:0.5 B4:0.5 C#5:1 E4:1 F#4:1 Ab4:1 A4:1 B4:1 C#5:2 A4:1 Ab4:1 A4:1 B4:1 C#5:1 D5:1 E5:2 C#5:1 F#5:1 E5:2 D5:2 C#5:2",
  },
  {
    id: "resonet-in-laudibus", title: "Resonet in laudibus", origin: "de", key: "F major", time: "6/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Resonet_in_laudibus",
    notes: "C5:1 C5:2 A4:1 F4:2 A4:1 C5:2 D5:1 C5:3 C5:2 A4:1 F4:2 A4:1 C5:2 D5:1 C5:3 Bb4:2 Bb4:1 Bb4:2 C5:1 Bb4:2 A4:1 G4:2 A4:1 C5:2 A4:1 F4:2 A4:1 G4:2 F4:1 G4:2 A4:1 F4:2 E4:1 F4:3 C5:2 A4:1 F4:2 A4:1 C5:2 D5:1 C5:3 C5:2 A4:1 F4:2 A4:1 C5:2 D5:1 C5:3 Bb4:2 Bb4:1 Bb4:2 C5:1 Bb4:2 A4:1 G4:2 A4:1 C5:2 A4:1 F4:2 A4:1 G4:2 F4:1 G4:2 A4:1 F4:2 E4:1 F4:3 C5:3 A4:3 C5:3 A4:3 F4:2 G4:1 A4:2 Bb4:2 A4:2 G4:1 A4:3 F4:2 G4:1 A4:2 Bb4:1 A4:2 G4:1 A4:2 A4:1 F4:2 E4:1 F4:3 C5:2 C5:1 C5:2 C5:1 F5:2 E5:1 D5:2 C5:1 F5:2 E5:1 D5:2 C5:1 C5:2 B4:1 C5:3 F4:2 G4:1 A4:2 Bb4:1 C5:2 Bb4:1 A4:2 G4:1 A4:2 G4:1 F4:2 E4:1 F4:4",
  },
  {
    id: "es-ist-fuer-uns-eine-zeit", title: "Es ist für uns eine Zeit angekommen", origin: "ch", key: "F major", time: "4/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Es_ist_f%C3%BCr_uns_eine_Zeit_angekommen",
    notes: "F4:0.5 F4:0.5 G4:0.5 A4:1 A4:0.5 G4:0.5 A4:1 A4:0.5 G4:0.5 A4:1 A4:0.5 G4:0.5 A4:1 Bb4:1 C5:1 D5:0.5 C5:0.5 C5:1 Bb4:1 A4:2 r:0.5 F4:0.5 F4:0.5 G4:0.5 A4:1 A4:0.5 G4:0.5 A4:1 A4:0.5 G4:0.5 A4:1 A4:0.5 G4:0.5 A4:1 Bb4:1 C5:1 D5:0.5 C5:0.5 C5:1 Bb4:1 A4:2 C5:1.5 C5:0.5 D5:1.5 C5:0.5 Bb4:0.5 A4:0.5 Bb4:0.5 D5:0.5 C5:2 A4:1.5 C5:0.5 G4:2 A4:1.5 C5:0.5 G4:2 A4:1.5 Bb4:0.5 C5:1 D5:0.5 C5:0.5 C5:1 Bb4:1 A4:2",
  },
  {
    id: "heiligste-nacht", title: "Heiligste Nacht", origin: "de", key: "F major", time: "3/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Heiligste_Nacht",
    notes: "F4:1 C4:1 A4:1 F4:2 r:1 F4:1 C4:1 A4:1 F4:2 r:1 C5:1 A4:1 Bb4:1 C5:1 A4:1 Bb4:1 C5:1 Bb4:1 A4:1 A4:1 G4:1 r:1 G4:1 E4:1 F4:1 G4:1 E4:1 G4:1 F4:1 E4:1 D4:1 C4:2 r:1 C5:1 A4:1 Bb4:1 C5:1 A4:1 Bb4:1 C5:1 Bb4:1 A4:1 A4:1 G4:1 r:1 G4:1 E4:1 F4:1 G4:1 E4:1 G4:1 F4:1 E4:1 D4:1 C4:2 r:1 F4:1 F4:0.5 C4:0.5 A4:1 F4:1 F4:0.5 C4:0.5 F4:0.5 A4:0.5 C5:1 C5:0.5 A4:0.5 D5:1 C5:2 r:1 Bb4:1 C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 A4:1 A4:0.5 G4:0.5 F4:1 G4:1 G4:0.5 F4:0.5 G4:0.5 A4:0.5 F4:2 r:1 C5:0.5 D5:0.5 C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 F4:1 A4:0.5 F4:0.5 C4:1 C5:0.5 D5:0.5 C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 F4:1 A4:0.5 F4:0.5 C4:1 G4:1 G4:0.5 F4:0.5 G4:0.5 A4:0.5 F4:2 r:1 G4:1 G4:0.5 F4:0.5 G4:0.5 A4:0.5 F4:2",
  },
  {
    id: "sei-uns-willkommen", title: "Sei uns willkommen, Herre Christ", origin: "de", key: "F major", time: "4/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Sei_uns_willkommen,_Herre_Christ",
    notes: "D4:1 F4:1 E4:1 D4:1 C4:1 F4:1 Bb4:1 A4:1 A4:1 A4:1 C5:1 C5:1 Bb4:1 A4:1 A4:1 G4:1 F4:1 F4:1 F4:1 A4:1 Bb4:1 G4:1 F4:1 E4:1 D4:1 C4:1 G4:1 G4:1 G4:1 Bb4:1 G4:1 F4:1 F4:1 E4:1 G4:1 C4:1 C4:1 E4:1 D4:1",
  },
  {
    id: "maman-les-ptits-bateaux", title: "Maman les p’tits bateaux", origin: "fr", key: "G major", time: "2/4",
    source: "https://fr.wikipedia.org/wiki/Maman_les_p'tits_bateaux",
    notes: "D4:0.5 D4:0.5 C5:0.5 B4:0.5 A4:0.5 G4:0.5 D4:0.5 E4:0.5 G4:0.5 F#4:0.5 D4:0.5 E4:0.5 F#4:0.5 G4:1 G4:0.5 D4:0.5 D4:0.5 C5:0.5 B4:0.5 A4:0.5 G4:0.5 D4:0.25 D4:0.25 E4:0.5 G4:0.5 F#4:0.5 D4:0.5 E4:0.5 F#4:0.5 G4:1 r:0.5 D5:0.5 D5:0.5 B4:0.5 B4:0.5 G4:0.5 G4:1.5 B4:0.5 D5:0.5 D5:0.5 D5:0.5 D5:0.5 B4:1 G4:0.5 D5:0.5 D5:0.5 B4:0.5 B4:0.5 G4:0.5 G4:1 G4:0.5 B4:0.5 D5:0.5 D5:0.5 D5:0.5 D5:0.5 G4:1.5",
  },
  {
    id: "cest-la-mere-michel", title: "C’est la mère Michel", origin: "fr", key: "A major", time: "2/4",
    source: "https://fr.wikipedia.org/wiki/C'est_la_m%C3%A8re_Michel",
    notes: "A4:0.75 A4:0.25 A4:0.5 A4:0.5 A4:0.5 E4:0.5 A4:0.5 B4:0.5 C#5:1 B4:1 A4:1.5 A4:0.5 Ab4:0.75 F#4:0.25 Ab4:0.5 A4:0.5 B4:0.5 C#5:0.5 B4:0.5 A4:0.5 Ab4:1 F#4:1 E4:1.5 E4:0.5 B4:0.5 B4:0.5 B4:0.5 C#5:0.5 D5:1.5 D5:0.5 C#5:0.5 A4:0.5 E5:0.5 C#5:0.5 B4:1.5 B4:0.5 D5:0.5 D5:0.5 D5:0.5 D5:0.5 C#5:0.5 E5:0.5 C#5:0.5 A4:0.5 B4:1 E5:1 A4:0.5 A4:0.5 A4:0.5 Ab4:0.5 F#4:1 F#4:0.75 F#4:0.25 F#4:0.5 Ab4:0.5 A4:0.5 B4:0.5 E4:1 E4:0.75 E4:0.25 E4:1.5 E4:0.5 A4:1 C#5:1 E5:0.5 D5:0.5 C#5:0.5 B4:0.5 A4:0.5 E5:0.5 E5:0.5 E5:0.5 A4:2",
  },
  {
    id: "nous-nirons-plus-au-bois", title: "Nous n’irons plus au bois", origin: "fr", key: "F major", time: "2/4",
    source: "https://fr.wikipedia.org/wiki/Nous_n'irons_plus_au_bois",
    notes: "F4:0.5 A4:0.5 Bb4:0.5 C5:1 F5:1 C5:0.75 D5:0.25 C5:0.5 Bb4:0.5 A4:1 G4:1 F4:0.5 F4:0.5 A4:0.5 Bb4:0.5 C5:1 F5:1 C5:0.75 D5:0.25 C5:0.5 Bb4:0.5 A4:1 G4:1 F4:1 r:1 F4:0.75 F4:0.25 F4:0.5 G4:0.5 F4:1 C4:1 F4:0.75 F4:0.25 F4:0.5 G4:0.5 F4:1 C4:1 C5:1 A4:1 C5:1 A4:1 G4:0.75 A4:0.25 Bb4:0.5 A4:0.5 G4:0.5 C5:0.5 F4:1",
  },
  {
    id: "a-la-volette", title: "À la volette", origin: "fr", key: "F major", time: "2/4",
    source: "https://fr.wikipedia.org/wiki/%C3%80_la_volette",
    notes: "F4:0.5 C4:0.5 F4:1 G4:1 A4:0.5 F4:0.5 A4:0.5 C5:0.5 A4:1 G4:1 F4:1 F4:0.5 C4:0.5 F4:1 G4:1 A4:0.5 F4:0.5 A4:0.5 C5:0.5 A4:1 G4:1 F4:1 A4:0.5 Bb4:0.5 C5:0.5 r:0.5 C5:0.5 Bb4:0.25 A4:0.25 Bb4:0.5 Bb4:0.5 G4:0.5 A4:0.5 Bb4:0.5 r:0.5 Bb4:0.5 A4:0.25 G4:0.25 A4:0.5 A4:0.5 F4:0.5 A4:0.5 G4:1 C4:1 F4:1",
  },
];

// Song lists: everything, or the Christmas songs (first in the list from
// mid-November to Epiphany, when people look for them).
export function christmasSongs(songs = SONGS) { return songs.filter(s => s.tags?.includes('christmas')); }
export function christmasSeason(date = new Date()) {
  const m = date.getMonth(), d = date.getDate();
  return (m === 10 && d >= 15) || m === 11 || (m === 0 && d <= 6);
}

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
