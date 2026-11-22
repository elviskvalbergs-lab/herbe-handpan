// What a tuning's page says about that tuning: its heading, its opening
// paragraph and its search title and description. Written from the app's own
// data (src/lib/engine.ts), so every page differs where its tuning differs:
// the notes, the scale's character, how many chords and songs it has.
import { displayNotes, handpanChords, isPanFamily, panWord, triads, tuningSongs, windChords, type Tuning } from "./engine";

export type TuningCounts = { chords: number; mainChords: number; songs: number; songsOf: number };

/** How many chords and songs a tuning has, from the app's engine. */
export function tuningCounts(t: Tuning): TuningCounts {
  const { songs, of } = tuningSongs(t);
  if (!isPanFamily(t.family)) return { chords: windChords(t).length, mainChords: windChords(t).length, songs: songs.length, songsOf: of };
  const chords = handpanChords(t.slug, t.family);
  return { chords: chords.length, mainChords: triads(chords).length, songs: songs.length, songsOf: of };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "D Kurd handpan chords", "Alto C 12-hole ocarina fingering chart". */
export function tuningHeading(t: Tuning): string {
  return isPanFamily(t.family) ? `${t.name} ${panWord(t.family)} chords` : /fingering$/.test(t.name) ? `${t.name} chart` : `${t.name} fingering chart`; // "Alto recorder, baroque fingering chart"
}

/** The page's first paragraph. */
export function tuningLead(t: Tuning, c: TuningCounts): string {
  const songs = c.songs ? ` and ${plural(c.songs, "song")} to learn` : "";
  if (isPanFamily(t.family)) {
    const what = `The ${t.name} ${panWord(t.family)} has ${plural(t.notes.length, "note")} (${displayNotes(t.notes)})`;
    const has = c.chords ? `, ${plural(c.chords, "chord")}${songs}` : songs ? `,${songs.replace(" and", "")}` : "";
    return `${t.description ? `${t.description} ` : ""}${what}${has}. Hear each chord and see where it sits.`;
  }
  const range = `${displayNotes([t.notes[0]])} to ${displayNotes([t.notes.at(-1)!])}`;
  return `Every note of the ${t.name}, from ${range}, with its fingering${c.chords ? `, the ${plural(c.chords, "chord")} of its key played note by note` : ""}${songs}.`;
}

/** The search result's description (about 155 characters at most). */
export function tuningDescription(t: Tuning, c: TuningCounts): string {
  const free = "Free in your browser.";
  if (isPanFamily(t.family)) {
    const notes = displayNotes(t.notes);
    const full = `${t.name} ${panWord(t.family)} (${notes}): ${plural(c.chords, "chord")}${c.songs ? ` and ${plural(c.songs, "song")}` : ""}, each shown on its layout. ${free}`;
    return full.length <= 160 ? full : `${t.name} ${panWord(t.family)}: ${plural(c.chords, "chord")}${c.songs ? ` and ${plural(c.songs, "song")}` : ""}, each shown on its layout. ${free}`;
  }
  return `${t.name} fingering chart: all ${t.notes.length} notes, ${displayNotes([t.notes[0]])} to ${displayNotes([t.notes.at(-1)!])}${c.chords ? `, ${plural(c.chords, "chord")} as arpeggios` : ""}${c.songs ? `, ${plural(c.songs, "song")}` : ""}. ${free}`;
}
