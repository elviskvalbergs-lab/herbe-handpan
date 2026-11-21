import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Paths that belong to the app (src/lib/site.ts, APP_ORIGIN).
const APP_PATHS = [
  "/play",
  "/handpan/:path*",
  "/tongue-drum/:path*",
  "/kalimba/:path*",
  "/ocarina/:path*",
  "/flute/:path*",
  "/s/:path*",
  "/song/:path*",
  "/sw.js",
  "/manifest.json",
  "/icon.svg",
  "/icon-maskable.svg",
  "/icon-:file",
  "/og/:path*",
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Off on purpose (as on lgaa-site): an unknown slug gets a real 404 on the first request.
  partialPrefetching: false,
  turbopack: {
    // The repository root, so the site can import the app's own engine from ../js
    // (scales, chords, charts, links, the pan drawing) and ../css/pan-drawing.css
    // instead of keeping copies. See src/lib/engine.ts.
    root: path.join(__dirname, ".."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The Vercel Marketplace integration may set non-public names; mirror them into the
  // NEXT_PUBLIC_* names the Studio reads in the browser (see src/sanity/env.ts).
  env: {
    NEXT_PUBLIC_SANITY_PROJECT_ID:
      process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_API_PROJECT_ID || process.env.SANITY_PROJECT_ID || "",
    NEXT_PUBLIC_SANITY_DATASET:
      process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_API_DATASET || process.env.SANITY_DATASET || "production",
  },
  // One domain: the app lives on this domain at /play, with its deep links
  // and its own files (service worker, manifest, icons, link-preview images),
  // fetched from the app's Vercel project. The app's fonts are the same files
  // as the site's /fonts (sync-assets), so they're served from here.
  async rewrites() {
    const app = (process.env.NEXT_PUBLIC_APP_URL || "https://oakhum.vercel.app").replace(/\/$/, "");
    return APP_PATHS.map((source) => ({ source, destination: `${app}${source}` }));
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
};

// Errors and traces go to Sentry (project oakhum-site, EU region). Source maps
// are uploaded only when SENTRY_AUTH_TOKEN is set in Vercel; without it the
// build still works and stack traces are minified.
export default withSentryConfig(nextConfig, {
  org: "burti",
  project: "oakhum-site",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  silent: !process.env.CI,
});
