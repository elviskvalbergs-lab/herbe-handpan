import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { InstrumentView } from "@/components/InstrumentView";
import { instrumentTunings } from "@/lib/instruments";
import { JsonLd } from "@/components/JsonLd";
import { canonicalTuning } from "@/lib/engine";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import { tuningCounts, tuningDescription, tuningHeading } from "@/lib/tuningText";
import { getInstrument, getInstruments } from "@/sanity/lib/data";

type Props = { params: Promise<{ slug: string; tuning: string }> };

// One page per scale or key, so "D Kurd handpan chords" can be found in search.
export async function generateStaticParams() {
  const list = await getInstruments();
  const params = list.flatMap((doc) => instrumentTunings(doc).all.map((t) => ({ slug: doc.slug, tuning: t.slug })));
  return params.length ? params : [{ slug: "-", tuning: "-" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, tuning } = await params;
  const doc = await getInstrument(slug);
  const t = doc ? instrumentTunings(doc).all.find((x) => x.slug === tuning) : null;
  if (!doc || !t) return {};
  // The same key in another octave has the same fingerings and note names:
  // search engines are pointed at one page for it (engine.ts canonicalTuning).
  const main = canonicalTuning(t);
  return pageMeta({
    title: tuningHeading(t),
    description: tuningDescription(t, tuningCounts(t)),
    path: `/instruments/${slug}/${tuning}`,
    canonical: `/instruments/${slug}/${main.slug}`,
    family: t.family,
  });
}

export default async function TuningPage({ params }: Props) {
  const { slug, tuning } = await params;
  const doc = await getInstrument(slug);
  if (!doc) notFound();
  const { featured, all } = instrumentTunings(doc);
  const t = all.find((x) => x.slug === tuning);
  if (!t) notFound();
  if (t.slug === featured[0]?.slug) permanentRedirect(`/instruments/${slug}`);
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Oakhum", path: "/" }, { name: doc.name, path: `/instruments/${slug}` }, { name: t.name, path: `/instruments/${slug}/${t.slug}` }])} />
      <InstrumentView instrument={doc} tuning={t} featured={featured} all={all} />
    </>
  );
}
