import type { MetadataRoute } from "next";
import { instrumentTunings } from "@/lib/instruments";
import { SITE_URL } from "@/lib/site";
import { getInstruments, getPageSlugs } from "@/sanity/lib/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [instruments, pages] = await Promise.all([getInstruments(), getPageSlugs()]);
  const urls = [SITE_URL, `${SITE_URL}/request`, ...pages.map((s) => `${SITE_URL}/${s}`)];
  for (const doc of instruments) {
    urls.push(`${SITE_URL}/instruments/${doc.slug}`);
    const { featured, all } = instrumentTunings(doc);
    for (const t of all) if (t.slug !== featured[0]?.slug) urls.push(`${SITE_URL}/instruments/${doc.slug}/${t.slug}`);
  }
  return urls.map((url) => ({ url }));
}
