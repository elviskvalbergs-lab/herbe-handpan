import type { MetadataRoute } from "next";
import { canonicalTuning } from "@/lib/engine";
import { instrumentTunings } from "@/lib/instruments";
import { SITE_URL } from "@/lib/site";
import { getHome, getInstruments, getMakers, getPages } from "@/sanity/lib/data";

// Every page search engines should keep, with the day its content last
// changed (the Sanity document's own date). A tuning's page takes its
// instrument's date. Left out: the octave copies of a key (canonicalTuning),
// which point at their main page.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [home, makers, instruments, pages] = await Promise.all([getHome(), getMakers(), getInstruments(), getPages()]);
  const entry = (path: string, changed?: string): MetadataRoute.Sitemap[number] => ({ url: `${SITE_URL}${path}`, ...(changed ? { lastModified: changed } : {}) });
  const urls = [
    entry("", home._updatedAt),
    entry("/request"),
    entry("/makers", makers._updatedAt),
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
  return urls;
}
