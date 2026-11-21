import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmbedShell } from "@/components/EmbedShell";
import { HandpanDemo } from "@/components/HandpanDemo";
import { WindDemo } from "@/components/WindDemo";
import { type Family, findTuning, handpanChords, isPanFamily, panWord, triads, windChords, windVoice } from "@/lib/engine";

// One of the catalogue's tunings, playable, for a shop page that sells a
// standard scale: /embed/handpan/d-kurd, /embed/flute/tin-whistle-d. The
// same demos as the tuning pages, without the site around them.
type Props = { params: Promise<{ family: string; slug: string }> };
const FAMILIES: Family[] = ["handpan", "tongue-drum", "kalimba", "ocarina", "flute"];

export const metadata: Metadata = { robots: { index: false, follow: false } };

export async function generateStaticParams() {
  return [{ family: "handpan", slug: "d-kurd" }];
}

export default async function EmbedTuningPage({ params }: Props) {
  const { family, slug } = await params;
  const fam = FAMILIES.find((f) => f === family);
  const tuning = fam ? findTuning(fam, slug) : null;
  if (!fam || !tuning) notFound();
  const pan = isPanFamily(fam) ? fam : null;
  const all = pan ? handpanChords(tuning.slug, pan) : [];
  const simple = triads(all);
  const title = pan ? `${tuning.name.replace(/ \(\d+\)$/, "")} ${panWord(pan)}` : tuning.name;
  return (
    <EmbedShell title={title} href={tuning.path}>
      {pan ? (
        <HandpanDemo slug={tuning.slug} family={pan} chords={(simple.length ? simple : all).slice(0, 8)}
          cta={{ href: `${tuning.path}/chords`, label: "Play it in Oakhum", newTab: true }} />
      ) : (
        <WindDemo tuning={tuning} chords={windChords(tuning)} voice={windVoice(tuning)} />
      )}
    </EmbedShell>
  );
}
