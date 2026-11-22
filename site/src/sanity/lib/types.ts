export type Point = { title: string; text: string };
export type QA = { question: string; answer: string };

export type SiteSettings = {
  title: string;
  description: string;
  storyTitle?: string;
  story?: string;
  storyVerse?: string;
  storyVerseTranslation?: string;
  storyVerseSource?: string;
  contactEmail: string;
};

export type HomePage = {
  heroTitle: string;
  heroText: string;
  heroNote?: string;
  heroCta?: string;
  heroListen?: string;
  heroTry?: string;
  demoCaption?: string;
  howTitle?: string;
  steps?: Point[];
  instrumentsText?: string;
  whyTitle?: string;
  why?: Point[];
  accountTitle?: string;
  accountText?: string;
  guestTitle?: string;
  guestPoints?: string[];
  guestNote?: string;
  memberTitle?: string;
  memberPoints?: Point[];
  memberNote?: string;
  featuresTitle?: string;
  requestTitle?: string;
  requestText?: string;
  faqTitle?: string;
  faqs?: QA[];
};

export type SongsPage = {
  heroTitle: string;
  heroText: string;
  fitTitle?: string;
  fitText?: string;
  almostText?: string;
  demoText?: string;
  appTitle?: string;
  appText?: string;
  appCta?: string;
  seo?: { title?: string; description?: string };
};

export type MakersPage = {
  heroTitle: string;
  heroText: string;
  heroCta?: string;
  heroSecondary?: string;
  videoTitle?: string;
  videoText?: string;
  whyTitle?: string;
  why?: Point[];
  howTitle?: string;
  steps?: Point[];
  howNote?: string;
  demoTitle?: string;
  demoText?: string;
  offerTitle?: string;
  offer?: Point[];
  ctaTitle?: string;
  ctaText?: string;
  emailSubject?: string;
  faqTitle?: string;
  faqs?: QA[];
  seo?: { title?: string; description?: string };
};

export type InstrumentDoc = {
  _id: string;
  name: string;
  slug: string;
  family: "handpan" | "tongue-drum" | "kalimba" | "ocarina" | "flute" | "recorder" | "none";
  status: "available" | "soon";
  order: number;
  tuningsLine?: string;
  title: string;
  intro: string;
  featuredTunings?: string[];
  playAlongTitle?: string;
  playAlongText?: string;
  ctaTitle?: string;
  ctaText?: string;
  faqs?: QA[];
  seo?: { title?: string; description?: string };
};

export type FeatureDoc = { _id: string; title: string; text: string; status: "ready" | "next"; order: number };

/** A Portable Text block, as the closed `body` list allows. */
export type Block = {
  _type: "block";
  _key: string;
  style: "normal" | "h2" | "h3";
  listItem?: "bullet" | "number";
  level?: number;
  children: { _type: "span"; _key: string; text: string; marks?: string[] }[];
  markDefs?: { _key: string; _type: "link"; href: string }[];
};

/** Seed pages are written as simple paragraphs; `toBlocks` makes Portable Text. */
export type SimpleBlock = { style: "normal" | "h2" | "h3"; text: string };

export type PageDoc = {
  _id: string;
  title: string;
  slug: string;
  updated?: string;
  body: Block[] | SimpleBlock[];
  seo?: { title?: string; description?: string };
};

export type PublicRequest = { _id: string; kind: "instrument" | "feature"; title: string; votes: number; status?: string };
