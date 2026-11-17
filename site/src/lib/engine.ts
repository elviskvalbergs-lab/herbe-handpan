// The site's window onto the app's own engine (../js). Nothing musical is
// re-implemented or copied here: scales and their notes, chords, fingering
// charts, deep links and the pan drawing all come from the app's modules, so
// the website and the app always agree. The charts' published sources are
// noted in ../js/charts.js and the scales' in ../js/data.js.
import { SCALES, createLayoutFromScale, getAllNotes, displayNote, noteToMidi } from "@engine/data.js";
import { findAllChords } from "@engine/chords.js";
import { TRADITIONAL_CHARTS, chartsForFamily, chartDefaultKey, instrumentFromChart } from "@engine/charts.js";
import { linkFor as appLinkFor, linkSlug, linkTitle, parseLink } from "@engine/links.js";
import { renderPan } from "@engine/pan.js";

export type Family = "handpan" | "ocarina" | "flute";

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

const midiName = (m: number) => {
  const names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  return `${names[m % 12]}${Math.floor(m / 12) - 1}`;
};

/** The app's link for a scale or chart key. Every catalogue entry has one (tested). */
const linkFor = (target: { scaleId?: string; chartId?: string; keyId?: string }): string => appLinkFor(target) ?? "";

const lastSegment = (path: string) => path.split("/")[2] ?? path;

function scaleTuning(s: Scale): Tuning {
  const layout = createLayoutFromScale(s);
  const notes = [...getAllNotes(layout)].sort((a, b) => noteToMidi(a) - noteToMidi(b));
  const path = linkFor({ scaleId: s.id });
  return { slug: lastSegment(path), name: s.name, family: "handpan", notes, description: s.desc ?? null, path };
}

/** Every handpan scale in the app's catalogue. */
export function handpanTunings(): Tuning[] {
  return SCALES.map(scaleTuning);
}

/** Every key of every fingering chart of an ocarina or flute. */
export function chartTunings(family: "ocarina" | "flute"): Tuning[] {
  return CHART_TUNINGS[family];
}

// Built once, when the module loads: the app's instrumentFromChart gives each
// instrument a random id, which Next.js must not see during a page render.
function buildChartTunings(family: "ocarina" | "flute"): Tuning[] {
  return chartsForFamily(family).flatMap((chart: (typeof TRADITIONAL_CHARTS)[number]) =>
    chart.keys.map((key: { id: string }) => {
      const inst = instrumentFromChart(chart.id, key.id, { now: "2026-01-01T00:00:00.000Z" });
      const path = linkFor({ chartId: chart.id, keyId: key.id });
      return {
        slug: lastSegment(path),
        // The app's own short name for the link: "Alto C 12-hole ocarina", "Tin whistle in D".
        name: linkTitle(parseLink(path)) || inst.name,
        family,
        notes: (inst.chambers[0].notes as number[]).map(midiName),
        description: null,
        path,
      };
    }),
  );
}

const CHART_TUNINGS = { ocarina: buildChartTunings("ocarina"), flute: buildChartTunings("flute") };

export function tuningsFor(family: Family): Tuning[] {
  return family === "handpan" ? handpanTunings() : chartTunings(family);
}

export function findTuning(family: Family, slug: string): Tuning | null {
  return tuningsFor(family).find((t) => t.slug === slug) ?? null;
}

/** The default key of each chart, as the app's Play screen lists them. */
export function chartDefaults(family: "ocarina" | "flute"): Tuning[] {
  return chartsForFamily(family).map((chart: (typeof TRADITIONAL_CHARTS)[number]) => {
    const key = chartDefaultKey(chart);
    return chartTunings(family).find((t) => t.path === linkFor({ chartId: chart.id, keyId: key.id }))!;
  });
}

const SHORT: Record<string, string> = {
  maj: "", min: "m", dim: "dim", aug: "aug", sus2: "sus2", sus4: "sus4",
  maj7: "maj7", min7: "m7", dom7: "7", dim7: "dim7", hdim7: "m7♭5", mmaj7: "m(maj7)", augM7: "+maj7",
  maj6: "6", min6: "m6", add9: "add9", madd9: "m(add9)", maj9: "maj9", min9: "m9", dom9: "9",
};

/** Chords on a handpan scale, as the app finds them; intervals are left out. */
export function handpanChords(slug: string): Chord[] {
  const scale = SCALES.find((s: Scale) => lastSegment(linkFor({ scaleId: s.id })) === slug);
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

/** The app's pan drawing for a scale, with a chord's notes lit. */
export function panSvg(slug: string, chordNotes: string[] = []): string {
  const scale = SCALES.find((s: Scale) => lastSegment(linkFor({ scaleId: s.id })) === slug);
  if (!scale) return "";
  return renderPan(createLayoutFromScale(scale), { highlightNotes: chordNotes, useFlats: true })
    .replace('id="handpan-svg"', `role="img" aria-label="${scale.name} handpan layout"`);
}

/** A deep link into the app: the tuning, and optionally a tab and a chord. */
export function appLink(tuning: Tuning, opts: { tab?: string; chord?: string } = {}): string {
  const path = opts.tab ? `${tuning.path}/${opts.tab}${opts.chord ? `/${opts.chord}` : ""}` : tuning.path;
  return path; // same domain: the deep link itself (next.config.ts sends it to the app)
}

export function displayNotes(notes: string[]): string {
  return notes.map((n) => display(n)).join(" ");
}
