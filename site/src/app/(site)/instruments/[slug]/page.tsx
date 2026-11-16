import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { stegaClean } from "next-sanity";
import { InstrumentView } from "@/components/InstrumentView";
import { instrumentTunings } from "@/lib/instruments";
import { getInstrument, getInstruments } from "@/sanity/lib/data";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const list = await getInstruments();
  return (list.length ? list : [{ slug: "-" }]).map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getInstrument(slug);
  if (!doc) return {};
  return {
    title: stegaClean(doc.seo?.title) || stegaClean(doc.title),
    description: stegaClean(doc.seo?.description) || stegaClean(doc.intro),
    alternates: { canonical: `/instruments/${slug}` },
  };
}

export default async function InstrumentPage({ params }: Props) {
  const { slug } = await params;
  const doc = await getInstrument(slug);
  if (!doc) notFound();
  const { featured, all } = instrumentTunings(doc);
  return <InstrumentView instrument={doc} tuning={featured[0] ?? null} featured={featured} all={all} />;
}
