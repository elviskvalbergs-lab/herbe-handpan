import { expect, it } from "vitest";
import { validateRequest } from "@/lib/requests";

it("accepts a request and trims it", () => {
  const r = validateRequest({ kind: "instrument", title: "  17-key kalimba ", notes: "C4 D4", email: "a@b.lv" });
  expect(r).toEqual({ ok: true, value: { kind: "instrument", title: "17-key kalimba", notes: "C4 D4", details: undefined, email: "a@b.lv" } });
});

it("explains what's missing or wrong", () => {
  expect(validateRequest({ kind: "instrument", title: "" })).toMatchObject({ ok: false, error: expect.stringMatching(/which instrument/) });
  expect(validateRequest({ kind: "feature", title: "x", email: "nope" })).toMatchObject({ ok: false, error: expect.stringMatching(/email/) });
  expect(validateRequest({ kind: "other", title: "x" })).toMatchObject({ ok: false });
  expect(validateRequest({ kind: "feature", title: "x".repeat(121) })).toMatchObject({ ok: false, error: expect.stringMatching(/shorten/) });
});

it("drops what bots fill in", () => {
  expect(validateRequest({ kind: "feature", title: "x", website: "http://spam" })).toMatchObject({ ok: false });
});
