// Songs to learn: well-known traditional and public-domain songs from many
// countries (folk, children's, Christmas), melody only, the most familiar first.
//
// Latvian songs (origin 'lv', with sourceName) were read from the scan of
// Jāzeps Vītols, 100 Latvian Folk Songs (Riga 1906, public domain, IMSLP):
// the vocal line, note by note, each bar checked against its time.
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
// lyrics: the first verse as the score gives it, one syllable per note
// (rests don't count): "Twin- kle, twin- kle, …", a trailing - when the word
// goes on, _ for a note that only carries on the syllable before (a slur).
// Read from the same score as the melody, with its slurs (the Latvian songs
// from the Vītols scan, the first verse under the notes, in today's spelling:
// ee → ie, w → v, a vowel and h → a long vowel, s → z, z → c, sch → š or ž);
// songs whose score
// has no lyrics, or lyrics that don't line up note for note, have none.
// meters: when the time changes, each bar's time in order (the last one
// holds for the rest of the song); time is then the first bar's.
// pickup: the beats before the first full bar (the score's \partial; where
// the score has none or it doesn't fit the notes, the one that puts the
// fewest notes across bar lines). For the tab's bar lines (songBars).
//
// Pure helpers, unit-tested in tests/songs.test.mjs. The screens are in
// js/app.js (songsSectionHtml, viewSong).
import { noteToMidi } from './data.js';

