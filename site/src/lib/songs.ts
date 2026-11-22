// Songs for the website, from the app's own catalogue and fit (../js/songs.js):
// which songs there are, where each lands on a tuning and which note, if any,
// that tuning lacks. Nothing is decided here that the app decides differently.
import { SONGS, SONG_ORIGINS, songNotes, songFit as engineSongFit, songKeyOn, songBars, songTimeLabel, songsInOrder, songsThatGoTogether, playableSongs as enginePlayableSongs } from "@engine/songs.js";
import { findTuning, midiNoteName, tuningMidis, tuningsFor, displayNotes, type Family, type Tuning } from "./engine";

export const SONG_FAMILIES: Family[] = ["handpan", "tongue-drum", "kalimba", "ocarina", "flute"];

/**
 * The tunings whose song pages are in the sitemap and open to search engines
 * (docs/songs-next.md, question 3): one well-known tuning per kind of
 * instrument. Every other tuning's song pages work and can be shared, and
 * carry noindex until this list is widened.
 */
export const FEATURED_SONG_TUNINGS: { family: Family; slug: string }[] = [
  { family: "handpan", slug: "d-kurd" },
  { family: "kalimba", slug: "c-major-17" },
  { family: "tongue-drum", slug: "c-major-11" },
  { family: "flute", slug: "tin-whistle-d" },
  { family: "ocarina", slug: "alto-c-12" },
  { family: "flute", slug: "naf-6-in-a-a4" },
];

export type Song = {
  id: string;
  title: string;
  /** Without a bracketed second title: "Ode to Joy". */
  shortTitle: string;
  country: string;
  key: string;
  time: string;
  christmas: boolean;
  source: string;
  /** The songbook, when the melody is from one (else its Wikipedia article). */
  sourceName: string | null;
  noteCount: number;
};

type EngineSong = (typeof SONGS)[number];
// The engine is plain JavaScript: its option defaults (easy = null) need their real types said here.
type FitOptions = { easy?: Set<number> | null; near?: boolean };
type Fit = { shift: number; missing: number | null; times?: number };
const songFit = engineSongFit as (song: EngineSong, have: Set<number>, options?: FitOptions) => Fit | null;
const playableSongs = enginePlayableSongs as (have: Set<number>, songs?: EngineSong[], options?: FitOptions) => ({ song: EngineSong } & Fit)[];
const origins = SONG_ORIGINS as Record<string, string>;

function toSong(s: EngineSong): Song {
  return {
    id: s.id, title: s.title, shortTitle: s.title.replace(/\s*\(.*\)$/, ""), country: origins[s.origin], key: s.key, time: songTimeLabel(s),
    christmas: !!s.tags?.includes("christmas"), source: s.source, sourceName: s.sourceName ?? null,
    noteCount: songNotes(s).filter((n: { midi: number | null }) => n.midi != null).length,
  };
}

/** Every song, in the order an English-speaking visitor sees them in the app. */
export function allSongs(): Song[] {
  return songsInOrder(SONGS, ["en"]).map(toSong);
}

export function findSong(id: string): Song | null {
  const s = SONGS.find((x: EngineSong) => x.id === id);
  return s ? toSong(s) : null;
}

export type SongNote = { note: string | null; midi: number | null; beats: number; missing: boolean };
export type SongOnTuning = {
  /** Semitones the song is moved on this tuning. */
  shift: number;
  /** The key it is played in there. */
  key: string;
  /** The one note the tuning lacks ("C5"), or null when the song fits completely. */
  missing: string | null;
  missingTimes: number;
  notes: SongNote[];
  /** The notes in bars, for reading: each bar a list of indexes into notes. */
  bars: number[][];
};

const engineSong = (id: string): EngineSong | undefined => SONGS.find((x: EngineSong) => x.id === id);

/** A song on a tuning, as the app plays it there, or null when it doesn't fit (near: also when it almost fits). */
export function songOn(id: string, tuning: Tuning, { near = true } = {}): SongOnTuning | null {
  const s = engineSong(id);
  if (!s) return null;
  const { have, easy } = tuningMidis(tuning);
  const fit = songFit(s, have, { easy, near });
  if (!fit) return null;
  const notes: SongNote[] = songNotes(s).map((n: { midi: number | null; beats: number }) => {
    const midi = n.midi == null ? null : n.midi + fit.shift;
    return { midi, note: midi == null ? null : midiNoteName(midi), beats: n.beats, missing: midi != null && midi === fit.missing };
  });
  const bars = (songBars(s) as { cols: { i: number | null }[] }[]).map((b) => b.cols.map((c) => c.i).filter((i): i is number => i != null));
  return {
    shift: fit.shift, key: songKeyOn(s, fit.shift), missing: fit.missing == null ? null : midiNoteName(fit.missing), missingTimes: fit.times ?? 0, notes, bars,
  };
}

export type SongTuning = { tuning: Tuning; key: string; missing: string | null };

/** Every catalogue tuning of a family that can play the song: those it fits, then those it almost fits. */
export function songTunings(id: string, family: Family): { fits: SongTuning[]; almost: SongTuning[] } {
  const s = engineSong(id);
  const fits: SongTuning[] = [], almost: SongTuning[] = [];
  if (!s) return { fits, almost };
  for (const tuning of tuningsFor(family)) {
    const { have, easy } = tuningMidis(tuning);
    const fit = songFit(s, have, { easy });
    if (!fit) continue;
    (fit.missing == null ? fits : almost).push({ tuning, key: songKeyOn(s, fit.shift), missing: fit.missing == null ? null : midiNoteName(fit.missing) });
  }
  return { fits, almost };
}

/** The featured tunings, in order, that the song fits completely. */
export function featuredTuningsFor(id: string): Tuning[] {
  return FEATURED_SONG_TUNINGS.map((f) => findTuning(f.family, f.slug)).filter((t): t is Tuning => !!t && !!songOn(id, t, { near: false }));
}

export function isFeaturedTuning(family: string, slug: string): boolean {
  return FEATURED_SONG_TUNINGS.some((f) => f.family === family && f.slug === slug);
}

/** The songs a tuning plays completely, as the app counts them. */
export function songsOnTuning(tuning: Tuning): Song[] {
  const { have, easy } = tuningMidis(tuning);
  return playableSongs(have, songsInOrder(SONGS, ["en"]), { easy }).map((x) => toSong(x.song));
}

/** Songs that go well after this one on the tuning (the same key there first), as in the app. */
export function songsAfter(id: string, tuning: Tuning, limit = 3): Song[] {
  const s = engineSong(id);
  if (!s) return [];
  const { have, easy } = tuningMidis(tuning);
  return (songsThatGoTogether(s, playableSongs(have, SONGS, { easy }), limit) as { song: EngineSong }[]).map((x) => toSong(x.song));
}

/** The page of a song, or of a song on a tuning. */
export function songHref(id: string, tuning?: Tuning): string {
  return tuning ? `/songs/${id}/${tuning.family}/${tuning.slug}` : `/songs/${id}`;
}

/** The app's deep link for the song on the tuning (js/links.js). */
export function songAppLink(id: string, tuning?: Tuning): string {
  return tuning ? `${tuning.path}/songs/${id}` : `/song/${id}`;
}

/** A note for reading: "B♭4". */
export const noteLabel = (note: string) => displayNotes([note]);

/** The link from a song page to the instrument's own page: "All handpan chords". */
export function songAfterWord(family: Family): string {
  return family === "ocarina" || family === "flute" ? `All ${family} fingerings` : `All ${family.replace("-", " ")} chords`;
}
