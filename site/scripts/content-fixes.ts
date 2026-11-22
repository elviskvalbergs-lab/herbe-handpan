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
import * as before from "./seed-before-2026-11-21";
import { toBlocks } from "../src/sanity/lib/blocks";

// Production builds only: previews share the dataset, so a pull request's
// preview must not change the live content before it's merged.
if (!projectId || !writeToken || process.env.VERCEL_ENV !== "production") process.exit(0);
const client = createClient({ projectId, dataset, apiVersion, token: writeToken, useCdn: false });

type Fix = { name: string; run: () => Promise<string> };

const OLD_OCARINA_TEXT = "The app also designs one from a scale: chambers, hole sizes and the clay's shrinkage. Then tune it hole by hole with the built-in tuner.";

// The makers page before the makers programme (2026-11-21): what each text
// read when the page's buttons were emails. Only texts that still read
// exactly like this are replaced.
const OLD_MAKERS = {
  heroCta: "Tell us about your instruments",
  howTitle: "One link in the box",
  ctaText: "Write to us about your instruments and scales. We'll help you set up your first ones, and we'd like to hear what would help your buyers.",
  steps: ["Set it up once", "Put it in the case", "One tap for the buyer"],
  offer: ["A page for every scale you sell", "Your own tunings", "Handpans, kalimbas, flutes and more", "Works on any phone"],
  brandQuestion: "Can it show my brand or my shop?",
  seoDescription: "Help every buyer keep playing the instrument you made: a QR code or NFC tag in the box opens it on their phone with every chord. Free.",
};
const NEW_MAKER_FIELDS = [
  "heroNote", "talkCta", "directoryTitle", "directoryText", "directoryJoinTitle", "directoryJoinText",
  "makerInstrumentsTitle", "makerInstrumentsText", "makerPlayCta", "makerTuningLink", "makerNoInstruments", "makerReport", "makerJoinText",
] as const;

