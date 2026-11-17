// Where the site and the app live. Both are plain environment variables so a
// domain change (oakhum.com, app.oakhum.com) is a setting, not a code change.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://oakhum-site.vercel.app").replace(/\/$/, "");
/**
 * One domain (docs/free-to-play.md): the app is served on the site's own
 * domain, at /play, and its deep links (/handpan/…, /ocarina/…, /flute/…,
 * /s/…) at the root. next.config.ts fetches them from the app's own Vercel
 * project, APP_ORIGIN (NEXT_PUBLIC_APP_URL, e.g. https://oakhum.vercel.app).
 */
export const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "https://oakhum.vercel.app").replace(/\/$/, "");
/** Where "Open the app" goes: the app's home on this domain. */
export const APP_URL = "/play";
export const SITE_NAME = "Oakhum";
export const CONTACT_EMAIL = "oakhummusic@gmail.com";
