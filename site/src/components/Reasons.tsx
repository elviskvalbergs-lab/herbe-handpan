import { container, h2, h3 } from "@/lib/ui";
import type { Point } from "@/sanity/lib/types";

// A title on the left, reasons (title + text) on the right, on a quiet band.
// Used by the home page ("Why") and the makers page. `band={false}` drops the
// background where the next section is a band too.
export function Reasons({ title, items, band = true }: { title?: string; items?: Point[]; band?: boolean }) {
  return (
    <section className={band ? "bg-band" : undefined}>
      <div className={`${container} flex flex-wrap gap-14 ${band ? "py-24" : "pt-4 pb-24"}`}>
        <div className="flex-[1_1_300px]">{title ? <h2 className={`${h2} m-0`}>{title}</h2> : null}</div>
        <div className="flex flex-[2_1_560px] flex-col gap-8">
          {(items ?? []).map((w, i) => (
            <div key={i}>
              <h3 className={`${h3} m-0 mb-1.5`}>{w.title}</h3>
              <p className="m-0 text-body">{w.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
