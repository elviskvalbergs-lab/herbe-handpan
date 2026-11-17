import { draftMode } from "next/headers";
import { defineLive } from "next-sanity/live";
import { hasSanity, readToken } from "../env";
import { client } from "./client";

// `strict` is the Cache Components form of defineLive: `perspective` and `stega`
// are passed explicitly to every fetch and `includeDrafts` to <SanityLive />,
// because `draftMode()` and `cookies()` must not be read implicitly inside a
// `'use cache'` boundary.
//
// The same read token serves both roles. `serverToken` lets the server fetch
// drafts. `browserToken` is handed to the browser only when <SanityLive> is
// rendered with includeDrafts, i.e. only in draft mode, which only the Studio
// can switch on (see app/api/draft-mode/enable). It must stay a Viewer token.
export const { sanityFetch, SanityLive } = defineLive({
  client,
  serverToken: readToken ?? false,
  browserToken: readToken ?? false,
  strict: true,
});

/**
 * The app's one `'use cache'` boundary around Sanity reads. `sanityFetch` tags
 * the entry with the Live Content API sync tags, so a published edit expires
 * exactly the pages that used it. Returns null when no project is configured.
 *
 * Draft mode is readable inside a cache scope, and while it is on Next re-runs
 * every cached function on each request and stores nothing. So the public site
 * stays cached and published-only, and an editor in the Presentation tool gets
 * the drafts perspective with stega (click-to-edit) encoding, uncached.
 */
export function fetchData<T>(query: string, params: Record<string, string | number | boolean> = {}): Promise<T | null> {
  return fetchCached<T>(query, params, DEPLOYMENT);
}

// Vercel keeps `'use cache'` entries from one deployment to the next. The
// deployment id is part of the cache key, so each deployment reads Sanity
// afresh: a content fix written during its build (scripts/content-fixes.ts)
// shows straight away instead of an older deployment's cached copy.
const DEPLOYMENT = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local";

async function fetchCached<T>(
  query: string,
  params: Record<string, string | number | boolean>,
  // Only part of the cache key (see DEPLOYMENT).
  deployment: string,
): Promise<T | null> {
  "use cache";
  void deployment;
  if (!hasSanity) return null;
  const { isEnabled } = await draftMode();
  const { data } = await sanityFetch({
    query,
    params,
    perspective: isEnabled ? "drafts" : "published",
    stega: isEnabled,
  });
  return data as T;
}
