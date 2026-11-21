// The site's window onto the app's own engine (../js). Nothing musical is
// re-implemented or copied here: scales and their notes, chords, fingering
// charts, deep links and the pan drawing all come from the app's modules, so
// the website and the app always agree. The charts' published sources are
// noted in ../js/charts.js and the scales' in ../js/data.js.
import { SCALES, createLayoutFromScale, getAllNotes, displayNote, noteToMidi } from "@engine/data.js";
import { findAllChords, mainChordsInKey } from "@engine/chords.js";
import { midiToNoteName } from "@engine/instruments.js";
import { SONGS, playableSongs, songKeyOn } from "@engine/songs.js";
import { TRADITIONAL_CHARTS, chartsForFamily, chartDefaultKey, instrumentFromChart } from "@engine/charts.js";
import { linkFor as appLinkFor, linkSlug, linkTitle, parseLink } from "@engine/links.js";
import { renderPan } from "@engine/pan.js";
import { ocarinaToLayout, arpeggioOrder, renderFingering, describeFingering, fingeringFor, playableMidis } from "@engine/ocarina-ui.js";
import { LAYOUT_FAMILIES } from "@engine/layoutfamilies.js";

export type Family = "handpan" | "tongue-drum" | "kalimba" | "ocarina" | "flute";
/** The families the app draws from a layout (js/layoutfamilies.js): handpans, tongue drums, kalimbas. Their chords play together. */
export type PanFamily = "handpan" | "tongue-drum" | "kalimba";

export function isPanFamily(family: string): family is PanFamily {
  return Object.hasOwn(LAYOUT_FAMILIES, family);
}

/** The app's word for a layout family: "handpan", "tongue drum", "kalimba". */
export function panWord(family: PanFamily): string {
  return LAYOUT_FAMILIES[family].word;
}

export type Tuning = {
  /** The app's link slug, unique within a family: "d-kurd", "alto-c-12". */
  slug: string;
  name: string;
  family: Family;
  /** Notes low to high, written with flats where the app does ("Bb3"). */
  notes: string[];
  description: string | null;
  /** The app's deep link for this tuning (a path, no origin). */
  path: string;
  /** The app's group for it: a handpan's scale family ("Kurd"), a drum's or kalimba's ("Major Pentatonic"). */
  group: string | null;
  /** Where it was read from: makers' listings (tongue drums, kalimbas) or the published chart (ocarinas, flutes). */
  sources: string[];
};

export type Chord = {
  id: string;
  /** "A min", "D maj7": short, for buttons. */
  short: string;
  /** "A Minor", "D Major 7th". */
  name: string;
  category: string;
  /** Pitch classes, root first ("A C E"). */
  pitches: string[];
  /** The notes to light on the instrument. */
  notes: string[];
};

type Scale = (typeof SCALES)[number];

// A MIDI number as the app names it ("Bb4"): js/instruments.js.
const midiName: (m: number) => string = midiToNoteName;

/** The app's link for a scale or chart key. Every catalogue entry has one (tested). */
const linkFor = (target: { scaleId?: string; chartId?: string; keyId?: string }): string => appLinkFor(target) ?? "";

const lastSegment = (path: string) => path.split("/")[2] ?? path;

function scaleTuning(s: Scale, family: PanFamily = "handpan"): Tuning {
  const layout = createLayoutFromScale(s);
  const notes = [...getAllNotes(layout)].sort((a, b) => noteToMidi(a) - noteToMidi(b));
  const path = linkFor({ scaleId: s.id });
  const makers = ((s as { sources?: { maker: string; model?: string }[] }).sources ?? []).map((m) => (m.model ? `${m.maker} ${m.model}` : m.maker));
  return { slug: lastSegment(path), name: s.name, family, notes, description: s.desc ?? null, path, group: s.family ?? null, sources: makers };
}

/** Every handpan scale in the app's catalogue. */
export function handpanTunings(): Tuning[] {
  return SCALES.map((s: Scale) => scaleTuning(s));
}

/** Every tongue drum in the app's catalogue (js/tonguedrums.js, from makers' listings). */
export function tongueDrumTunings(): Tuning[] {
  return LAYOUT_FAMILIES["tongue-drum"].tunings.map((t: Scale) => scaleTuning(t, "tongue-drum"));
}

/** Every kalimba in the app's catalogue (js/kalimbas.js, from makers' charts). */
export function kalimbaTunings(): Tuning[] {
  return LAYOUT_FAMILIES.kalimba.tunings.map((t: Scale) => scaleTuning(t, "kalimba"));
}

