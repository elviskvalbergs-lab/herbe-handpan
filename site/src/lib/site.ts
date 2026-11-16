// Where the site and the app live. Both are plain environment variables so a
// domain change (oakhum.com, app.oakhum.com) is a setting, not a code change.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://oakhum-site.vercel.app").replace(/\/$/, "");
/** The Oakhum app. For now the app answers on oakhum.vercel.app. */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://oakhum.vercel.app").replace(/\/$/, "");
export const SITE_NAME = "Oakhum";
export const CONTACT_EMAIL = "oakhummusic@gmail.com";
