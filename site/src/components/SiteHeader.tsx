"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_URL } from "@/lib/site";
import { btnCta, btnInk, container } from "@/lib/ui";
import { Logo } from "./Logo";

// On the home page the header sits over the hero's sky (ink on cream, from
// 768px; on phones it stays above the picture). Elsewhere it is the ink band.
export function SiteHeader() {
  const home = usePathname() === "/";
  const link = home ? "text-text no-underline hover:text-text hover:underline" : "text-on-dark no-underline hover:text-on-dark hover:underline";
  return (
    <header className={home ? "relative z-10 text-text md:absolute md:inset-x-0 md:top-0" : "on-dark bg-dark text-on-dark"}>
      <nav aria-label="Main" className={`${container} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4 ${home ? "md:py-6" : ""}`}>
        <Link href="/" className={home ? "text-text hover:text-text" : "text-on-dark hover:text-on-dark"} aria-label="Oakhum home">
          <Logo className="h-9" label="" />
        </Link>
        <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 text-[16px] font-semibold ${home ? "nav-on-picture" : ""}`}>
          <Link href="/#instruments" className={link}>Instruments</Link>
          <Link href="/#how" className={link}>How it works</Link>
          <Link href="/request" className={link}>Request</Link>
          <a href={APP_URL} className={`${home ? btnInk : btnCta} min-h-11 px-5 py-2 text-[16px]`}>Open the app</a>
        </div>
      </nav>
    </header>
  );
}
