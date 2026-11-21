import type { Metadata } from "next";
import Link from "next/link";
import { stegaClean } from "next-sanity";
import { allSongs, songHref } from "@/lib/songs";
import { container } from "@/lib/ui";
import { getSongsPage } from "@/sanity/lib/data";

// Every song in the app's catalogue (../js/songs.js), each linking to its own
// page: which instruments can play it, and the song playable on one of them.
export async function generateMetadata(): Promise<Metadata> {
  const copy = await getSongsPage();
  return {
    title: stegaClean(copy.seo?.title) || stegaClean(copy.heroTitle),
    description: stegaClean(copy.seo?.description) || stegaClean(copy.heroText),
    alternates: { canonical: "/songs" },
  };
}

export default async function SongsIndex() {
  const copy = await getSongsPage();
  const songs = allSongs();
  const groups = [
    { title: "Songs", list: songs.filter((s) => !s.christmas) },
    { title: "Christmas songs", list: songs.filter((s) => s.christmas) },
  ];
  return (
    <div className={`${container} pt-8 pb-24`}>
      <nav aria-label="Breadcrumb" className="mb-7 text-[15px]">
        <Link href="/">Home</Link> <span aria-hidden="true" className="text-muted">/</span> <span>Songs</span>
      </nav>
      <h1 className="m-0 mb-5 text-[clamp(38px,5.5vw,60px)] font-semibold leading-[1.04] tracking-[-0.025em]">{copy.heroTitle}</h1>
      <p className="m-0 mb-12 max-w-[720px] text-[20px] text-body">{copy.heroText}</p>
      {groups.map((g) => (
        <section key={g.title} className="mb-14">
          <h2 className="m-0 mb-5 text-[30px] font-semibold tracking-[-0.015em]">{g.title} · {g.list.length}</h2>
          <ul className="m-0 grid list-none grid-cols-1 gap-x-8 gap-y-2.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {g.list.map((s) => (
              <li key={s.id}>
                <Link href={songHref(s.id)} className="font-semibold">{s.shortTitle}</Link>{" "}
                <span className="text-[15px] text-muted">{s.country}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
