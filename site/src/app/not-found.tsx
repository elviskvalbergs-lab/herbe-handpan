import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Problem } from "@/components/Problem";

export const metadata: Metadata = { title: "Page not found | Oakhum", robots: { index: false } };

// Any other address that doesn't exist. It is outside the site's own layout,
// so it brings its own way home.
export default function NotFound() {
  return (
    <>
      <header className="on-dark bg-dark text-on-dark">
        <div className="mx-auto w-full max-w-page px-4 py-4 sm:px-8">
          <Link href="/" className="text-on-dark hover:text-on-dark" aria-label="Oakhum home"><Logo className="h-8 md:h-9" label="" /></Link>
        </div>
      </header>
      <main id="content">
        <Problem title="This page isn’t here" text="The link may be old, or the address has a typo. Your instrument is most likely one step away." />
      </main>
    </>
  );
}