// The app's tuning behind a pan-family slug.
function panScale(slug: string, family: PanFamily): Scale | undefined {
  const list: Scale[] = LAYOUT_FAMILIES[family]?.tunings ?? SCALES;
  return list.find((s: Scale) => lastSegment(linkFor({ scaleId: s.id })) === slug);
}

/** Every key of every fingering chart of an ocarina or flute. */
export function chartTunings(family: "ocarina" | "flute"): Tuning[] {
  return CHART_TUNINGS[family];
}

// The app's instrument behind each chart tuning, by path (filled below).
type ChartKey = { id: string; lowest: string; root?: string; octave?: number };
type WindInstrument = { inst: ReturnType<typeof instrumentFromChart>; chartId: string; keyId: string; key: ChartKey; defaultLowest: number };
const WIND_INSTRUMENTS = new Map<string, WindInstrument>();

// Built once, when the module loads: the app's instrumentFromChart gives each
// instrument a random id, which Next.js must not see during a page render.
function buildChartTunings(family: "ocarina" | "flute"): Tuning[] {
  return chartsForFamily(family).flatMap((chart: (typeof TRADITIONAL_CHARTS)[number]) =>
    chart.keys.map((key: ChartKey) => {
      const inst = instrumentFromChart(chart.id, key.id, { now: "2026-01-01T00:00:00.000Z" });
      const path = linkFor({ chartId: chart.id, keyId: key.id });
      WIND_INSTRUMENTS.set(path, { inst, chartId: chart.id, keyId: key.id, key, defaultLowest: noteToMidi((chart.keys.find((k: ChartKey) => k.id === chartDefaultKey(chart)) ?? chart.keys[0]).lowest) });
      return {
        slug: lastSegment(path),
        // The app's own short name for the link: "Alto C 12-hole ocarina", "Tin whistle in D".
        name: linkTitle(parseLink(path)) || inst.name,
        family,
        notes: (inst.chambers[0].notes as number[]).map(midiName),
        description: null,
        path,
        group: chart.shortName ?? chart.name,
        sources: chart.sourceName ? [chart.sourceName] : [],
      };
    }),
  );
}

const CHART_TUNINGS = { ocarina: buildChartTunings("ocarina"), flute: buildChartTunings("flute") };

export function tuningsFor(family: Family): Tuning[] {
  if (family === "handpan") return handpanTunings();
  if (isPanFamily(family)) return LAYOUT_FAMILIES[family].tunings.map((t: Scale) => scaleTuning(t, family));
  return chartTunings(family);
}

export function findTuning(family: Family, slug: string): Tuning | null {
  return tuningsFor(family).find((t) => t.slug === slug) ?? null;
}

const SHORT: Record<string, string> = {
  maj: "", min: "m", dim: "dim", aug: "aug", sus2: "sus2", sus4: "sus4",
  maj7: "maj7", min7: "m7", dom7: "7", dim7: "dim7", hdim7: "m7♭5", mmaj7: "m(maj7)", augM7: "+maj7",
  maj6: "6", min6: "m6", add9: "add9", madd9: "m(add9)", maj9: "maj9", min9: "m9", dom9: "9",
};

/** Chords on a handpan scale, tongue drum or kalimba, as the app finds them; intervals are left out. */
export function handpanChords(slug: string, family: PanFamily = "handpan"): Chord[] {
  const scale = panScale(slug, family);
  if (!scale) return [];
  const chords = findAllChords(createLayoutFromScale(scale));
  return chords
    .filter((c: { type: { category: string } }) => c.type.category !== "Interval")
    .map((c: { id: string; rootName: string; type: { id: string; name: string; category: string }; notes: string[] }) => ({
      id: linkSlug(c.id),
      short: `${display(c.rootName)}${SHORT[c.type.id] ?? ` ${c.type.name}`}`,
      name: `${display(c.rootName)} ${c.type.name}`,
      category: c.type.category,
      pitches: [...new Set(c.notes.map((n) => display(n.replace(/\d+$/, ""))))],
      notes: c.notes,
    }));
}

/** The simple triads first (what a guitarist would play along with). */
export function triads(chords: Chord[]): Chord[] {
  return chords.filter((c) => c.category === "Major" || c.category === "Minor").filter((c) => c.pitches.length === 3);
}

const display = (n: string) => displayNote(n, true).replace("b", "♭");

