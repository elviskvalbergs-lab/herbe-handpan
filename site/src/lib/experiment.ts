// The home page experiment: does the playable handpan demo help people get to
// playing in the app, or does a video of the real app do better, since the
// demo isn't how the app works? (Owner, 2026-11-26.)
//
// Each visit to "/" is put in "a" (with the demo) or "b" (the overview video in its place) at random by
// src/proxy.ts. Nothing is stored on the device, so a visitor who reloads can
// see the other version; that is the price of staying cookie-free. The site's
// analytics send `home_view` with the variant, and every later site event on
// that page carries `home_variant` (src/components/Measure.tsx), so PostHog
// can compare the two (dashboard "Oakhum: where people drop off").
//
// HOME_EXPERIMENT in Vercel: "off" serves everyone "a"; "a" or "b" serves
// everyone that version (to end the test on the winner without a deploy of
// code). Unset or anything else runs the 50/50 split. ?home=a or ?home=b in
// the address shows one version, for checking.

export type HomeVariant = "a" | "b";

export const HOME_B_PATH = "/home-b";

/** Which version of the home page a visit gets. */
export function pickHomeVariant(search: string, setting: string | undefined, random: () => number = Math.random): HomeVariant {
  const asked = new URLSearchParams(search).get("home");
  if (asked === "a" || asked === "b") return asked;
  if (setting === "off" || setting === "a") return "a";
  if (setting === "b") return "b";
  return random() < 0.5 ? "a" : "b";
}
