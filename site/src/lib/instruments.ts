import { tuningsFor, type Family, type Tuning } from "./engine";
import type { InstrumentDoc } from "@/sanity/lib/types";

/** The tunings an instrument page offers: its featured ones first, then all of them. */
export function instrumentTunings(doc: InstrumentDoc): { featured: Tuning[]; all: Tuning[] } {
  if (doc.status !== "available" || doc.family === "none") return { featured: [], all: [] };
  const all = tuningsFor(doc.family as Family);
  const featured = (doc.featuredTunings ?? []).map((s) => all.find((t) => t.slug === s)).filter((t): t is Tuning => !!t);
  return { featured: featured.length ? featured : all.slice(0, 6), all };
}