/** The app's drawing of a handpan scale, tongue drum or kalimba, with a chord's notes lit. */
export function panSvg(slug: string, chordNotes: string[] = [], family: PanFamily = "handpan"): string {
  const scale = panScale(slug, family);
  if (!scale) return "";
  return renderPan(createLayoutFromScale(scale), { highlightNotes: chordNotes, useFlats: true })
    .replace('id="handpan-svg"', `role="img" aria-label="${scale.name} ${panWord(family)} layout"`);
}

/** A deep link into the app: the tuning, and optionally a tab and a chord. */
export function appLink(tuning: Tuning, opts: { tab?: string; chord?: string } = {}): string {
  const path = opts.tab ? `${tuning.path}/${opts.tab}${opts.chord ? `/${opts.chord}` : ""}` : tuning.path;
  return path; // same domain: the deep link itself (next.config.ts sends it to the app)
}

export function displayNotes(notes: string[]): string {
  return notes.map((n) => display(n)).join(" ");
}

// ── Ocarinas and flutes: the playable demo (WindDemo) ──────────────────────
// One note at a time, so a chord plays as an arpeggio and shows each note's
// fingering in turn, as the app does (docs: "Adding an instrument").

export type WindChord = Chord & {
  /** The chord's notes in playing order (MIDI): root first, then up, as the app's arpeggios. */
  arpeggio: number[];
};

// The key's note: the chart key's root ("C" of an alto C ocarina), or the start of its id ("D", "F#3").
function windTonic(w: WindInstrument): number {
  const name = w.key.root ?? String(w.keyId).split("-")[0].replace(/\d+$/, "");
  return noteToMidi(`${name}4`) % 12;
}

// Notes spelled as the instrument's key is: sharps in G, D, A… (F♯ on a D whistle), flats in F, B♭, E♭…
function windSpell(w: WindInstrument): (note: string) => string {
  const flats = [5, 10, 3, 8, 1, 6].includes(windTonic(w));
  return (x) => displayNote(x, flats).replace("b", "♭");
}

/**
 * The major and minor chords to try on an ocarina or flute, as the app's
 * Chords screen lists them first (js/chords.js mainChordsInKey): those of its
 * own key from the key note up; on an instrument with few notes, every one it has.
 */
export function windChords(tuning: Tuning): WindChord[] {
  const w = WIND_INSTRUMENTS.get(tuning.path);
  if (!w) return [];
  const layout = ocarinaToLayout(w.inst);
  // The key's note: the chart key's root ("C" of an alto C ocarina), or the start of its id ("D", "F#3").
  const tonic = windTonic(w);
  const pcs = new Set<number>(getAllNotes(layout).map((n: string) => noteToMidi(n) % 12));
  type Found = { id: string; rootName: string; rootNote: string; type: { id: string; name: string; category: string }; notes: string[] };
  const main = (mainChordsInKey as (chords: unknown[], tonic: number, pcs: Set<number> | null) => Found[])(findAllChords(layout), tonic, pcs);
  const spell = windSpell(w);
  const seen = new Set<string>();
  return main
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .map((c) => ({
      id: linkSlug(c.id),
      short: `${spell(c.rootName)}${SHORT[c.type.id] ?? ` ${c.type.name}`}`,
      name: `${spell(c.rootName)} ${c.type.name}`,
      category: c.type.category,
      pitches: [...new Set(c.notes.map((n) => spell(n.replace(/\d+$/, ""))))],
      notes: c.notes,
      arpeggio: arpeggioOrder(c.notes, c.rootNote),
    }));
}

/** The app's fingering diagram for one note of an ocarina or flute. */
export function windFingering(tuning: Tuning, midi: number, size: "large" | "medium" | "mini" = "large"): string {
  const w = WIND_INSTRUMENTS.get(tuning.path);
  return w ? renderFingering(w.inst, midi, { size, useFlats: true }) : "";
}

/** The app's voice for the instrument: ocarina, tin whistle or (wooden) flute. */
export function windVoice(tuning: Tuning): "ocarina" | "whistle" | "flute" {
  const w = WIND_INSTRUMENTS.get(tuning.path);
  if (!w || tuning.family === "ocarina") return "ocarina";
  return String(w.inst.type ?? w.chartId).startsWith("tin-whistle") ? "whistle" : "flute";
}

/** A wind instrument's notes as its key spells them ("F♯5 A5"), for showing. */
export function windNotes(tuning: Tuning, midis: number[]): string {
  const w = WIND_INSTRUMENTS.get(tuning.path);
  return midis.map((m) => (w ? windSpell(w)(midiName(m)) : display(midiName(m)))).join(" ");
}

/** A MIDI note as the app names it ("Bb4"), for playing. */
export const midiNoteName = midiName;

