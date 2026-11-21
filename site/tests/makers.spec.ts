import { describe, expect, it, vi } from "vitest";

// next/cache only works inside Next; here the cached readers aren't called.
vi.mock("next/cache", () => ({ cacheLife: () => {} }));

import { cleanMaker, cleanMakerInstrument, cleanMakerList, familiesLine } from "@/lib/makers";
import { layoutNotes, layoutPicture, findTuningById } from "@/lib/engine";
import { validateRequest } from "@/lib/requests";
import { schemaTypes } from "@/sanity/schemaTypes";
import * as seed from "@/content/seed";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const LAYOUT = {
  id: "custom", isCustom: true, name: "Low Pygmy",
  top: { ding: "F3", capacity: 4, slots: [{ note: "G3" }, { note: "Ab3" }, { note: "C4" }, { note: "Eb4" }] },
  bottom: { capacity: 1, slots: [{ note: "C3" }] },
};

describe("makers from the app's database are cleaned before they are shown", () => {
  it("the directory keeps only what a card shows", () => {
    const list = cleanMakerList([
      { slug: "ilze-pans", name: "Ilze Pans", kind: "maker", place: "Cēsis", country: "LV", families: ["handpan", "theremin"], logo: PNG, instruments: 3, story: "x", secret: 1 },
      { slug: "Bad Slug", name: "Nope" },
      { slug: "ok-shop", name: "<b>Shop</b>", kind: "emperor", logo: "data:image/svg+xml;base64,AA==", instruments: "many" },
      null,
    ]);
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({ slug: "ilze-pans", name: "Ilze Pans", kind: "maker", line: "Maker · Cēsis, Latvia", families: ["handpan"], logo: PNG, initials: "IP", instruments: 3 });
    expect(list[1]).toMatchObject({ kind: "maker", logo: "", instruments: 0, name: "<b>Shop</b>" }); // React escapes the name where it is shown
    expect(cleanMakerList("nope")).toEqual([]);
  });

  it("a maker's website must be https and the story is plain text", () => {
    const m = cleanMaker({ slug: "ilze-pans", name: "Ilze Pans", kind: "shop", website: "javascript:alert(1)", story: " One at a time. ", story_lang: "LV!", families: ["kalimba", "flute"] });
    expect(m).toMatchObject({ kind: "shop", website: "", websiteLabel: "", story: "One at a time.", storyLang: "" });
    expect(cleanMaker({ slug: "ilze-pans", name: "Ilze Pans", website: "https://www.ilzepans.lv/", story_lang: "lv" })).toMatchObject({ website: "https://www.ilzepans.lv", websiteLabel: "ilzepans.lv", storyLang: "lv" });
    expect(cleanMaker({ slug: "x" })).toBeNull();
    expect(familiesLine(["handpan", "kalimba", "flute"])).toBe("handpans, kalimbas and flutes");
    expect(familiesLine([])).toBe("");
  });

  it("an instrument links to its code, and to its scale's page when it is one of ours", () => {
    const custom = cleanMakerInstrument({ code: "ser222", name: "Low Pygmy", family: "handpan", scale: null }, { layout: LAYOUT });
    expect(custom).toMatchObject({ code: "SER222", path: "/s/SER222", tuningPath: null, notes: ["C3", "F3", "G3", "Ab3", "C4", "Eb4"] });
    expect(custom!.picture).toContain("<svg");
    const kurd = cleanMakerInstrument({ code: "KURD22", name: "D Kurd 9", family: "handpan", scale: "D-Kurd" }, null);
    expect(kurd).toMatchObject({ tuningPath: "/instruments/handpan/d-kurd", picture: null, notes: [] });
    expect(cleanMakerInstrument({ code: "KURD22", name: "Blue", family: "ocarina" }, { layout: LAYOUT })).toMatchObject({ family: "ocarina", picture: null });
    expect(cleanMakerInstrument({ code: "not-a-code", name: "X" }, null)).toBeNull();
    expect(cleanMakerInstrument({ code: "KURD22", name: "" }, null)).toBeNull();
    expect(findTuningById("handpan", "No-Such-Scale")).toBeNull();
  });

  it("a layout from the database can only put note names into the picture", () => {
    const hostile = { ...LAYOUT, name: "<script>alert(1)</script>", top: { ...LAYOUT.top, ding: "D3", slots: [{ note: '"><script>alert(1)</script>' }, { note: "A3" }] } };
    const svg = layoutPicture(hostile, "handpan", '"><img src=x onerror=alert(1)>');
    expect(svg).toBeTruthy();
    expect(svg).not.toMatch(/<script|<img|"><|onerror=/);
    expect(layoutNotes(hostile)).toEqual(["C3", "D3", "A3"]);
    expect(layoutPicture(null, "handpan", "x")).toBeNull();
    expect(layoutNotes("nope")).toEqual([]);
  });
});

describe("the request form's Maker or shop", () => {
  it("takes a name and an email, and is never an instrument request", () => {
    expect(validateRequest({ kind: "maker", title: "Ilze Pans", notes: "ilzepans.lv", details: "Handpans to order", email: "ilze@example.com" }))
      .toEqual({ ok: true, value: { kind: "maker", title: "Ilze Pans", notes: "ilzepans.lv", details: "Handpans to order", email: "ilze@example.com" } });
    expect(validateRequest({ kind: "maker", title: "Ilze Pans" })).toMatchObject({ ok: false, error: expect.stringContaining("email") });
    expect(validateRequest({ kind: "maker", email: "ilze@example.com" })).toMatchObject({ ok: false, error: expect.stringContaining("workshop or shop") });
  });

  it("is a kind the Studio knows, and stays out of the public list", async () => {
    const request = schemaTypes.find((t) => t.name === "request") as unknown as { fields: { name: string; options?: { list?: { value: string }[] } }[] };
    expect(request.fields.find((f) => f.name === "kind")!.options!.list!.map((o) => o.value)).toContain("maker");
    const { PUBLIC_REQUESTS_QUERY } = await import("@/sanity/lib/queries");
    expect(PUBLIC_REQUESTS_QUERY).toContain('kind != "maker"');
  });
});

describe("the makers page's words are content", () => {
  it("has a field and a starting text for every new word", () => {
    const makers = schemaTypes.find((t) => t.name === "makersPage") as unknown as { fields: { name: string }[] };
    const fields = makers.fields.map((f) => f.name);
    for (const f of ["heroNote", "talkCta", "directoryTitle", "directoryText", "directoryJoinTitle", "directoryJoinText",
      "makerInstrumentsTitle", "makerInstrumentsText", "makerPlayCta", "makerTuningLink", "makerNoInstruments", "makerReport", "makerJoinText"] as const) {
      expect(fields).toContain(f);
      expect(seed.makers[f], f).toBeTruthy();
    }
  });

  it("no longer says makers can't show their brand, and the buttons don't promise an email", () => {
    const text = JSON.stringify(seed.makers);
    expect(text).not.toContain("Not yet. If that would help you");
    expect(seed.makers.heroCta).toBe("Set up your maker page");
  });
});
