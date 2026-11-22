// The help centre's content: the Markdown articles in ../help/<lang>/, read
// with the app's own parser (../js/helpdoc.js) and the feature registry
// (../js/features.js), so the website, the app's help sheet and the exports
// for AI tools always say the same thing. Design: ../docs/help-centre.md.
//
// Files are read with the synchronous fs calls on purpose: every help page
// and export is prerendered at build time, when the repository is on disk.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { FEATURES } from "@engine/features.js";
import { HELP_SECTIONS, helpMarkdown, helpParse, helpPassages, helpSort } from "@engine/helpdoc.js";
import { SITE_URL } from "@/lib/site";

export type HelpInline =
  | { t: "text" | "bold"; v: string }
  | { t: "label"; v: string; id: string }
  | { t: "link"; v: string; href: string };

export type HelpBlock =
  | { t: "p" | "h3" | "note"; parts: HelpInline[] }
  | { t: "h2"; id: string; parts: HelpInline[] }
  | { t: "list"; ordered: boolean; items: HelpInline[][] }
  | { t: "img"; alt: string; name: string };

export type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  section: string;
  type: "howto" | "faq" | "reference";
  audience: "players" | "makers";
  instruments: string[];
  features: string[];
  /** A deep link into the app that shows what the article is about. */
  app: string | null;
  /** The day it was last checked against the app. */
  verified: string;
  order: number;
  blocks: HelpBlock[];
  anchors: string[];
};

export type HelpPassage = { id: string; heading: string; text: string; blocks: HelpBlock[] };

export const HELP_LANGUAGES = ["en"] as const;
export type HelpLanguage = (typeof HELP_LANGUAGES)[number];
export const helpSections = HELP_SECTIONS as { id: string; title: string }[];

const cache = new Map<string, HelpArticle[]>();

/** Every article, in the order the index shows them. Empty if the files are not there. */
export function getHelpArticles(lang: HelpLanguage = "en"): HelpArticle[] {
  const hit = cache.get(lang);
  if (hit) return hit;
  // `next build` and vitest run in site/; the articles are one level up. The
  // path is spelled out so the build traces only this folder.
  const dir = path.join(process.cwd(), "..", "help", lang);
  const list = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => helpParse(readFileSync(path.join(process.cwd(), "..", "help", lang, f), "utf8"), `help/${lang}/${f}`) as unknown as HelpArticle)
    : [];
  const sorted = helpSort(list) as HelpArticle[];
  cache.set(lang, sorted);
  return sorted;
}

export function getHelpArticle(id: string, lang: HelpLanguage = "en"): HelpArticle | null {
  return getHelpArticles(lang).find((a) => a.id === id) ?? null;
}

export function passagesOf(article: HelpArticle): HelpPassage[] {
  return helpPassages(article) as HelpPassage[];
}

export const helpUrl = (id: string, anchor = "") => `${SITE_URL}/help/${id}${anchor ? `#${anchor}` : ""}`;

/** What the search box on /help looks through: one entry per heading. */
export type HelpSearchEntry = { href: string; title: string; heading: string; text: string };
export function helpSearchEntries(lang: HelpLanguage = "en"): HelpSearchEntry[] {
  return getHelpArticles(lang).flatMap((a) =>
    passagesOf(a).map((p) => ({
      href: `/help/${a.id}${p.id ? `#${p.id}` : ""}`,
      title: a.title,
      heading: p.id ? p.heading : a.summary,
      text: p.text,
    })),
  );
}

// What an assistant must look up and never answer from memory (docs/help-centre.md, "An AI assistant").
const ASSISTANT_RULES = [
  "Answer only from these articles and cite the passage id (for example chords#play) with its url.",
  "Never state the notes of a tuning, a fingering, a chord's notes on an instrument or which songs an instrument can play from memory: link to the instrument's page or the app deep link instead. That data lives in the app's catalogue, not in these articles.",
  "Use feature names exactly as in `features`; they are the names shown in the app.",
  "If no passage answers the question, say so and point to /help/contact.",
];

