import Image from "next/image";
import Link from "next/link";
import { Faq } from "@/components/Faq";
import { HandpanDemo } from "@/components/HandpanDemo";
import { WindDemo } from "@/components/WindDemo";
import {
  appLink, displayNotes, handpanChords, isPanFamily, panWord, relatedTunings, triads, tuningSongs, windChords, windFingeringChart, windNotes, windVoice,
  type Chord, type Tuning,
} from "@/lib/engine";
import { appShot } from "@/lib/pictures";
import { tuningCounts, tuningHeading, tuningLead } from "@/lib/tuningText";
import { btnPrimary, btnSecondary, container, h2 } from "@/lib/ui";
import type { InstrumentDoc } from "@/sanity/lib/types";

type Props = { instrument: InstrumentDoc; tuning: Tuning | null; featured: Tuning[]; all: Tuning[] };

const sectionTitle = "m-0 mb-2 text-[30px] font-semibold tracking-[-0.015em]";
/** How many songs a page lists before "and N more in the app". */
const SONGS_SHOWN = 15;

export function InstrumentView({ instrument, tuning, featured, all }: Props) {
  const soon = instrument.status !== "available" || !tuning;
  const main = !tuning || tuning.slug === featured[0]?.slug;
  return (
    <div className={`${container} pt-8 pb-24`}>
      <nav aria-label="Breadcrumb" className="mb-7 text-[15px]">
        <Link href="/">Home</Link> <span aria-hidden="true" className="text-muted">/</span>{" "}
        <Link href="/#instruments">Instruments</Link> <span aria-hidden="true" className="text-muted">/</span>{" "}
        {tuning && !main ? (
          <>
            <Link href={`/instruments/${instrument.slug}`}>{instrument.name}</Link> <span aria-hidden="true" className="text-muted">/</span>{" "}
            <span aria-current="page">{tuning.name}</span>
          </>
        ) : (
          <span aria-current="page">{instrument.name}</span>
        )}
      </nav>
      {soon ? <ComingSoon instrument={instrument} /> : <Available instrument={instrument} tuning={tuning} featured={featured} all={all} main={main} />}
      {/* The instrument's questions live on its own page; a tuning's page points there, so 240 pages don't repeat them. */}
      {instrument.faqs?.length && main ? (
        <section id="faq" className="mt-24 max-w-[760px] scroll-mt-4">
          <h2 className={`${h2} m-0 mb-6`}>{instrument.name} questions</h2>
          <Faq items={instrument.faqs} />
        </section>
      ) : instrument.faqs?.length ? (
        <p className="mt-16 mb-0"><Link href={`/instruments/${instrument.slug}#faq`} className="font-semibold">{instrument.name} questions and answers</Link></p>
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

function Available({ instrument, tuning, featured, all, main }: { instrument: InstrumentDoc; tuning: Tuning; featured: Tuning[]; all: Tuning[]; main: boolean }) {
  // Handpans, tongue drums and kalimbas: a fixed set of notes, chords played together.
  const panFamily = isPanFamily(tuning.family) ? tuning.family : null;
  const tuned = panFamily && panFamily !== "handpan"; // tunings, not scales
  const isPan = !!panFamily;
  const chords = panFamily ? handpanChords(tuning.slug, panFamily) : [];
  const wind = panFamily ? [] : windChords(tuning);
  const simple = triads(chords);
  const more = chords.length - simple.length;
  const { songs, of: songsOf } = tuningSongs(tuning);
  const fingerings = isPan ? [] : windFingeringChart(tuning);
  const related = relatedTunings(tuning, all);
  // The chords a guitarist or pianist plays along with: the same list on every instrument.
  const playAlong = (isPan ? simple : wind).map((c) => c.short);
  const base = `/instruments/${instrument.slug}`;
  const hrefFor = (t: Tuning) => (t.slug === featured[0]?.slug ? base : `${base}/${t.slug}`);
  const others = all.filter((t) => !featured.some((f) => f.slug === t.slug));
  const word = panFamily ? panWord(panFamily) : tuning.family;
  const shot = appShot(tuning.family);
  const counts = tuningCounts(tuning);

  return (
    <>
      <div className="flex flex-wrap items-start gap-14">
        <div className="min-w-0 flex-[1_1_460px]">
          <h1 className="m-0 mb-5 text-[clamp(38px,5.5vw,60px)] font-semibold leading-[1.04] tracking-[-0.025em]">
            {main ? instrument.title : tuningHeading(tuning)}
          </h1>
          {/* The instrument's page says what the instrument is; a tuning's page says what this tuning is. */}
          <p className="m-0 mb-8 max-w-[560px] text-[20px] text-body">{main ? instrument.intro : tuningLead(tuning, counts)}</p>

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
            {tuning.sources.length ? (
              <div className="flex-[1_1_200px]">
                <dt className="text-[15px] text-muted">{isPan ? "As made by" : "Fingerings from"}</dt>
                <dd className="m-0 mt-0.5 text-[17px] font-semibold">{tuning.sources.join(", ")}</dd>
              </div>
            ) : null}
          </dl>

          <h2 className={sectionTitle}>Chords you can play</h2>
          {isPan ? (
            <p className="m-0 mb-5 text-body">
              {simple.length} major and minor chords on these notes{more > 0 ? `, and ${more} more (sevenths, sus, add9…) listed below` : ""}. Tap one to hear it and see it on the layout.
            </p>
          ) : (
            <p className="m-0 text-body">
              {wind.length ? `${wind.length} chords of its key. ` : ""}{tuning.family === "ocarina" ? "An ocarina" : "A flute"} plays one note at a time, so a chord is played note by note: tap one to hear it and see the fingering for each note.
            </p>
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

      {/* What this tuning has, written out: found by search engines and readable without the demo. */}
      <div className="mt-20 flex flex-wrap items-start gap-x-14 gap-y-16">
        {isPan && chords.length ? (
          <section className="min-w-0 flex-[1_1_460px]" aria-labelledby="all-chords">
            <h2 id="all-chords" className={sectionTitle}>Every chord on the {tuning.name} {word}</h2>
            <p className="m-0 mb-6 text-body">{chords.length} chords, each with the notes to play.</p>
            <ChordList chords={chords} />
          </section>
        ) : null}
        {!isPan && wind.length ? (
          <section className="min-w-0 flex-[1_1_360px]" aria-labelledby="all-chords">
            <h2 id="all-chords" className={sectionTitle}>Chords on the {tuning.name}</h2>
            <p className="m-0 mb-6 text-body">The chords of its key, each with its notes in playing order.</p>
            <ul className="m-0 grid list-none gap-x-8 gap-y-2 p-0 sm:grid-cols-2">
              {wind.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-4 border-b border-border py-1.5">
                  <span className="font-semibold">{c.name}</span>
                  <span className="tabular text-[15px] text-body">{windNotes(tuning, c.arpeggio)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {fingerings.length ? (
          <section className="min-w-0 flex-[1_1_460px]" aria-labelledby="fingering-chart">
            <h2 id="fingering-chart" className={sectionTitle}>{tuning.name} fingering chart</h2>
            <p className="m-0 mb-6 text-body">
              Every note from low to high. L and R are the left and right hand; 1 is the index finger, 4 the little finger, T the thumb.
            </p>
            <table className="w-full border-collapse text-left text-[15px]">
              <thead>
                <tr className="border-b border-border-strong"><th scope="col" className="py-2 pr-4 font-semibold">Note</th><th scope="col" className="py-2 font-semibold">Fingering</th></tr>
              </thead>
              <tbody>
                {fingerings.map((f) => (
                  <tr key={f.midi} className="border-b border-border"><th scope="row" className="tabular py-1.5 pr-4 font-semibold">{f.note}</th><td className="py-1.5 text-body">{f.fingering}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className="min-w-0 flex-[1_1_360px]" aria-labelledby="songs">
          <h2 id="songs" className={sectionTitle}>Songs you can play</h2>
          {songs.length ? (
            <>
              <p className="m-0 mb-6 text-body">
                {songs.length} of the app’s {songsOf} songs to learn fit the {tuning.name}{isPan ? ` ${word}` : ""}: every note of the melody is one it has. Each comes with a tab to follow.
              </p>
              <ul className="m-0 flex list-none flex-col p-0">
                {songs.slice(0, SONGS_SHOWN).map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-4 border-b border-border py-1.5">
                    <span>{s.title}</span>
                    <span className="flex-none text-[15px] text-muted">in {s.key}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 mb-0">
                <a href={appLink(tuning, isPan ? { tab: "playlists" } : {})} className="font-semibold">
                  {songs.length > SONGS_SHOWN ? `These and ${songs.length - SONGS_SHOWN} more, with tabs, in the app` : "Learn them in the app, with tabs"}
                </a>
              </p>
            </>
          ) : (
            <p className="m-0 text-body">
              None of the app’s {songsOf} songs to learn fits these notes exactly yet. Chords, playlists and playing along from a song’s chord sheet all work on it.
            </p>
          )}
        </section>
      </div>

      {related.length ? (
        <section className="mt-16" aria-labelledby="related">
          <h2 id="related" className="m-0 mb-3 text-[21px] font-semibold">{isPan ? `Other ${tuning.group} ${tuned ? "tunings" : "scales"}` : "The same chart in other keys"}</h2>
          <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
            {related.map((t) => <li key={t.slug}><Link href={hrefFor(t)}>{shortName(t, instrument.name)}</Link></li>)}
          </ul>
        </section>
      ) : null}

      <section className="mt-20 flex flex-wrap items-start gap-12">
        {instrument.playAlongTitle ? (
          <div className="on-dark flex-[1_1_440px] rounded-card bg-dark p-9 text-on-dark">
            <h2 className={`${sectionTitle} mb-3`}>{instrument.playAlongTitle}</h2>
            {instrument.playAlongText ? <p className="m-0 mb-5 text-on-dark-muted">{instrument.playAlongText}</p> : null}
            {playAlong.length ? (
              <>
                <p className="m-0 text-[15px] text-on-dark-muted">Chords for them</p>
                <p className="m-0 mt-0.5 text-[22px] font-semibold">{playAlong.join(", ")}</p>
              </>
            ) : null}
          </div>
        ) : null}
        <div data-loc="instrument-cta" className="flex flex-[1_1_440px] flex-wrap items-center gap-8 rounded-card bg-band p-9">
          <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-5">
            <div>
              <h2 className={sectionTitle}>{instrument.ctaTitle ?? `Play your ${instrument.name.toLowerCase()} in the app`}</h2>
              {instrument.ctaText ? <p className="m-0 text-body">{instrument.ctaText}</p> : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <a href={appLink(tuning, { tab: "chords" })} className={btnPrimary}>Play {tuning.name} in the app</a>
              <Link href={`/request?instrument=${encodeURIComponent(instrument.name)}`} className={btnSecondary}>{tuned ? "Request a tuning" : isPan ? "Request a scale" : "Request a chart"}</Link>
            </div>
          </div>
          {shot ? (
            <Image src={shot.src} alt={shot.alt} width={shot.width} height={shot.height} sizes="180px"
              className="aspect-[39/52] h-auto w-[180px] flex-none rounded-tile object-cover object-top shadow-[inset_0_0_0_1px_var(--border)]" />
          ) : null}
        </div>
      </section>
    </>
  );
}

/** Every chord of a handpan, tongue drum or kalimba as text, grouped the way the app's filter names them. */
function ChordList({ chords }: { chords: Chord[] }) {
  const groups = [...new Set(chords.map((c) => c.category))];
  return (
    <div className="flex flex-col gap-7">
      {groups.map((g) => (
        <div key={g}>
          <h3 className="m-0 mb-2 text-[17px] font-semibold text-muted">{g}</h3>
          <ul className="m-0 grid list-none gap-x-8 p-0 sm:grid-cols-2">
            {chords.filter((c) => c.category === g).map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-4 border-b border-border py-1.5">
                <span className="font-semibold">{c.name}</span>
                <span className="tabular text-[15px] text-body">{c.pitches.join(" ")}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
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
