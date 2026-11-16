// Writes the starting content (src/content/seed.ts) to Sanity.
//   SANITY_API_WRITE_TOKEN=… NEXT_PUBLIC_SANITY_PROJECT_ID=… pnpm seed
// Deterministic ids, so a re-run updates instead of duplicating. It replaces
// those documents, so run it once at the start; after that, edit in /studio.
import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId, writeToken } from "../src/sanity/env";
import * as seed from "../src/content/seed";
import { toBlocks } from "../src/sanity/lib/blocks";

if (!projectId || !writeToken) {
  console.error("Set NEXT_PUBLIC_SANITY_PROJECT_ID (or SANITY_API_PROJECT_ID) and SANITY_API_WRITE_TOKEN first.");
  process.exit(1);
}

const client = createClient({ projectId, dataset, apiVersion, token: writeToken, useCdn: false });
const key = (i: number) => `k${i}`;
const withKeys = <T extends object>(list: T[] | undefined) => (list ?? []).map((item, i) => ({ _key: key(i), ...item }));

async function main() {
  const tx = client.transaction();
  tx.createOrReplace({ _id: "siteSettings", _type: "siteSettings", ...seed.settings });
  tx.createOrReplace({
    _id: "homePage", _type: "homePage", ...seed.home,
    steps: withKeys(seed.home.steps), why: withKeys(seed.home.why), memberPoints: withKeys(seed.home.memberPoints), faqs: withKeys(seed.home.faqs),
  });
  for (const i of seed.instruments) {
    tx.createOrReplace({ ...i, _type: "instrument", slug: { _type: "slug", current: i.slug }, faqs: withKeys(i.faqs) });
  }
  for (const f of seed.features) tx.createOrReplace({ ...f, _type: "feature" });
  for (const p of seed.pages) {
    tx.createOrReplace({ ...p, _type: "page", slug: { _type: "slug", current: p.slug }, body: toBlocks(p.body) });
  }
  const res = await tx.commit();
  console.log(`Seeded ${res.results.length} documents into ${projectId}/${dataset}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
