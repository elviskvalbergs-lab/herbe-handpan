import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SongView, inSentence, tuningTitle } from "@/components/SongView";
import { findTuning, type Family } from "@/lib/engine";
import { FEATURED_SONG_TUNINGS, SONG_FAMILIES, allSongs, findSong, isFeaturedTuning, songOn } from "@/lib/songs";
import { getInstruments, getSongsPage } from "@/sanity/lib/data";

type Props = { params: Promise<{ song: string; family: string; tuning: string }> };

const resolve = (family: string, slug: string) => (SONG_FAMILIES.includes(family as Family) ? findTuning(family as Family, slug) : null);

// "Twinkle, Twinkle on D Kurd handpan": a page wherever the song fits the
// tuning completely. Built ahead for the well-known tunings
// (FEATURED_SONG_TUNINGS, which are also the ones in the sitemap); any other
// tuning's page is made when first asked for, and carries noindex.
export function generateStaticParams() {
  const out: { song: string; family: string; tuning: string }[] = [];
  for (const f of FEATURED_SONG_TUNINGS) {
    const t = findTuning(f.family, f.slug);
    if (!t) continue;
    for (const s of allSongs()) if (songOn(s.id, t, { near: false })) out.push({ song: s.id, family: f.family, tuning: f.slug });
  }
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { song: id, family, tuning: slug } = await params;
  const song = findSong(id);
  const t = resolve(family, slug);
  const on = song && t ? songOn(id, t, { near: false }) : null;
  if (!song || !t || !on) return {};
  return {
    title: `${song.shortTitle} on ${inSentence(tuningTitle(t))}`,
    description: `${song.shortTitle} on the ${inSentence(tuningTitle(t))}: every note is on the instrument, in ${on.key}. Hear it, see each note, and learn it with a tab in the app. Free in your browser.`,
    alternates: { canonical: `/songs/${id}/${family}/${slug}` },
    robots: isFeaturedTuning(family, slug) ? undefined : { index: false, follow: true },
  };
}

export default async function SongOnTuningPage({ params }: Props) {
  const { song: id, family, tuning: slug } = await params;
  const song = findSong(id);
  const t = resolve(family, slug);
  // Only where the song fits completely: an almost-fit is listed on the song's own page, not given a page.
  if (!song || !t || !songOn(id, t, { near: false })) notFound();
  const [copy, instruments] = await Promise.all([getSongsPage(), getInstruments()]);
  const doc = instruments.find((i) => i.family === t.family);
  return <SongView song={song} tuning={t} copy={copy} instrumentHref={doc ? `/instruments/${doc.slug}` : null} />;
}
