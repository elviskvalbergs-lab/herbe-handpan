import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { pickHomeVariant } from "@/lib/experiment";
import { config, proxy } from "@/proxy";

it("splits visits 50/50 unless told otherwise", () => {
  expect(pickHomeVariant("", undefined, () => 0.2)).toBe("a");
  expect(pickHomeVariant("", undefined, () => 0.7)).toBe("b");
  let b = 0;
  for (let i = 0; i < 10_000; i++) if (pickHomeVariant("", undefined) === "b") b++;
  expect(b).toBeGreaterThan(4_500);
  expect(b).toBeLessThan(5_500);
});

it("can be switched off or fixed on one version, and ?home= shows one for checking", () => {
  expect(pickHomeVariant("", "off", () => 0.9)).toBe("a");
  expect(pickHomeVariant("", "b", () => 0.1)).toBe("b");
  expect(pickHomeVariant("?home=b", "off")).toBe("b");
  expect(pickHomeVariant("?home=a&utm_source=x", undefined, () => 0.9)).toBe("a");
  expect(pickHomeVariant("?home=zzz", "off")).toBe("a");
});

it("the proxy serves version b at the same address, and only on the home page", () => {
  expect(config.matcher).toEqual(["/", "/home-b"]);
  const b = proxy(new NextRequest("https://oakhum.com/?home=b&utm_source=reddit"));
  expect(b.headers.get("x-middleware-rewrite")).toBe("https://oakhum.com/home-b?home=b&utm_source=reddit");
  const a = proxy(new NextRequest("https://oakhum.com/?home=a"));
  expect(a.headers.get("x-middleware-rewrite")).toBeNull();
  const direct = proxy(new NextRequest("https://oakhum.com/home-b?x=1"));
  expect([direct.status, direct.headers.get("location")]).toEqual([308, "https://oakhum.com/?x=1"]);
});