/** /help/index.json: everything, structured, for a chatbot or a retrieval pipeline. */
export function helpExport(lang: HelpLanguage = "en") {
  const articles = getHelpArticles(lang);
  return {
    version: 1,
    language: lang,
    site: SITE_URL,
    updated: articles.map((a) => a.verified).sort().at(-1) ?? null,
    rules: ASSISTANT_RULES,
    sections: helpSections,
    features: (FEATURES as { id: string; name: string; where: string; instruments: string[]; account: boolean; help: string }[]).map((f) => ({
      id: f.id,
      name: f.name,
      where: f.where,
      instruments: f.instruments,
      needsAccount: f.account,
      article: f.help,
      url: helpUrl(f.help),
    })),
    articles: articles.map((a) => ({
      id: a.id,
      url: helpUrl(a.id),
      title: a.title,
      summary: a.summary,
      section: a.section,
      type: a.type,
      audience: a.audience,
      instruments: a.instruments,
      features: a.features,
      app: a.app ? `${SITE_URL}${a.app}` : null,
      verified: a.verified,
      markdown: helpMarkdown(a) as string,
      passages: passagesOf(a).map((p) => ({
        id: p.id ? `${a.id}#${p.id}` : a.id,
        url: helpUrl(a.id, p.id),
        heading: p.heading,
        text: p.text,
      })),
    })),
  };
}

/** /llms.txt: the short map of the site for language models (llmstxt.org). */
export function llmsTxt(lang: HelpLanguage = "en"): string {
  const articles = getHelpArticles(lang);
  const lines = [
    "# Oakhum",
    "",
    "> Oakhum is a free web app that shows the chords and songs the exact handpan, tongue drum, kalimba, ocarina or flute you own can play. It runs in the browser, can be added to the home screen, and needs no account to play.",
    "",
    ...ASSISTANT_RULES.map((r) => `- ${r}`),
    "",
    `- [All help articles as one file](${SITE_URL}/llms-full.txt)`,
    `- [All help articles as JSON, one passage per heading](${SITE_URL}/help/index.json)`,
    "",
  ];
  for (const s of helpSections) {
    const inSection = articles.filter((a) => a.section === s.id);
    if (!inSection.length) continue;
    lines.push(`## ${s.title}`, "", ...inSection.map((a) => `- [${a.title}](${helpUrl(a.id)}): ${a.summary}`), "");
  }
  lines.push("## Optional", "", `- [Instruments and tunings](${SITE_URL}/#instruments)`, `- [For instrument makers](${SITE_URL}/makers)`, `- [Privacy](${SITE_URL}/privacy)`, "");
  return lines.join("\n");
}

/** /llms-full.txt: every article in full, as Markdown. */
export function llmsFullTxt(lang: HelpLanguage = "en"): string {
  const out = ["# Oakhum help", "", ...ASSISTANT_RULES.map((r) => `- ${r}`), ""];
  for (const a of getHelpArticles(lang)) {
    out.push(
      "---",
      "",
      `# ${a.title}`,
      "",
      `Source: ${helpUrl(a.id)}`,
      `Article id: ${a.id} · For: ${a.audience} · Instruments: ${a.instruments.join(", ")} · Checked against the app: ${a.verified}`,
      "",
      a.summary,
      "",
      // Headings carry their anchor, so a quote can be cited as article#anchor.
      (helpMarkdown(a) as string).replace(/^## (.+)$/gm, (line, h: string) => {
        const p = passagesOf(a).find((x) => x.id && x.heading === h.replace(/\*\*/g, ""));
        return p ? `## ${h} {#${p.id}}` : line;
      }),
      "",
    );
  }
  return out.join("\n");
}

/** schema.org data for an article: HowTo for step-by-step ones, FAQPage for the rest. */
export function helpJsonLd(article: HelpArticle): Record<string, unknown>[] {
  const url = helpUrl(article.id);
  const passages = passagesOf(article).filter((p) => p.id && p.text.trim());
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Help", item: `${SITE_URL}/help` },
      { "@type": "ListItem", position: 2, name: article.title, item: url },
    ],
  };
  const steps = article.blocks.find((b) => b.t === "list" && b.ordered) as Extract<HelpBlock, { t: "list" }> | undefined;
  if (article.type === "howto" && steps) {
    return [
      crumbs,
      {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: article.title,
        description: article.summary,
        url,
        dateModified: article.verified,
        step: steps.items.map((it, i) => ({ "@type": "HowToStep", position: i + 1, text: it.map((p) => p.v).join("") })),
      },
    ];
  }
  return [
    crumbs,
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      name: article.title,
      url,
      dateModified: article.verified,
      mainEntity: passages.map((p) => ({
        "@type": "Question",
        name: p.heading,
        url: helpUrl(article.id, p.id),
        acceptedAnswer: { "@type": "Answer", text: p.text },
      })),
    },
  ];
}
