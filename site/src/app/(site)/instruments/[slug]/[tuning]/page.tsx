import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { InstrumentView } from "@/components/InstrumentView";
import { instrumentTunings } from "@/lib/instruments";
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
  const isPan = t.family === "handpan";
  return {
    title: isPan ? `${t.name} handpan chords` : `${t.name} fingerings`,
    description: isPan
      ? `Every chord on the ${t.name} handpan (${t.notes.join(" ")}), drawn on its layout. Free in your browser.`
      : `Fingerings for every note of the ${t.name}, and chords as arpeggios. Free in your browser.`,
    alternates: { canonical: `/instruments/${slug}/${tuning}` },
  };
}

export default async function TuningPage({ params }: Props) {
  const { slug, tuning } = await params;
  const doc = await getInstrument(slug);
  if (!doc) notFound();
  const { featured, all } = instrumentTunings(doc);
  const t = all.find((x) => x.slug === tuning);
  if (!t) notFound();
  if (t.slug === featured[0]?.slug) permanentRedirect(`/instruments/${slug}`);
  return <InstrumentView instrument={doc} tuning={t} featured={featured} all={all} />;
}
