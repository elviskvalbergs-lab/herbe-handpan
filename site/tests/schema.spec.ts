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
