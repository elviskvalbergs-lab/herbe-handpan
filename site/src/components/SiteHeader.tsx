"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HOME_B_PATH } from "@/lib/experiment";
import { APP_URL } from "@/lib/site";
import { btnCta, btnInk, container } from "@/lib/ui";
import { Logo } from "./Logo";

// On the home page the header is a cream band above the hero picture, ink on
// cream (docs/design/hero-a-reference.webp). Elsewhere it is the ink band.
export function SiteHeader() {
  // "/home-b" is the home page too: version b of the home page experiment, served at "/" (src/lib/experiment.ts).
  const path = usePathname();
  const home = path === "/" || path === HOME_B_PATH;
  const link = home ? "text-text no-underline hover:text-text hover:underline" : "text-on-dark no-underline hover:text-on-dark hover:underline";
  return (
    <header className={home ? "relative z-10 bg-bg text-text" : "on-dark bg-dark text-on-dark"}>
      <nav aria-label="Main" className={`${container} flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 py-3 md:flex-nowrap md:py-4 ${home ? "md:py-6" : ""}`}>
        <Link href="/" className={home ? "text-text hover:text-text" : "text-on-dark hover:text-on-dark"} aria-label="Oakhum home">
          <Logo className="h-8 md:h-9" label="" />
        </Link>
        {/* Phones: the logo and the app button on one row, the links on one row
            below. From 768px everything sits in one row, the button last. */}
        <a href={APP_URL} className={`${home ? btnInk : btnCta} min-h-10 px-4 py-1.5 text-[15px] md:order-last md:min-h-11 md:px-5 md:py-2 md:text-[16px]`}>Open the app</a>
        <div className="flex w-full items-center justify-between gap-x-6 text-[15px] font-semibold sm:justify-start md:ml-auto md:w-auto md:text-[16px]">
          <Link href="/#instruments" className={link}>Instruments</Link>
          <Link href="/#how" className={link}>How it works</Link>
          <Link href="/makers" className={link}>For makers</Link>
          <Link href="/help" className={link}>Help</Link>
          <Link href="/request" className={link}>Request</Link>
        </div>
      </nav>
    </header>
  );
}
