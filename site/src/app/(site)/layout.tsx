import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { stegaClean } from "next-sanity";
import { VisualEditing } from "next-sanity/visual-editing";
import { Suspense } from "react";
import { Measure } from "@/components/Measure";
import { SanityLive } from "@/sanity/lib/live";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SITE_URL } from "@/lib/site";
import { hasSanity } from "@/sanity/env";
import { getSettings } from "@/sanity/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title = stegaClean(settings.title) || "Oakhum";
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${title}: chords and songs for the instrument you own`, template: `%s | ${title}` },
    description: stegaClean(settings.description),
    icons: { icon: "/brand/leaf_only_oak_olive.svg" },
    // Every page: its own address as the canonical link and og:url ("./" is
    // the page being rendered). Pages with their own picture use pageMeta (src/lib/seo.ts).
    alternates: { canonical: "./" },
    openGraph: { siteName: title, type: "website", url: "./", images: [{ url: "/og.jpg", width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image" },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-pill focus:bg-cta focus:px-5 focus:py-2 focus:text-on-cta">
        Skip to content
      </a>
      <SiteHeader />
      <main id="content">{children}</main>
      <SiteFooter settings={settings} />
      <Suspense fallback={null}>
        <Measure />
      </Suspense>
      {hasSanity ? (
        <Suspense fallback={null}>
          <LiveAndVisualEditing />
        </Suspense>
      ) : null}
    </>
  );
}

async function LiveAndVisualEditing() {
  const { isEnabled } = await draftMode();
  return (
    <>
      <SanityLive includeDrafts={isEnabled} />
      {isEnabled ? <VisualEditing /> : null}
    </>
  );
}
