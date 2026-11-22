// Search and sharing: each page's share card and its structured data
// (JSON-LD, read by search engines). Pure, so it is unit-tested (tests/seo.spec.ts).
import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "./site";
import type { QA } from "@/sanity/lib/types";

/** The share pictures (1200 × 630): the site's own, and the app's one per instrument family (../og, served at /og). */
export function shareImage(family?: string): string {
  return family && ["handpan", "tongue-drum", "kalimba", "ocarina", "flute"].includes(family) ? `/og/${family}.jpg` : "/og.jpg";
}

/**
 * A page's title, description, canonical address and share card. The layout
 * gives every page a canonical and og:url of its own address; this is for
 * pages that also have their own picture or point search engines elsewhere.
 */
export function pageMeta({ title, description, path, family, canonical }: {
  title: string; description?: string; path: string; family?: string; canonical?: string;
}): Metadata {
  const image = { url: shareImage(family), width: 1200, height: 630 };
  return {
    title,
    description,
    alternates: { canonical: canonical ?? path },
    openGraph: { siteName: SITE_NAME, type: "website", title, description, url: canonical ?? path, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path === "/" ? "" : path}`);

/** The app itself, as search engines list web apps: free, in the browser. */
export function webApplicationLd(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: abs("/play"),
    description,
    applicationCategory: "MusicApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "A modern browser: Chrome, Safari, Firefox or Edge",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: abs("/brand/leaf_only_oak_olive.svg") },
  };
}

export function faqLd(faqs: QA[] | undefined) {
  if (!faqs?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
  };
}

/** The trail to a page: [{ name, path }], home first. */
export function breadcrumbLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: abs(t.path) })),
  };
}

/** JSON for a <script type="application/ld+json">: "<" is escaped, so text can never close the tag. */
export function ldJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
