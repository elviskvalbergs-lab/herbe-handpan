import { describe, expect, it } from "vitest";
import { FEATURES } from "@engine/features.js";
import { getHelpArticle, getHelpArticles, helpExport, helpJsonLd, helpSearchEntries, llmsFullTxt, llmsTxt, passagesOf } from "@/lib/help";

// The site's side of the help centre (../docs/help-centre.md). That the
// articles match the app is tested in ../tests/help.test.mjs; here: the
// pages and exports are built from them and leave nothing out.
describe("help centre", () => {
  const articles = getHelpArticles();

  it("reads every article from ../help/en", () => {
    expect(articles.length).toBeGreaterThanOrEqual(25);
    expect(articles[0].id).toBe("set-up-your-instrument");
    expect(getHelpArticle("no-such-article")).toBeNull();
  });

  it("exports every article, feature and passage as JSON", () => {
    const data = helpExport();
    expect(data.articles.map((a) => a.id)).toEqual(articles.map((a) => a.id));
    expect(data.features.map((f) => f.id)).toEqual((FEATURES as { id: string }[]).map((f) => f.id));
    const ids = data.articles.flatMap((a) => a.passages.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of data.articles) {
      expect(a.url).toMatch(/\/help\/[a-z0-9-]+$/);
      expect(a.markdown).not.toMatch(/\{\{|\}\}/);
      for (const p of a.passages) expect(p.url.startsWith(a.url)).toBe(true);
    }
    for (const f of data.features) expect(data.articles.some((a) => a.id === f.article)).toBe(true);
    expect(data.rules.join(" ")).toMatch(/fingering/);
    // The export is the same on every build of the same content.
    expect(JSON.stringify(helpExport())).toBe(JSON.stringify(data));
  });

  it("lists every article in llms.txt and prints every one in llms-full.txt", () => {
    const short = llmsTxt();
    const full = llmsFullTxt();
    expect(short.startsWith("# Oakhum\n")).toBe(true);
    for (const a of articles) {
      expect(short).toContain(`/help/${a.id})`);
      expect(full).toContain(`# ${a.title}\n`);
      for (const anchor of a.anchors) expect(full).toContain(`{#${anchor}}`);
    }
  });

  it("gives each article HowTo or FAQPage data that matches the page", () => {
    for (const a of articles) {
      const [crumbs, main] = helpJsonLd(a);
      expect(crumbs["@type"]).toBe("BreadcrumbList");
      if (main["@type"] === "HowTo") {
        expect(a.type).toBe("howto");
        expect((main.step as unknown[]).length).toBeGreaterThanOrEqual(2);
      } else {
        expect(main["@type"]).toBe("FAQPage");
        const questions = main.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
        expect(questions.length).toBe(passagesOf(a).filter((p) => p.id).length);
        for (const q of questions) expect(q.acceptedAnswer.text.length).toBeGreaterThan(10);
      }
    }
  });

  it("makes every answer searchable under a stable anchor", () => {
    const entries = helpSearchEntries();
    for (const a of articles) for (const anchor of a.anchors) expect(entries.some((e) => e.href === `/help/${a.id}#${anchor}`)).toBe(true);
  });
});
