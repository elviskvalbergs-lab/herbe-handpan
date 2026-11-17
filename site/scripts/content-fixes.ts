// One-time changes to the live content in Sanity, run by `prebuild` on Vercel
// (the only place the write token can be read). Like database migrations:
// each fix has a name, runs once, and is recorded in the document
// "contentFixes"; locally, without a token, nothing happens.
//
// A fix never overwrites what was edited in the Studio: it changes a text
// only while it still reads exactly as the starting content had it.
import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId, writeToken } from "../src/sanity/env";
import * as seed from "../src/content/seed";

// Production builds only: previews share the dataset, so a pull request's
// preview must not change the live content before it's merged.
if (!projectId || !writeToken || process.env.VERCEL_ENV !== "production") process.exit(0);
const client = createClient({ projectId, dataset, apiVersion, token: writeToken, useCdn: false });

type Fix = { name: string; run: () => Promise<string> };

const OLD_OCARINA_TEXT = "The app also designs one from a scale: chambers, hole sizes and the clay's shrinkage. Then tune it hole by hole with the built-in tuner.";

const FIXES: Fix[] = [
  {
    // Building ocarinas is for chosen accounts only (profiles.can_build), so
    // the website no longer offers it (owner's decision, 2026-11-17).
    name: "2026-11-17-hide-builder",
    async run() {
      const tx = client.transaction().delete("feature-builder");
      const ocarina = await client.fetch<{ _id: string; playAlongTitle?: string; playAlongText?: string } | null>(
        `*[_type == "instrument" && slug.current == "ocarina"][0]{_id, playAlongTitle, playAlongText}`,
      );
      let note = "deleted feature-builder";
      if (ocarina && ocarina.playAlongText === OLD_OCARINA_TEXT) {
        tx.patch(ocarina._id, (p) => p.set({
          playAlongTitle: "Made your own ocarina?",
          playAlongText: "Set it up hole by hole with the built-in tuner, and the app gives it its own fingering chart and chords.",
        }));
        note += "; reworded the ocarina page's own-ocarina box";
      }
      await tx.commit();
      return note;
    },
  },
  {
    // The tongue drum is in the app (owner, 2026-11-17): its page becomes
    // available. Fields are filled only where they still hold the starting
    // "coming soon" text (or nothing), so Studio edits stay.
    name: "2026-11-17-tongue-drum-available",
    async run() {
      const doc = await client.fetch<Record<string, unknown> | null>(`*[_id == "instrument-tongue-drum"][0]`);
      if (!doc) return "no tongue drum document";
      if (doc.status !== "soon" || doc.family !== "none") return "left as edited in the Studio";
      const start = seed.instruments.find((i) => i._id === "instrument-tongue-drum")!;
      const OLD: Record<string, unknown> = {
        tuningsLine: "8, 11 and 15-tongue drums in common scales",
        title: "Steel tongue drum chords",
        intro: "Steel tongue drums share a lot with handpans: a fixed set of notes. Tell us your drum's notes and vote for it.",
      };
      const set: Record<string, unknown> = { family: "tongue-drum", status: "available" };
      for (const key of ["tuningsLine", "title", "intro"]) if (doc[key] === OLD[key] || !doc[key]) set[key] = start[key as keyof typeof start];
      for (const key of ["featuredTunings", "playAlongTitle", "playAlongText", "ctaTitle", "ctaText"]) {
        const v = doc[key];
        if (v == null || (Array.isArray(v) && !v.length)) set[key] = start[key as keyof typeof start];
      }
      if (!(doc.faqs as unknown[] | undefined)?.length) set.faqs = (start.faqs ?? []).map((f, i) => ({ _key: `k${i}`, ...f }));
      const tx = client.transaction().patch("instrument-tongue-drum", (p) => p.set(set));
      const kalimba = await client.fetch<{ order?: number } | null>(`*[_id == "instrument-kalimba"][0]{order}`);
      if (kalimba?.order === 4) { tx.patch("instrument-tongue-drum", (p) => p.set({ order: 4 })); tx.patch("instrument-kalimba", (p) => p.set({ order: 5 })); }
      const more = await client.fetch<{ text?: string } | null>(`*[_id == "feature-more"][0]{text}`);
      if (more?.text === "Kalimba and steel tongue drum are next. Vote for what you play.") tx.patch("feature-more", (p) => p.set({ text: "Kalimba is next. Vote for what you play." }));
      await tx.commit();
      return `available; filled ${Object.keys(set).join(", ")}`;
    },
  },
  {
    // The owner's story of the name (2026-11-17): the hum of the oaks and the
    // forest, grounding and healing, and a Latvian folk song about the oak.
    // The story is replaced only while it is still the starting text; the
    // verse fields are filled only while empty.
    name: "2026-11-17-oak-story",
    async run() {
      const doc = await client.fetch<Record<string, unknown> | null>(`*[_id == "siteSettings"][0]`);
      if (!doc) return "no siteSettings document";
      const OLD_STORY = "Oakhum is made in Latvia, on a street lined with old oaks. In Latvian folklore the oak is the tree of strength, and it has stood for as long as people have made music. The hum is what handpans, ocarinas and flutes share: hollow bodies that sing when you play them.";
      const set: Record<string, unknown> = {};
      if (doc.story === OLD_STORY || !doc.story) set.story = seed.settings.story;
      for (const key of ["storyVerse", "storyVerseTranslation", "storyVerseSource"] as const) if (!doc[key]) set[key] = seed.settings[key];
      if (!Object.keys(set).length) return "left as edited in the Studio";
      await client.patch("siteSettings").set(set).commit();
      return `set ${Object.keys(set).join(", ")}`;
    },
  },
  {
    // The kalimba is in the app (owner, 2026-11-17): its page becomes
    // available, filling only what still holds the "coming soon" text.
    name: "2026-11-17-kalimba-available",
    async run() {
      const doc = await client.fetch<Record<string, unknown> | null>(`*[_id == "instrument-kalimba"][0]`);
      if (!doc) return "no kalimba document";
      if (doc.status !== "soon" || doc.family !== "none") return "left as edited in the Studio";
      const start = seed.instruments.find((i) => i._id === "instrument-kalimba")!;
      const OLD: Record<string, unknown> = {
        tuningsLine: "17-key in C, 21-key and custom",
        title: "Kalimba chords",
        intro: "Kalimba support is on the list. Tell us which kalimba you play and its notes, and vote for it to move it up.",
      };
      const set: Record<string, unknown> = { family: "kalimba", status: "available" };
      for (const key of ["tuningsLine", "title", "intro"]) if (doc[key] === OLD[key] || !doc[key]) set[key] = start[key as keyof typeof start];
      for (const key of ["featuredTunings", "playAlongTitle", "playAlongText", "ctaTitle", "ctaText"]) {
        const v = doc[key];
        if (v == null || (Array.isArray(v) && !v.length)) set[key] = start[key as keyof typeof start];
      }
      if (!(doc.faqs as unknown[] | undefined)?.length) set.faqs = (start.faqs ?? []).map((f, i) => ({ _key: `k${i}`, ...f }));
      await client.transaction().patch("instrument-kalimba", (p) => p.set(set)).commit();
      return `available; filled ${Object.keys(set).join(", ")}`;
    },
  },
  {
    // The home page's feature list, reviewed after the kalimba (owner,
    // 2026-11-17): Listen and offline are built, setting up by ear is new,
    // and the instrument lists name every family. Each text changes only
    // while it still reads as the starting content had it.
    name: "2026-11-17-features-review",
    async run() {
      const start = (id: string) => seed.features.find((f) => f._id === id)!;
      const OLD: Record<string, Record<string, unknown>> = {
        "feature-instruments": { text: "Every handpan, ocarina and flute you own, with its exact setup, one tap apart." },
        "feature-listen": { status: "next", order: 20 },
        "feature-offline": { title: "Play offline", text: "With a free account, your instruments, chords and playlists keep working with no signal.", status: "next", order: 21 },
        "feature-more": { text: "Kalimba is next. Vote for what you play." },
      };
      const docs = await client.fetch<Record<string, unknown>[]>(`*[_id in $ids]`, { ids: Object.keys(OLD) });
      const tx = client.transaction();
      const notes: string[] = [];
      for (const doc of docs) {
        const id = doc._id as string;
        const set: Record<string, unknown> = {};
        for (const [key, old] of Object.entries(OLD[id])) if (doc[key] === old) set[key] = start(id)[key as keyof FeatureStart];
        if (Object.keys(set).length) { tx.patch(id, (p) => p.set(set)); notes.push(`${id}: ${Object.keys(set).join(", ")}`); }
      }
      const s = start("feature-setup-listen");
      tx.createIfNotExists({ _type: "feature", ...s });
      notes.push("feature-setup-listen");
      const settings = await client.fetch<{ _id: string; description?: string } | null>(
        `*[_type == "siteSettings"][0]{_id, description}`,
      );
      if (settings?.description === "Chords, arpeggios and play-along for handpan, ocarina and flute. Free in your browser, nothing to install.") {
        tx.patch(settings._id, (p) => p.set({ description: seed.settings.description }));
        notes.push("settings.description");
      }
      const home = await client.fetch<{ _id: string; faqs?: { _key: string; question?: string; answer?: string }[] } | null>(`*[_id == "homePage"][0]{_id, faqs}`);
      const OLD_OFFLINE = "Not yet. Offline use for account holders is being built: sign in once while connected, and your instruments and playlists will keep working with no signal.";
      const faq = home?.faqs?.find((f) => f.answer === OLD_OFFLINE);
      if (home && faq) {
        const answer = seed.home.faqs!.find((f) => f.question === "Does it work offline?")!.answer;
        tx.patch(home._id, (p) => p.set({ [`faqs[_key=="${faq._key}"].answer`]: answer }));
        notes.push("offline question");
      }
      await tx.commit();
      return notes.join("; ");
    },
  },
  {
    // The daina's English, retold as a verse rather than word for word
    // (owner, 2026-11-17). Changed only while it is still the first version.
    name: "2026-11-17-daina-translation",
    async run() {
      const doc = await client.fetch<{ storyVerseTranslation?: string } | null>(`*[_id == "siteSettings"][0]{storyVerseTranslation}`);
      if (doc?.storyVerseTranslation !== "Little oak, little oak,\nhow great your age:\nI was born, and found you here;\nI will die, and you will stay.") return "left as edited in the Studio";
      await client.patch("siteSettings").set({ storyVerseTranslation: seed.settings.storyVerseTranslation }).commit();
      return "set storyVerseTranslation";
    },
  },
];

type FeatureStart = (typeof seed.features)[number];

async function main() {
  const done = new Set((await client.fetch<{ done?: string[] } | null>(`*[_id == "contentFixes"][0]{done}`))?.done ?? []);
  for (const fix of FIXES) {
    if (done.has(fix.name)) continue;
    const note = await fix.run();
    await client.createIfNotExists({ _id: "contentFixes", _type: "contentFixes", done: [] });
    await client.patch("contentFixes").setIfMissing({ done: [] }).append("done", [fix.name]).commit();
    console.log(`content-fixes: ${fix.name}: ${note}`);
  }
}

// A failed fix must not stop the deploy: the site works either way.
main().catch((e) => { console.warn("content-fixes: skipped:", e?.message ?? e); });
