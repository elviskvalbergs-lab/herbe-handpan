import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { stegaClean } from "next-sanity";
import { VisualEditing } from "next-sanity/visual-editing";
import { Suspense } from "react";
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
    title: { default: `${title}: chords for handpan, ocarina and flute`, template: `%s | ${title}` },
    description: stegaClean(settings.description),
    icons: { icon: "/brand/leaf_only_oak_olive.svg" },
    openGraph: { siteName: title, type: "website", images: ["/og.jpg"] },
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
