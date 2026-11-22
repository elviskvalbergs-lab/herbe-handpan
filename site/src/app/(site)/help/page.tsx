import type { Metadata } from "next";
import Link from "next/link";
import { HelpSearch } from "@/components/HelpSearch";
import { getHelpArticles, helpSearchEntries, helpSections } from "@/lib/help";
import { container, h2 } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Help",
  description: "How to set up your handpan, tongue drum, kalimba, ocarina or flute in Oakhum, find its chords and songs, save, share and fix common problems.",
  alternates: { canonical: "/help" },
};

export default function HelpIndex() {
  const articles = getHelpArticles();
  return (
    <div className={`${container} pt-14 pb-24`}>
      <h1 className="m-0 mb-3 text-[clamp(36px,5vw,52px)] font-semibold leading-[1.05] tracking-[-0.02em]">Help</h1>
      <p className="m-0 mb-8 max-w-measure text-[19px] text-body">
        Short answers, in plain words. New here? Start with <Link href="/help/set-up-your-instrument">Set up your instrument</Link>.
      </p>
      <HelpSearch entries={helpSearchEntries()} />
      {helpSections.map((s) => {
        const inSection = articles.filter((a) => a.section === s.id);
        if (!inSection.length) return null;
        return (
          <section key={s.id} id={s.id} className="mt-14 scroll-mt-6">
            <h2 className={`${h2} m-0 mb-5 text-[28px]`}>{s.title}</h2>
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {inSection.map((a) => (
                <li key={a.id}>
                  <Link href={`/help/${a.id}`} className="block h-full rounded-card border border-border bg-surface p-5 no-underline hover:border-border-strong">
                    <span className="block text-[19px] font-semibold leading-snug text-text">{a.title}</span>
                    <span className="mt-2 block text-[16px] text-body">{a.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="mt-16 mb-0 max-w-measure text-body">
        Did not find it? <Link href="/help/contact">Get help or tell us something</Link>.
      </p>
    </div>
  );
}
