import { describe, expect, it } from "vitest";
import * as seed from "@/content/seed";
import { linkSearchHeaders } from "../../middleware.js";

// The starting content against the rules the copy review set (2026-11-21).
const all = JSON.stringify([seed.home, seed.features, seed.instruments, seed.settings]);

describe("the site's words", () => {
  it("fit the Studio's limits", () => {
    expect(seed.home.heroTitle.length).toBeLessThanOrEqual(70);
    expect(seed.home.heroText.length).toBeLessThanOrEqual(260);
    for (const k of ["heroCta", "heroListen", "requestCta"] as const) expect(seed.home[k]!.length, k).toBeLessThanOrEqual(40);
    expect(seed.home.heroTry!.length).toBeLessThanOrEqual(60);
    expect(seed.home.songsText!.length).toBeLessThanOrEqual(320);
    for (const p of [...(seed.home.steps ?? []), ...(seed.home.why ?? []), ...(seed.home.memberPoints ?? [])]) { expect(p.title.length).toBeLessThanOrEqual(80); expect(p.text.length).toBeLessThanOrEqual(400); }
    for (const q of [...(seed.home.faqs ?? []), ...seed.instruments.flatMap((i) => i.faqs ?? [])]) { expect(q.question.length).toBeLessThanOrEqual(140); expect(q.answer.length).toBeLessThanOrEqual(900); }
    expect(seed.settings.description.length).toBeLessThanOrEqual(160);
  });

  it("the hero says what Oakhum is, for every instrument in the app, and how it starts", () => {
    for (const w of ["handpan", "tongue drum", "kalimba", "ocarina", "flute", "Play your notes", "songs"]) expect(seed.home.heroText).toContain(w);
  });

  it("use the app's own names for its features, and no jargon", () => {
    const titles = seed.features.map((f) => f.title);
    expect(titles).toEqual(expect.arrayContaining(["Play my notes", "Chords", "Listen", "Songs to learn", "Playlists"]));
    for (const gone of ["play levels", "roots, arpeggio, groove", "Set up by ear", "Chord finder", "until you close the tab"]) expect(all).not.toContain(gone);
  });

  it("never offer the clay ocarina builder", () => {
    expect(all).not.toMatch(/\b(design|build)s? (an|your) ocarina|shrinkage|clay/i);
  });

  it("name the 6-hole pendant ocarina where ocarinas are listed", () => {
    const oc = seed.instruments.find((i) => i.slug === "ocarina")!;
    expect(`${oc.tuningsLine} ${oc.intro}`).toMatch(/6-hole/);
    expect(oc.featuredTunings).toContain("pendant-6-c-c6");
  });
});

it("an app link's canonical page exists on the site: the same instrument slugs", () => {
  const paths: Record<string, string> = { handpan: "/handpan/d-kurd", "tongue-drum": "/tongue-drum/d-kurd-9", kalimba: "/kalimba/c-major-17", ocarina: "/ocarina/alto-c-12", flute: "/flute/tin-whistle-d", recorder: "/recorder/soprano-baroque" };
  for (const doc of seed.instruments) {
    const header = (linkSearchHeaders(paths[doc.family]) as { link?: string }).link ?? "";
    expect(header).toContain(`https://oakhum.com/instruments/${doc.slug}/`);
  }
});
