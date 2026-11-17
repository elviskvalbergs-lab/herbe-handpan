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

it("takes feedback: the text is required and the title is its first line", () => {
  expect(validateRequest({ kind: "feedback", details: "" })).toMatchObject({ ok: false, error: expect.stringMatching(/what happened/) });
  const r = validateRequest({ kind: "feedback", details: " Chords didn't light up\non my phone ", notes: "D Kurd" });
  expect(r).toEqual({ ok: true, value: { kind: "feedback", title: "Chords didn't light up", notes: "D Kurd", details: "Chords didn't light up\non my phone", email: undefined } });
  const long = validateRequest({ kind: "feedback", details: "x".repeat(300) });
  expect(long.ok && long.value.title.length).toBe(80);
});
