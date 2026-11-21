// Vercel Routing Middleware (runs on Vercel only, not in the app bundle).
// A deep link such as /handpan/d-kurd gets the app's index.html with its own
// preview card (title, description, image) for link previews on websites,
// messaging apps and social media: docs/free-to-play.md, "1. Deep links".
// Anything that goes wrong falls through to the plain rewrite in vercel.json.
import { linkPreview, parseLink, withLinkPreview } from './js/links.js';

export const config = { matcher: ['/handpan/:path*', '/tongue-drum/:path*', '/kalimba/:path*', '/ocarina/:path*', '/flute/:path*', '/s/:path*'] };

// Search engines should keep one page per tuning: the website's
// (oakhum.com/instruments/handpan/d-kurd), which has the words; a deep link
// is the app, which has none until it runs. So a plain tuning link names the
// website's page as its canonical address, and every other deep link (a tab,
// a chord, custom notes, a shared instrument) asks not to be indexed. Link
// previews are not affected.
const SITE = 'https://oakhum.com';
const SITE_INSTRUMENT = { handpan: 'handpan', 'tongue-drum': 'steel-tongue-drum', kalimba: 'kalimba', ocarina: 'ocarina', flute: 'flute' };
export function linkSearchHeaders(pathname, search = '') {
  const link = parseLink(pathname, search);
  const page = link && (link.kind === 'scale' || link.kind === 'chart') && !link.tab && !link.chord ? SITE_INSTRUMENT[link.family] : null;
  return page
    ? { link: `<${SITE}/instruments/${page}/${link.path.split('/')[2]}>; rel="canonical"` }
    : { 'x-robots-tag': 'noindex, follow' };
}

export default async function middleware(request) {
  try {
    const url = new URL(request.url);
    const res = await fetch(new URL('/', url), { headers: { accept: 'text/html' } });
    if (!res.ok) return;
    const html = withLinkPreview(await res.text(), linkPreview(url.pathname, url.search), url.origin, url.href);
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate', ...linkSearchHeaders(url.pathname, url.search) },
    });
  } catch (_) {
    return; // the rewrite serves index.html as it is
  }
}
