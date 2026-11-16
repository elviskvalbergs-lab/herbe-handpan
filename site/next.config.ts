import path from "node:path";
import type { NextConfig } from "next";

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
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
};

export default nextConfig;
