import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MakerLogo } from "@/components/MakerLogo";
import { displayNotes } from "@/lib/engine";
import { familiesLine, getMaker, listMakers } from "@/lib/makers";
import { instrumentPicture } from "@/lib/pictures";
import { APP_URL } from "@/lib/site";
import { btnCta, btnPrimary, btnSecondary, container, h2, h3 } from "@/lib/ui";
import * as seed from "@/content/seed";
import { getMakers } from "@/sanity/lib/data";

// A maker's or shop's public page: who they are, in their own words, and the
// instruments they make, each opening in the app exactly as they set it up.
// Everything about the maker comes from the app's database (src/lib/makers.ts),
// where the maker edits it; the fixed words around it are the makers page's.
type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const list = await listMakers();
  return (list.length ? list : [{ slug: "-" }]).map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const maker = await getMaker(slug);
  if (!maker) return {};
  const what = familiesLine(maker.families);
  return {
    title: `${maker.name}${what ? `: ${what}` : ""}`,
    description: `${maker.name}, ${maker.line.toLowerCase()}. Hear and play ${maker.instruments.length ? "their instruments" : "what they make"} on Oakhum: every chord and song each one can play.`,
    alternates: { canonical: `/makers/${maker.slug}` },
  };
}

export default async function MakerPage({ params }: Props) {
  const { slug } = await params;
  const [maker, words] = await Promise.all([getMaker(slug), getMakers()]);
  if (!maker) notFound();
  const w = { ...seed.makers, ...words };
  const what = familiesLine(maker.families);

  return (
    <>
      <section className={`${container} pt-12 pb-10 lg:pt-16`}>
        <p className="m-0 mb-6 text-[15px] text-muted"><Link href="/makers#makers">{w.directoryTitle}</Link></p>
        <div className="flex flex-wrap items-center gap-5">
          <MakerLogo maker={maker} size={88} />
          <div className="min-w-0">
            <h1 className="m-0 text-[clamp(32px,4.4vw,52px)] font-bold leading-[1.05] tracking-[-0.025em]">{maker.name}</h1>
            <p className="m-0 mt-1.5 text-[17px] text-body">{maker.line}{what ? ` · ${what}` : ""}</p>
          </div>
        </div>
        {maker.story ? <p lang={maker.storyLang || undefined} className="m-0 mt-7 max-w-[720px] whitespace-pre-line text-[19px] leading-[1.55] text-body">{maker.story}</p> : null}
        {maker.website ? (
          <p className="m-0 mt-6"><a href={maker.website} rel="noopener nofollow" className={btnSecondary}>{maker.websiteLabel}</a></p>
        ) : null}
      </section>

      <section className={`${container} pb-20`}>
        <h2 className={`${h2} m-0 mb-2`}>{w.makerInstrumentsTitle}</h2>
        <p className="m-0 mb-8 max-w-[640px] text-body">{w.makerInstrumentsText}</p>
        {maker.instruments.length ? (
          <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {maker.instruments.map((inst) => {
              const brand = inst.picture ? null : instrumentPicture(inst.family);
              return (
                <li key={inst.code} className="flex min-w-0 flex-col rounded-card bg-surface p-5 shadow-[inset_0_0_0_1px_var(--border)]">
                  <a href={inst.path} aria-label={`${inst.name}: ${w.makerPlayCta}`} className="mb-4 block">
                    {inst.picture ? (
                      <div className="pan-picture mx-auto w-full max-w-[280px] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: inst.picture }} />
                    ) : brand ? (
                      <Image src={brand} alt="" width={512} height={512} className="mx-auto h-auto w-full max-w-[220px]" />
                    ) : null}
                  </a>
                  <h3 className={`${h3} m-0 mb-1`}>{inst.name}</h3>
                  {inst.notes.length ? <p className="m-0 mb-4 text-[15px] text-muted">{displayNotes(inst.notes)}</p> : <p className="m-0 mb-4" />}
                  <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2">
                    <a href={inst.path} className={`${btnPrimary} min-h-10 px-5 py-2 text-[16px]`}>{w.makerPlayCta}</a>
                    {inst.tuningPath ? <Link href={inst.tuningPath} className="text-[15px] font-semibold">{w.makerTuningLink}</Link> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="m-0 rounded-card bg-surface p-6 text-body shadow-[inset_0_0_0_1px_var(--border)]">{w.makerNoInstruments}</p>
        )}
        <p className="m-0 mt-10 text-[15px] text-muted">
          <Link href={`/request?kind=feedback&about=${encodeURIComponent(`Maker page: ${maker.slug}`)}`}>{w.makerReport}</Link>
        </p>
      </section>

      <section className="on-dark bg-dark text-on-dark">
        <div className={`${container} flex flex-wrap items-center justify-between gap-8 py-16`}>
          <div className="flex-[1_1_520px]">
            <h2 className="m-0 mb-3 text-[clamp(26px,3.2vw,36px)] font-semibold leading-[1.1] tracking-[-0.02em]">{w.ctaTitle}</h2>
            <p className="m-0 max-w-[560px] text-on-dark-muted">{w.makerJoinText}</p>
          </div>
          <a href={`${APP_URL}#maker`} className={btnCta}>{w.heroCta}</a>
        </div>
      </section>
    </>
  );
}
