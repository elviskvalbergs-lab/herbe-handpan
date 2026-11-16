import Link from "next/link";
import type { FeatureDoc } from "@/sanity/lib/types";

export function Features({ features }: { features: FeatureDoc[] }) {
  const ready = features.filter((f) => f.status === "ready");
  const next = features.filter((f) => f.status === "next");
  return (
    <div className="flex flex-wrap gap-12">
      <div className="min-w-0 flex-[1_1_400px]">
        <h3 className="m-0 mb-4 text-[18px] font-semibold text-ready">In the app now</h3>
        <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2">
          {ready.map((f) => (
            <li key={f._id}><strong className="block font-semibold">{f.title}</strong><span className="text-body">{f.text}</span></li>
          ))}
        </ul>
      </div>
      <div className="min-w-0 flex-[1_1_320px]">
        <h3 className="m-0 mb-4 text-[18px] font-semibold text-soon">On the way</h3>
        <ul className="m-0 flex list-none flex-col gap-5 p-0">
          {next.map((f) => (
            <li key={f._id}><strong className="block font-semibold">{f.title}</strong><span className="text-body">{f.text}</span></li>
          ))}
        </ul>
        <p className="mt-6 mb-0"><Link href="/request?kind=feature" className="font-semibold">Suggest a feature</Link></p>
      </div>
    </div>
  );
}
