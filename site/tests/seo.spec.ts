import { expect, it } from "vitest";
import { canonicalTuning, chartTunings, tuningsFor, tuningSongs, windFingeringChart, windFingeringText, type Family } from "@/lib/engine";
import { breadcrumbLd, faqLd, ldJson, pageMeta, shareImage, webApplicationLd } from "@/lib/seo";
import { tuningCounts, tuningDescription, tuningHeading, tuningLead } from "@/lib/tuningText";

const FAMILIES: Family[] = ["handpan", "tongue-drum", "kalimba", "ocarina", "flute"];

it("every tuning's page has words of its own: no two share a title, a description or an opening", () => {
  for (const f of FAMILIES) {
    const all = tuningsFor(f).filter((t) => canonicalTuning(t).slug === t.slug);
    for (const text of [tuningHeading, (t: (typeof all)[number]) => tuningDescription(t, tuningCounts(t)), (t: (typeof all)[number]) => tuningLead(t, tuningCounts(t))]) {
      expect(new Set(all.map(text)).size, f).toBe(all.length);
    }
    for (const t of all) expect(tuningDescription(t, tuningCounts(t)).length, t.slug).toBeLessThanOrEqual(165);
  }
});

it("songs that fit come from the app: a D Kurd has some, and each names the key it is played in", () => {
  const kurd = tuningsFor("handpan").find((t) => t.slug === "d-kurd")!;
  const { songs, of } = tuningSongs(kurd);
  expect(of).toBeGreaterThan(100);
  expect(songs.length).toBeGreaterThan(5);
  expect(songs.length).toBeLessThan(of);
  expect(songs.find((s) => s.id === "twinkle-twinkle")?.key).toBe("C major");
});

it("an ocarina's and a flute's fingerings are also words", () => {
  const alto = chartTunings("ocarina").find((t) => t.slug === "alto-c-12")!;
  const chart = windFingeringChart(alto);
  expect(chart.length).toBe(alto.notes.length);
  expect(chart[0]).toEqual({ midi: 69, note: "A4", fingering: "all holes closed" });
  expect(windFingeringText(alto, 69)).toBe("A4: all holes closed");
});

it("a key's other octaves point at one page; a 12-hole ocarina's voices keep their own", () => {
  const flute = chartTunings("flute");
  const low = flute.find((t) => t.slug === "naf-6-a3")!;
  expect(canonicalTuning(low).slug).toBe("naf-6-a4");
  expect(canonicalTuning(canonicalTuning(low)).slug).toBe("naf-6-a4");
  for (const t of chartTunings("ocarina").filter((t) => t.slug.endsWith("-12"))) expect(canonicalTuning(t).slug).toBe(t.slug);
  const pendant = chartTunings("ocarina").filter((t) => t.slug.startsWith("pendant-6-"));
  expect(new Set(pendant.map((t) => canonicalTuning(t).slug)).size).toBe(12);
  expect(tuningsFor("handpan").every((t) => canonicalTuning(t).slug === t.slug)).toBe(true);
});

it("share cards: a picture per instrument family, the canonical address as og:url", () => {
  expect(shareImage("kalimba")).toBe("/og/kalimba.jpg");
  expect(shareImage("none")).toBe("/og.jpg");
  const m = pageMeta({ title: "T", description: "D", path: "/instruments/flute/naf-6-a3", canonical: "/instruments/flute/naf-6-a4", family: "flute" });
  expect(m.alternates?.canonical).toBe("/instruments/flute/naf-6-a4");
  expect(m.openGraph).toMatchObject({ url: "/instruments/flute/naf-6-a4", images: [{ url: "/og/flute.jpg", width: 1200, height: 630 }] });
});

it("structured data: a free web app, questions, a trail, and text that can't close the script tag", () => {
  expect(webApplicationLd("x")).toMatchObject({ "@type": "WebApplication", offers: { price: "0" }, url: "https://oakhum.com/play" });
  expect(faqLd([])).toBeNull();
  expect(faqLd([{ question: "Q?", answer: "A." }])).toMatchObject({ "@type": "FAQPage", mainEntity: [{ name: "Q?", acceptedAnswer: { text: "A." } }] });
  expect(breadcrumbLd([{ name: "Oakhum", path: "/" }, { name: "Handpan", path: "/instruments/handpan" }]).itemListElement[1]).toMatchObject({ position: 2, item: "https://oakhum.com/instruments/handpan" });
  expect(ldJson({ a: "</script><script>" })).not.toContain("</script>");
});
