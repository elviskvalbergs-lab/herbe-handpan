"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { HelpSearchEntry } from "@/lib/help";

/** Search over every heading and answer of the help centre, in the browser. */
export function HelpSearch({ entries }: { entries: HelpSearchEntry[] }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    if (!words.length) return [];
    return entries
      .map((e) => {
        const head = `${e.title} ${e.heading}`.toLowerCase();
        const body = e.text.toLowerCase();
        if (!words.every((w) => head.includes(w) || body.includes(w))) return null;
        // A word in the title or the question counts for more than one in the answer.
        return { e, score: words.reduce((n, w) => n + (head.includes(w) ? 3 : 1), 0) };
      })
      .filter((r) => r !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((r) => r.e);
  }, [entries, query]);

  return (
    <div className="max-w-[640px]">
      <label htmlFor="help-search" className="mb-2 block text-[17px] font-semibold">Search help</label>
      <input
        id="help-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="For example: wrong note, offline, QR code"
        autoComplete="off"
        className="min-h-12 w-full rounded-tile border border-border-strong bg-surface px-4 text-[17px] text-text"
      />
      <div aria-live="polite">
        {query.trim().length > 1 ? (
          results.length ? (
            <ul className="m-0 mt-4 flex list-none flex-col gap-1 p-0">
              {results.map((r) => (
                <li key={r.href}>
                  <Link href={r.href} className="block rounded-tile px-4 py-3 no-underline hover:bg-surface">
                    <span className="block font-semibold text-text">{r.heading}</span>
                    <span className="block text-[15px] text-muted">{r.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 mb-0 text-body">
              Nothing found for that. Try other words, or <Link href="/help/contact">tell us what you were looking for</Link>.
            </p>
          )
        ) : null}
      </div>
    </div>
  );
}
