import { describe, expect, it } from "vitest";
import { appLink, chartTunings, findTuning, handpanChords, handpanTunings, panSvg, triads, tuningsFor, windChords, windFingering, windVoice } from "@/lib/engine";
import { instrumentTunings } from "@/lib/instruments";
import * as seed from "@/content/seed";

describe("the site reads the app's catalogue", () => {
  it("every handpan scale and chart key, each with a unique slug", () => {
    const hp = handpanTunings();
    expect(hp.length).toBe(62);
    expect(new Set(hp.map((t) => t.slug)).size).toBe(hp.length);
    expect(chartTunings("ocarina").length).toBe(36);
    for (const t of [...hp, ...chartTunings("ocarina"), ...chartTunings("flute")]) expect(t.path).toMatch(/^\/(handpan|ocarina|flute)\/[a-z0-9-]+$/);
  });

  it("D Kurd: its notes and the chords a guitarist would use", () => {
    const t = findTuning("handpan", "d-kurd")!;
    expect(t.notes).toEqual(["D3", "A3", "Bb3", "C4", "D4", "E4", "F4", "G4", "A4"]);
    const simple = triads(handpanChords("d-kurd")).map((c) => c.short);
    expect(simple).toEqual(expect.arrayContaining(["Dm", "F", "Gm", "Am", "B♭", "C"]));
  });

  it("names charts the way the app's links do", () => {
    expect(findTuning("ocarina", "alto-c-12")?.name).toBe("Alto C 12-hole ocarina");
    expect(findTuning("flute", "tin-whistle-d")?.name).toBe("Tin whistle in D");
  });

  it("deep links open the app on the tuning, tab and chord", () => {
    const t = findTuning("handpan", "d-kurd")!;
    expect(appLink(t, { tab: "chords", chord: "a-min" })).toMatch(/\/handpan\/d-kurd\/chords\/a-min$/);
  });

  it("draws the app's pan with a chord lit, as an accessible image", () => {
    const svg = panSvg("d-kurd", ["D3", "F4", "A3"]);
    expect(svg).toContain('role="img"');
    expect(svg).toContain("highlight-0");
    expect(svg).not.toContain('id="handpan-svg"');
  });
});

describe("seed content", () => {
  it("every featured tuning exists in the app", () => {
    for (const doc of seed.instruments.filter((d) => d.status === "available")) {
      const { featured } = instrumentTunings(doc);
      expect(featured.map((t) => t.slug)).toEqual(doc.featuredTunings);
    }
  });

  it("instrument slugs are unique, and available ones name an app family", () => {
    expect(new Set(seed.instruments.map((d) => d.slug)).size).toBe(seed.instruments.length);
    for (const d of seed.instruments) expect(d.status === "available" ? d.family !== "none" : true).toBe(true);
  });
});

it("tongue drums come from the app: every tuning, its chords and its drawing", () => {
  const drums = tuningsFor("tongue-drum");
  expect(drums.length).toBeGreaterThanOrEqual(18);
  for (const t of drums) expect(t.path).toBe(`/tongue-drum/${t.slug}`);
  const chords = handpanChords("d-kurd-9", "tongue-drum");
  expect(chords.map((c) => c.short)).toContain("Dm");
  expect(panSvg("d-kurd-9", ["D3", "F4", "A4"], "tongue-drum")).toMatch(/pan-note tongue/);
  expect(panSvg("d-kurd-9", [], "handpan")).toBe("");
});

it("ocarinas and flutes get a playable demo: the chords of their key, as arpeggios with fingerings", () => {
  const alto = chartTunings("ocarina").find((t) => t.slug === "alto-c-12")!;
  const chords = windChords(alto);
  expect(chords.map((c) => c.short)).toEqual(["C", "Dm", "Em", "F", "G", "Am"]);
  expect(chords[0].arpeggio.length).toBe(3);
  expect(windFingering(alto, chords[0].arpeggio[0])).toMatch(/class="fingering/);
  expect(windVoice(alto)).toBe("ocarina");
  for (const t of chartTunings("flute")) {
    expect(windChords(t).length, t.slug).toBeGreaterThan(0);
    expect(["flute", "whistle"]).toContain(windVoice(t));
  }
  expect(windVoice(chartTunings("flute").find((t) => t.slug.startsWith("tin-whistle"))!)).toBe("whistle");
});

it("a wind instrument's chords are spelled as its key: F#m on a D whistle", () => {
  const whistle = chartTunings("flute").find((t) => t.slug.startsWith("tin-whistle"))!;
  expect(windChords(whistle).map((c) => c.short)).toContain("F#m");
});
