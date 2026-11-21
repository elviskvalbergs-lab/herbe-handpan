import * as seed from "@/content/seed";
import { hasSanity } from "../env";
import { fetchData } from "./live";
import {
  FEATURES_QUERY, HOME_QUERY, MAKERS_QUERY, INSTRUMENTS_QUERY, INSTRUMENT_QUERY, PAGE_QUERY, PAGE_SLUGS_QUERY, PUBLIC_REQUESTS_QUERY, SETTINGS_QUERY,
} from "./queries";
import { toBlocks } from "./blocks";
import type { FeatureDoc, HomePage, MakersPage, InstrumentDoc, PageDoc, PublicRequest, SiteSettings } from "./types";

// With a Sanity project connected, every getter reads Sanity and only Sanity.
// Without one (local work, the first preview deploys) it returns the seed
// content in src/content/seed.ts, the same content `pnpm seed` uploads.

export const getSettings = async (): Promise<SiteSettings> =>
  (hasSanity ? await fetchData<SiteSettings>(SETTINGS_QUERY) : null) ?? seed.settings;

export const getHome = async (): Promise<HomePage> => (hasSanity ? await fetchData<HomePage>(HOME_QUERY) : null) ?? seed.home;

// Falls back to the seed while the document doesn't exist yet in Sanity (the build's seed creates it).
export const getMakers = async (): Promise<MakersPage> => (hasSanity ? await fetchData<MakersPage>(MAKERS_QUERY) : null) ?? seed.makers;

export async function getInstruments(): Promise<InstrumentDoc[]> {
  if (!hasSanity) return seed.instruments;
  return (await fetchData<InstrumentDoc[]>(INSTRUMENTS_QUERY)) ?? [];
}

export async function getInstrument(slug: string): Promise<InstrumentDoc | null> {
  if (!hasSanity) return seed.instruments.find((i) => i.slug === slug) ?? null;
  return fetchData<InstrumentDoc>(INSTRUMENT_QUERY, { slug });
}

export async function getFeatures(): Promise<FeatureDoc[]> {
  if (!hasSanity) return seed.features;
  return (await fetchData<FeatureDoc[]>(FEATURES_QUERY)) ?? [];
}

export async function getPage(slug: string): Promise<PageDoc | null> {
  const page = hasSanity ? await fetchData<PageDoc>(PAGE_QUERY, { slug }) : seed.pages.find((p) => p.slug === slug) ?? null;
  return page ? { ...page, body: toBlocks(page.body) } : null;
}

export async function getPageSlugs(): Promise<string[]> {
  if (!hasSanity) return seed.pages.map((p) => p.slug);
  return ((await fetchData<{ slug: string }[]>(PAGE_SLUGS_QUERY)) ?? []).map((r) => r.slug);
}

/** Every text page's address and dates, for the sitemap. */
export async function getPages(): Promise<{ slug: string; updated?: string; _updatedAt?: string }[]> {
  if (!hasSanity) return seed.pages.map((p) => ({ slug: p.slug, updated: p.updated }));
  return (await fetchData<{ slug: string; updated?: string; _updatedAt?: string }[]>(PAGE_SLUGS_QUERY)) ?? [];
}

export async function getPublicRequests(): Promise<PublicRequest[]> {
  if (!hasSanity) return [];
  return (await fetchData<PublicRequest[]>(PUBLIC_REQUESTS_QUERY)) ?? [];
}
