import Link from "next/link";
import { type MakerCard, familiesLine } from "@/lib/makers";
import { APP_URL } from "@/lib/site";
import { MakerLogo } from "./MakerLogo";

// The makers on Oakhum, each linking to their page, and a last card that
// invites the reader to join them. With nobody listed yet, only that card.
export function MakersDirectory({ makers, joinTitle, joinText }: { makers: MakerCard[]; joinTitle: string; joinText: string }) {
  const card = "flex min-w-0 items-center gap-4 rounded-card bg-surface p-5 no-underline shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--border-strong)]";
  return (
    <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {makers.map((m) => (
        <li key={m.slug} className="min-w-0">
          <Link href={`/makers/${m.slug}`} className={`${card} text-text hover:text-text`}>
            <MakerLogo maker={m} />
            <span className="min-w-0">
              <span className="block truncate text-[19px] font-semibold">{m.name}</span>
              <span className="block text-[15px] text-muted">{m.line}</span>
              {m.families.length ? <span className="block text-[15px] text-muted first-letter:uppercase">{familiesLine(m.families)}</span> : null}
            </span>
          </Link>
        </li>
      ))}
      <li className="min-w-0">
        <a href={`${APP_URL}#maker`} className={`${card} border border-dashed border-border-strong bg-transparent text-text shadow-none hover:text-text`}>
          <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-tile bg-band text-[26px] font-semibold">+</span>
          <span className="min-w-0">
            <span className="block text-[19px] font-semibold">{joinTitle}</span>
            <span className="block text-[15px] text-muted">{joinText}</span>
          </span>
        </a>
      </li>
    </ul>
  );
}
