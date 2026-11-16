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
  },
});
