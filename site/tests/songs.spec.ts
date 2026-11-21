import { describe, expect, it } from "vitest";
import { findTuning, tuningMidis, tuningsFor } from "@/lib/engine";
import { FEATURED_SONG_TUNINGS, SONG_FAMILIES, allSongs, featuredTuningsFor, findSong, isFeaturedTuning, songAppLink, songHref, songOn, songTunings, songsAfter, songsOnTuning } from "@/lib/songs";
import { schemaTypes } from "@/sanity/schemaTypes";
import { inSentence, tuningTitle } from "@/components/SongView";
import * as seed from "@/content/seed";
// The app's own song list and fit, to check the site says the same.
import { SONGS, playableSongs } from "@engine/songs.js";
import { parseLink } from "@engine/links.js";

describe("songs come from the app", () => {
  it("every song of the app's catalogue, once, world-known ones first", () => {
    const songs = allSongs();
    expect(songs.length).toBe(SONGS.length);
    expect(new Set(songs.map((s) => s.id)).size).toBe(songs.length);
    expect(songs[0].id).toBe("ode-to-joy");
    expect(findSong("ode-to-joy")?.shortTitle).toBe("Ode to Joy");
    expect(findSong("silent-night")?.christmas).toBe(true);
    expect(findSong("nope")).toBeNull();
    for (const s of songs) {
      expect(s.country, s.id).toBeTruthy();
      expect(s.source).toMatch(/^https:\/\//);
      expect(s.noteCount).toBeGreaterThan(15);
    }
  });

  it("the featured tunings exist in the app's catalogue", () => {
    for (const f of FEATURED_SONG_TUNINGS) expect(findTuning(f.family, f.slug), `${f.family}/${f.slug}`).not.toBeNull();
    expect(isFeaturedTuning("handpan", "d-kurd")).toBe(true);
    expect(isFeaturedTuning("handpan", "d-akebono")).toBe(false);
  });

  it("a tuning plays the songs the app says it plays", () => {
    for (const f of FEATURED_SONG_TUNINGS) {
      const t = findTuning(f.family, f.slug)!;
      const { have, easy } = tuningMidis(t);
      const app = (playableSongs as (h: Set<number>, s: unknown, o: unknown) => { song: { id: string } }[])(have, SONGS, { easy }).map((x) => x.song.id).sort();
      expect(songsOnTuning(t).map((s) => s.id).sort()).toEqual(app);
    }
    expect(songsOnTuning(findTuning("flute", "tin-whistle-d")!).length).toBe(SONGS.length);
  });

  it("Twinkle, Twinkle on a D Kurd handpan: every note is one the handpan has", () => {
    const t = findTuning("handpan", "d-kurd")!;
    const on = songOn("twinkle-twinkle", t)!;
    expect(on.missing).toBeNull();
    expect(on.key).toBe("C major");
    const have = new Set(t.notes);
    for (const n of on.notes) if (n.note) expect(have.has(n.note), n.note).toBe(true);
    expect(on.notes.slice(0, 7).map((n) => n.note)).toEqual(["C4", "C4", "G4", "G4", "A4", "A4", "G4"]);
    // Bars: 4/4, the first bar is the first four notes, and every note is in one bar.
    expect(on.bars[0]).toEqual([0, 1, 2, 3]);
    expect(on.bars.flat().length).toBe(on.notes.length);
  });

  it("a song that almost fits says which note, and gets no page of its own", () => {
    const t = findTuning("handpan", "d-kurd")!;
    const on = songOn("amazing-grace", t)!;
    expect(on.missing).toBe("C5");
    expect(on.missingTimes).toBe(3);
    expect(on.notes.filter((n) => n.missing).length).toBe(3);
    expect(songOn("amazing-grace", t, { near: false })).toBeNull();
    expect(songOn("silent-night", t)).toBeNull();
    const hp = songTunings("amazing-grace", "handpan");
    expect(hp.almost.some((x) => x.tuning.slug === "d-kurd" && x.missing === "C5")).toBe(true);
    expect(hp.fits.every((x) => x.missing === null)).toBe(true);
  });

  it("which instruments can play a song: within the catalogue, each once", () => {
    for (const family of SONG_FAMILIES) {
      const { fits, almost } = songTunings("twinkle-twinkle", family);
      const all = [...fits, ...almost].map((x) => x.tuning.slug);
      expect(new Set(all).size).toBe(all.length);
      expect(all.length).toBeLessThanOrEqual(tuningsFor(family).length);
      expect(fits.length, family).toBeGreaterThan(0);
    }
  });

  it("featured tunings for a song, and songs that go well after it", () => {
    expect(featuredTuningsFor("twinkle-twinkle").map((t) => t.slug)).toContain("d-kurd");
    expect(featuredTuningsFor("amazing-grace").map((t) => t.slug)).not.toContain("d-kurd");
    const t = findTuning("flute", "tin-whistle-d")!;
    const after = songsAfter("twinkle-twinkle", t);
    expect(after.length).toBe(3);
    expect(after.every((s) => s.id !== "twinkle-twinkle")).toBe(true);
  });

  it("links: the song's pages on the site, and the app's deep link, which the app can open", () => {
    const t = findTuning("handpan", "d-kurd")!;
    expect(songHref("twinkle-twinkle")).toBe("/songs/twinkle-twinkle");
    expect(songHref("twinkle-twinkle", t)).toBe("/songs/twinkle-twinkle/handpan/d-kurd");
    expect(songAppLink("twinkle-twinkle", t)).toBe("/handpan/d-kurd/songs/twinkle-twinkle");
    expect(songAppLink("twinkle-twinkle")).toBe("/song/twinkle-twinkle");
    expect(parseLink(songAppLink("twinkle-twinkle", t))?.song).toBe("twinkle-twinkle");
    expect(parseLink(songAppLink("twinkle-twinkle"))?.kind).toBe("song");
    for (const f of FEATURED_SONG_TUNINGS) {
      const tuning = findTuning(f.family, f.slug)!;
      expect(parseLink(songAppLink("ode-to-joy", tuning))?.path).toBe(songAppLink("ode-to-joy", tuning));
    }
  });
});

describe("naming an instrument on a song page", () => {
  it("every tuning of a family has its own name", () => {
    for (const family of SONG_FAMILIES) {
      const names = tuningsFor(family).map(tuningTitle);
      expect(new Set(names).size, family).toBe(names.length);
    }
    expect(tuningTitle(findTuning("handpan", "d-kurd")!)).toBe("D Kurd handpan");
    expect(tuningTitle(findTuning("kalimba", "c-major-17")!)).toBe("C Major 17-key kalimba");
    expect(tuningTitle(findTuning("tongue-drum", "c-major-11")!)).toBe("C Major 11-note tongue drum");
    expect(inSentence(tuningTitle(findTuning("flute", "tin-whistle-d")!))).toBe("tin whistle in D");
    expect(inSentence("D Kurd handpan")).toBe("D Kurd handpan");
  });
});

describe("the songs pages' words are content", () => {
  it("a Songs pages document with the words the pages use", () => {
    const doc = schemaTypes.find((t) => t.name === "songsPage") as unknown as { fields: { name: string }[] };
    expect(doc.fields.map((f) => f.name)).toEqual(expect.arrayContaining(["heroTitle", "heroText", "fitTitle", "fitText", "almostText", "demoText", "appTitle", "appText", "appCta", "seo"]));
    expect(seed.songsPage.heroTitle).toBeTruthy();
    expect(seed.songsPage.heroText.length).toBeLessThanOrEqual(320);
  });
});
