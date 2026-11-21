import { defineQuery } from "next-sanity";

export const SETTINGS_QUERY = defineQuery(`*[_id == "siteSettings"][0]{title, description, storyTitle, story, storyVerse, storyVerseTranslation, storyVerseSource, contactEmail}`);
export const HOME_QUERY = defineQuery(`*[_id == "homePage"][0]`);
export const MAKERS_QUERY = defineQuery(`*[_id == "makersPage"][0]`);
export const INSTRUMENTS_QUERY = defineQuery(
  `*[_type == "instrument" && defined(slug.current)] | order(order asc){..., "slug": slug.current}`,
);
export const INSTRUMENT_QUERY = defineQuery(`*[_type == "instrument" && slug.current == $slug][0]{..., "slug": slug.current}`);
export const FEATURES_QUERY = defineQuery(`*[_type == "feature"] | order(order asc){_id, title, text, status, order}`);
export const PAGE_QUERY = defineQuery(`*[_type == "page" && slug.current == $slug][0]{_id, title, "slug": slug.current, updated, body, seo}`);
export const PAGE_SLUGS_QUERY = defineQuery(`*[_type == "page" && defined(slug.current)]{"slug": slug.current}`);
// Only what the public list needs: never the email or the details.
export const PUBLIC_REQUESTS_QUERY = defineQuery(
  `*[_type == "request" && public == true && kind != "feedback" && kind != "maker" && status != "declined"] | order(votes desc)[0...12]{_id, kind, title, votes, status}`,
);
