import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@engine": fileURLToPath(new URL("../js", import.meta.url)),
    },
  },
  test: {
    // *.spec.ts, not *.test.ts: the root `node --test` (the app's tests) would pick those up too.
    include: ["tests/**/*.spec.{ts,tsx}"],
    environment: "node",
    // Some tests walk every tuning of every instrument through the app's engine (tests/seo.spec.ts:
    // each page's words and songs): over 5 s on a CI runner once the songs and the recorder came in.
    testTimeout: 30000,
  },
});
