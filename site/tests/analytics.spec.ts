import { expect, it } from "vitest";
import { isAppPath, utmParams, withUtm } from "@/lib/analytics";

it("knows which links go into the app", () => {
  for (const p of ["/play", "/handpan/d-kurd", "/tongue-drum/d-kurd-9/chords/d-min", "/kalimba/c-major-17", "/ocarina/alto-c-12", "/flute/tin-whistle-d", "/s/abc123", "/play?utm_source=x"]) expect(isAppPath(p), p).toBe(true);
  for (const p of ["/", "/instruments/handpan", "/makers", "/request", "/playful", "/privacy", "mailto:a@b.lv", "https://example.com/play"]) expect(isAppPath(p), p).toBe(false);
});

it("reads only campaign tags from the address", () => {
  expect(utmParams("?utm_source=reddit&utm_campaign=handpan&ding=D3&x=1")).toEqual({ utm_source: "reddit", utm_campaign: "handpan" });
  expect(utmParams("")).toEqual({});
});

it("carries the visit's campaign tags into the app, keeping the link's own", () => {
  const utm = { utm_source: "reddit", utm_medium: "post" };
  expect(withUtm("/play", utm)).toBe("/play?utm_source=reddit&utm_medium=post");
  expect(withUtm("/handpan/d-kurd/chords/d-min", utm)).toBe("/handpan/d-kurd/chords/d-min?utm_source=reddit&utm_medium=post");
  expect(withUtm("/play?utm_source=card", utm)).toBe("/play?utm_source=card&utm_medium=post");
  expect(withUtm("/play", {})).toBe("/play");
});