const FIXES: Fix[] = [
  {
    // The makers programme (docs/makers-programme.md in the repository root;
    // owner, 2026-11-21): the page's buttons open the app on "Create your
    // maker page" instead of an email, so its words say so; the directory
    // and the maker pages get their words. A text edited in the Studio stays.
    name: "2026-11-21-makers-programme",
    async run() {
      type Doc = { heroCta?: string; howTitle?: string; ctaText?: string; steps?: { title?: string }[]; offer?: { title?: string }[]; faqs?: { question?: string }[]; seo?: { description?: string } } & Record<string, unknown>;
      const doc = await client.fetch<Doc | null>(`*[_id == "makersPage"][0]`);
      if (!doc) return "no makers page";
      const m = seed.makers;
      const set: Record<string, unknown> = {};
      const key = () => Math.random().toString(36).slice(2, 10);
      const keyed = <T extends object>(list: T[] = []) => list.map((x) => ({ _key: key(), ...x }));
      const titles = (list?: { title?: string }[]) => (list ?? []).map((x) => x.title).join("|");
      if (doc.heroCta === OLD_MAKERS.heroCta) set.heroCta = m.heroCta;
      if (doc.howTitle === OLD_MAKERS.howTitle) set.howTitle = m.howTitle;
      if (doc.ctaText === OLD_MAKERS.ctaText) set.ctaText = m.ctaText;
      if (titles(doc.steps) === OLD_MAKERS.steps.join("|")) set.steps = keyed(m.steps);
      if (titles(doc.offer) === OLD_MAKERS.offer.join("|")) set.offer = keyed(m.offer);
      // The questions: replaced as a set only while "Can it show my brand?" is still there with its old five.
      if (doc.faqs?.length === 5 && doc.faqs.some((f) => f.question === OLD_MAKERS.brandQuestion)) set.faqs = keyed(m.faqs);
      if (doc.seo?.description === OLD_MAKERS.seoDescription) set["seo.description"] = m.seo!.description;
      for (const f of NEW_MAKER_FIELDS) if (!doc[f]) set[f] = m[f];
      if (!Object.keys(set).length) return "left as edited in the Studio";
      await client.patch("makersPage").set(set).commit();
      return `set ${Object.keys(set).join(", ")}`;
    },
  },
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
    // The recorder is in the app (outside-in review, 2026-11-21): its page is
    // created if it isn't there, and the texts that named it as "next" or
    // listed the instruments change only while they still read as the
    // starting content had them.
    name: "2026-11-21-recorder-available",
    async run() {
      const start = seed.instruments.find((i) => i._id === "instrument-recorder")!;
      const notes: string[] = [];
      const tx = client.transaction();
      const doc = await client.fetch<Record<string, unknown> | null>(`*[_id == "instrument-recorder"][0]`);
      if (!doc) {
        tx.createIfNotExists({ ...start, _type: "instrument", slug: { _type: "slug", current: start.slug }, faqs: (start.faqs ?? []).map((f, i) => ({ _key: `k${i}`, ...f })) });
        notes.push("created instrument-recorder");
      } else if (doc.status === "soon" && doc.family === "none") {
        const set: Record<string, unknown> = { family: "recorder", status: "available" };
        for (const key of ["tuningsLine", "title", "intro", "featuredTunings", "playAlongTitle", "playAlongText", "ctaTitle", "ctaText"] as const) {
          const v = doc[key];
          if (v == null || (Array.isArray(v) && !v.length)) set[key] = start[key];
        }
        if (!(doc.faqs as unknown[] | undefined)?.length) set.faqs = (start.faqs ?? []).map((f, i) => ({ _key: `k${i}`, ...f }));
        tx.patch("instrument-recorder", (p) => p.set(set));
        notes.push(`recorder page available; filled ${Object.keys(set).join(", ")}`);
      } else notes.push("recorder page left as edited in the Studio");
      const OLD: Record<string, string> = {
        "feature-more": "Recorder is next. Vote for what you play.",
        "feature-instruments": "Every handpan, tongue drum, kalimba, ocarina and flute you own, with its exact setup, one tap apart.",
        "feature-fingerings": "Ocarina and flute fingerings for every note, from published charts.",
      };
      const docs = await client.fetch<{ _id: string; text?: string }[]>(`*[_id in $ids]{_id, text}`, { ids: Object.keys(OLD) });
      for (const d of docs) {
        if (d.text !== OLD[d._id]) continue;
        tx.patch(d._id, (p) => p.set({ text: seed.features.find((f) => f._id === d._id)!.text }));
        notes.push(d._id);
      }
      await tx.commit();
      return notes.join("; ");
    },
  },
  {
    // The makers video on /makers (owner, 2026-11-19): its title and text,
    // filled only while the fields are empty.
    name: "2026-11-19-makers-video",
    async run() {
      const doc = await client.fetch<{ videoTitle?: string; videoText?: string } | null>(`*[_id == "makersPage"][0]{videoTitle, videoText}`);
      if (!doc) return "no makers page";
      const set: Record<string, unknown> = {};
      if (!doc.videoTitle) set.videoTitle = seed.makers.videoTitle;
      if (!doc.videoText) set.videoText = seed.makers.videoText;
      if (!Object.keys(set).length) return "left as edited in the Studio";
      await client.patch("makersPage").set(set).commit();
      return `set ${Object.keys(set).join(", ")}`;
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
  {
    // The privacy notice names every service that handles data (owner,
    // 2026-11-17): Vercel, Supabase, PostHog, Sentry and Sanity. Replaced
    // only while the page still reads exactly as the first version.
    name: "2026-11-17-privacy-services",
    async run() {
      const OLD = [
        "Oakhum is free to use without an account. This page explains what we keep and why, in plain words.",
        "Who we are",
        "Oakhum is made by Elvis Kvalbergs in Latvia. For anything about your data, write to oakhummusic@gmail.com.",
        "Playing without an account",
        "We don't ask who you are. What you set up stays in your browser until you close the tab. To see which parts of the app are used, we count visits and taps without cookies and without storing an id on your device (PostHog, with data stored in the EU). We don't record your screen.",
        "With an account",
        "We keep your email address and what you save: instruments, favourite chords and playlists. They are stored with Supabase in the EU. You can delete your account and everything in it from the app's settings, any time.",
        "Requests on this website",
        "If you send a request and leave your email, we use it only to tell you when your request is ready, then delete it. Your email is never shown on the site.",
        "Your rights",
        "You can ask us for a copy of your data, to correct it or to delete it, and you can complain to the Latvian Data State Inspectorate (dvi.gov.lv)."
      ];
      const doc = await client.fetch<{ _id: string; t?: string[] } | null>(`*[_id == "page-privacy"][0]{_id, "t": body[].children[].text}`);
      if (!doc) return "no privacy page";
      if (JSON.stringify(doc.t ?? []) !== JSON.stringify(OLD)) return "left as edited in the Studio";
      const page = seed.pages.find((p) => p._id === "page-privacy")!;
      await client.patch("page-privacy").set({ body: toBlocks(page.body), updated: page.updated }).commit();
      return "privacy notice updated";
    },
  },
  {
    // Listening reports (the app's "Send us the recording"): the microphone section and Jira.
    name: "2026-11-19-privacy-listening",
    async run() {
      const OLD = [
        "Oakhum is free to use without an account. This page explains what we keep and why, in plain words.",
        "Who we are",
        "Oakhum is made by Elvis Kvalbergs in Latvia. For anything about your data, write to oakhummusic@gmail.com.",
        "Playing without an account",
        "We don't ask who you are. What you set up stays in your browser until you close the tab. To see which parts of the app are used, we count visits and taps without cookies and without storing an id on your device (PostHog, with data stored in the EU). We don't record your screen.",
        "With an account",
        "We keep your email address and what you save: instruments, favourite chords and playlists. They are stored with Supabase in the EU, which also sends your sign-in code. You can delete your account and everything in it from the app's settings, any time.",
        "Requests on this website",
        "If you send a request and leave your email, we use it only to tell you when your request is ready, then delete it. Your email is never shown on the site. Requests are kept with Sanity, the service that holds this website's content.",
        "Services that help us run Oakhum",
        "Each of these handles data only to do its job for us.",
        "Vercel hosts the website and the app. Like any web host, it sees the address your browser connects from.",
        "Supabase stores accounts and what you save, in the EU, and sends sign-in codes.",
        "PostHog counts visits and taps, without cookies, with data stored in the EU.",
        "Sentry receives a report when something in the app or on the website goes wrong: what failed, on which page, and the browser and device type, without your name or email. The reports are stored in the EU.",
        "Sanity holds the website's text and the requests sent through it, with the email you leave.",
        "Your rights",
        "You can ask us for a copy of your data, to correct it or to delete it, and you can complain to the Latvian Data State Inspectorate (dvi.gov.lv)."
      ];
      const doc = await client.fetch<{ _id: string; t?: string[] } | null>(`*[_id == "page-privacy"][0]{_id, "t": body[].children[].text}`);
      if (!doc) return "no privacy page";
      if (JSON.stringify(doc.t ?? []) !== JSON.stringify(OLD)) return "left as edited in the Studio";
      const page = seed.pages.find((p) => p._id === "page-privacy")!;
      await client.patch("page-privacy").set({ body: toBlocks(page.body), updated: page.updated }).commit();
      return "privacy notice updated";
    },
  },
  {
    // Listening reports can carry a photo of the instrument.
    name: "2026-11-20-privacy-report-photo",
    async run() {
      const OLD = [
        "Oakhum is free to use without an account. This page explains what we keep and why, in plain words.",
        "Who we are",
        "Oakhum is made by Elvis Kvalbergs in Latvia. For anything about your data, write to oakhummusic@gmail.com.",
        "Playing without an account",
        "We don't ask who you are. What you set up stays in your browser until you close the tab. To see which parts of the app are used, we count visits and taps without cookies and without storing an id on your device (PostHog, with data stored in the EU). We don't record your screen.",
        "The microphone",
        "When Oakhum listens to your instrument, the sound is worked out on your device and isn't sent anywhere. While it listens, it also keeps a recording in your browser's memory, so that you can send it to us if it heard your instrument wrong. The recording is gone when you close the page.",
        "If you choose to send a listening report, we receive what you wrote, the notes Oakhum heard, the recording if you leave it switched on (it may also catch voices in the room), your email if you leave it, and your browser and device type. We use it only to fix how Oakhum listens and to tell you when it's fixed. We keep it until it's fixed, and at most a year.",
        "With an account",
        "We keep your email address and what you save: instruments, favourite chords and playlists. They are stored with Supabase in the EU, which also sends your sign-in code. You can delete your account and everything in it from the app's settings, any time.",
        "Requests on this website",
        "If you send a request and leave your email, we use it only to tell you when your request is ready, then delete it. Your email is never shown on the site. Requests are kept with Sanity, the service that holds this website's content.",
        "Services that help us run Oakhum",
        "Each of these handles data only to do its job for us.",
        "Vercel hosts the website and the app. Like any web host, it sees the address your browser connects from.",
        "Supabase stores accounts and what you save, in the EU, and sends sign-in codes.",
        "PostHog counts visits and taps, without cookies, with data stored in the EU.",
        "Sentry receives a report when something in the app or on the website goes wrong: what failed, on which page, and the browser and device type, without your name or email. The reports are stored in the EU.",
        "Sanity holds the website's text, the requests sent through it and listening reports, with the email you leave.",
        "Jira, by Atlassian, is our to-do list: feedback and listening reports are copied there while we work on them.",
        "Your rights",
        "You can ask us for a copy of your data, to correct it or to delete it, and you can complain to the Latvian Data State Inspectorate (dvi.gov.lv)."
      ];
      const doc = await client.fetch<{ _id: string; t?: string[] } | null>(`*[_id == "page-privacy"][0]{_id, "t": body[].children[].text}`);
      if (!doc) return "no privacy page";
      if (JSON.stringify(doc.t ?? []) !== JSON.stringify(OLD)) return "left as edited in the Studio";
      const page = seed.pages.find((p) => p._id === "page-privacy")!;
      await client.patch("page-privacy").set({ body: toBlocks(page.body), updated: page.updated }).commit();
      return "privacy notice updated";
    },
  },
  {
    // The copy review of 2026-11-21: the home page says what Oakhum is and
    // leads with "Play my notes" and songs, features carry the app's own
    // names, the ocarina page names the 6-hole pendant, and the privacy page
    // covers measurement on the website. Every field is compared with the
    // starting content as it was before (scripts/seed-before-2026-11-21.ts):
    // it changes only while it still reads exactly as it did then, and new
    // fields are filled only while empty, so Studio edits stay.
    name: "2026-11-21-copy-review",
    async run() {
      const tx = client.transaction();
      const notes: string[] = [];
      // Arrays of objects carry Sanity's _key: compared without, written with.
      const plain = (v: unknown): unknown => (Array.isArray(v) ? v.map((x) => (x && typeof x === "object" ? Object.fromEntries(Object.entries(x).filter(([k]) => k !== "_key" && k !== "_type")) : x)) : v);
      const same = (a: unknown, b: unknown) => JSON.stringify(plain(a) ?? null) === JSON.stringify(plain(b) ?? null);
      const keyed = (v: unknown): unknown => (Array.isArray(v) ? v.map((x, i) => (x && typeof x === "object" ? { _key: `r${i}`, ...x } : x)) : v);
      // What to set on a document: fields whose starting text changed, where the live text is still the old one (or missing).
      const changes = (doc: Record<string, unknown>, was: Record<string, unknown>, now: Record<string, unknown>) => {
        const set: Record<string, unknown> = {};
        for (const key of Object.keys(now)) {
          if (key.startsWith("_") || key === "slug" || same(was[key], now[key])) continue;
          if (doc[key] == null || same(doc[key], was[key])) set[key] = keyed(now[key]);
        }
        return set;
      };
      const apply = (id: string, set: Record<string, unknown>) => {
        if (!Object.keys(set).length) return;
        tx.patch(id, (p) => p.set(set));
        notes.push(`${id}: ${Object.keys(set).join(", ")}`);
      };

      const home = await client.fetch<Record<string, unknown> | null>(`*[_id == "homePage"][0]`);
      if (home) apply("homePage", changes(home, before.home as Record<string, unknown>, seed.home as Record<string, unknown>));
      const settings = await client.fetch<Record<string, unknown> | null>(`*[_id == "siteSettings"][0]`);
      if (settings) apply("siteSettings", changes(settings, before.settings as Record<string, unknown>, seed.settings as Record<string, unknown>));

      const ids = [...seed.instruments, ...seed.features].map((d) => d._id);
      const docs = await client.fetch<Record<string, unknown>[]>(`*[_id in $ids]`, { ids });
      const old = new Map<string, Record<string, unknown>>([...before.instruments, ...before.features].map((d) => [d._id, d as Record<string, unknown>]));
      for (const now of [...seed.instruments, ...seed.features] as Record<string, unknown>[]) {
        const doc = docs.find((d) => d._id === now._id);
        const was = old.get(now._id as string);
        if (doc && was) apply(now._id as string, changes(doc, was, now));
      }
      // New in the app since the list was written.
      const songs = seed.features.find((f) => f._id === "feature-songs")!;
      tx.createIfNotExists({ _type: "feature", ...songs });
      notes.push("feature-songs");

      // The privacy page: replaced only while it reads exactly as it did.
      const page = seed.pages.find((p) => p._id === "page-privacy")!;
      const wasPage = before.pages.find((p) => p._id === "page-privacy")!;
      const live = await client.fetch<{ t?: string[] } | null>(`*[_id == "page-privacy"][0]{"t": body[].children[].text}`);
      if (live && JSON.stringify(live.t ?? []) === JSON.stringify((wasPage.body as { text: string }[]).map((b) => b.text))) {
        tx.patch("page-privacy", (p) => p.set({ body: toBlocks(page.body), updated: page.updated }));
        notes.push("page-privacy");
      }
      await tx.commit();
      return notes.join("; ") || "left as edited in the Studio";
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
