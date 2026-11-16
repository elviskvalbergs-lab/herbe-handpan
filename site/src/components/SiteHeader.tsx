import Link from "next/link";
import { APP_URL } from "@/lib/site";
import { btnCta, container } from "@/lib/ui";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="on-dark bg-dark text-on-dark">
      <nav aria-label="Main" className={`${container} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4`}>
        <Link href="/" className="text-on-dark hover:text-on-dark" aria-label="Oakhum home">
          <Logo className="h-9" label="" />
        </Link>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[16px]">
          <Link href="/#instruments" className="text-on-dark no-underline hover:text-on-dark hover:underline">Instruments</Link>
          <Link href="/#how" className="text-on-dark no-underline hover:text-on-dark hover:underline">How it works</Link>
          <Link href="/request" className="text-on-dark no-underline hover:text-on-dark hover:underline">Request</Link>
          <a href={APP_URL} className={`${btnCta} min-h-11 px-5 py-2 text-[16px]`}>Open the app</a>
        </div>
      </nav>
    </header>
  );
}
