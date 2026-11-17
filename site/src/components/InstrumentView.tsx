import Link from "next/link";
import { Faq } from "@/components/Faq";
import { HandpanDemo } from "@/components/HandpanDemo";
import { WindDemo } from "@/components/WindDemo";
import { appLink, displayNotes, handpanChords, isPanFamily, panWord, triads, windChords, windVoice, type Tuning } from "@/lib/engine";
import { btnPrimary, btnSecondary, container, h2 } from "@/lib/ui";
import type { InstrumentDoc } from "@/sanity/lib/types";

type Props = { instrument: InstrumentDoc; tuning: Tuning | null; featured: Tuning[]; all: Tuning[] };

export function InstrumentView({ instrument, tuning, featured, all }: Props) {
  const soon = instrument.status !== "available" || !tuning;
  return (
    <div className={`${container} pt-8 pb-24`}>
      <nav aria-label="Breadcrumb" className="mb-7 text-[15px]">
        <Link href="/">Home</Link> <span aria-hidden="true" className="text-muted">/</span>{" "}
        <Link href="/#instruments">Instruments</Link> <span aria-hidden="true" className="text-muted">/</span>{" "}
        {tuning && tuning.slug !== featured[0]?.slug ? (
          <>
            <Link href={`/instruments/${instrument.slug}`}>{instrument.name}</Link> <span aria-hidden="true" className="text-muted">/</span>{" "}
            <span>{tuning.name}</span>
          </>
        ) : (
          <span>{instrument.name}</span>
        )}
      </nav>
      {soon ? <ComingSoon instrument={instrument} /> : <Available instrument={instrument} tuning={tuning} featured={featured} all={all} />}
      {instrument.faqs?.length ? (
        <section className="mt-24 max-w-[760px]">
          <h2 className={`${h2} m-0 mb-6`}>{instrument.name} questions</h2>
          <Faq items={instrument.faqs} />
        </section>
      ) : null}
    </div>
  );
}

function ComingSoon({ instrument }: { instrument: InstrumentDoc }) {
  return (
    <section className="max-w-[720px]">
      <span className="mb-4 inline-block rounded-pill bg-soon-soft px-3 py-1 text-[14px] font-semibold text-soon">Coming soon</span>
      <h1 className="m-0 mb-5 text-[clamp(38px,5.5vw,60px)] font-semibold leading-[1.04] tracking-[-0.025em]">{instrument.title}</h1>
      <p className="m-0 mb-8 text-[20px] text-body">{instrument.intro}</p>
      <div className="flex flex-wrap gap-3">
        <Link href={`/request?instrument=${encodeURIComponent(instrument.name)}`} className={btnPrimary}>Ask for the {instrument.name.toLowerCase()}</Link>
        <Link href="/#instruments" className={btnSecondary}>See what’s in the app</Link>
      </div>
    </section>
  );
}