export const SONG_LICENCE = 'Melodies from Wikipedia (CC BY-SA 4.0) and public-domain songbooks';
export const SONG_ORIGINS = {
  de: 'Germany', at: 'Austria', fr: 'France', it: 'Italy', 'gb-eng': 'England', 'gb-sct': 'Scotland', ie: 'Ireland',
  lv: 'Latvia', us: 'USA', mx: 'Mexico', au: 'Australia', il: 'Israel', kr: 'Korea', hu: 'Hungary', cz: 'Czechia', ch: 'Switzerland',
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
    lyrics: "Twin- kle, twin- kle, lit- tle star, How I won- der what you are! Up a- bove the world so high, like a dia- mond in the sky. Twin- kle, twin- kle, lit- tle star, How I won- der what you are!",
  },
  {
    id: "happy-birthday", title: "Happy Birthday to You", origin: "us", key: "G major", time: "3/4", pickup: 1,
    source: "https://en.wikipedia.org/wiki/Happy_Birthday_to_You",
    notes: "D4:0.75 D4:0.25 E4:1 D4:1 G4:1 F#4:2 D4:0.75 D4:0.25 E4:1 D4:1 A4:1 G4:2 D4:0.75 D4:0.25 D5:1 B4:1 G4:1 F#4:1 E4:1 C5:0.75 C5:0.25 B4:1 G4:1 A4:1 G4:2",
    lyrics: "Hap- py birth- day to you, Hap- py birth- day to you, Hap- py birth- day dear [NAME], _ Hap- py birth- day to you.",
  },
  {
    id: "frere-jacques", title: "Frère Jacques (Bruder Jakob)", origin: "fr", key: "D major", time: "4/4",
    source: "https://de.wikipedia.org/wiki/Bruder_Jakob",
    notes: "D4:1 E4:1 F#4:1 D4:1 D4:1 E4:1 F#4:1 D4:1 F#4:1 G4:1 A4:2 F#4:1 G4:1 A4:2 A4:0.75 B4:0.25 A4:0.5 G4:0.5 F#4:1 D4:1 A4:0.75 B4:0.25 A4:0.5 G4:0.5 F#4:1 D4:1 D4:1 A3:1 D4:2 D4:1 A3:1 D4:2",
  },
  {
    id: "amazing-grace", title: "Amazing Grace", origin: "gb-eng", key: "G major", time: "3/4", pickup: 1,
    source: "https://en.wikipedia.org/wiki/Amazing_Grace",
    notes: "D4:1 G4:2 B4:0.5 G4:0.5 B4:2 A4:1 G4:2 E4:1 D4:2 D4:1 G4:2 B4:0.5 G4:0.5 B4:2 A4:1 D5:2 B4:1 D5:1.5 B4:0.5 D5:0.5 B4:0.5 G4:2 D4:1 E4:1.5 G4:0.5 G4:0.5 E4:0.5 D4:2 D4:1 G4:2 B4:0.5 G4:0.5 B4:2 A4:1 G4:3",
  },
  {
    id: "silent-night", title: "Silent Night (Stille Nacht)", origin: "at", key: "D major", time: "6/8", tags: ["christmas"],
    source: "https://en.wikipedia.org/wiki/Silent_Night",
    notes: "A4:0.75 B4:0.25 A4:0.5 F#4:1 r:0.5 A4:0.75 B4:0.25 A4:0.5 F#4:1 r:0.5 E5:0.75 Eb5:0.25 E5:0.5 C#5:1 r:0.5 D5:0.75 C#5:0.25 D5:0.5 A4:1 r:0.5 B4:1 B4:0.5 D5:0.75 C#5:0.25 B4:0.5 A4:0.75 B4:0.25 A4:0.5 F#4:1 r:0.5 B4:1 B4:0.5 D5:0.75 C#5:0.25 B4:0.5 A4:0.75 B4:0.25 A4:0.5 F#4:1 r:0.5 C#5:0.75 C#5:0.25 C#5:0.5 E5:0.75 D5:0.25 C#5:0.5 D5:1.5 F#5:1 r:0.5 D5:0.75 A4:0.25 F#4:0.5 A4:0.75 G4:0.25 E4:0.5 D4:2.5",
    lyrics: "Stil- _ le Nacht! Hei- li- ge Nacht! Al- _ les schläft; ein- _ sam wacht Nur das trau- _ te hei- li- ge Paar. Hol- der Knab' _ im lok- kig- ten Haar, schla- fe in himm- li- scher Ruh! _ Schla- fe in himm- li- scher Ruh!",
  },
  {
    id: "auld-lang-syne", title: "Auld Lang Syne", origin: "gb-sct", key: "F major", time: "4/4", pickup: 1,
    source: "https://en.wikipedia.org/wiki/Auld_Lang_Syne",
    notes: "C4:1 F4:1.5 F4:0.5 F4:1 A4:1 G4:1.5 F4:0.5 G4:1 A4:1 F4:1.5 F4:0.5 A4:1 C5:1 D5:3 D5:1 C5:1.5 A4:0.5 A4:1 F4:1 G4:1.5 F4:0.5 G4:1 A4:1 F4:1.5 D4:0.5 D4:1 C4:1 F4:3 D5:1 C5:1.5 A4:0.5 A4:1 F4:1 G4:1.5 F4:0.5 G4:1 D5:1 C5:1.5 A4:0.5 A4:1 C5:1 D5:3 D5:1 C5:1.5 A4:0.5 A4:1 F4:1 G4:1.5 F4:0.5 G4:1 A4:1 F4:1.5 D4:0.5 D4:1 C4:1 F4:3",
    lyrics: "Should auld ac- quain- tance be for- got, and ne- ver brought to mind? Should auld ac- quain- tance be for- got, and auld _ lang _ syne? For auld _ lang _ syne, my jo, for auld _ lang _ syne, we'll tak' a cup o' kind- ness yet, for auld _ lang _ syne.",
  },
  {
    id: "londonderry-air", title: "Londonderry Air (Danny Boy)", origin: "ie", key: "E♭ major", time: "4/4", pickup: 1.5,
    source: "https://en.wikipedia.org/wiki/Londonderry_Air",
    notes: "D4:0.5 Eb4:0.5 F4:0.5 G4:1.5 F4:0.5 G4:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:0.5 Eb4:0.5 C4:1 r:0.5 Eb4:0.5 G4:0.5 Ab4:0.5 Bb4:1.5 C5:0.5 Bb4:0.5 G4:0.5 Eb4:0.5 G4:0.5 F4:2 r:0.5 D4:0.5 Eb4:0.5 F4:0.5 G4:1.5 F4:0.5 G4:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:0.5 Eb4:0.5 C4:0.5 B3:0.5 C4:0.5 D4:0.5 Eb4:0.5 F4:0.5 G4:1.5 Ab4:0.5 G4:0.5 F4:0.5 Eb4:0.5 F4:0.5 Eb4:2 r:0.5 Bb4:0.5 C5:0.5 D5:0.5 Eb5:1.5 D5:0.5 D5:0.5 C5:0.5 Bb4:0.5 G4:0.5 Bb4:0.5 G4:0.5 Eb4:1 r:0.5 Bb4:0.5 C5:0.5 D5:0.5 Eb5:1.5 D5:0.5 D5:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:2 r:0.5 Bb4:0.5 Bb4:0.5 Bb4:0.5 G5:1.5 F5:0.5 F5:0.5 Eb5:0.5 C5:0.5 Eb5:0.5 Bb4:0.5 G4:0.5 Eb4:1 r:0.5 D4:0.5 Eb4:0.5 F4:0.5 G4:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:0.5 Eb4:0.5 C4:0.5 D4:0.5 Eb4:2.5",
  },
  {
    id: "bella-ciao", title: "Bella ciao", origin: "it", key: "D minor", time: "4/4", pickup: 1.5,
    source: "https://en.wikipedia.org/wiki/Bella_ciao",
    notes: "A3:0.5 D4:0.5 E4:0.5 F4:0.5 D4:2 A3:0.5 D4:0.5 E4:0.5 F4:0.5 D4:2 A3:0.5 D4:0.5 E4:0.5 F4:1 E4:0.5 D4:0.5 F4:1 E4:0.5 D4:0.5 A4:1 A4:1 A4:0.5 A4:0.5 G4:0.5 A4:0.5 Bb4:0.5 Bb4:2 Bb4:0.5 A4:0.5 G4:0.5 Bb4:0.5 A4:2 A4:0.5 G4:0.5 F4:0.5 E4:1 A4:1 F4:1 E4:1 D4:2",
    lyrics: "U- na mat- ti- na mi son sve- glia- to, o bel- la ciao, bel- la ciao, bel- la ciao ciao ciao, u- na mat- ti- na mi son sve- glia- to, e ho tro- va- to l'in- va- sor.",
  },
  {
    id: "hava-nagila", title: "Hava Nagila", origin: "il", key: "G minor", time: "4/4",
    source: "https://en.wikipedia.org/wiki/Hava_Nagila",
    notes: "D4:1 D4:1.5 F#4:0.5 Eb4:0.5 D4:0.5 F#4:1 F#4:1.5 A4:0.5 G4:0.5 F#4:0.5 G4:1 G4:1.5 Bb4:0.5 A4:0.5 G4:0.5 F#4:1 Eb4:0.25 D4:0.25 Eb4:0.5 D4:2 D4:1 D4:1.5 F#4:0.5 Eb4:0.5 D4:0.5 F#4:1 F#4:1.5 A4:0.5 G4:0.5 F#4:0.5 G4:1 G4:1.5 Bb4:0.5 A4:0.5 G4:0.5 F#4:1 Eb4:0.25 D4:0.25 Eb4:0.5 D4:2 F#4:0.5 F#4:1 Eb4:0.5 D4:0.5 D4:0.5 D4:1 Eb4:0.5 Eb4:1 D4:0.5 C4:0.5 C4:0.5 C4:1 C4:1 Eb4:0.75 D4:0.25 C4:0.5 C4:0.5 G4:1 F#4:1 Eb4:0.25 D4:0.25 Eb4:0.5 D4:2 F#4:0.5 F#4:1 Eb4:0.5 D4:0.5 D4:0.5 D4:1 Eb4:0.5 Eb4:1 D4:0.5 C4:0.5 C4:0.5 C4:1 C4:1 Eb4:0.75 D4:0.25 C4:0.5 C4:0.5 G4:1 F#4:1 Eb4:0.25 D4:0.25 Eb4:0.5 D4:2 G4:2 G4:2 G4:1 G4:1 G4:1 G4:1 G4:0.5 G4:0.5 Bb4:0.75 A4:0.25 G4:0.5 Bb4:0.5 A4:0.5 G4:0.5 G4:0.5 G4:0.5 Bb4:0.75 A4:0.25 G4:0.5 Bb4:0.5 A4:0.5 G4:0.5 A4:0.5 A4:0.5 C5:0.75 Bb4:0.25 A4:0.5 C5:0.5 Bb4:0.5 A4:0.5 A4:0.5 A4:0.5 C5:0.75 Bb4:0.25 A4:0.5 C5:0.5 Bb4:0.5 A4:0.5 A4:0.5 A4:0.5 D5:1 D4:0.5 D4:0.5 D5:1 r:0.5 D4:0.5 D4:0.5 D4:0.5 Bb4:0.5 A4:0.5 G4:0.5 F#4:0.5 G4:3",
  },
  {
    id: "dievs-sveti-latviju", title: "Dievs, svētī Latviju", origin: "lv", key: "G major", time: "4/4",
    source: "https://imslp.org/wiki/100_Latvian_Folk_Songs_(V%C4%ABtols,_J%C4%81zeps)",
    sourceName: "Jāzeps Vītols, 100 Latvian Folk Songs (Riga: P. Neldner, 1906), No. 1",
    notes: "G4:2 G4:1 G4:1 B4:1.5 A4:0.5 G4:2 A4:2 A4:1 A4:1 C5:1.5 B4:0.5 A4:2 B4:2 B4:1 B4:1 D5:1.5 C5:0.5 B4:1 B4:1 A4:2 B4:1 C#5:1 D5:4 G4:2 G4:1 G4:1 B4:1.5 A4:0.5 G4:2 A4:2 A4:1 A4:1 C5:1.5 B4:0.5 A4:2 B4:2 B4:1 B4:1 D5:1.5 C5:0.5 B4:1 B4:1 A4:2 B4:1 C#5:1 D5:4 A4:2 A4:1 C5:1 B4:1.5 A4:0.5 G4:2 B4:2 B4:1 D5:1 C5:1.5 B4:0.5 A4:2 C5:2 C5:1 E5:1 D5:1.5 C5:0.5 B4:1 B4:1 B4:2 A4:1 C5:1 G4:4 A4:2 A4:1 C5:1 B4:1.5 A4:0.5 G4:2 B4:2 B4:1 D5:1 C5:1.5 B4:0.5 A4:2 C5:2 C5:1 E5:1 D5:1.5 C5:0.5 B4:1 B4:1 B4:2 A4:2 G4:4",
    lyrics: "Dievs, svē- tī Lat- vi- ju, mūs' dār- go tē- vi- ju, svē- tī jel Lat- vi- ju, ak, svē- tī jel to! Dievs, svē- tī Lat- vi- ju, mūs' dār- go tē- vi- ju, svē- tī jel Lat- vi- ju, ak, svē- tī jel to! Kur lat- vju mei- tas zied, kur lat- vju dē- li dzied, laid mums tur lai- mē diet, mūs' Lat- vi- _ jā. Kur lat- vju mei- tas zied, kur lat- vju dē- li dzied, laid mums tur lai- mē diet, mūs' Lat- vi- jā.",
  },
  {
    id: "put-vejini", title: "Pūt, vējiņi", origin: "lv", key: "F major", time: "3/4",
    source: "https://imslp.org/wiki/100_Latvian_Folk_Songs_(V%C4%ABtols,_J%C4%81zeps)",
    sourceName: "Jāzeps Vītols, 100 Latvian Folk Songs (Riga: P. Neldner, 1906), No. 51",
    notes: "F4:1 C5:2 A4:0.5 G4:0.5 F4:2 Bb4:1 D5:2 D5:1 C5:2 G4:0.5 A4:0.5 Bb4:2 C5:1 F4:2 Bb4:0.5 A4:0.5 G4:2 F4:3",
    lyrics: "Pūt, vē- ji- _ ņi, dzen lai- vi- ņu, aiz- _ dzen ma- ni Kur- _ ze- mē.",
  },
  {
    id: "kur-tu-skriesi-vanadzini", title: "Kur tu skriesi, vanadziņi", origin: "lv", key: "F major", time: "3/4",
    meters: ["3/4", "3/4", "3/4", "4/4", "3/4", "4/4"],
    source: "https://imslp.org/wiki/100_Latvian_Folk_Songs_(V%C4%ABtols,_J%C4%81zeps)",
    sourceName: "Jāzeps Vītols, 100 Latvian Folk Songs (Riga: P. Neldner, 1906), No. 65",
    notes: "F4:0.5 A4:0.5 C5:1.5 A4:0.5 Bb4:0.5 C5:0.5 D5:1.5 Bb4:0.5 Bb4:0.5 D5:0.5 D5:1 D5:1 D5:0.5 F5:0.5 E5:0.5 D5:0.5 C5:1.5 Bb4:0.5 A4:0.5 C5:0.5 Bb4:0.5 A4:0.5 G4:1 G4:0.5 D5:0.5 C5:0.5 Bb4:0.5 A4:1.5 G4:0.5 F5:0.5 E5:0.5 F5:0.5 D5:0.5 C5:0.5 D5:0.5 C5:0.5 Bb4:0.5 A4:1.5 G4:0.5 F4:2",
    lyrics: "Kur tu skrie- si, va- na- dzi- ņi, ar tiem vas- ka spār- _ _ ni- ņie- mi? Kur tu skrie- _ si, va- _ _ na- dzi- ņi, ar _ _ tiem vas- _ _ ka spār- ni- ņiem?",
  },
  {
    id: "riga-dimd", title: "Rīga dimd", origin: "lv", key: "A major", time: "2/4",
    source: "https://imslp.org/wiki/100_Latvian_Folk_Songs_(V%C4%ABtols,_J%C4%81zeps)",
    sourceName: "Jāzeps Vītols, 100 Latvian Folk Songs (Riga: P. Neldner, 1906), No. 63",
    notes: "A4:0.75 A4:0.25 C#5:1 A4:0.75 A4:0.25 C#5:1 A4:0.5 E5:0.5 D5:0.5 B4:0.5 A4:0.5 F#4:0.5 E4:1 C#4:0.5 E4:0.5 E4:1 D4:0.5 F#4:0.5 F#4:1 E4:0.5 E4:0.5 D5:0.5 D5:0.5 C#5:0.5 B4:0.5 A4:1 C#4:0.5 E4:0.5 E4:1 D4:0.5 F#4:0.5 F#4:1 E4:0.5 E4:0.5 D5:0.5 D5:0.5 C#5:0.5 B4:0.5 A4:1",
    lyrics: "Rī- ga dimd! Rī- ga dimd! kas to Rī- gu dim- di- nāj'? Tra- la- la, tra- la- la, kas to Rī- gu dim- di- nāj'? Tra- la- la, tra- la- la, kas to Rī- gu dim- di- nāj'?",
  },
  {
    id: "jurin-prasa-smalku-tiklu", title: "Jūriņ’ prasa smalku tīklu", origin: "lv", key: "E major", time: "6/8",
    source: "https://imslp.org/wiki/100_Latvian_Folk_Songs_(V%C4%ABtols,_J%C4%81zeps)",
    sourceName: "Jāzeps Vītols, 100 Latvian Folk Songs (Riga: P. Neldner, 1906), No. 57",
    notes: "E4:1 G#4:0.5 B4:1 C#5:0.5 B4:1 G#4:0.5 E4:1 E4:0.5 E4:1 E5:0.5 D#5:0.5 C#5:0.5 D#5:0.5 E5:1 C#5:0.5 B4:1.5 C#5:1 C#5:0.5 C#5:1 C#5:0.5 C#5:1 F#4:0.5 F#4:1 F#4:0.5 B4:1 B4:0.5 B4:1 A4:0.5 G#4:1 F#4:0.5 E4:1.5",
    lyrics: "Jū- riņ' pra- sa smal- ku tī- klu, lai- viņ' bal- _ tu zē- ge- lit', jū- riņ' pra- sa smal- ku tī- klu, lai- viņ' bal- tu zē- ge- lit'!",
  },
  {
    id: "krauklitis-sez-ozola", title: "Krauklītis sēž ozolā", origin: "lv", key: "F major", time: "3/4",
    source: "https://imslp.org/wiki/100_Latvian_Folk_Songs_(V%C4%ABtols,_J%C4%81zeps)",
    sourceName: "Jāzeps Vītols, 100 Latvian Folk Songs (Riga: P. Neldner, 1906), No. 55",
    notes: "F4:1 A4:0.5 Bb4:0.5 C5:1 D5:1 F5:0.3333 E5:0.3333 D5:0.3333 C5:1 F5:1 C5:1 C5:0.5 D5:0.5 E5:1 D5:0.3333 E5:0.3333 F5:0.3333 E5:1 F5:1 A4:1 A4:0.5 Bb4:0.5 D5:1 C5:1 G4:0.5 A4:0.5 C5:1 Bb4:1 A4:0.5 G4:0.5 A4:1 G4:1 F4:1 F5:1 A4:1 A4:0.5 Bb4:0.5 D5:1 C5:1 G4:0.5 A4:0.5 C5:1 Bb4:1 A4:0.5 G4:0.5 A4:1 G4:1 F4:1",
    lyrics: "Krauk- lits _ sēž o- so- _ _ lā, zel- ta kok- les ro- ci- _ _ ņā. Ak tai ri- di, ak tai ri- di, zel- ta kok- les ro- ci- ņā. Ak tai ri- di, ak tai ri- di, zel- ta kok- les ro- ci- ņā.",
  },
  {
    id: "nu-ar-dievu-vidzemite", title: "Nu ar Dievu, Vidzemīte", origin: "lv", key: "A major", time: "4/4",
    source: "https://imslp.org/wiki/100_Latvian_Folk_Songs_(V%C4%ABtols,_J%C4%81zeps)",
    sourceName: "Jāzeps Vītols, 100 Latvian Folk Songs (Riga: P. Neldner, 1906), No. 29",
    notes: "A4:1.5 A4:0.5 A4:1 A4:1 E4:1.5 E4:0.5 E4:1 G#4:1 A4:1 A4:1 A4:1 C#5:1 D5:1.5 D5:0.5 D5:2 C#5:1 C#5:1 C#5:1 C#5:1 B4:1.5 B4:0.5 B4:1 B4:1 E5:1 D5:1 C#5:1.5 B4:0.5 A4:1 G#4:1 A4:2",
    lyrics: "Nu ar Die- vu, Vid- ze- mī- te, ne- bū- šu vairs Vid- ze- mē. Ne- ie- šu vairs sa- vā va- ļā cie- ma dur- vis vi- ri- nāt.",
  },
  {
    id: "aija-zuzu", title: "Aijā, žūžū, lāča bērns", origin: "lv", key: "G major", time: "2/4", tags: ["children"],
    source: "https://imslp.org/wiki/100_Latvian_Folk_Songs_(V%C4%ABtols,_J%C4%81zeps)",
    sourceName: "Jāzeps Vītols, 100 Latvian Folk Songs (Riga: P. Neldner, 1906), No. 20",
    notes: "G4:0.5 A4:0.5 B4:0.5 C5:0.5 D5:0.5 B4:0.5 G4:0.5 B4:0.5 D5:1 E5:1 D5:0.5 B4:0.5 G4:1 D5:0.5 D5:0.5 C5:0.5 A4:0.5 B4:0.5 B4:0.5 G4:0.5 A4:0.5 B4:1 A4:1 G4:2 D5:0.5 D5:0.5 C5:0.5 A4:0.5 B4:0.5 B4:0.5 G4:0.5 A4:0.5 B4:1 A4:1 G4:2",
    lyrics: "Ai- jā, žū- žū, lā- ča bēr- nis, ai- jā, žū- _ žū, pla- ka- na- mi kā- ji- ņa- mi, žū- _ žū. pla- ka- na- mi kā- ji- ņa- mi, žū- _ žū.",
  },
  {
    id: "cuci-mana-ligavina", title: "Čuči, mana līgaviņa", origin: "lv", key: "F major", time: "3/4", tags: ["children"],
    source: "https://imslp.org/wiki/100_Latvian_Folk_Songs_(V%C4%ABtols,_J%C4%81zeps)",
    sourceName: "Jāzeps Vītols, 100 Latvian Folk Songs (Riga: P. Neldner, 1906), No. 22",
    notes: "F4:1 F4:0.5 G4:0.5 A4:0.5 F4:0.5 G4:1 G4:0.5 A4:0.5 Bb4:0.5 G4:0.5 C5:1 C5:0.5 D5:0.5 C5:0.5 Bb4:0.5 A4:1 F4:1 C5:0.5 A4:0.5 G4:1 G4:0.5 A4:0.5 Bb4:0.5 G4:0.5 F4:1 F4:0.5 G4:0.5 A4:0.5 F4:0.5 G4:1 G4:0.5 A4:0.5 Bb4:0.5 G4:0.5 F4:1 E4:1 F4:1",
    lyrics: "Ču- či, _ ma- na lī- ga- _ vi- ņa, uz ma- _ na- mi ro- ci- ņa- mi, ču- či, _ ma- na lī- ga- _ vi- ņa, uz ma- _ na- mi ro- ci- ņam.",
  },
  {
    id: "ej-saulite-driz-pie-dieva", title: "Ej, saulīte, drīz pie Dieva", origin: "lv", key: "A minor", time: "3/4",
    source: "https://imslp.org/wiki/100_Latvian_Folk_Songs_(V%C4%ABtols,_J%C4%81zeps)",
    sourceName: "Jāzeps Vītols, 100 Latvian Folk Songs (Riga: P. Neldner, 1906), No. 4",
    notes: "C5:1 C5:1 A4:0.5 B4:0.5 C5:1 A4:1 B4:0.5 A4:0.5 C5:1 B4:1 A4:0.5 A4:0.5 B4:1 G4:1 A4:4 C5:1 C5:1 A4:0.5 B4:0.5 C5:1 A4:1 B4:0.5 A4:0.5 C5:1 B4:1 A4:0.5 A4:0.5 B4:1 G4:1 A4:4 C5:0.3333 B4:0.3333 A4:0.3333 E5:1 D5:1 C5:0.3333 B4:0.3333 A4:0.3333 A4:2",
    lyrics: "Ej, sau- lī- te, drīz pie Die- va, dod man svē- tu va- ka- ru. Bār- gi kun- gi dar- bu de- va, ne- dev' svē- ta va- ka- ra. Ū! _ _ _ _ _ _ _ _",
  },
  {
    id: "kas-godiga-janu-mate", title: "Kas godīga Jāņu māte", origin: "lv", key: "E major", time: "2/4", tags: ["jani"],
    source: "https://imslp.org/wiki/100_Latvian_Folk_Songs_(V%C4%ABtols,_J%C4%81zeps)",
    sourceName: "Jāzeps Vītols, 100 Latvian Folk Songs (Riga: P. Neldner, 1906), No. 93",
    notes: "B4:0.5 B4:0.5 B4:0.5 B4:0.5 B4:0.5 A4:0.5 G#4:0.5 A4:0.5 B4:1 G#4:2 A4:1 B4:1 G#4:2 A4:1 B4:0.5 B4:0.5 B4:0.5 B4:0.5 B4:0.5 A4:0.5 G#4:0.5 A4:0.5 B4:1 G#4:2 A4:1 B4:1 G#4:2 A4:1 B4:0.5 B4:0.5 B4:0.5 B4:0.5 B4:0.5 A4:0.5 G#4:0.5 A4:0.5 B4:1 G#4:2 A4:1 B4:1 G#4:1 G#4:2",
    lyrics: "Kas go- dī- ga Jā- ņa mā- te, lī- go, _ lī- go, _ at- ver lo- gu gai- di- da- ma, lī- go, _ lī- go, _ at- ver lo- gu gai- di- da- ma, lī- go, _ lī- go. _",
  },
  {
    id: "se-naksim-citu-gadu", title: "Še nāksim citu gadu", origin: "lv", key: "E minor", time: "2/4", tags: ["jani"],
    source: "https://imslp.org/wiki/100_Latvian_Folk_Songs_(V%C4%ABtols,_J%C4%81zeps)",
    sourceName: "Jāzeps Vītols, 100 Latvian Folk Songs (Riga: P. Neldner, 1906), No. 99",
    notes: "E4:0.5 F#4:0.5 G4:0.5 A4:0.5 B4:0.5 G4:0.5 F#4:0.5 G4:0.5 E4:1 B4:1 B4:0.5 C5:0.5 D5:1 A4:0.5 C5:0.5 B4:0.5 B4:0.5 A4:0.5 G4:0.5 F#4:0.5 G4:0.5 F#4:1 E4:1 B4:0.5 B4:0.5 B4:0.5 B4:0.5 A4:0.5 G4:0.5 F#4:0.5 G4:0.5 F#4:1 E4:1",
    lyrics: "Še nāk- si- mi ci- tu ga- du, lī- go, lī- _ go! še līgs- mi- ga Jā- ņa mā- te, lī- go! še līgs- mi- ga Jā- ņa mā- te, lī- go!",
  },
  {
    id: "pavadam-janu-dienu", title: "Pavadām Jāņu dienu", origin: "lv", key: "G minor", time: "2/4", tags: ["jani"],
    source: "https://imslp.org/wiki/100_Latvian_Folk_Songs_(V%C4%ABtols,_J%C4%81zeps)",
    sourceName: "Jāzeps Vītols, 100 Latvian Folk Songs (Riga: P. Neldner, 1906), No. 100",
    notes: "G4:0.5 A4:0.5 Bb4:0.5 Bb4:0.5 C5:0.5 C5:0.5 G4:0.5 A4:0.5 Bb4:1 D5:1 C5:1 Eb5:1 D5:0.5 D5:0.5 D5:0.5 D5:0.5 C5:0.5 C5:0.5 A4:0.5 G4:0.5 Bb4:1 C5:1 Bb4:0.5 A4:0.5 G4:1",
    lyrics: "Pa- va- da- mi Jā- ņa die- nu, lī- go, lī- go! līdz vi- ņa- mi kal- ni- ņa- mi, lī- go, lī- _ go!",
  },
  {
    id: "la-cucaracha", title: "La Cucaracha", origin: "mx", key: "F major", time: "3/4", pickup: 1,
    source: "https://en.wikipedia.org/wiki/La_Cucaracha",
    notes: "C4:0.5 C4:0.5 F4:0.5 F4:0.5 A4:0.5 A4:0.5 C5:1 A4:2 C5:0.5 D5:0.5 C5:0.5 Bb4:0.5 A4:0.5 C5:0.5 Bb4:1 G4:2 C4:0.5 C4:0.5 E4:0.5 E4:0.5 G4:0.5 G4:0.5 Bb4:1 G4:2 C5:0.5 D5:0.5 C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 A4:1 F4:2 C4:0.5 C4:0.5 F4:0.5 F4:0.5 A4:0.5 A4:0.5 C5:1 A4:2 C5:0.5 D5:0.5 C5:0.5 Bb4:0.5 A4:0.5 C5:0.5 Bb4:1 G4:2 C4:0.5 C4:0.5 E4:0.5 E4:0.5 G4:0.5 G4:0.5 Bb4:1 G4:2 C5:0.5 D5:0.5 C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 A4:1 F4:2",
  },
  {
    id: "drunken-sailor", title: "Drunken Sailor", origin: "gb-eng", key: "D minor", time: "2/4",
    source: "https://de.wikipedia.org/wiki/What_Shall_We_Do_with_the_Drunken_Sailor%3F",
    notes: "A4:0.5 A4:0.25 A4:0.25 A4:0.5 A4:0.25 A4:0.25 A4:0.5 D4:0.5 F4:0.5 A4:0.5 G4:0.5 G4:0.25 G4:0.25 G4:0.5 G4:0.25 G4:0.25 G4:0.5 C4:0.5 E4:0.5 G4:0.5 A4:0.5 A4:0.25 A4:0.25 A4:0.5 A4:0.25 A4:0.25 A4:0.5 B4:0.5 C5:0.5 D5:0.5 C5:0.5 A4:0.5 G4:0.5 E4:0.5 D4:1 D4:1 A4:1 A4:0.75 A4:0.25 A4:0.5 D4:0.5 F4:0.5 A4:0.5 G4:1 G4:0.75 G4:0.25 G4:0.5 C4:0.5 E4:0.5 G4:0.5 A4:1 A4:0.75 A4:0.25 A4:0.5 B4:0.5 C5:0.5 D5:0.5 C5:0.5 A4:0.5 G4:0.5 E4:0.5 D4:1 D4:1",
    lyrics: "What shall we do with the drun- ken sai- lor, What shall we do with the drun- ken sai- lor, what shall we do with the drun- ken sai- lor ear- ly in the mor- ning? Hoo- ray, and up she ri- ses, hoo- ray, and up she ri- ses, hoo- ray, and up she ri- ses ea- rly in the mor- ning.",
  },
  {
    id: "my-bonnie", title: "My Bonnie Lies over the Ocean", origin: "gb-sct", key: "G major", time: "3/4", pickup: 1,
    source: "https://en.wikipedia.org/wiki/My_Bonnie_Lies_over_the_Ocean",
    notes: "D4:1 B4:1 A4:1 G4:1 A4:1 G4:1 E4:1 D4:1 B3:4 D4:1 B4:1 A4:1 G4:1 G4:1 F#4:1 G4:1 A4:5 D4:1 B4:1 A4:1 G4:1 A4:1 G4:1 E4:1 D4:1 B3:4 D4:1 E4:1 A4:1 G4:1 F#4:1 E4:1 F#4:1 G4:5 r:1 D4:3 G4:3 E4:3 A4:3 F#4:1 F#4:1 F#4:1 F#4:1 E4:1 F#4:1 G4:2 A4:1 B4:3 D4:3 G4:3 E4:3 A4:3 F#4:1 F#4:1 F#4:1 F#4:1 E4:1 F#4:1 G4:6",
  },
  {
    id: "red-river-valley", title: "Red River Valley", origin: "us", key: "G major", time: "4/4", pickup: 1,
    source: "https://en.wikipedia.org/wiki/Red_River_Valley_(song)",
    notes: "D4:0.5 G4:0.5 B4:1 B4:0.5 B4:0.5 B4:1 A4:0.5 B4:0.5 A4:1 G4:2 B4:0.5 B4:0.5 B4:1 G4:0.5 B4:0.5 D5:1 C5:0.5 B4:0.5 A4:3 D5:0.5 C5:0.5 B4:1 B4:0.5 A4:0.5 G4:1 A4:0.5 B4:0.5 D5:1 C5:2 E4:0.5 E4:0.5 D4:1 F#4:0.5 G4:0.5 A4:1 B4:0.5 A4:0.5 G4:4",
    lyrics: "From this val- ley they say you are go- ing. We will miss your bright eyes and sweet smile, for they say you are ta- king the sun- shine, that has bright- ened our path- way a while.",
  },
  {
    id: "brahms-lullaby", title: "Brahms’ Lullaby (Guten Abend, gut’ Nacht)", origin: "de", key: "E♭ major", time: "3/4", pickup: 1,
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
    lyrics: "Au clair de la lu- ne, Mon a- mi Pier- rot, Prê- te- moi ta plu- me Pour é- crire un mot. Ma chan- delle est mor- te, Je n'ai plus de feu ; Ou- vre- moi ta por- te, Pour l'a- mour de Dieu.",
  },
  {
    id: "arirang", title: "Arirang", origin: "kr", key: "F major", time: "9/8",
    source: "https://en.wikipedia.org/wiki/Arirang",
    notes: "C4:2.5 D4:0.5 C4:1 D4:0.5 F4:2.5 G4:0.5 F4:1 G4:0.5 A4:1.5 G4:0.5 A4:0.5 G4:0.5 F4:1 D4:0.5 C4:2.5 D4:0.5 C4:0.5 D4:0.5 r:0.5 F4:2.5 G4:0.5 F4:1 G4:0.5 A4:1 G4:0.5 F4:1 D4:0.5 C4:1 D4:0.5 F4:2.5 G4:0.5 F4:1.5 F4:3 r:1.5 C5:3 C5:1.5 C5:1.5 A4:1.5 G4:1.5 A4:1.5 G4:1 A4:0.5 F4:1 D4:0.5 C4:2.5 D4:0.5 C4:0.5 D4:0.5 r:0.5 F4:2.5 G4:0.5 F4:1 G4:0.5 A4:1 G4:0.5 F4:1 D4:0.5 C4:1 D4:0.5 F4:2.5 G4:0.5 F4:1.5 F4:3",
    lyrics: "아 리 랑 _ 아 리 랑 _ 아 라 _ _ 리 _ 요 _ _ _ 아 리 랑 _ 고 _ 개 _ 로 _ 넘 어 간 다 나 를 버 리 고 가 시 는 님 _ 은 _ _ _ 십 리 도 _ 못 _ 가 _ 서 _ 발 병 난 다",
  },
  {
    id: "waltzing-matilda", title: "Waltzing Matilda", origin: "au", key: "F major", time: "4/4",
    source: "https://en.wikipedia.org/wiki/Waltzing_Matilda",
    notes: "A4:0.75 A4:0.25 A4:0.5 A4:0.5 G4:1 G4:1 F4:1 A4:0.5 F4:0.5 D4:0.5 E4:0.5 F4:1 C4:1 F4:0.75 A4:0.25 C5:1 C5:0.5 C5:0.5 C5:0.5 C5:0.5 C5:1 C5:0.5 r:0.5 F4:0.5 G4:0.5 A4:1 A4:0.5 A4:0.5 G4:1 G4:1 F4:0.5 G4:0.5 A4:0.5 F4:0.5 D4:0.5 E4:0.5 F4:1 C4:1 F4:0.75 A4:0.25 C5:1 Bb4:0.5 A4:0.5 G4:1 G4:0.5 G4:0.5 F4:1 r:1 C5:1 C5:0.75 C5:0.25 C5:1 A4:1 F5:1 F5:0.75 E5:0.25 D5:1 C5:1 C5:1 C5:0.75 C5:0.25 D5:1 C5:0.75 C5:0.25 C5:1 Bb4:0.5 A4:0.5 G4:0.5 r:0.5 F4:0.5 G4:0.5 A4:1 A4:0.5 A4:0.5 G4:1 G4:1 F4:0.5 G4:0.5 A4:0.5 F4:0.5 D4:0.5 E4:0.5 F4:1 C4:1 F4:0.75 A4:0.25 C5:1 Bb4:0.5 A4:0.5 G4:1 G4:0.5 G4:0.5 F4:1",
    lyrics: "Once a jol- ly swag- man camped by a bill- a- bong Un- der the shade of a coo- li- bah tree, And he sang as he watched and wai- ted till his Bil- ly boiled, You'll come a- waltz- ing Ma- til- da with me. Waltz- ing Ma- til- da, waltz- ing Ma- til- da, You'll come a- waltz- ing Ma- til- da with me, And he sang as he watched and wai- ted till his Bil- ly boiled, You'll come a- waltz- ing Ma- til- da with me.",
  },
  {
    id: "skye-boat-song", title: "Skye Boat Song", origin: "gb-sct", key: "G major", time: "6/8",
    source: "https://en.wikipedia.org/wiki/Skye_Boat_Song",
    notes: "D4:0.75 E4:0.25 D4:0.5 G4:1 G4:0.25 G4:0.25 A4:0.75 B4:0.25 A4:0.5 D5:1.5 B4:0.75 A4:0.25 B4:0.5 E4:1 E4:0.5 D4:1.5 r:1.5 D4:0.75 E4:0.25 D4:0.5 G4:1 G4:0.5 A4:0.75 B4:0.25 A4:0.5 D5:1.5 B4:0.75 A4:0.25 B4:0.5 E4:1 E4:0.5 G4:3 B4:0.5 G4:0.5 B4:0.5 B4:1.5 A4:0.5 E4:0.5 A4:0.5 A4:1.5 G4:0.5 E4:0.5 G4:0.5 G4:1 G4:0.5 E4:3 B4:0.5 G4:0.5 B4:0.5 B4:1.5 A4:0.5 E4:0.5 A4:0.5 A4:1.5 G4:0.5 E4:0.5 G4:0.5 G4:1 G4:0.5 E4:1.5 D4:1.5",
    lyrics: "Speed bon- nie boat, like a bird on the wing, on- ward, the sai- lors cry Car- ry the lad that's born to be king o- ver the sea to Skye. Loud the winds howl, loud the waves roar, thun- der- claps rend the air; baf- fled, our foes stand by the shore, fol- low they will not dare. _",
  },
  {
    id: "malbrough", title: "For He’s a Jolly Good Fellow (Malbrough s’en va-t-en guerre)", origin: "fr", key: "G major", time: "6/8", pickup: 0.5,
    source: "https://fr.wikipedia.org/wiki/Malbrough_s'en_va-t-en_guerre",
    notes: "D4:0.5 B4:1 B4:0.5 B4:1 A4:0.5 C5:1.5 B4:0.5 C5:0.5 B4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:0.5 G4:0.5 A4:0.5 B4:1.5 G4:1 D4:0.5 B4:1 B4:0.5 B4:1 A4:0.5 C5:1.5 B4:1 D5:0.5 B4:1 G4:0.5 A4:1 A4:0.5 G4:2.5 D5:0.5 D5:1 B4:0.5 E5:1 E5:0.5 D5:1.5 D5:1.5 D5:1 B4:0.5 E5:1 E5:0.5 D5:2.5",
  },
  {
    id: "row-your-boat", title: "Row, Row, Row Your Boat", origin: "us", key: "C major", time: "6/8",
    source: "https://en.wikipedia.org/wiki/Row,_Row,_Row_Your_Boat",
    notes: "C4:1.5 C4:1.5 C4:1 D4:0.5 E4:1.5 E4:1 D4:0.5 E4:1 F4:0.5 G4:3 C5:0.5 C5:0.5 C5:0.5 G4:0.5 G4:0.5 G4:0.5 E4:0.5 E4:0.5 E4:0.5 C4:0.5 C4:0.5 C4:0.5 G4:1 F4:0.5 E4:1 D4:0.5 C4:3",
    lyrics: "Row, row, row your boat gent- ly down the stream; mer- ri- ly, mer- ri- ly, mer- ri- ly, mer- ri- ly, life is but a dream!",
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
    lyrics: "O du fröh- li- che, _ o du se- li- ge, _ gna- den- brin- gen- de Weih- nachts- zeit! Welt _ ging ver- lo- _ ren, Christ _ ist ge- bo- _ ren: Freu- _ e, _ freu- e dich, o Chris- ten- heit!",
  },
  {
    id: "kling-gloeckchen", title: "Kling, Glöckchen, klingelingeling", origin: "de", key: "F major", time: "2/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Kling,_Gl%C3%B6ckchen,_klingelingeling",
    notes: "C5:1 A4:0.5 Bb4:0.5 C5:0.25 D5:0.25 C5:0.25 D5:0.25 C5:1 Bb4:1 G4:0.5 C5:0.5 A4:2 G4:0.5 G4:0.5 A4:0.5 F4:0.5 A4:1 G4:1 Bb4:0.5 Bb4:0.5 C5:0.5 G4:0.5 Bb4:1 A4:1 G4:0.5 G4:0.5 A4:0.5 B4:0.5 C5:1 G4:1 A4:0.5 D5:0.5 C5:0.5 B4:0.5 D5:1 C5:1 C5:1 A4:0.5 Bb4:0.5 C5:0.25 D5:0.25 C5:0.25 D5:0.25 C5:1 Bb4:1 G4:0.5 C5:0.5 A4:2",
    lyrics: "Kling, Glöck- chen, klin- ge- lin- ge- ling, kling, Glöck- chen, kling! Lasst mich ein, ihr Kin- der, ist so kalt der Win- ter, öff- net mir die Tü- ren, lasst mich nicht er- frie- ren! Kling, Glöck- chen, klin- ge- lin- ge- ling, kling, Glöck- chen, kling!",
  },
  {
    id: "we-three-kings", title: "We Three Kings", origin: "us", key: "D minor", time: "6/8", tags: ["christmas"],
    source: "https://fr.wikipedia.org/wiki/We_Three_Kings",
    notes: "A4:1 G4:0.5 F4:1 D4:0.5 E4:0.5 F4:0.5 E4:0.5 D4:1.5 A4:1 G4:0.5 F4:1 D4:0.5 E4:0.5 F4:0.5 E4:0.5 D4:1.5 F4:1 F4:0.5 G4:1 G4:0.5 A4:1 A4:0.5 C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 A4:0.5 G4:0.5 F4:1 E4:0.5 D4:1.5 E4:1.5 F4:1 F4:0.5 F4:1 C4:0.5 F4:1 D4:0.5 F4:1.5 F4:1 F4:0.5 F4:1 C4:0.5 F4:1 D4:0.5 F4:1.5 F4:1 F4:0.5 G4:1 A4:0.5 Bb4:1 A4:0.5 G4:1 A4:0.5 F4:1 F4:0.5 F4:1 D4:0.5 F4:1 D4:0.5 F4:1.5",
  },
  {
    id: "o-little-town-of-bethlehem", title: "O Little Town of Bethlehem", origin: "us", key: "G major", time: "4/4", pickup: 1, tags: ["christmas"],
    source: "https://fr.wikipedia.org/wiki/O_Little_Town_of_Bethlehem",
    notes: "B4:1 B4:1 B4:1 Bb4:1 B4:1 D5:1 C5:1 E4:1 A4:1 G4:1 F#4:0.5 G4:0.5 A4:1 D4:1 B4:3 B4:1 B4:1 B4:1 E5:1 D5:1 D5:1 C5:1 E4:1 A4:1 G4:1 F#4:0.5 G4:0.5 B4:1 A4:1 G4:3 B4:1 B4:1 B4:1 A4:1 G4:1 F#4:2 F#4:1 F#4:1 E4:1 F#4:1 G4:1 A4:1 B4:3 B4:1 B4:1 B4:1 Bb4:1 B4:1 D5:1 C5:1 E4:1 E5:1 D5:1 G4:1 B4:1.5 A4:0.5 G4:3",
  },
  {
    id: "hark-the-herald", title: "Hark! The Herald Angels Sing", origin: "gb-eng", key: "F major", time: "4/4", tags: ["christmas"],
    source: "https://en.wikipedia.org/wiki/Hark!_The_Herald_Angels_Sing",
    notes: "C4:1 F4:1 F4:1.5 E4:0.5 F4:1 A4:1 A4:1 G4:1 C5:1 C5:1 C5:1.5 Bb4:0.5 A4:1 G4:1 A4:2 C4:1 F4:1 F4:1.5 E4:0.5 F4:1 A4:1 A4:1 G4:1 C5:1 G4:1 G4:1.5 E4:0.5 E4:1 D4:1 C4:2 C5:1 C5:1 C5:1 F4:1 Bb4:1 A4:1 A4:1 G4:1 C5:1 C5:1 C5:1 F4:1 Bb4:1 A4:1 A4:1 G4:1 D5:1 D5:1 D5:1 C5:1 Bb4:1 A4:1 Bb4:2 G4:1 A4:0.5 Bb4:0.5 C5:1.5 F4:0.5 F4:1 G4:1 A4:2 D5:1.5 D5:0.5 D5:1 C5:1 Bb4:1 A4:1 Bb4:2 G4:1 A4:0.5 Bb4:0.5 C5:1.5 F4:0.5 F4:1 G4:1 F4:2",
  },
  {
    id: "away-in-a-manger", title: "Away in a Manger", origin: "us", key: "F major", time: "3/4", pickup: 1, tags: ["christmas"],
    source: "https://en.wikipedia.org/wiki/Away_in_a_Manger",
    notes: "C5:1 C5:1.5 Bb4:0.5 A4:1 A4:1.5 G4:0.5 F4:1 F4:1 E4:1 D4:1 C4:2 C4:1 C4:1.5 D4:0.5 C4:1 C4:1 G4:1 E4:1 D4:1 C4:1 F4:1 A4:2 C5:1 C5:1.5 Bb4:0.5 A4:1 A4:1.5 G4:0.5 F4:1 F4:1 E4:1 D4:1 C4:2 C4:1 Bb4:1.5 A4:0.5 G4:1 A4:1 G4:1 F4:1 G4:1 D4:1 E4:1 F4:2",
    lyrics: "A- way in a man- ger, No crib for a bed, The lit- tle Lord Je- sus Laid down His sweet head. The stars in the sky _ Looked down where He lay, The lit- tle Lord Je- sus A- sleep on the hay.",
  },
  {
    id: "god-rest-ye", title: "God Rest Ye Merry, Gentlemen", origin: "gb-eng", key: "E minor", time: "4/4", pickup: 1, tags: ["christmas"],
    source: "https://en.wikipedia.org/wiki/God_Rest_Ye_Merry,_Gentlemen",
    notes: "E4:1 E4:1 B4:1 B4:1 A4:1 G4:1 F#4:1 E4:1 D4:1 E4:1 F#4:1 G4:1 A4:1 B4:3 E4:1 E4:1 B4:1 B4:1 A4:1 G4:1 F#4:1 E4:1 D4:1 E4:1 F#4:1 G4:1 A4:1 B4:3 B4:1 C5:1 A4:1 B4:1 C5:1 D5:1 E5:1 B4:1 A4:1 G4:1 E4:1 F#4:1 G4:1 A4:2 G4:1 A4:1 B4:2 C5:1 B4:1 B4:1 A4:1 G4:1 F#4:1 E4:2 G4:0.5 F#4:0.5 E4:1 A4:2 G4:1 A4:1 B4:1 C5:1 D5:1 E5:1 B4:1 A4:1 G4:1 F#4:1 E4:3",
  },
  {
    id: "ding-dong-merrily", title: "Ding Dong Merrily on High", origin: "gb-eng", key: "B♭ major", time: "4/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Ding!_Dong!_Merrily_on_High",
    notes: "Bb4:1 Bb4:1 C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 F4:3 F4:1 G4:1 Bb4:1 Bb4:1 A4:1 Bb4:2 Bb4:2 Bb4:1 Bb4:1 C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 F4:3 F4:1 G4:1 Bb4:1 Bb4:1 A4:1 Bb4:2 Bb4:2 F5:1.5 Eb5:0.5 D5:0.5 Eb5:0.5 F5:0.5 D5:0.5 Eb5:1.5 D5:0.5 C5:0.5 D5:0.5 Eb5:0.5 C5:0.5 D5:1.5 C5:0.5 Bb4:0.5 C5:0.5 D5:0.5 Bb4:0.5 C5:1.5 Bb4:0.5 A4:0.5 Bb4:0.5 C5:0.5 A4:0.5 Bb4:1.5 A4:0.5 G4:0.5 A4:0.5 Bb4:0.5 G4:0.5 A4:1.5 G4:0.5 F4:1 F4:1 G4:1 Bb4:1 Bb4:1 A4:1 Bb4:2 Bb4:2",
  },
  {
    id: "in-dulci-jubilo", title: "In dulci jubilo", origin: "de", key: "F major", time: "3/4", pickup: 1, tags: ["christmas"],
    source: "https://fr.wikipedia.org/wiki/In_dulci_jubilo",
    notes: "F4:1 F4:2 F4:1 A4:2 Bb4:1 C5:2 D5:1 C5:3 F4:2 F4:1 A4:2 Bb4:1 C5:2 D5:1 C5:3 C5:2 D5:1 C5:2 Bb4:1 A4:1.5 Bb4:0.5 A4:0.5 G4:0.5 F4:2 F4:1 G4:2 G4:1 A4:2 G4:1 F4:2 G4:1 A4:3 C5:2 D5:1 C5:2 Bb4:1 A4:1.5 Bb4:0.5 A4:0.5 G4:0.5 F4:2 F4:1 G4:2 G4:1 A4:2 G4:1 F4:2 G4:1 A4:3 D4:2 D4:1 E4:2 E4:1 F4:0.5 E4:0.5 F4:0.5 G4:0.5 A4:0.5 Bb4:0.5 C5:3 A4:2 A4:1 G4:2 G4:1 F4:5",
    lyrics: "In dul- ci ju- bi- lo, _ _ sing- et und seid froh, _ _ un- sers Her- zens Won- _ _ _ ne liegt in prae- se- pi- o, _ _ leuch- tet als die Son- _ _ _ ne mat- ris in pre- mi- o. _ _ Al- pha es et O! _ _ _ _ _ _ Al- pha es et O!",
  },
  {
    id: "it-came-upon-the-midnight-clear", title: "It Came Upon the Midnight Clear", origin: "us", key: "B♭ major", time: "6/8", pickup: 0.5, tags: ["christmas"],
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
    lyrics: "Lasst uns froh _ und _ mun- ter sein und uns recht _ von _ Her- zen freun! Lus- tig, lus- tig, tra- le- ra- le- ra! Bald ist Ni- ko- laus- _ a- bend da, bald ist Ni- ko- laus- _ a- bend da!",
  },
  {
    id: "suesser-die-glocken", title: "Süßer die Glocken nie klingen", origin: "de", key: "F major", time: "6/8", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/S%C3%BC%C3%9Fer_die_Glocken_nie_klingen",
    notes: "A4:0.75 A4:0.25 A4:0.5 A4:0.5 G4:0.5 A4:0.5 C5:1 Bb4:0.5 G4:1.5 G4:0.75 G4:0.25 G4:0.5 G4:0.5 F4:0.5 G4:0.5 A4:2.5 r:0.5 C5:0.75 C5:0.25 C5:0.5 C5:0.5 A4:0.5 F4:0.5 F5:1 D5:0.5 D5:1.5 C5:0.75 D5:0.25 C5:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:2.5 r:0.5 G4:0.75 G4:0.25 Bb4:0.5 A4:0.5 A4:0.5 C5:0.5 C5:0.75 Bb4:0.25 A4:0.5 G4:1.5 G4:0.75 G4:0.25 Bb4:0.5 A4:0.5 A4:0.5 C5:0.5 C5:0.75 Bb4:0.25 A4:0.5 G4:1.5 C5:0.75 Bb4:0.25 A4:0.5 A4:0.5 G4:0.5 F4:0.5 F5:1.5 D5:1.5 C5:0.75 D5:0.25 C5:0.5 C5:0.5 Bb4:0.5 G4:0.5 F4:2.5",
  },
  {
    id: "ihr-kinderlein-kommet", title: "Ihr Kinderlein, kommet", origin: "de", key: "D major", time: "2/4", pickup: 0.5, tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Ihr_Kinderlein,_kommet",
    notes: "A4:0.5 A4:1 F#4:0.5 A4:0.5 A4:1 F#4:0.5 A4:0.5 G4:1 E4:0.5 G4:0.5 F#4:1 r:0.5 A4:0.5 A4:1 F#4:0.5 A4:0.5 A4:1 F#4:0.5 A4:0.5 G4:1 E4:0.5 G4:0.5 F#4:1 r:0.5 F#4:0.5 E4:1 E4:0.5 E4:0.5 G4:1 G4:0.5 G4:0.5 F#4:1 F#4:0.5 F#4:0.5 B4:1 r:0.5 B4:0.5 A4:1 A4:0.5 A4:0.5 D5:1 A4:0.5 F#4:0.5 G4:1 E4:0.5 C#4:0.5 D4:1.5",
    lyrics: "Ihr Kin- der- lein, kom- met, o kom- met doch all! Zur Krip- pe her kom- met in Beth- le- hems Stall und seht, was in die- ser hoch- hei- li- gen Nacht der Va- ter im Him- mel für Freu- de uns macht!",
  },
  {
    id: "tu-scendi-dalle-stelle", title: "Tu scendi dalle stelle", origin: "it", key: "E♭ major", time: "6/8", pickup: 0.5, tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Tu_scendi_dalle_stelle",
    notes: "Bb4:0.5 Bb4:1 C5:0.5 Bb4:1 Ab4:0.5 Ab4:0.5 G4:2 F4:0.5 G4:0.5 Ab4:0.5 Bb4:0.5 Bb4:0.5 Ab4:0.5 G4:0.5 F4:2.5 G4:0.5 F4:1 G4:0.5 Ab4:1 G4:0.5 F4:1.5 C5:1.5 Bb4:0.5 C5:0.5 Bb4:0.5 Ab4:0.5 G4:0.5 F4:0.5 G4:2.5 G4:0.5 F4:1 G4:0.5 Ab4:1 G4:0.5 F4:1.5 C5:1.5 Bb4:0.5 C5:0.5 Bb4:0.5 Ab4:0.5 G4:0.5 F4:0.5 Eb4:1.5 G4:0.5 Ab4:0.5 Bb4:0.5 Ab4:1 Ab4:0.5 F4:0.5 G4:0.5 Ab4:0.5 G4:1 G4:0.5 G4:0.5 Ab4:0.5 Bb4:0.5 Ab4:1 Ab4:0.5 F4:0.5 G4:0.5 Ab4:0.5 G4:2.5 F4:0.5 G4:0.5 Ab4:0.5 Bb4:0.5 Bb4:0.5 Ab4:0.5 G4:0.5 F4:2.5 G4:0.5 F4:1 G4:0.5 Ab4:1 G4:0.5 F4:1.5 C5:1.5 Bb4:0.5 C5:0.5 Bb4:0.5 Ab4:0.5 G4:0.5 F4:0.5 G4:2.5 G4:0.5 F4:1 G4:0.5 Ab4:1 G4:0.5 F4:1.5 C5:1.5 Bb4:0.5 C5:0.5 Bb4:0.5 Ab4:0.5 G4:0.5 F4:0.5 Eb4:3",
  },
  {
    id: "es-ist-ein-ros-entsprungen", title: "Es ist ein Ros entsprungen", origin: "de", key: "F major", time: "4/4", pickup: 2, tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Es_ist_ein_Ros_entsprungen",
    notes: "C5:2 C5:1 C5:1 D5:1 C5:1 C5:2 A4:2 Bb4:2 A4:1 G4:2 F4:2 E4:1 F4:2 C5:2 C5:1 C5:1 D5:1 C5:1 C5:2 A4:2 Bb4:2 A4:1 G4:2 F4:2 E4:1 F4:2 r:1 A4:1 G4:1 E4:1 F4:1 D4:1 C4:2 r:1 C5:1 C5:1 C5:1 D5:1 C5:1 C5:2 A4:2 Bb4:2 A4:1 G4:2 F4:2 E4:1 F4:2",
    lyrics: "Es ist ein Ros ent- sprun- gen aus ei- ner Wur- zel zart, Wie uns die Al- ten sun- gen, von Jes- se kam die Art, Und hat ein Blüm- lein bracht, mit- ten im kal- ten Win- ter, wohl zu der hal- ben Nacht.",
  },
  {
    id: "still-still-still", title: "Still, still, still", origin: "at", key: "F major", time: "2/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Still,_still,_still",
    notes: "C5:1 F5:1 A4:1 C5:1 F4:1 F4:0.5 A4:0.5 G4:1 G4:0.5 Bb4:0.5 E4:1 E4:0.5 G4:0.5 F4:2 r:1 F4:1 G4:1 G4:0.5 A4:0.5 Bb4:1 G4:1 A4:1 A4:0.5 Bb4:0.5 C5:1 A4:1 G4:1 G4:0.5 A4:0.5 Bb4:1 G4:1 A4:1 A4:0.5 Bb4:0.5 C5:1 A4:1 C5:1 F5:1 A4:1 C5:1 F4:1 F4:0.5 A4:0.5 G4:1 G4:0.5 Bb4:0.5 E4:1 E4:0.5 G4:0.5 F4:2",
    lyrics: "Still, _ still, _ still, weil’s _ Kind- lein _ schla- fen _ will. Ma- ri- a _ tut es nie- der- _ sing- en, ih- re _ keu- sche Brust dar- _ brin- gen. Still, _ still, _ still, weil’s _ Kind- lein _ schla- fen _ will.",
  },
  {
    id: "morgen-kinder", title: "Morgen, Kinder, wird’s was geben", origin: "de", key: "G major", time: "2/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Morgen,_Kinder,_wird%E2%80%99s_was_geben",
    notes: "G4:0.5 D4:0.5 E4:0.5 D4:0.5 E4:0.25 G4:0.25 F#4:0.25 A4:0.25 G4:0.5 D4:0.5 B4:0.5 B4:0.25 C5:0.25 D5:0.5 B4:0.5 C5:0.5 B4:0.5 A4:1 G4:0.5 D4:0.5 E4:0.5 D4:0.5 E4:0.25 G4:0.25 F#4:0.25 A4:0.25 G4:0.5 D4:0.5 B4:0.5 B4:0.25 C5:0.25 D5:0.5 B4:0.5 C5:0.5 B4:0.5 A4:1 C5:0.5 C5:0.5 E5:0.5 E5:0.5 A4:0.5 A4:0.5 D5:1 G4:0.5 G4:0.5 C5:0.5 C5:0.5 B4:0.25 A4:0.25 G4:0.25 F#4:0.25 G4:1",
    lyrics: "Mor- gen, Kin- der, wird’s _ was _ ge- ben, mor- gen _ wer- den wir uns freu’n! Wel- che Won- ne, welch _ ein _ Le- ben wird in _ un- serm Hau- se sein! Ein- mal wer- den wir noch wach, hei- ßa, dann ist Weih- _ nachts- _ tag!",
  },
  {
    id: "la-marche-des-rois", title: "La Marche des rois", origin: "fr", key: "C minor", time: "4/4", pickup: 2, tags: ["christmas"],
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
    lyrics: "High King of _ Hea- ven, my _ vi- cto- ry won, May I reach Hea- ven's joys, O bright Heav’n's Sun! Heart of _ my _ own heart, what- e- ver be- fall, _ Still be my Vi- _ sion, O _ Ru- ler of all.",
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
    id: "kommt-ein-vogel-geflogen", title: "Kommt ein Vogel geflogen", origin: "de", key: "F major", time: "3/4", pickup: 1,
    source: "https://de.wikipedia.org/wiki/Kommt_ein_Vogel_geflogen",
    notes: "A4:0.5 Bb4:0.5 C5:1 A4:1 A4:1 A4:1 G4:1 G4:0.5 A4:0.5 Bb4:1 G4:1 G4:0.5 D5:0.5 C5:1 r:1 A4:0.5 Bb4:0.5 C5:1 A4:1 A4:1 A4:1 G4:1 G4:0.5 A4:0.5 Bb4:1 E4:1 E4:1 F4:1 r:1",
    lyrics: "Kommt ein Vo- gel ge- flo- gen, setzt sich nie- der auf mein’ Fuß, hat ein’ Zet- tel im Schna- bel, von der Mut- ter ein’ Gruß",
  },
  {
    id: "die-gedanken-sind-frei", title: "Die Gedanken sind frei", origin: "de", key: "C major", time: "3/4", pickup: 1,
    source: "https://de.wikipedia.org/wiki/Die_Gedanken_sind_frei",
    notes: "G4:0.5 G4:0.5 C5:1 C5:1 E5:0.5 C5:0.5 G4:2 G4:1 F4:1 D4:1 G4:1 E4:1 C4:1 G4:1 C5:1 C5:1 E5:0.5 C5:0.5 G4:2 G4:1 F4:1 D4:1 G4:1 E4:1 C4:1 C5:1 B4:1 D5:1 D5:1 C5:1 E5:1 E5:1 B4:1 D5:1 D5:1 C5:1 E5:1 C5:1 A4:1 A4:1 C5:0.5 A4:0.5 G4:2 G4:0.5 E5:0.5 E5:0.5 D5:0.5 C5:1 B4:1 C5:2",
  },
  {
    id: "kein-schoener-land", title: "Kein schöner Land in dieser Zeit", origin: "de", key: "A major", time: "3/4", pickup: 1.5,
    source: "https://de.wikipedia.org/wiki/Kein_sch%C3%B6ner_Land_in_dieser_Zeit",
    notes: "E4:0.5 E4:0.5 E4:0.5 A4:1 C#5:1 B4:0.5 A4:0.5 B4:1 r:0.5 E4:0.5 E4:0.5 E4:0.5 A4:1 C#5:1 B4:0.5 A4:0.5 B4:1 r:0.5 C#5:0.5 A4:0.5 B4:0.5 C#5:0.5 E5:0.5 D5:0.5 C#5:0.5 B4:0.5 A4:0.5 B4:0.5 D5:0.5 C#5:0.5 B4:0.5 A4:0.5 B4:0.5 C#5:1 r:0.5 C#5:0.5 A4:0.5 B4:0.5 C#5:0.5 E5:0.5 D5:0.5 C#5:0.5 B4:0.5 A4:0.5 B4:0.5 D5:0.5 C#5:0.5 B4:0.5 A4:0.5 Ab4:0.5 A4:1 r:0.5",
  },
  {
    id: "alle-voegel-sind-schon-da", title: "Alle Vögel sind schon da", origin: "de", key: "D major", time: "4/4",
    source: "https://de.wikipedia.org/wiki/Alle_V%C3%B6gel_sind_schon_da",
    notes: "D4:1.5 F#4:0.5 A4:1 D5:1 B4:1 D5:0.5 B4:0.5 A4:2 G4:1.5 A4:0.5 F#4:1 D4:1 E4:2 D4:1 r:1 A4:1 A4:1 G4:1 G4:1 F#4:1 A4:0.5 F#4:0.5 E4:2 A4:1 A4:1 G4:1 G4:1 F#4:1 A4:0.5 F#4:0.5 E4:2 D4:1.5 F#4:0.5 A4:1 D5:1 B4:1 D5:0.5 B4:0.5 A4:2 G4:1.5 A4:0.5 F#4:1 D4:1 E4:2 D4:1 r:1",
    lyrics: "Al- le Vö- gel sind schon _ da, al- le Vö- gel, al- le. Welch ein Sin- gen, Mu- si- _ ziern, Pfei- fen, Zwit- schern, Ti- ri- _ liern! Früh- ling will nun ein- mar- _ schiern, kommt mit Sang und Schal- le.",
  },
  {
    id: "der-kuckuck-und-der-esel", title: "Der Kuckuck und der Esel", origin: "de", key: "F major", time: "4/4", pickup: 1,
    source: "https://de.wikipedia.org/wiki/Der_Kuckuck_und_der_Esel",
    notes: "C5:1 A4:1 C5:1 A4:1 C5:1 Bb4:1 Bb4:1 r:1 Bb4:1 G4:1 Bb4:1 G4:1 Bb4:1 A4:2 r:1 C5:0.5 Bb4:0.5 A4:1 A4:1 A4:1 A4:1 Bb4:1 Bb4:1 r:1 Bb4:0.5 A4:0.5 G4:1 G4:1 G4:1 G4:1 A4:1 A4:1 r:1 F4:1 F4:1 G4:1 A4:1 Bb4:1 C5:1.5 D5:0.5 C5:1 Bb4:1 A4:1 A4:1 G4:1 G4:1 F4:2 r:1",
    lyrics: "Der Ku- ckuck und der E- sel, die hat- ten gro- ßen Streit, wer _ wohl am bes- ten sän- ge, wer _ wohl am bes- ten sän- ge zur schö- nen Mai- en- zeit, _ _ zur schö- nen Mai- en- zeit.",
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
    id: "guter-mond", title: "Guter Mond, du gehst so stille", origin: "de", key: "F major", time: "4/4", pickup: 1,
    source: "https://de.wikipedia.org/wiki/Guter_Mond,_du_gehst_so_stille",
    notes: "C5:0.75 Bb4:0.25 A4:1 A4:1 A4:0.5 Bb4:0.5 C5:0.5 D5:0.5 C5:0.75 Bb4:0.25 G4:1 r:1 C5:0.75 Bb4:0.25 A4:1.5 A4:0.5 G4:0.5 F4:0.5 G4:0.5 A4:0.5 F4:2 r:1 C5:0.75 Bb4:0.25 A4:1 A4:1 A4:0.5 Bb4:0.5 C5:0.5 D5:0.5 C5:0.75 Bb4:0.25 G4:1 r:1 C5:0.75 Bb4:0.25 A4:1.5 A4:0.5 G4:0.5 F4:0.5 G4:0.5 A4:0.5 F4:2 r:1 G4:0.75 A4:0.25 Bb4:1 G4:1 r:1 A4:0.75 Bb4:0.25 C5:1 A4:1 r:1 A4:0.5 C5:0.5 D5:1.5 C5:0.5 D5:0.5 C5:0.5 Bb4:0.5 A4:0.5 A4:1 G4:1 r:1 C5:0.75 Bb4:0.25 A4:1 A4:1 A4:0.5 Bb4:0.5 C5:0.5 D5:0.5 C5:0.75 Bb4:0.25 G4:1 r:1 C5:0.75 Bb4:0.25 A4:1.5 A4:0.5 G4:0.5 F4:0.5 G4:0.5 A4:0.5 F4:2 r:1",
    lyrics: "Gu- ter Mond, du gehst _ so _ stil- _ le in den A- bend- wol- _ ken _ hin, bist so ru- hig, und _ ich _ füh- _ le, dass ich o- hne Ru- _ he _ bin. Trau- rig fol- gen mei- ne Bli- cke dei- ner stil- len hei- _ tern _ Bahn. _ O wie hart ist mein _ Ge- _ schi- _ cke, dass ich dir nicht fol- _ gen _ kann!",
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
    id: "im-maerzen-der-bauer", title: "Im Märzen der Bauer", origin: "de", key: "B♭ major", time: "3/4", pickup: 1,
    source: "https://de.wikipedia.org/wiki/Im_M%C3%A4rzen_der_Bauer",
    notes: "F4:1 Bb4:1 Bb4:1 D5:1 C5:1 C5:1 Eb5:1 A4:1 A4:1 C5:1 Bb4:2 F4:1 Bb4:1 Bb4:1 D5:1 C5:1 C5:1 Eb5:1 A4:1 A4:1 C5:1 Bb4:2 F5:1 C5:1 C5:1 F5:1 D5:1 D5:1 F5:1 Eb5:1 Eb5:1 F5:1 D5:2 F4:1 Bb4:1 Bb4:1 D5:1 C5:1 C5:1 Eb5:1 A4:1 A4:1 C5:1 Bb4:2",
  },
  {
    id: "der-mai-ist-gekommen", title: "Der Mai ist gekommen", origin: "de", key: "D major", time: "3/4", pickup: 1,
    source: "https://de.wikipedia.org/wiki/Der_Mai_ist_gekommen",
    notes: "D4:0.5 E4:0.5 F#4:1 F#4:1.5 G4:0.5 B4:1 A4:1.5 F#4:0.5 A4:0.75 G4:0.25 G4:1 A4:1 F#4:2 D4:0.5 E4:0.5 F#4:1 F#4:1.5 G4:0.5 B4:1 A4:1.5 F#4:0.5 A4:0.75 G4:0.25 G4:1 A4:1 F#4:2 F#4:0.75 F#4:0.25 E4:1 A4:1.5 A4:0.5 Ab4:1 B4:1.5 B4:0.5 E5:0.75 D5:0.25 C#5:0.75 B4:0.25 A4:0.75 Ab4:0.25 A4:2 A4:0.5 G4:0.5 F#4:0.75 F#4:0.25 F#4:1.5 G4:0.5 B4:1 A4:1.5 F#4:0.5 A4:0.75 G4:0.25 G4:1 A4:1 F#4:2",
  },
  {
    id: "fuchs-du-hast-die-gans-gestohlen", title: "Fuchs, du hast die Gans gestohlen", origin: "de", key: "D major", time: "4/4",
    source: "https://de.wikipedia.org/wiki/Fuchs,_du_hast_die_Gans_gestohlen",
    notes: "D4:1 E4:1 F#4:1 G4:1 A4:1 A4:1 A4:1 A4:1 B4:1 G4:1 D5:1 B4:1 A4:4 B4:1 G4:1 D5:1 B4:1 A4:4 A4:1 G4:1 G4:1 G4:1 G4:1 F#4:1 F#4:1 F#4:1 F#4:1 E4:1 F#4:1 E4:1 D4:1 F#4:1 A4:2 A4:1 G4:1 G4:1 G4:1 G4:1 F#4:1 F#4:1 F#4:1 F#4:1 E4:1 F#4:1 E4:1 D4:4",
    lyrics: "Fuchs, du hast die Gans ge- stoh- len, gib sie wie- der her, gib sie wie- der her, sonst wird dich der Jä- ger ho- len mit dem Schieß- ge- wehr, _ _ sonst wird dich der Jä- ger ho- len mit dem Schieß- ge- wehr.",
  },
  {
    id: "sur-le-pont-davignon", title: "Sur le pont d’Avignon", origin: "fr", key: "F major", time: "2/4", pickup: 1,
    source: "https://fr.wikipedia.org/wiki/Sur_le_pont_d'Avignon",
    notes: "F4:0.5 F4:0.5 F4:1 G4:0.5 G4:0.5 G4:1 A4:0.5 Bb4:0.5 C5:0.5 F4:0.5 E4:0.5 F4:0.5 G4:0.5 C4:0.5 F4:0.5 F4:0.5 F4:1 G4:0.5 G4:0.5 G4:1 A4:0.5 Bb4:0.5 C5:0.5 F4:0.5 G4:0.5 E4:0.5 F4:1 F4:0.5 F4:0.5 F4:0.5 F4:0.5 G4:1 F4:1 F4:0.5 F4:0.5 F4:0.5 F4:0.5 G4:1 F4:1 F4:0.5 F4:0.5 F4:1 G4:0.5 G4:0.5 G4:1 A4:0.5 Bb4:0.5 C5:0.5 F4:0.5 E4:0.5 F4:0.5 G4:0.5 C4:0.5 F4:0.5 F4:0.5 F4:1 G4:0.5 G4:0.5 G4:1 A4:0.5 Bb4:0.5 C5:0.5 F4:0.5 G4:0.5 E4:0.5 F4:1",
  },
  {
    id: "itsy-bitsy-spider", title: "Itsy Bitsy Spider", origin: "us", key: "G major", time: "6/8", pickup: 0.5,
    source: "https://en.wikipedia.org/wiki/Itsy_Bitsy_Spider",
    notes: "D4:0.5 G4:1 G4:0.5 G4:1 A4:0.5 B4:1.5 B4:1 B4:0.5 A4:1 G4:0.5 A4:1 B4:0.5 G4:3 B4:1.5 B4:1 C5:0.5 D5:1.5 D5:1.5 C5:1 B4:0.5 C5:1 D5:0.5 B4:3 G4:1.5 G4:1 A4:0.5 B4:1.5 B4:1.5 A4:1 G4:0.5 A4:1 B4:0.5 G4:1.5 F#4:1 F#4:0.5 G4:1 G4:0.5 G4:1 A4:0.5 B4:1.5 B4:1 B4:0.5 A4:1 G4:0.5 A4:1 B4:0.5 G4:2.5",
    lyrics: "The it- sy bit- sy spi- der crawled up the wa- ter spout. Down came the rain and washed the spi- der out! Up came the sun and dried up all the rain. And the it- sy bit- sy spi- der went up the spout a- gain.",
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
    lyrics: "Lus- tig ist das Zi- geu- ner- le- _ ben, fa- ri- a, fa- ri- a, ho. Brau-chen dem Kai- ser kein Zins zu ge- _ ben, fa- ri- a, fa- ri- a, ho. Lus- tig ist es im grü- nen Wald, wo des Zi- geu- _ ners Auf- ent- halt, Fa- ri- a, fa- ri- a, fa- ri- a, fa- ri- a, fa- ri- a, fa- ri- a, ho.",
  },
  {
    id: "ich-geh-mit-meiner-laterne", title: "Ich geh mit meiner Laterne", origin: "de", key: "G major", time: "6/8", pickup: 0.5,
    source: "https://de.wikipedia.org/wiki/Ich_geh_mit_meiner_Laterne",
    notes: "D4:0.5 G4:1 G4:0.5 B4:0.5 G4:0.5 B4:0.5 D5:1.5 B4:1 G4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:0.5 B4:0.5 A4:0.5 G4:1.5 r:1 D4:0.5 G4:1 G4:0.5 B4:0.5 G4:0.5 B4:0.5 D5:1.5 B4:1 G4:0.5 A4:1 A4:0.5 A4:0.5 B4:0.5 A4:0.5 G4:1.5 r:1 B4:0.5 D5:1 B4:0.5 G4:1 B4:0.5 D5:1 B4:0.5 G4:1 G4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:0.5 B4:0.5 A4:0.5 G4:1.5 r:1 B4:0.5 D5:1 B4:0.5 G4:1 B4:0.5 D5:1 B4:0.5 G4:1 G4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:0.5 B4:0.5 A4:0.5 G4:1.5",
    lyrics: "Ich geh’ mit mei- ner La- ter- ne und mei- ne La- ter- ne mit mir. Da o- ben leuch- ten die Ster- ne und un- ten da leuch- ten wir. Mein Licht ist aus, ich geh’ nach Haus. ra- bimm- el, ra- bamm- el, ra- bum. Mein Licht ist aus, ich geh’ nach Haus. ra- bimm- el, ra- bamm- el, ra- bum.",
  },
  {
    id: "die-vogelhochzeit", title: "Die Vogelhochzeit", origin: "de", key: "G major", time: "2/4", pickup: 0.5,
    source: "https://de.wikipedia.org/wiki/Die_Vogelhochzeit",
    notes: "B4:0.5 D5:0.5 B4:0.5 D5:0.5 B4:0.5 C5:0.5 A4:0.5 C5:0.5 A4:0.5 B4:0.5 G4:0.5 D5:0.5 B4:0.5 A4:0.5 D5:0.5 D5:0.5 D5:0.25 B4:0.25 G4:0.5 G4:0.5 G4:0.5 D5:0.25 B4:0.25 A4:0.5 A4:0.5 A4:0.5 D5:0.25 C5:0.25 B4:0.5 G4:0.5 A4:0.5 F#4:0.5 G4:1",
    lyrics: "Ein Vo- gel woll- te Hoch- zeit ma- chen in dem grü- nen Wal- _ de. Fi- di- ral- la- la, fi- di- ral- la- la, fi- di- ral- la- la- la- la.",
  },
  {
    id: "der-mond-ist-aufgegangen", title: "Der Mond ist aufgegangen", origin: "de", key: "F major", time: "4/4", pickup: 1,
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
    lyrics: "Ba- cke, ba- cke Ku- chen, der Bä- cker hat ge- ru- fen. Wer will gu- ten Ku- chen ba- cken, der muss ha- ben sie- ben Sa- chen: Ei- er und Schmalz, Zu- cker und Salz, Milch und Mehl, Sa- fran macht den Ku- chen gehl. Schieb, schieb in'n O- fen 'nein.",
  },
  {
    id: "tochter-zion", title: "Tochter Zion, freue dich", origin: "de", key: "G major", time: "4/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Tochter_Zion,_freue_dich",
    notes: "B4:0.5 A4:0.5 B4:0.5 C5:0.5 B4:1 B4:1 A4:2 G4:2 C5:1 B4:1 A4:1 G4:1 F#4:4 G4:0.5 F#4:0.5 G4:0.5 A4:0.5 G4:1 G4:1 E5:2 C#5:2 D5:1 E5:0.5 D5:0.5 C#5:1.5 D5:0.5 D5:4 B4:0.5 A4:0.5 B4:0.5 C5:0.5 B4:1 B4:1 A4:2 G4:2 C5:1 B4:1 A4:1 G4:1 F#4:4 G4:0.5 F#4:0.5 G4:0.5 A4:0.5 G4:1 G4:1 E5:2 C#5:2 D5:1 E5:0.5 D5:0.5 C#5:1.5 D5:0.5 D5:4",
    lyrics: "Toch- _ _ _ _ ter Zi- on, freu- _ _ e dich, jauch- _ _ _ _ ze laut, Je- ru- _ _ _ sa- lem! Sieh, _ _ _ _ dein Kö- nig kömmt _ _ zu dir, ja, _ _ _ _ er kömmt, der Frie- _ _ _ de- fürst.",
  },
  {
    id: "le-bon-roi-dagobert", title: "Le bon roi Dagobert", origin: "fr", key: "G major", time: "6/8", pickup: 0.5,
    source: "https://fr.wikipedia.org/wiki/Le_bon_roi_Dagobert",
    notes: "B4:0.5 B4:1 A4:0.5 A4:1 G4:0.5 G4:1.5 A4:1.5 B4:0.5 C5:0.5 B4:0.5 A4:0.5 G4:0.5 A4:0.5 G4:1.5 r:0.5 G4:0.5 A4:0.5 B4:1 B4:0.5 B4:0.5 C5:0.5 D5:0.5 A4:1 A4:0.5 A4:0.5 G4:0.5 A4:0.5 B4:1 B4:0.5 B4:0.5 C5:0.5 D5:0.5 A4:1 A4:0.5 A4:1 B4:0.5 B4:1 A4:0.5 A4:1 G4:0.5 G4:1.5 A4:1.5 B4:0.5 C5:0.5 B4:0.5 A4:0.5 G4:0.5 A4:0.5 G4:2.5",
    lyrics: "Le bon roi Da- go- bert a mis sa cu- lotte à l'en- vers ; le grand saint É- loi lui dit : Ô mon roi ! vo- tre Ma- jes- té est mal cu- lot- tée. c'est vrai, lui dit le roi, je vais la re- mettre à l'en- droit.",
  },
  {
    id: "le-temps-des-cerises", title: "Le Temps des cerises", origin: "fr", key: "D minor", time: "6/8",
    source: "https://fr.wikipedia.org/wiki/Le_Temps_des_cerises",
    notes: "C4:0.5 F4:0.5 F4:0.5 F4:0.5 F4:1 F4:0.5 G4:0.5 G4:0.5 G4:0.5 G4:0.5 G4:0.5 G4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:1 A4:0.5 Bb4:0.5 Bb4:0.5 Bb4:0.5 Bb4:0.5 r:0.5 A4:0.5 A4:0.5 A4:0.5 Bb4:0.5 A4:1.5 G4:1.5 F4:0.5 r:0.5 F4:0.5 Bb4:0.5 Bb4:0.5 Bb4:0.5 Bb4:1 Bb4:0.5 Bb4:0.5 D5:0.5 Bb4:0.5 Bb4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:0.5 C5:1 A4:0.5 A4:0.5 G4:0.5 F4:0.5 G4:3.5 r:0.5 C4:0.5 F4:0.5 F4:0.5 F4:0.5 F4:1 F4:0.5 G4:0.5 G4:0.5 G4:0.5 G4:0.5 G4:0.5 G4:0.5 A4:0.5 A4:0.5 A4:0.5 C5:1 A4:0.5 A4:0.5 G4:0.5 F4:0.5 F4:3.5",
    lyrics: "Quand nous chan- te- rons le temps des ce- ri- ses, Et gai ros- si- gnol et mer- le mo- queur Se- ront tous en fê- _ te. Les bel- les au- ront la fo- lie en tê- te, Et les a- mou- reux, du so- leil au cœur. Quand nous chan- te- rons le temps des ce- ri- ses, Sif- fle- ra bien mieux le mer- le mo- queur.",
  },
  {
    id: "mennybol-az-angyal", title: "Mennyből az angyal", origin: "hu", key: "F major", time: "2/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Mennyb%C5%91l_az_angyal",
    notes: "F4:1 F4:0.5 E4:0.5 F4:1 C4:1 A4:1 A4:0.5 G4:0.5 A4:1 F4:1 A4:1 D5:1 C5:2 A4:1 D5:1 C5:2 C5:1 C5:0.5 D5:0.5 C5:1 A4:1 Bb4:1 Bb4:0.5 C5:0.5 Bb4:1 G4:1 A4:1 G4:1 F4:2 A4:1 G4:1 F4:2",
    lyrics: "Menny- ből az an- gyal le- jött hoz- zá- tok, pász- to- rok, pász- to- rok, hogy Bet- le- hem- be si- et- ve men- vén lás- sá- tok, lás- sá- tok.",
  },
  {
    id: "am-weihnachtsbaum", title: "Am Weihnachtsbaum die Lichter brennen", origin: "de", key: "C major", time: "3/4", pickup: 1.5, tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Am_Weihnachtsbaum_die_Lichter_brennen",
    notes: "C4:0.5 C4:0.5 E4:0.5 G4:1 E4:0.5 G4:0.5 C5:0.5 A4:0.5 G4:1 E4:0.5 G4:0.5 A4:0.5 G4:0.5 F4:1 D4:1 G4:0.5 G4:0.5 E4:1 r:0.5 E4:0.5 E4:0.5 G4:0.5 F4:1 D4:0.5 F4:0.5 F4:0.5 A4:0.5 G4:1 E4:0.5 E4:0.5 E4:0.5 G4:0.5 F4:1 D4:1 G4:0.5 G4:0.5 E4:1",
    lyrics: "Am Weih- nachts- baum _ die Lich- ter bren- nen, wie glänzt er fest- lich, lieb und mild, als spräch’ er: wollt _ in mir er- ken- nen ge- treu- er Hoff- nung still- es Bild.",
  },
  {
    id: "quem-pastores", title: "Quem pastores laudavere", origin: "de", key: "A♭ major", time: "3/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Quem_pastores_laudavere",
    notes: "Ab4:2 C5:1 Eb5:2 C5:1 C#5:1 Eb5:1 F5:1 Eb5:1 Bb4:2 C5:1 C#5:1 Eb5:1 C#5:1 C5:1 Bb4:1 Ab4:2 F4:1 G4:1 Eb4:2 C5:2 C#5:1 Eb5:2 F5:1 Eb5:2 Bb4:1 C5:1 Ab4:2 C#5:2 C#5:1 C5:1 Bb4:1 Ab4:1 Ab4:1 F4:1 G4:1 Ab4:3",
    lyrics: "Quem pas- to- res lau- _ da- ve- re, qui- _ bus an- _ ge- li dix- e- re, ab- sit vo- bis iam ti- me- re, na- tus est _ rex glo- _ ri- ae.",
  },
  {
    id: "ich-steh-an-deiner-krippen", title: "Ich steh an deiner Krippen hier", origin: "de", key: "C minor", time: "4/4", pickup: 1, tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Ich_steh_an_deiner_Krippen_hier",
    notes: "G4:1 C5:1 D5:1 Eb5:1 C5:1 Bb4:1.5 Ab4:0.5 G4:1 Bb4:1 Eb4:1.5 D4:0.5 Eb4:1 F4:1 G4:2 G4:1 G4:1 C5:1 D5:1 Eb5:1 C5:1 Bb4:1.5 Ab4:0.5 G4:1 Bb4:1 Eb4:1.5 D4:0.5 Eb4:1 F4:1 G4:2 G4:1 Bb4:1 Eb5:1 Bb4:1 C5:1 Bb4:1 Ab4:1.5 Bb4:0.5 G4:1 Bb4:1 Eb5:1 Bb4:1 C5:1 Bb4:1 Ab4:1.5 Bb4:0.5 G4:1 G4:1 A4:1 B4:1 C5:0.5 Eb5:0.5 D5:0.5 C5:0.5 B4:2 C5:1",
    lyrics: "Ich steh an dei- ner Krip- pen hier, o Je- su- lein, mein Le- ben; ich ste- he, bring und schen- ke dir, was du mir hast ge- ge- ben. Nimm hin, es ist mein Geist und Sinn, Herz, Seel und Mut, nimm al- les hin und lass dirs wohl- _ ge- _ fal- len.",
  },
  {
    id: "es-wird-scho-glei-dumpa", title: "Es wird scho glei dumpa", origin: "at", key: "A♭ major", time: "3/4", pickup: 1, tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Es_wird_scho_glei_dumpa",
    notes: "Eb4:1 Ab4:1 Ab4:1 Bb4:1 C5:0.75 Eb5:0.25 Eb5:1.5 C#5:0.5 C5:1 C5:1 Bb4:1 Ab4:2 Eb4:1 Ab4:1 Ab4:1 Bb4:1 C5:0.75 Eb5:0.25 Eb5:1.5 C#5:0.5 C5:1 C5:1 Bb4:1 Ab4:2 C5:0.5 C#5:0.5 Eb5:1 C5:1 Eb5:1 Eb5:0.5 C#5:0.5 Bb4:1.5 C#5:0.5 C5:1 Ab4:1 C5:1 Bb4:2 Eb4:1 Ab4:1 Ab4:1 Bb4:1 C5:0.75 Eb5:0.25 Eb5:1.5 C#5:0.5 C5:1 C5:1 Bb4:1 Ab4:2 C5:0.5 Eb4:0.5 Ab4:2 C5:0.5 Eb4:0.5 Ab4:1.5 Eb4:0.5 Ab4:0.5 C5:0.5 Eb5:1 C5:0.5 Ab4:0.5 Bb4:0.5 Eb4:0.5 Ab4:2",
    lyrics: "Es wird schon glei dum- _ per, es wird ja schon Nacht. Drum kim i zá Dir _ he, mein Hei- land áf d’Wacht; will _ sing- en á Lied- _ l mein Lieb- ling den klain; du magst ja nöt schla- _ fen, i her di nu wain; hei _ hei, hei _ hei! _ Schlaf _ süeß, Du _ schen’s _ Kind.",
  },
  {
    id: "freu-dich-erd-und-sternenzelt", title: "Freu dich, Erd und Sternenzelt", origin: "cz", key: "G major", time: "2/4", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Freu_dich,_Erd_und_Sternenzelt",
    notes: "G4:0.5 A4:0.5 B4:0.5 C5:0.5 D5:0.5 D5:0.5 D5:1 C5:0.5 D5:0.5 E5:1 D5:1.5 r:0.5 D5:0.5 D5:0.5 C5:0.5 C5:0.5 B4:0.5 B4:0.5 A4:1 B4:0.5 C5:0.5 A4:1 G4:1.5 r:0.5 B4:0.5 A4:0.5 B4:0.5 C5:0.5 D5:1 A4:1 B4:0.5 A4:0.5 B4:0.5 C5:0.5 D5:1 A4:1 G4:1 E5:1 D5:0.5 B4:0.5 A4:1 G4:2",
    lyrics: "Freu' dich, Erd' und Ster- nen- zelt, Hal- le- lu- ja! Got- tes Sohn kam in die Welt, Hal- le- lu- ja! Uns zum Heil er- ko- ren, ward er heut' ge- bo- ren, heu- te uns ge- bo- ren!",
  },
  {
    id: "auf-auf-ihr-hirten", title: "Auf, auf, ihr Hirten", origin: "at", key: "A major", time: "3/8", tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Auf,_auf,_ihr_Hirten,_euch_nicht_verweilet",
    notes: "E4:0.5 A4:0.5 A4:0.5 Ab4:1 B4:0.5 A4:0.5 C#5:0.5 C#5:0.5 B4:1 D5:0.5 E5:0.5 C#5:0.5 B4:0.5 A4:1 r:0.5 E5:0.5 D5:0.5 C#5:0.5 D5:0.5 B4:1 D5:0.5 C#5:0.5 B4:0.5 C#5:0.5 A4:1 A4:0.5 Ab4:0.5 A4:0.5 B4:0.5 A4:0.5 B4:0.5 E5:0.5 C#5:0.5 B4:0.5 A4:1 r:0.5 E5:0.5 C#5:0.5 B4:0.5 A4:1",
    lyrics: "Auf, auf ihr Hir- ten! Euch nicht ver- wei- let! Lauf- et mit Freud! Da werd’t ihr seh- en, tut al- le geh- en Groß und Klein ins- ge- mein nach Beth- le- hem, nach Beth- le- hem!",
  },
  {
    id: "zu-bethlehem-geboren", title: "Zu Bethlehem geboren", origin: "de", key: "F major", time: "4/4", pickup: 1, tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Zu_Bethlehem_geboren",
    notes: "C4:1 F4:1.5 G4:0.5 A4:1 G4:1 F4:2 E4:1 F4:1 G4:1 F4:0.5 G4:0.5 A4:1 G4:1 F4:2 r:1 C5:1 C5:1 A4:1 Bb4:1 C5:1 D5:2 Bb4:1 Bb4:1 A4:1 Bb4:1 C5:1 Bb4:0.5 A4:0.5 G4:3 r:1 C5:2 G4:2 A4:2 G4:1 A4:0.5 Bb4:0.5 C5:1 F4:0.5 G4:0.5 A4:1 G4:1 F4:3",
    lyrics: "Zu Beth- le- hem ge- bo- ren ist uns ein _ Kin- de- lein. Das hab ich aus- er- ko- ren, sein ei- gen will ich _ sein. Ei- a, ei- a, sein _ ei- gen _ will ich sein.",
  },
  {
    id: "der-christbaum", title: "Der Christbaum ist der schönste Baum", origin: "de", key: "A major", time: "4/4", pickup: 1, tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Der_Christbaum_ist_der_sch%C3%B6nste_Baum",
    notes: "E4:1 C#5:1 A4:1 D5:1 B4:1 E5:1.5 D5:0.5 C#5:1 B4:1 A4:1 E4:1 D5:1 C#5:1 C#5:1 B4:1 r:1 E5:1 E5:1 C#5:1 F#5:1.5 E5:0.5 E5:0.5 D5:0.5 D5:0.5 C#5:0.5 D5:1 D5:1 D5:1 B4:1 E5:1.5 D5:0.5 D5:0.5 C#5:0.5 C#5:0.5 B4:0.5 C#5:1 E4:1 F#4:1 Ab4:1 A4:1 B4:1 C#5:2 A4:1 Ab4:1 A4:1 B4:1 C#5:1 D5:1 E5:2 C#5:1 F#5:1 E5:2 D5:2 C#5:2",
    lyrics: "Der Christ- baum ist der schön- ste Baum, den wir auf Er- den ken- nen. Im Gar- ten klein, im eng- _ sten _ Raum, wie lieb- lich blüht der Wun- _ der- _ baum, wenn sei- ne Lich- ter bren- nen, wenn sei- ne Lich- ter bren- nen, ja bren- _ nen.",
  },
  {
    id: "resonet-in-laudibus", title: "Resonet in laudibus", origin: "de", key: "F major", time: "6/4", pickup: 4, tags: ["christmas"],
    source: "https://de.wikipedia.org/wiki/Resonet_in_laudibus",
    notes: "C5:1 C5:2 A4:1 F4:2 A4:1 C5:2 D5:1 C5:3 C5:2 A4:1 F4:2 A4:1 C5:2 D5:1 C5:3 Bb4:2 Bb4:1 Bb4:2 C5:1 Bb4:2 A4:1 G4:2 A4:1 C5:2 A4:1 F4:2 A4:1 G4:2 F4:1 G4:2 A4:1 F4:2 E4:1 F4:3 C5:2 A4:1 F4:2 A4:1 C5:2 D5:1 C5:3 C5:2 A4:1 F4:2 A4:1 C5:2 D5:1 C5:3 Bb4:2 Bb4:1 Bb4:2 C5:1 Bb4:2 A4:1 G4:2 A4:1 C5:2 A4:1 F4:2 A4:1 G4:2 F4:1 G4:2 A4:1 F4:2 E4:1 F4:3 C5:3 A4:3 C5:3 A4:3 F4:2 G4:1 A4:2 Bb4:2 A4:2 G4:1 A4:3 F4:2 G4:1 A4:2 Bb4:1 A4:2 G4:1 A4:2 A4:1 F4:2 E4:1 F4:3 C5:2 C5:1 C5:2 C5:1 F5:2 E5:1 D5:2 C5:1 F5:2 E5:1 D5:2 C5:1 C5:2 B4:1 C5:3 F4:2 G4:1 A4:2 Bb4:1 C5:2 Bb4:1 A4:2 G4:1 A4:2 G4:1 F4:2 E4:1 F4:4",
  },
  {
    id: "es-ist-fuer-uns-eine-zeit", title: "Es ist für uns eine Zeit angekommen", origin: "ch", key: "F major", time: "4/4", pickup: 1.5, tags: ["christmas"],
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
    lyrics: "Syt wil- le- ko- men, hei- re Kirst want du un- ser al- re he- re bis. Syt wil- le- ko- men, lie- ber Her- re her int ert- ri- che al- so scho- ne Ki- ri- e- leys.",
  },
  {
    id: "maman-les-ptits-bateaux", title: "Maman les p’tits bateaux", origin: "fr", key: "G major", time: "2/4", pickup: 0.5,
    source: "https://fr.wikipedia.org/wiki/Maman_les_p'tits_bateaux",
    notes: "D4:0.5 D4:0.5 C5:0.5 B4:0.5 A4:0.5 G4:0.5 D4:0.5 E4:0.5 G4:0.5 F#4:0.5 D4:0.5 E4:0.5 F#4:0.5 G4:1 G4:0.5 D4:0.5 D4:0.5 C5:0.5 B4:0.5 A4:0.5 G4:0.5 D4:0.25 D4:0.25 E4:0.5 G4:0.5 F#4:0.5 D4:0.5 E4:0.5 F#4:0.5 G4:1 r:0.5 D5:0.5 D5:0.5 B4:0.5 B4:0.5 G4:0.5 G4:1.5 B4:0.5 D5:0.5 D5:0.5 D5:0.5 D5:0.5 B4:1 G4:0.5 D5:0.5 D5:0.5 B4:0.5 B4:0.5 G4:0.5 G4:1 G4:0.5 B4:0.5 D5:0.5 D5:0.5 D5:0.5 D5:0.5 G4:1.5",
    lyrics: "Ma- man les p'tits ba- teaux Qui vont sur l'eau Ont- ils des jam- bes ? Mais oui, mon gros bê- ta S'ils n'en a- vaient pas Ils n'march'- raient pas ! Al- lant droit de- vant eux, Ils font le tour du mon- de, Mais comme la Terre est ron- de, Ils re- vien- nent chez eux.",
  },
  {
    id: "cest-la-mere-michel", title: "C’est la mère Michel", origin: "fr", key: "A major", time: "2/4",
    source: "https://fr.wikipedia.org/wiki/C'est_la_m%C3%A8re_Michel",
    notes: "A4:0.75 A4:0.25 A4:0.5 A4:0.5 A4:0.5 E4:0.5 A4:0.5 B4:0.5 C#5:1 B4:1 A4:1.5 A4:0.5 Ab4:0.75 F#4:0.25 Ab4:0.5 A4:0.5 B4:0.5 C#5:0.5 B4:0.5 A4:0.5 Ab4:1 F#4:1 E4:1.5 E4:0.5 B4:0.5 B4:0.5 B4:0.5 C#5:0.5 D5:1.5 D5:0.5 C#5:0.5 A4:0.5 E5:0.5 C#5:0.5 B4:1.5 B4:0.5 D5:0.5 D5:0.5 D5:0.5 D5:0.5 C#5:0.5 E5:0.5 C#5:0.5 A4:0.5 B4:1 E5:1 A4:0.5 A4:0.5 A4:0.5 Ab4:0.5 F#4:1 F#4:0.75 F#4:0.25 F#4:0.5 Ab4:0.5 A4:0.5 B4:0.5 E4:1 E4:0.75 E4:0.25 E4:1.5 E4:0.5 A4:1 C#5:1 E5:0.5 D5:0.5 C#5:0.5 B4:0.5 A4:0.5 E5:0.5 E5:0.5 E5:0.5 A4:2",
  },
  {
    id: "nous-nirons-plus-au-bois", title: "Nous n’irons plus au bois", origin: "fr", key: "F major", time: "2/4", pickup: 1.5,
    source: "https://fr.wikipedia.org/wiki/Nous_n'irons_plus_au_bois",
    notes: "F4:0.5 A4:0.5 Bb4:0.5 C5:1 F5:1 C5:0.75 D5:0.25 C5:0.5 Bb4:0.5 A4:1 G4:1 F4:0.5 F4:0.5 A4:0.5 Bb4:0.5 C5:1 F5:1 C5:0.75 D5:0.25 C5:0.5 Bb4:0.5 A4:1 G4:1 F4:1 r:1 F4:0.75 F4:0.25 F4:0.5 G4:0.5 F4:1 C4:1 F4:0.75 F4:0.25 F4:0.5 G4:0.5 F4:1 C4:1 C5:1 A4:1 C5:1 A4:1 G4:0.75 A4:0.25 Bb4:0.5 A4:0.5 G4:0.5 C5:0.5 F4:1",
  },
  {
    id: "a-la-volette", title: "À la volette", origin: "fr", key: "F major", time: "2/4", pickup: 1,
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

/** Each note's syllable (null for a rest or a note that carries on the
 *  syllable before), or null when the song has no lyrics. A syllable that
 *  starts a word: { text, word: true }; text ends in - when the word goes on. */
export function songLyrics(song, notes = songNotes(song)) {
  if (!song.lyrics) return null;
  const toks = song.lyrics.split(' ');
  let j = 0, prevHyph = false;
  return notes.map(n => {
    if (n.midi == null) return null;
    const t = toks[j++];
    if (t == null || t === '_') return null;
    const out = { text: t, word: !prevHyph };
    prevHyph = t.endsWith('-');
    return out;
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
  const score = x => (songKeyOn(x.song, x.shift) === key ? 4 : 0) + (songTimeLabel(x.song) === songTimeLabel(song) ? 2 : 0) + (x.song.origin === song.origin ? 1 : 0);
  return playable.filter(x => x.song.id !== song.id).sort((a, b) => score(b) - score(a)).slice(0, limit);
}

// ── Tab (the song player's Tab view on a handpan or tongue drum) ─────────
// A grid like a handpan tab sheet: one box per bar, a column for every
// eighth note counted "1 + 2 +" (in x/8 every eighth is a count), extra
// columns where a note starts between them (sixteenths, triplets).

const near = (a, b) => Math.abs(a - b) < 1e-6;

/** The count above a column: '1', '+', or '' between counts. at: beats
 *  (quarter notes) from the start of the bar. */
export function songCountLabel(at, time) {
  const den = Number(time.split('/')[1]);
  const unit = 4 / den; // one count, in quarter notes
  const k = at / unit;
  if (near(k, Math.round(k))) return String(Math.round(k) + 1);
  if (unit >= 1 && near(k % 1, 0.5)) return '+';
  return '';
}

/** The song's time as shown: "3/4", or "3/4 · 4/4" when it changes. */
export function songTimeLabel(song) {
  return song.meters ? [...new Set(song.meters)].join(' · ') : song.time;
}
const meterLen = time => { const [num, den] = time.split('/').map(Number); return (num * 4) / den; };

/** A song's bars: [{ len, from, time, cols: [{ at, count, i | null, hold | null }] }].
 *  from: where the bar starts within a full bar (a pickup bar starts late);
 *  each column: its place in the bar (at), its count, the note starting
 *  there (i, an index into notes) or the note still sounding (hold). */
export function songBars(song, notes = songNotes(song)) {
  // Each bar's time: song.meters in order (the last holds), else song.time.
  const timeOf = k => (song.meters ? song.meters[Math.min(k, song.meters.length - 1)] : song.time);
  const total = notes.reduce((a, n) => a + n.beats, 0);
  const starts = [];
  let t = 0;
  for (const n of notes) { starts.push(t); t += n.beats; }
  const first = meterLen(timeOf(0));
  const pickup = song.pickup && song.pickup < first ? song.pickup : 0;
  const bars = [];
  for (let k = 0, b0 = pickup ? pickup - first : 0; b0 < total - 1e-6; k++) {
    const time = timeOf(k), bar = meterLen(time);
    const lo = Math.max(0, b0), hi = Math.min(total, b0 + bar);
    const from = lo - b0;
    const ats = new Set();
    for (let a = Math.ceil((from - 1e-6) / 0.5) * 0.5; a < hi - b0 - 1e-6; a += 0.5) ats.add(+a.toFixed(4));
    starts.forEach(s => { if (s >= lo - 1e-6 && s < hi - 1e-6) ats.add(+(s - b0).toFixed(4)); });
    const cols = [...ats].sort((a, b) => a - b).map(at => {
      const abs = b0 + at;
      const i = starts.findIndex(s => near(s, abs));
      let hold = null;
      if (i < 0) {
        const j = starts.findLastIndex(s => s < abs);
        if (j >= 0 && notes[j].midi != null && starts[j] + notes[j].beats > abs + 1e-6) hold = j;
      }
      return { at, count: songCountLabel(at, time), i: i >= 0 ? i : null, hold };
    });
    // time: shown on the bar when it differs from the bar before.
    bars.push({ len: hi - lo, from, time, change: k > 0 && time !== timeOf(k - 1), cols });
    b0 += bar;
  }
  return bars;
}

/** Which hand plays each note: sides[i] is -1 (left of the middle of the
 *  drawing), 1 (right), 0 (the middle, a ding) or null (a rest). A side note
 *  is played by that side's hand, a middle one by the hand that didn't play
 *  the note before (the right hand to start). */
export function songHands(sides) {
  let last = 'L';
  return sides.map(s => {
    if (s == null) return null;
    const h = s < 0 ? 'L' : s > 0 ? 'R' : last === 'R' ? 'L' : 'R';
    last = h;
    return h;
  });
}
