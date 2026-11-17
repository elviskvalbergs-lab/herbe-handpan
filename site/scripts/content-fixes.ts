// One-time changes to the live content in Sanity, run by `prebuild` on Vercel
// (the only place the write token can be read). Like database migrations:
// each fix has a name, runs once, and is recorded in the document
// "contentFixes"; locally, without a token, nothing happens.
//
// A fix never overwrites what was edited in the Studio: it changes a text
// only while it still reads exactly as the starting content had it.
import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId, writeToken } from "../src/sanity/env";

if (!projectId || !writeToken) process.exit(0);
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
];

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
