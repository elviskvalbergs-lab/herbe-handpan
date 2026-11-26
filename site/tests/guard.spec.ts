import { expect, it } from "vitest";
import { clientIp, createRateLimiter, originAllowed } from "@/lib/guard";

it("lets Oakhum's own pages post, and nobody else's", () => {
  for (const o of ["https://oakhum.com", "https://www.oakhum.com", "https://oakhum.vercel.app", "https://oakhum-site-git-x-team.vercel.app", "http://localhost:3000"]) expect(originAllowed(o), o).toBe(true);
  for (const o of [null, "", "https://evil.example", "https://oakhum.com.evil.example", "https://notoakhum.vercel.app", "http://oakhum.com"]) expect(originAllowed(o), String(o)).toBe(false);
  // The page's own host always counts (a new domain needs no code change).
  expect(originAllowed("https://play.example.org", "play.example.org")).toBe(true);
  expect(originAllowed("https://evil.example", "play.example.org")).toBe(false);
});

it("reads the caller's address from the platform's headers", () => {
  expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  expect(clientIp(new Headers({ "x-vercel-forwarded-for": "198.51.100.2", "x-forwarded-for": "203.0.113.7" }))).toBe("198.51.100.2");
  expect(clientIp(new Headers())).toBe("unknown");
});

it("limits each address on its own, and opens again when the window ends", () => {
  const l = createRateLimiter(2, 1000);
  expect(l.hit("a", 0).ok).toBe(true);
  expect(l.hit("a", 10).ok).toBe(true);
  expect(l.hit("a", 20)).toEqual({ ok: false, retryAfter: 1 });
  expect(l.hit("b", 20).ok).toBe(true);
  expect(l.hit("a", 1001).ok).toBe(true);
});

it("doesn't grow without end under a flood of addresses", () => {
  const l = createRateLimiter(1, 1000);
  for (let i = 0; i < 12_000; i++) l.hit(`ip-${i}`, 0);
  expect(l.hit("ip-11999", 1).ok).toBe(false); // recent ones are still counted
});
