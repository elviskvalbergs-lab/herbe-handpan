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
import { ocarinaToLayout, arpeggioOrder, renderFingering } from "@engine/ocarina-ui.js";
import { LAYOUT_FAMILIES, safeLayout } from "@engine/layoutfamilies.js";

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

function scaleTuning(s: Scale, family: PanFamily = "handpan"): Tuning {
  const layout = createLayoutFromScale(s);
  const notes = [...getAllNotes(layout)].sort((a, b) => noteToMidi(a) - noteToMidi(b));
  const path = linkFor({ scaleId: s.id });
  return { slug: lastSegment(path), name: s.name, family, notes, description: s.desc ?? null, path };
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
type WindInstrument = { inst: ReturnType<typeof instrumentFromChart>; chartId: string; keyId: string };
const WIND_INSTRUMENTS = new Map<string, WindInstrument>();

// Built once, when the module loads: the app's instrumentFromChart gives each
// instrument a random id, which Next.js must not see during a page render.
function buildChartTunings(family: "ocarina" | "flute"): Tuning[] {
  return chartsForFamily(family).flatMap((chart: (typeof TRADITIONAL_CHARTS)[number]) =>
    chart.keys.map((key: { id: string }) => {
      const inst = instrumentFromChart(chart.id, key.id, { now: "2026-01-01T00:00:00.000Z" });
      const path = linkFor({ chartId: chart.id, keyId: key.id });
      WIND_INSTRUMENTS.set(path, { inst, chartId: chart.id, keyId: key.id });
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
  if (family === "handpan") return handpanTunings();
  if (isPanFamily(family)) return LAYOUT_FAMILIES[family].tunings.map((t: Scale) => scaleTuning(t, family));
  return chartTunings(family);
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

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

/**
 * The major and minor chords to try on an ocarina or flute: those of its own
 * key (the chart key's tonic), I ii iii IV V vi, as found by the app on its
 * notes; on an instrument with few chords, every one it has.
 */
export function windChords(tuning: Tuning): WindChord[] {
  const w = WIND_INSTRUMENTS.get(tuning.path);
  if (!w) return [];
  const all = findAllChords(ocarinaToLayout(w.inst)).filter((c: { type: { id: string } }) => c.type.id === "maj" || c.type.id === "min");
  // The key's tonic from its id: "C-A4" (an ocarina in C), "D" (a whistle), "Fs-…".
  const tonicName = String(w.keyId).split("-")[0].replace(/\d+$/, "").replace(/s$/, "#");
  const tonic = tonicName ? noteToMidi(tonicName + "4") % 12 : -1;
  const pc = (n: string) => noteToMidi(n) % 12;
  const degree = (c: { notes: string[]; rootNote: string }) => MAJOR_STEPS.indexOf((((pc(c.rootNote) - tonic) % 12) + 12) % 12);
  const inKey = tonic >= 0 && all.length > 8
    ? all.filter((c: { notes: string[]; rootNote: string }) => degree(c) >= 0 && degree(c) < 6 && c.notes.every((n) => MAJOR_STEPS.includes((((pc(n) - tonic) % 12) + 12) % 12)))
    : all;
  // Spelled as the key is: sharps in G, D, A… (F♯m on a D whistle), flats in F, B♭, E♭…
  const flats = [5, 10, 3, 8, 1, 6].includes(tonic);
  const spell = (x: string) => displayNote(x, flats).replace("b", "♭");
  const seen = new Set<string>();
  return inKey
    .sort((a: { notes: string[]; rootNote: string }, b: { notes: string[]; rootNote: string }) => degree(a) - degree(b) || noteToMidi(a.rootNote) - noteToMidi(b.rootNote))
    .filter((c: { id: string }) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .map((c: { id: string; rootName: string; rootNote: string; type: { id: string; name: string; category: string }; notes: string[] }) => ({
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

/** A MIDI note as the app names it ("Bb4"), for playing. */
export const midiNoteName = midiName;

// ── A maker's own instrument (src/lib/makers.ts) ─────────────────────────────
// A layout that came from the database (an instrument a maker shared), not
// from the catalogue. It passes the app's safeLayout first, so only note
// names reach the picture.
function cleanLayout(layout: unknown, family: PanFamily) {
  try {
    if (!layout || typeof layout !== "object") return null;
    const safe = safeLayout(JSON.parse(JSON.stringify(layout)));
    if (!safe?.top?.ding || !Array.isArray(safe.top.slots) || !Array.isArray(safe.bottom?.slots)) return null;
    if (family !== "handpan") safe.instrument = family; else delete safe.instrument;
    return safe;
  } catch {
    return null;
  }
}

/** The app's drawing of a maker's handpan, tongue drum or kalimba from its saved notes, or null. */
export function layoutPicture(layout: unknown, family: PanFamily, name: string): string | null {
  const safe = cleanLayout(layout, family);
  if (!safe) return null;
  try {
    const label = `${name} ${panWord(family)} layout`.replace(/[^\p{L}\p{N} #.,'’()-]/gu, "");
    return renderPan(safe, { useFlats: true }).replace('id="handpan-svg"', `role="img" aria-label="${label}"`);
  } catch {
    return null;
  }
}

/** Its notes, low to high, written as the site writes notes. */
export function layoutNotes(layout: unknown): string[] {
  const safe = cleanLayout(layout, "handpan");
  if (!safe) return [];
  try {
    return [...new Set(getAllNotes(safe) as string[])].sort((a, b) => noteToMidi(a) - noteToMidi(b));
  } catch {
    return [];
  }
}

/** A catalogue tuning by the app's scale id ("D-Kurd"), with the instrument page it belongs to. */
export function findTuningById(family: PanFamily, scaleId: string): (Tuning & { instrumentSlug: string }) | null {
  const path = appLinkFor({ scaleId });
  if (!path) return null;
  const tuning = tuningsFor(family).find((t) => t.path === path);
  return tuning ? { ...tuning, instrumentSlug: family === "tongue-drum" ? "steel-tongue-drum" : family } : null;
}
