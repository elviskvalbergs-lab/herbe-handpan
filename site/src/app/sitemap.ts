import type { MetadataRoute } from "next";
import { instrumentTunings } from "@/lib/instruments";
import { listMakers } from "@/lib/makers";
import { SITE_URL } from "@/lib/site";
import { getInstruments, getPageSlugs } from "@/sanity/lib/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [instruments, pages, makers] = await Promise.all([getInstruments(), getPageSlugs(), listMakers()]);
  const urls = [SITE_URL, `${SITE_URL}/request`, `${SITE_URL}/makers`, ...pages.map((s) => `${SITE_URL}/${s}`)];
  for (const doc of instruments) {
    urls.push(`${SITE_URL}/instruments/${doc.slug}`);
    const { featured, all } = instrumentTunings(doc);
    for (const t of all) if (t.slug !== featured[0]?.slug) urls.push(`${SITE_URL}/instruments/${doc.slug}/${t.slug}`);
  }
  for (const m of makers) urls.push(`${SITE_URL}/makers/${m.slug}`);
  return urls.map((url) => ({ url }));
}
