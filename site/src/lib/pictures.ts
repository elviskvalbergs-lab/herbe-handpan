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

// Real screenshots of the app (public/shots, made by scripts/app-shots.mjs
// from a local build of the app; re-run it when the app's look changes).
export type Shot = { src: string; alt: string; width: number; height: number };
const SHOT = { width: 780, height: 1688 };
const SHOTS: Record<string, Shot> = {
  handpan: { src: "/shots/handpan-chords.webp", alt: "The Oakhum app on a phone: the chords of a D Kurd handpan, with D minor lit on a drawing of the handpan", ...SHOT },
  "tongue-drum": { src: "/shots/tongue-drum-chords.webp", alt: "The Oakhum app on a phone: the chords of a steel tongue drum, with one lit on a drawing of the drum", ...SHOT },
  kalimba: { src: "/shots/kalimba-chords.webp", alt: "The Oakhum app on a phone: the chords of a 17-key kalimba, with C major lit on a drawing of its keys", ...SHOT },
  ocarina: { src: "/shots/ocarina-chords.webp", alt: "The Oakhum app on a phone: a chord on a 12-hole ocarina, with the fingering for each of its notes", ...SHOT },
  flute: { src: "/shots/flute-chords.webp", alt: "The Oakhum app on a phone: a chord on a tin whistle, with the fingering for each of its notes", ...SHOT },
  setup: { src: "/shots/setup-play-my-notes.webp", alt: "The Oakhum app on a phone: setting up an instrument, with the button “Play my notes”", ...SHOT },
  songs: { src: "/shots/songs.webp", alt: "The Oakhum app on a phone: the list “Songs to learn” for a handpan", ...SHOT },
  song: { src: "/shots/song-tab.webp", alt: "The Oakhum app on a phone: a song’s tab, with the note to play lit on the handpan", ...SHOT },
};

/** The app's screenshot for an instrument family, or one of the home page's ("setup", "songs", "song"). */
export function appShot(key: string): Shot | null {
  return SHOTS[key] ?? null;
}
