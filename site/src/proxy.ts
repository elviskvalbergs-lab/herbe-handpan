import { NextResponse } from "next/server";

// The site has no request-time logic. This file exists so Next.js uses it as
// the site's proxy instead of picking up the app's middleware.js from the
// repository root (turbopack.root is the repository, see next.config.ts).
export function proxy() {
  return NextResponse.next();
}

export const config = { matcher: ["/__oakhum-site-no-proxy"] };
