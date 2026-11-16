// Writes the starting content (src/content/seed.ts) to Sanity.
//   SANITY_API_WRITE_TOKEN=… NEXT_PUBLIC_SANITY_PROJECT_ID=… pnpm seed
// Deterministic ids, so a re-run updates instead of duplicating. It replaces
// those documents, so run it once at the start; after that, edit in /studio.
//
// --on-build (run by `prebuild`): does nothing unless SANITY_SEED_ON_BUILD=1
// is set in Vercel, and then only creates documents that don't exist yet, so
// it never overwrites what was edited in the Studio. This is how the content
// is loaded when the write token is only readable inside Vercel's build: set
// the variable, redeploy once, remove it.
const onBuild = process.argv.includes("--on-build");
if (onBuild && process.env.SANITY_SEED_ON_BUILD !== "1") process.exit(0);
import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId, writeToken } from "../src/sanity/env";
import * as seed from "../src/content/seed";
import { toBlocks } from "../src/sanity/lib/blocks";

if (!projectId || !writeToken) {
  console.error("Set NEXT_PUBLIC_SANITY_PROJECT_ID (or SANITY_API_PROJECT_ID) and SANITY_API_WRITE_TOKEN first.");
  process.exit(1);
}

const client = createClient({ projectId, dataset, apiVersion, token: writeToken, useCdn: false });
const tx = client.transaction();
const put = (doc: { _id: string; _type: string; [field: string]: unknown }) => (onBuild ? tx.createIfNotExists(doc) : tx.createOrReplace(doc));
const key = (i: number) => `k${i}`;
const withKeys = <T extends object>(list: T[] | undefined) => (list ?? []).map((item, i) => ({ _key: key(i), ...item }));

async function main() {
  put({ _id: "siteSettings", _type: "siteSettings", ...seed.settings });
  put({
    _id: "homePage", _type: "homePage", ...seed.home,
    steps: withKeys(seed.home.steps), why: withKeys(seed.home.why), memberPoints: withKeys(seed.home.memberPoints), faqs: withKeys(seed.home.faqs),
  });
  for (const i of seed.instruments) {
    put({ ...i, _type: "instrument", slug: { _type: "slug", current: i.slug }, faqs: withKeys(i.faqs) });
  }
  for (const f of seed.features) put({ ...f, _type: "feature" });
  for (const p of seed.pages) {
    put({ ...p, _type: "page", slug: { _type: "slug", current: p.slug }, body: toBlocks(p.body) });
  }
  const res = await tx.commit();
  console.log(`Seeded ${res.results.length} documents into ${projectId}/${dataset}${onBuild ? " (missing ones only)" : ""}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
