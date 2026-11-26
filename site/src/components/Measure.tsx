"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isAppPath, loadAnalytics, setHomeVariant, track, utmParams, withUtm } from "@/lib/analytics";

// Measurement for every page (src/lib/analytics.ts): Vercel Web Analytics and
// Speed Insights, PostHog, and the funnel events that come from plain links
// and the video, caught here once so pages don't each wire them up:
//   app_cta_click        any link into the app; `location` is where it sits
//   maker_contact_click  an email link on /makers
//   video_play           a video started
// A link into the app also gets the visit's campaign tags (utm_…).

// The tags this visit arrived with. Kept in memory only: nothing is stored on the device.
let landingUtm: Record<string, string> | null = null;

/** Where on the page something sits: its own data-loc, else header, footer or the section's id. */
function locationOf(el: Element): string {
  const own = el.closest<HTMLElement>("[data-loc]")?.dataset.loc;
  if (own) return own;
  if (el.closest("header")) return "header";
  if (el.closest("footer")) return "footer";
  return el.closest("section[id]")?.id || "page";
}

export function Measure() {
  const pathname = usePathname();
  // The home page experiment (src/lib/experiment.ts): which version this page
  // is, read again on every page change (the layout, and so this, stays mounted).
  useEffect(() => {
    const variant = document.querySelector<HTMLElement>("[data-home-variant]")?.dataset.homeVariant ?? null;
    setHomeVariant(variant);
    if (variant) track("home_view", { variant });
  }, [pathname]);

  useEffect(() => {
    landingUtm ??= utmParams(window.location.search);
    // After the page has settled, so it never competes with the first paint.
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 1500));
    idle(() => loadAnalytics());

    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (isAppPath(href)) {
        track("app_cta_click", { location: locationOf(a), href: href.split("?")[0], page: window.location.pathname });
        const tagged = withUtm(href, landingUtm ?? {});
        if (tagged !== href) a.setAttribute("href", tagged);
      } else if (href.startsWith("mailto:") && window.location.pathname.startsWith("/makers")) {
        track("maker_contact_click", { location: locationOf(a) });
      }
    };
    // `play` doesn't bubble, so it is caught on the way down.
    const onPlay = (e: Event) => {
      const v = e.target as HTMLVideoElement | null;
      if (v?.tagName !== "VIDEO" || v.dataset.played) return;
      v.dataset.played = "1"; // once per video, not on every resume
      track("video_play", { video: (v.currentSrc || v.querySelector("source")?.src || "").split("/").pop(), page: window.location.pathname });
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("play", onPlay, true);
    return () => { document.removeEventListener("click", onClick, true); document.removeEventListener("play", onPlay, true); };
  }, []);

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
