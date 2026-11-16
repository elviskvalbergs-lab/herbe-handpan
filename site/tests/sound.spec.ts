import { describe, expect, it } from "vitest";

// The demo is a client component, but Next.js also renders it on the server:
// loading the app's audio engine there must not touch the browser.
describe("sound", () => {
  it("loads without a browser", async () => {
    const sound = await import("@/lib/sound");
    expect(typeof sound.playPanChord).toBe("function");
    expect(typeof sound.playPanNote).toBe("function");
  });
});
