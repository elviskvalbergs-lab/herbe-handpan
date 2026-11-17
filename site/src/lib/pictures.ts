// The instrument pictures of the brand kit (brand/instruments, 512 × 512,
// transparent; copied into public/ by scripts/sync-assets.mjs), by the
// instrument's slug. An instrument without one shows none.
const PICTURES: Record<string, string> = {
  handpan: "/brand/instruments/handpan.webp",
  ocarina: "/brand/instruments/ocarina.webp",
  flute: "/brand/instruments/native-american-flute.webp",
  kalimba: "/brand/instruments/kalimba.webp",
  "steel-tongue-drum": "/brand/instruments/tongue-drum.webp",
  "tongue-drum": "/brand/instruments/tongue-drum.webp",
  recorder: "/brand/instruments/recorder.webp",
};

export function instrumentPicture(slug: string): string | null {
  return PICTURES[slug] ?? null;
}
