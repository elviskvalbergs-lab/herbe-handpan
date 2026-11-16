// The only place that reads Sanity environment variables.
//
// The Sanity project is provisioned through the Vercel Marketplace, which sets
// its own variable names, so every value accepts a fallback. Nothing here
// throws when the variables are absent: type-check, tests and `next build`
// must work without a project. Code that talks to Sanity checks `hasSanity`.
//
// Each NEXT_PUBLIC_* read is a literal `process.env.X` expression so Next can
// inline it into the Studio's browser bundle (next.config.ts mirrors the
// non-public fallbacks into those names).

// The Vercel Marketplace integration sets NEXT_PUBLIC_SANITY_PROJECT_ID,
// NEXT_PUBLIC_SANITY_DATASET, SANITY_API_PROJECT_ID, SANITY_API_DATASET,
// SANITY_STUDIO_DATASET, SANITY_API_READ_TOKEN and SANITY_API_WRITE_TOKEN.
export const projectId: string =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.SANITY_API_PROJECT_ID ||
  process.env.SANITY_PROJECT_ID ||
  "";

export const dataset: string =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_API_DATASET ||
  process.env.SANITY_DATASET ||
  "production";

export const apiVersion = "2026-10-01";

/** Read token: server only. Needed when the dataset is private. */
export const readToken: string | undefined = process.env.SANITY_API_READ_TOKEN || undefined;

/** Write token: server only. Used by scripts/ and the request API routes (src/app/api/requests); never sent to a browser. */
export const writeToken: string | undefined = process.env.SANITY_API_WRITE_TOKEN || undefined;

export const hasSanity: boolean = projectId.length > 0;
