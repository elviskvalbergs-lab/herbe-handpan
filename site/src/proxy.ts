import { NextResponse, type NextRequest } from "next/server";
import { HOME_B_PATH, pickHomeVariant } from "@/lib/experiment";

// The site's only request-time logic: the home page experiment
// (src/lib/experiment.ts). A visit to "/" stays on the page with the demo
// ("a") or is served the page without it ("b") at the same address. Its other
// job is to exist: without it Next.js would pick up the app's middleware.js
// from the repository root (turbopack.root is the repository, next.config.ts).
export function proxy(request: NextRequest) {
  // Version b's own address is internal: asked for directly, it is the home page.
  if (request.nextUrl.pathname === HOME_B_PATH) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    return NextResponse.redirect(home, 308);
  }
  const variant = pickHomeVariant(request.nextUrl.search, process.env.HOME_EXPERIMENT);
  if (variant === "a") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = HOME_B_PATH;
  return NextResponse.rewrite(url);
}

export const config = { matcher: ["/", "/home-b"] };