function Available({ instrument, tuning, featured, all }: { instrument: InstrumentDoc; tuning: Tuning; featured: Tuning[]; all: Tuning[] }) {
  // Handpans, tongue drums and kalimbas: a fixed set of notes, chords played together.
  const panFamily = isPanFamily(tuning.family) ? tuning.family : null;
  const tuned = panFamily && panFamily !== "handpan"; // tunings, not scales
  const isPan = !!panFamily;
  const chords = panFamily ? handpanChords(tuning.slug, panFamily) : [];
  const wind = panFamily ? [] : windChords(tuning);
  const simple = triads(chords);
  const more = chords.length - simple.length;
  // The chords a guitarist or pianist plays along with: the same list on every instrument.
  const playAlong = (isPan ? simple : wind).map((c) => c.short);
  const base = `/instruments/${instrument.slug}`;
  const hrefFor = (t: Tuning) => (t.slug === featured[0]?.slug ? base : `${base}/${t.slug}`);
  const others = all.filter((t) => !featured.some((f) => f.slug === t.slug));

  return (
    <>
      <div className="flex flex-wrap items-start gap-14">
        <div className="min-w-0 flex-[1_1_460px]">
          <h1 className="m-0 mb-5 text-[clamp(38px,5.5vw,60px)] font-semibold leading-[1.04] tracking-[-0.025em]">
            {tuning.slug === featured[0]?.slug ? instrument.title : `${tuning.name} ${panFamily ? `${panWord(panFamily)} chords` : "fingerings"}`}
          </h1>
          <p className="m-0 mb-8 max-w-[560px] text-[20px] text-body">{instrument.intro}</p>

          <h2 className="m-0 mb-2.5 text-[16px] font-semibold text-muted">{tuned ? "Your tuning" : isPan ? "Your scale" : "Your instrument"}</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {featured.map((t) => {
              const on = t.slug === tuning.slug;
              return (
                <Link
                  key={t.slug}
                  href={hrefFor(t)}
                  aria-current={on ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-pill border px-4 text-[16px] font-semibold no-underline ${on ? "border-primary bg-primary text-on-primary hover:text-on-primary" : "border-border-strong bg-surface text-text hover:border-text hover:text-text"}`}
                >
                  {shortName(t, instrument.name)}
                </Link>
              );
            })}
          </div>
          {others.length ? (
            <details className="mb-9">
              <summary className="cursor-pointer py-2 font-semibold text-link">All {all.length} {tuned ? "tunings" : isPan ? "scales" : "keys and charts"}</summary>
              <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-x-4 gap-y-1.5 p-0 text-[15px] sm:grid-cols-3">
                {all.map((t) => (
                  <li key={t.slug}><Link href={hrefFor(t)} aria-current={t.slug === tuning.slug ? "page" : undefined}>{shortName(t, instrument.name)}</Link></li>
                ))}
              </ul>
            </details>
          ) : <div className="mb-9" />}

          <dl className="m-0 mb-10 flex flex-wrap gap-6 border-y border-border py-6">
            <div className="flex-[1_1_220px]">
              <dt className="text-[15px] text-muted">Notes</dt>
              <dd className="m-0 mt-0.5 text-[19px] font-semibold">{isPan ? displayNotes(tuning.notes) : `${displayNotes([tuning.notes[0]])} to ${displayNotes([tuning.notes.at(-1)!])}, ${tuning.notes.length} notes`}</dd>
            </div>
            {tuning.description ? (
              <div className="flex-[1_1_200px]">
                <dt className="text-[15px] text-muted">Character</dt>
                <dd className="m-0 mt-0.5 text-[19px] font-semibold">{tuning.description}</dd>
              </div>
            ) : null}
          </dl>

          {isPan ? (
            <>
              <h2 className="m-0 mb-2 text-[30px] font-semibold tracking-[-0.015em]">Chords you can play</h2>
              <p className="m-0 mb-5 text-body">
                {simple.length} major and minor chords on these notes{more > 0 ? `, and ${more} more in the app (sevenths, sus, add9…)` : ""}. Tap one to hear it and see it on the layout.
              </p>
            </>
          ) : (
            <>
              <h2 className="m-0 mb-2 text-[30px] font-semibold tracking-[-0.015em]">Chords you can play</h2>
              <p className="m-0 text-body">
                {wind.length ? `${wind.length} chords of its key. ` : ""}{tuning.family === "ocarina" ? "An ocarina" : "A flute"} plays one note at a time, so a chord is played as an arpeggio: tap one to hear it and see the fingering for each note. The app has every note, all chords and practice mode for playlists.
              </p>
            </>
          )}
        </div>

        <div className="min-w-0 flex-[1_1_360px] lg:sticky lg:top-6">
          {isPan ? (
            <div className="rounded-card bg-pan-stage p-5">
              <HandpanDemo slug={tuning.slug} family={panFamily ?? "handpan"} chords={simple} caption={`${tuning.name} layout`} appPath={tuning.path} />
            </div>
          ) : wind.length ? (
            <div className="rounded-card bg-surface p-5 shadow-[inset_0_0_0_1px_var(--border)]">
              <WindDemo tuning={tuning} chords={wind} voice={windVoice(tuning)} caption={`${tuning.name}: fingering for each note`} />
            </div>
          ) : (
            <NoteStrip tuning={tuning} />
          )}
        </div>
      </div>

      <section className="mt-20 flex flex-wrap gap-12">
        {instrument.playAlongTitle ? (
          <div className="on-dark flex-[1_1_440px] rounded-card bg-dark p-9 text-on-dark">
            <h2 className="m-0 mb-3 text-[30px] font-semibold tracking-[-0.015em]">{instrument.playAlongTitle}</h2>
            {instrument.playAlongText ? <p className="m-0 mb-5 text-on-dark-muted">{instrument.playAlongText}</p> : null}
            {playAlong.length ? (
              <>
                <p className="m-0 text-[15px] text-on-dark-muted">Chords for them</p>
                <p className="m-0 mt-0.5 text-[22px] font-semibold">{playAlong.join(", ")}</p>
              </>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-[1_1_440px] flex-col justify-center gap-5 rounded-card bg-band p-9">
          <div>
            <h2 className="m-0 mb-2 text-[30px] font-semibold tracking-[-0.015em]">{instrument.ctaTitle ?? `Play your ${instrument.name.toLowerCase()} in the app`}</h2>
            {instrument.ctaText ? <p className="m-0 text-body">{instrument.ctaText}</p> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={appLink(tuning, { tab: "chords" })} className={btnPrimary}>Open {tuning.name} in the app</a>
            <Link href={`/request?instrument=${encodeURIComponent(instrument.name)}`} className={btnSecondary}>{tuned ? "Request a tuning" : isPan ? "Request a scale" : "Request a chart"}</Link>
          </div>
        </div>
      </section>
    </>
  );
}

/** Ocarina and flute: the notes in order, as chips. The fingerings are in the app. */
function NoteStrip({ tuning }: { tuning: Tuning }) {
  return (
    <div className="rounded-card bg-surface p-6 shadow-[inset_0_0_0_1px_var(--border)]">
      <p className="m-0 mb-4 text-[15px] text-muted">{tuning.name}: every note it plays</p>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {tuning.notes.map((n) => (
          <li key={n} className="tabular min-w-12 rounded-tile border border-border bg-bg px-2.5 py-2 text-center text-[15px] font-semibold">{displayNotes([n])}</li>
        ))}
      </ul>
    </div>
  );
}

function shortName(t: Tuning, instrumentName: string): string {
  return t.name.replace(new RegExp(`\\s*${instrumentName}\\s*`, "i"), " ").replace(/\s+,/g, ",").trim();
}
