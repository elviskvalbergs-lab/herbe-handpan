import Image from "next/image";
import Link from "next/link";
import { instrumentPicture } from "@/lib/pictures";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import type { InstrumentDoc } from "@/sanity/lib/types";

export function InstrumentList({ instruments }: { instruments: InstrumentDoc[] }) {
  return (
    <ul className="m-0 flex list-none flex-col border-t border-border p-0">
      {instruments.map((i) => {
        const ready = i.status === "available";
        const picture = instrumentPicture(i.slug);
        return (
          <li key={i._id} className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-border px-1 py-6">
            <Link href={`/instruments/${i.slug}`} className="flex flex-[0_1_330px] items-center gap-4 text-[28px] font-semibold tracking-[-0.01em] text-text no-underline hover:underline">
              {picture ? <Image src={picture} alt="" width={80} height={80} className="h-20 w-20 shrink-0" /> : <span aria-hidden="true" className="h-20 w-20 shrink-0" />}
              {i.name}
            </Link>
            <span className="min-w-0 flex-[1_1_300px] text-body">{i.tuningsLine}</span>
            <span className={`rounded-pill px-3 py-1 text-[14px] font-semibold ${ready ? "bg-ready-soft text-ready" : "bg-soon-soft text-soon"}`}>
              {ready ? "In the app" : "Coming soon"}
            </span>
            <span className="flex flex-wrap gap-3">
              {ready ? (
                <Link href={`/instruments/${i.slug}`} className={`${btnPrimary} min-h-11 px-5 py-2 text-[16px]`}>Chords and tunings</Link>
              ) : (
                <Link href={`/request?instrument=${encodeURIComponent(i.name)}`} className={`${btnSecondary} min-h-11 px-5 py-2 text-[16px]`}>Ask for it</Link>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
