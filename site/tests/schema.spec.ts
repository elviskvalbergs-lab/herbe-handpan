import { expect, it } from "vitest";
import { schemaTypes } from "@/sanity/schemaTypes";

it("has the content types the site reads", () => {
  const names = schemaTypes.map((t) => t.name);
  expect(names).toEqual(expect.arrayContaining(["siteSettings", "homePage", "makersPage", "instrument", "feature", "request", "page", "body"]));
});

it("page text is a closed list: no images, embeds or raw HTML", () => {
  const body = schemaTypes.find((t) => t.name === "body") as unknown as { of: { type: string }[] };
  expect(body.of.map((m) => m.type)).toEqual(["block"]);
});

it("the home hero's words are content: title, text and the three labels", () => {
  const home = schemaTypes.find((t) => t.name === "homePage") as unknown as { fields: { name: string }[] };
  expect(home.fields.map((f) => f.name)).toEqual(expect.arrayContaining(["heroTitle", "heroText", "heroCta", "heroListen", "heroTry"]));
});

it("the makers video's words are content, not the file", () => {
  const makers = schemaTypes.find((t) => t.name === "makersPage") as unknown as { fields: { name: string }[] };
  expect(makers.fields.map((f) => f.name)).toEqual(expect.arrayContaining(["videoTitle", "videoText"]));
});

it("the footer story can carry a verse, its translation and its source", () => {
  const settings = schemaTypes.find((t) => t.name === "siteSettings") as unknown as { fields: { name: string }[] };
  expect(settings.fields.map((f) => f.name)).toEqual(expect.arrayContaining(["story", "storyVerse", "storyVerseTranslation", "storyVerseSource"]));
});

it("listening reports keep what the app heard, the recordings and where the fix is", () => {
  const r = schemaTypes.find((t) => t.name === "listenReport") as unknown as { fields: { name: string }[] };
  expect(r.fields.map((f) => f.name)).toEqual(expect.arrayContaining(["status", "comment", "email", "recordings", "heard", "jiraKey", "fixNotes", "meta", "createdAt"]));
});