/** A note's fingering in words, as the app's own diagram is labelled: "D4: R4 and R3 open, all others closed". */
export function windFingeringText(tuning: Tuning, midi: number): string {
  const w = WIND_INSTRUMENTS.get(tuning.path);
  return w ? describeFingering(w.inst, midi, windSpell(w)(midiName(midi))) : "";
}

/** Every note of an ocarina or flute, low to high, with its fingering in words (the page's fingering chart as text). */
export function windFingeringChart(tuning: Tuning): { midi: number; note: string; fingering: string }[] {
  const w = WIND_INSTRUMENTS.get(tuning.path);
  if (!w) return [];
  return (playableMidis(w.inst) as number[]).map((midi) => {
    const note = windSpell(w)(midiName(midi));
    return { midi, note, fingering: describeFingering(w.inst, midi, note).replace(`${note}: `, "") };
  });
}

// ── What a tuning page says about its own tuning ───────────────────────────

/** The notes a tuning plays, as MIDI numbers. */
function tuningMidis(tuning: Tuning): Set<number> {
  const w = WIND_INSTRUMENTS.get(tuning.path);
  return new Set<number>(w ? (playableMidis(w.inst) as number[]) : tuning.notes.map((n) => noteToMidi(n)));
}

export type TuningSong = { id: string; title: string; /** The key it is played in on this instrument. */ key: string };

/**
 * The app's Songs to learn that fit this tuning (js/songs.js playableSongs):
 * every note of the melody is one the instrument has, moved to the key that fits.
 */
export function tuningSongs(tuning: Tuning): { songs: TuningSong[]; of: number } {
  // As the app's Songs list does (js/app.js songsFor): an ocarina's or flute's songs are moved
  // to keys that keep to notes played without half-covering a hole, where they can.
  const w = WIND_INSTRUMENTS.get(tuning.path);
  const easy = w ? new Set<number>((playableMidis(w.inst) as number[]).filter((m) => !fingeringFor(w.inst, m)?.states?.includes("h"))) : null;
  type Fit = { song: { id: string; title: string; key: string }; shift: number };
  const fit = (playableSongs as (have: Set<number>, songs: unknown[], opts: { easy: Set<number> | null }) => Fit[])(tuningMidis(tuning), SONGS, { easy });
  return { songs: fit.map(({ song, shift }) => ({ id: song.id, title: song.title, key: songKeyOn(song, shift) })), of: SONGS.length };
}

/**
 * The page search engines should keep for a tuning. A chart that serves any
 * key lists each key in several octaves ("NAF in A, lowest A3 / A4 / A5",
 * a pendant ocarina in C4 / C5 / C6): the fingerings and the note names are
 * the same, so the octaves point at the one in the chart's usual octave. A
 * 12-hole ocarina's bass, alto and soprano are instruments of their own and
 * keep their own pages.
 */
export function canonicalTuning(tuning: Tuning): Tuning {
  const w = WIND_INSTRUMENTS.get(tuning.path);
  if (!w || !/\d$/.test(tuning.slug)) return tuning;
  const base = tuning.slug.slice(0, -1);
  const octaves = chartTunings(tuning.family as "ocarina" | "flute").filter((t) => t.slug.slice(0, -1) === base && /\d$/.test(t.slug) && WIND_INSTRUMENTS.get(t.path)?.chartId === w.chartId);
  if (octaves.length < 2) return tuning;
  const far = (t: Tuning) => Math.abs(noteToMidi(WIND_INSTRUMENTS.get(t.path)!.key.lowest) - w.defaultLowest);
  return octaves.reduce((best, t) => (far(t) < far(best) ? t : best));
}

/** Other tunings of the same group ("Kurd" scales, the same chart's other keys), nearest in the list first. */
export function relatedTunings(tuning: Tuning, all: Tuning[], limit = 8): Tuning[] {
  if (!tuning.group) return [];
  const group = all.filter((t) => t.group === tuning.group && (t.slug === tuning.slug || canonicalTuning(t).slug === t.slug));
  // The nearest in the app's own order: a chart's neighbouring keys, a scale's sister scales.
  const at = Math.max(0, group.findIndex((t) => t.slug === tuning.slug));
  const from = Math.max(0, Math.min(at - Math.floor(limit / 2), group.length - limit - 1));
  return group.slice(from, from + limit + 1).filter((t) => t.slug !== tuning.slug).slice(0, limit);
}

/** How many songs the app's Songs to learn has. */
export function songCount(): number {
  return SONGS.length;
}
