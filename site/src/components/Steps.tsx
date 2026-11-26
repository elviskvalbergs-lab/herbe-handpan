import Image from "next/image";
import { container, h2, h3 } from "@/lib/ui";
import type { Shot } from "@/lib/pictures";
import type { Point } from "@/sanity/lib/types";

// Numbered steps as cards on a quiet band, rising in as they scroll into view
// (.step-rise in globals.css). Used by the home page ("How it works") and the
// makers page ("One link in the box"). With `shots`, each step shows the
// app's own screen for it (the top of a phone screenshot), as proof.
export function Steps({ id, title, steps, note, shots }: { id?: string; title?: string; steps?: Point[]; note?: string; shots?: (Shot | null)[] }) {
  return (
    <section id={id} className="scroll-mt-4 bg-band">
      <div className={`${container} py-16 lg:py-24`}>
        {title ? <h2 className={`${h2} m-0 mb-10 max-w-[680px] lg:mb-12`}>{title}</h2> : null}
        <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3 md:gap-6">
          {(steps ?? []).map((s, i) => {
            const shot = shots?.[i];
            return (
              <li key={i} className="step-rise flex flex-col gap-3 rounded-card bg-surface p-6 shadow-[inset_0_0_0_1px_var(--border)] lg:p-8">
                <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-pill bg-accent text-[24px] font-semibold leading-none text-on-primary">{i + 1}</span>
                <h3 className={`${h3} m-0`}>{s.title}</h3>
                <p className="m-0 text-body">{s.text}</p>
                {shot ? (
                  <div className="mt-auto pt-3">
                    <Image src={shot.src} alt={shot.alt} width={shot.width} height={shot.height} sizes="(min-width: 768px) 30vw, 90vw"
                      className="block aspect-[39/52] h-auto w-full rounded-tile object-cover object-top shadow-[inset_0_0_0_1px_var(--border)]" />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        {note ? <p className="mt-8 mb-0 max-w-[760px] text-[16px] text-muted">{note}</p> : null}
      </div>
    </section>
  );
}
