"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type HelpNavSection = { id: string; title: string; articles: { id: string; title: string }[] };

function NavList({ sections, current }: { sections: HelpNavSection[]; current: string | null }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-6 p-0">
      {sections.map((s) => (
        <li key={s.id}>
          <Link href={`/help#${s.id}`} className="text-[14px] font-semibold tracking-[0.04em] text-muted uppercase no-underline hover:text-text">{s.title}</Link>
          <ul className="m-0 mt-2 flex list-none flex-col gap-0.5 p-0">
            {s.articles.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/help/${a.id}`}
                  aria-current={current === a.id ? "page" : undefined}
                  className={`block rounded-tile px-3 py-1.5 text-[16px] leading-snug no-underline ${current === a.id ? "bg-surface font-semibold text-text" : "text-body hover:bg-surface hover:text-text"}`}
                >
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/**
 * The help centre's contents, on every help page: a sticky column on wide
 * screens, a "All help topics" fold on phones. The current article is marked.
 */
export function HelpNav({ sections }: { sections: HelpNavSection[] }) {
  const path = usePathname();
  const current = path.startsWith("/help/") ? path.slice("/help/".length) : null;
  return (
    <>
      <details className="mb-8 rounded-card border border-border bg-surface lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
          All help topics <span aria-hidden="true" className="text-oak">▾</span>
        </summary>
        <nav aria-label="Help topics" className="border-t border-border px-2 py-5">
          <NavList sections={sections} current={current} />
        </nav>
      </details>
      <nav aria-label="Help topics" className="hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2">
        <p className="m-0 mb-5"><Link href="/help" className="text-[19px] font-semibold text-text no-underline">Help</Link></p>
        <NavList sections={sections} current={current} />
      </nav>
    </>
  );
}
