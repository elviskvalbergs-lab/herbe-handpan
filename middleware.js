// Vercel Routing Middleware (runs on Vercel only, not in the app bundle).
// A deep link such as /handpan/d-kurd gets the app's index.html with its own
// preview card (title, description, image) for link previews on websites,
// messaging apps and social media: docs/free-to-play.md, "1. Deep links".
// Anything that goes wrong falls through to the plain rewrite in vercel.json.
import { linkPreview, withLinkPreview, parseLink } from './js/links.js';
import { makerLinkPreview } from './js/makers.js';
import { supabasePublic } from './js/auth.js';

export const config = { matcher: ['/handpan/:path*', '/tongue-drum/:path*', '/kalimba/:path*', '/ocarina/:path*', '/flute/:path*', '/s/:path*'] };

export default async function middleware(request) {
  try {
    const url = new URL(request.url);
    const res = await fetch(new URL('/', url), { headers: { accept: 'text/html' } });
    if (!res.ok) return;
    let preview = linkPreview(url.pathname, url.search);
    const link = parseLink(url.pathname, url.search);
    if (link?.kind === 'shared') preview = makerLinkPreview(await sharedCard(link.code), preview);
    const html = withLinkPreview(await res.text(), preview, url.origin, url.href);
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' },
    });
  } catch (_) {
    return; // the rewrite serves index.html as it is
  }
}

// The name of a shared instrument and of the maker who shared it
// (shared_instrument_card, supabase/migrations/20261121_makers.sql), for
// "D Kurd 9 by Ilze Pans" on the card. null when it can't be read in time:
// the card then says "Shared instrument", as before.
async function sharedCard(code) {
  try {
    const pub = supabasePublic();
    const base = process.env.HP_SUPABASE_URL || pub.url; // a preview build's test project (supabase/README.md)
    const key = process.env.HP_SUPABASE_KEY || pub.key;
    const res = await fetch(`${base}/rest/v1/rpc/shared_instrument_card`, {
      method: 'POST',
      headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_code: String(code).slice(0, 12) }),
      signal: AbortSignal.timeout(1500),
    });
    return res.ok ? await res.json() : null;
  } catch (_) {
    return null;
  }
}
