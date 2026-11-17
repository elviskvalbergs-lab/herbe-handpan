import { expect, it } from "vitest";
import { schemaTypes } from "@/sanity/schemaTypes";

it("has the content types the site reads", () => {
  const names = schemaTypes.map((t) => t.name);
  expect(names).toEqual(expect.arrayContaining(["siteSettings", "homePage", "instrument", "feature", "request", "page", "body"]));
});

it("page text is a closed list: no images, embeds or raw HTML", () => {
  const body = schemaTypes.find((t) => t.name === "body") as unknown as { of: { type: string }[] };
  expect(body.of.map((m) => m.type)).toEqual(["block"]);
});

it("the home hero's words are content: title, text and the three labels", () => {
  const home = schemaTypes.find((t) => t.name === "homePage") as unknown as { fields: { name: string }[] };
  expect(home.fields.map((f) => f.name)).toEqual(expect.arrayContaining(["heroTitle", "heroText", "heroCta", "heroListen", "heroTry"]));
});

it("the footer story can carry a verse, its translation and its source", () => {
  const settings = schemaTypes.find((t) => t.name === "siteSettings") as unknown as { fields: { name: string }[] };
  expect(settings.fields.map((f) => f.name)).toEqual(expect.arrayContaining(["story", "storyVerse", "storyVerseTranslation", "storyVerseSource"]));
});
