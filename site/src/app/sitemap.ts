import type { MetadataRoute } from "next";
import { canonicalTuning, findTuning } from "@/lib/engine";
import { instrumentTunings } from "@/lib/instruments";
import { listMakers } from "@/lib/makers";
import { SITE_URL } from "@/lib/site";
import { FEATURED_SONG_TUNINGS, allSongs, songOn } from "@/lib/songs";
import { getHome, getInstruments, getMakers, getPages } from "@/sanity/lib/data";

// Every page search engines should keep, with the day its content last
// changed (the Sanity document's own date). A tuning's page takes its
// instrument's date. Left out: the octave copies of a key (canonicalTuning),
// which point at their main page.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [home, makersPage, instruments, pages, makers] = await Promise.all([getHome(), getMakers(), getInstruments(), getPages(), listMakers()]);
  const entry = (path: string, changed?: string): MetadataRoute.Sitemap[number] => ({ url: `${SITE_URL}${path}`, ...(changed ? { lastModified: changed } : {}) });
  const urls = [
    entry("", home._updatedAt),
    entry("/request"),
    entry("/makers", makersPage._updatedAt),
    ...pages.map((p) => entry(`/${p.slug}`, p.updated ?? p._updatedAt)),
  ];
  for (const doc of instruments) {
    urls.push(entry(`/instruments/${doc.slug}`, doc._updatedAt));
    const { featured, all } = instrumentTunings(doc);
    for (const t of all) {
      if (t.slug === featured[0]?.slug || canonicalTuning(t).slug !== t.slug) continue;
      urls.push(entry(`/instruments/${doc.slug}/${t.slug}`, doc._updatedAt));
    }
  }
  // Songs: the list, each song, and each song on the well-known tunings it fits (docs/songs-next.md).
  urls.push(entry("/songs"));
  const featured = FEATURED_SONG_TUNINGS.map((f) => findTuning(f.family, f.slug)).filter((t) => !!t);
  for (const s of allSongs()) {
    urls.push(entry(`/songs/${s.id}`));
    for (const t of featured) if (songOn(s.id, t, { near: false })) urls.push(entry(`/songs/${s.id}/${t.family}/${t.slug}`));
  }
  for (const m of makers) urls.push(entry(`/makers/${m.slug}`));
  return urls;
}
