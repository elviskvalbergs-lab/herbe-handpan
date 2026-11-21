// Vercel Routing Middleware (runs on Vercel only, not in the app bundle).
// A deep link such as /handpan/d-kurd or /handpan/d-kurd/songs/ode-to-joy gets the app's index.html with its own
// preview card (title, description, image) for link previews on websites,
// messaging apps and social media: docs/free-to-play.md, "1. Deep links".
// Anything that goes wrong falls through to the plain rewrite in vercel.json.
import { linkPreview, withLinkPreview } from './js/links.js';

export const config = { matcher: ['/handpan/:path*', '/tongue-drum/:path*', '/kalimba/:path*', '/ocarina/:path*', '/flute/:path*', '/s/:path*', '/song/:path*'] };

export default async function middleware(request) {
  try {
    const url = new URL(request.url);
    const res = await fetch(new URL('/', url), { headers: { accept: 'text/html' } });
    if (!res.ok) return;
    const html = withLinkPreview(await res.text(), linkPreview(url.pathname, url.search), url.origin, url.href);
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' },
    });
  } catch (_) {
    return; // the rewrite serves index.html as it is
  }
}
