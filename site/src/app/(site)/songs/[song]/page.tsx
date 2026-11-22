import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SongView } from "@/components/SongView";
import { SONG_FAMILIES, allSongs, featuredTuningsFor, findSong, songTunings } from "@/lib/songs";
import { getInstruments, getSongsPage } from "@/sanity/lib/data";

type Props = { params: Promise<{ song: string }> };

// One page per song: which instruments can play it, and the song playable on
// the first well-known tuning it fits.
export function generateStaticParams() {
  return allSongs().map((s) => ({ song: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { song: id } = await params;
  const song = findSong(id);
  if (!song) return {};
  const n = SONG_FAMILIES.reduce((a, f) => a + songTunings(id, f).fits.length, 0);
  return {
    title: `${song.shortTitle}: which instruments can play it`,
    description: `${song.shortTitle} (${song.country}, ${song.time}) fits ${n} handpan, tongue drum, kalimba, ocarina and flute tunings. See which, and play it note by note. Free in your browser.`,
    alternates: { canonical: `/songs/${id}` },
  };
}

export default async function SongPage({ params }: Props) {
  const { song: id } = await params;
  const song = findSong(id);
  if (!song) notFound();
  const [copy, instruments] = await Promise.all([getSongsPage(), getInstruments()]);
  const tuning = featuredTuningsFor(id)[0] ?? null;
  const doc = tuning ? instruments.find((i) => i.family === tuning.family) : null;
  return <SongView song={song} tuning={tuning} copy={copy} instrumentHref={doc ? `/instruments/${doc.slug}` : null} own />;
}
