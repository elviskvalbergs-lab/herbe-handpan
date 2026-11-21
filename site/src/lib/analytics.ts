// Measurement for the website: PostHog EU, the same project and the same
// settings as the app (../js/auth.js), so one funnel runs from a page here to
// playing in the app. No consent banner is needed: cookieless mode (nothing is
// stored on the device; PostHog's server counts a visitor with a daily hash,
// and the project discards IPs), no person profiles, no session recording.
// Every failure is silent: measuring never gets in the way of the page.
//
// Vercel Web Analytics and Speed Insights (page views and loading speed, also
// without cookies) are separate: components/Measure.tsx.

/** The PostHog project's public key (the same as the app's `_PH_KEY`); empty turns PostHog off. */
export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "phc_nh2iTHkNwrRJm9cvptxc5MUErcozvXSzfgpo3eCyg9cP";
const POSTHOG_HOST = "https://eu.i.posthog.com";
const POSTHOG_SCRIPT = "https://eu-assets.i.posthog.com/static/array.js";

/** The events the site sends, and what each carries. */
export type SiteEvent =
  | "demo_chord_played" // family, tuning, chord
  | "app_cta_click" // location (header, hero, demo, …), href
  | "request_submitted" // kind
  | "maker_contact_click" // location
  | "video_play"; // video

type PostHog = { init: (key: string, options: Record<string, unknown>) => void; capture: (name: string, props?: Record<string, unknown>) => void };
declare global {
  interface Window { posthog?: PostHog }
}

const queue: [string, Record<string, unknown>][] = [];
let state: "off" | "loading" | "ready" = "off";

/** Loads PostHog once (called when the page has settled, and by the first event). */
export function loadAnalytics(): void {
  if (!POSTHOG_KEY || state !== "off" || typeof document === "undefined") return;
  state = "loading";
  const s = document.createElement("script");
  s.async = true;
  s.src = POSTHOG_SCRIPT;
  s.onload = () => {
    try {
      window.posthog!.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST, cookieless_mode: "always", persistence: "memory", person_profiles: "identified_only",
        autocapture: true, capture_pageview: "history_change", capture_exceptions: false,
        capture_performance: false, disable_session_recording: true,
      });
      state = "ready";
      while (queue.length) { const [n, p] = queue.shift()!; track(n as SiteEvent, p); }
    } catch { state = "off"; }
  };
  s.onerror = () => { state = "off"; };
  document.head.appendChild(s);
}

/** Sends one event; before PostHog has loaded, events wait in a short queue. */
export function track(name: SiteEvent, props: Record<string, unknown> = {}): void {
  if (!POSTHOG_KEY || typeof window === "undefined") return;
  if (state !== "ready") { if (queue.length < 50) queue.push([name, props]); loadAnalytics(); return; }
  try { window.posthog!.capture(name, { ...props, surface: "site" }); } catch { /* never in the way */ }
}

// ── Links into the app ──────────────────────────────────────────────────────

/** Paths the app answers on this domain (next.config.ts APP_PATHS). */
const APP_PATH = /^\/(play|handpan|tongue-drum|kalimba|ocarina|flute|s)(\/|$|\?)/;

export function isAppPath(path: string): boolean {
  return APP_PATH.test(path);
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

/** The campaign tags (utm_…) of an address's query string. */
export function utmParams(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  const q = new URLSearchParams(search);
  for (const k of UTM_KEYS) { const v = q.get(k); if (v) out[k] = v.slice(0, 100); }
  return out;
}

/**
 * A link into the app carrying the visit's campaign tags, so a visitor who
 * came from a tagged link is still counted for it when they open the app. The
 * link's own tags, if it has any, win.
 */
export function withUtm(href: string, utm: Record<string, string>): string {
  if (!Object.keys(utm).length) return href;
  const [rest, hash = ""] = href.split("#");
  const [path, query = ""] = rest.split("?");
  const q = new URLSearchParams(query);
  for (const [k, v] of Object.entries(utm)) if (!q.has(k)) q.set(k, v);
  return `${path}?${q.toString()}${hash ? `#${hash}` : ""}`;
}
