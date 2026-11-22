// Guards for the public API routes (requests, votes, listening reports): who
// may post (by Origin) and how often (by IP). Pure, so it is unit-tested
// (tests/guard.spec.ts).
//
// The rate limit is a counter in the function's memory. Vercel keeps a
// function instance warm and reuses it for many requests, so this stops one
// address hammering a route, with no extra service and no cost. It is not a
// shared, exact limit: a burst spread over several instances gets a little
// more than the limit. A Vercel Firewall rate-limit rule on /api/* is the
// second layer (site/README.md, "Abuse limits").

/** Where a browser may post from: the site's own domain, the app's and the
 *  site's Vercel addresses, and a local build. */
export function originAllowed(origin: string | null, host?: string | null): boolean {
  if (!origin) return false;
  if (host && (origin === `https://${host}` || origin === `http://${host}`)) return true;
  return /^https:\/\/(www\.)?oakhum\.com$/.test(origin)
    || /^https:\/\/(oakhum|herbe-handpan)(-[a-z0-9-]+)?\.vercel\.app$/.test(origin)
    || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

/** The caller's address. On Vercel these headers are set by the platform and can't be forged by the caller. */
export function clientIp(headers: Headers): string {
  const first = (v: string | null) => v?.split(",")[0]?.trim() || "";
  return first(headers.get("x-vercel-forwarded-for")) || first(headers.get("x-real-ip")) || first(headers.get("x-forwarded-for")) || "unknown";
}

type Window = { count: number; resetAt: number };
const MAX_KEYS = 5000;

/** A fixed-window counter: `limit` hits per `windowMs` for each key. */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, Window>();
  return {
    /** Counts one hit. `ok: false` once the key is over its limit; `retryAfter` is in seconds. */
    hit(key: string, now: number = Date.now()): { ok: boolean; retryAfter: number } {
      let w = hits.get(key);
      if (!w || w.resetAt <= now) {
        if (hits.size >= MAX_KEYS) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
        if (hits.size >= MAX_KEYS) hits.clear(); // a flood of new addresses: start over rather than grow
        w = { count: 0, resetAt: now + windowMs };
        hits.set(key, w);
      }
      w.count++;
      return { ok: w.count <= limit, retryAfter: Math.max(1, Math.ceil((w.resetAt - now) / 1000)) };
    },
    clear() { hits.clear(); },
  };
}

export const TOO_MANY = "That's a lot at once. Please wait a few minutes and try again.";
export const NOT_FROM_HERE = "This can only be sent from Oakhum.";
