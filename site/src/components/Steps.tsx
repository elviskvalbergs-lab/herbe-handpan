import { container, h2, h3 } from "@/lib/ui";
import type { Point } from "@/sanity/lib/types";

// Numbered steps as cards on a quiet band, rising in as they scroll into view
// (.step-rise in globals.css). Used by the home page ("How it works") and the
// makers page ("One link in the box").
export function Steps({ id, title, steps, note }: { id?: string; title?: string; steps?: Point[]; note?: string }) {
  return (
    <section id={id} className="scroll-mt-4 bg-band">
      <div className={`${container} py-16 lg:py-24`}>
        {title ? <h2 className={`${h2} m-0 mb-10 max-w-[680px] lg:mb-12`}>{title}</h2> : null}
        <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3 md:gap-6">
          {(steps ?? []).map((s, i) => (
            <li key={i} className="step-rise flex flex-col gap-3 rounded-card bg-surface p-6 shadow-[inset_0_0_0_1px_var(--border)] lg:p-8">
              <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-pill bg-accent text-[24px] font-semibold leading-none text-on-primary">{i + 1}</span>
              <h3 className={`${h3} m-0`}>{s.title}</h3>
              <p className="m-0 text-body">{s.text}</p>
            </li>
          ))}
        </ol>
        {note ? <p className="mt-8 mb-0 max-w-[760px] text-[16px] text-muted">{note}</p> : null}
      </div>
    </section>
  );
}
