import Link from "next/link";
import { SongDemo } from "@/components/SongDemo";
import { isPanFamily, panWord, windVoice, type Family, type Tuning } from "@/lib/engine";
import { SONG_FAMILIES, noteLabel, songAfterWord, songAppLink, songHref, songOn, songsAfter, songTunings, type Song } from "@/lib/songs";
import { btnPrimary, btnSecondary, container, h2 } from "@/lib/ui";
import type { SongsPage } from "@/sanity/lib/types";

const FAMILY_NAMES: Record<Family, string> = { handpan: "Handpans", "tongue-drum": "Tongue drums", kalimba: "Kalimbas", ocarina: "Ocarinas", flute: "Flutes", recorder: "Recorders" };

/** What the instrument is called: "D Kurd handpan", "C Major 17-key kalimba", "Tin whistle in D". */
/** A name inside a sentence: "Tin whistle in D" → "tin whistle in D"; "D Kurd handpan" stays. */
export function inSentence(name: string): string {
  return /^[A-Z][a-z]/.test(name) ? name[0].toLowerCase() + name.slice(1) : name;
}

export function tuningTitle(t: Tuning): string {
  if (!isPanFamily(t.family)) return t.name;
  // "C Major (17)" → "C Major 17-key kalimba": the count tells two tunings of one name apart.
  const count = / \((\d+)\)$/.exec(t.name)?.[1];
  const base = t.name.replace(/ \(\d+\)$/, "");
  return count ? `${base} ${count}-${t.family === "kalimba" ? "key" : "note"} ${panWord(t.family)}` : `${base} ${panWord(t.family)}`;
}

// A song's page: with a tuning, the song on that instrument (the playable
// picture, the key it lands in, songs that go well after it); always, every
// instrument in the catalogue that can play it. The words that aren't the
// song's own are the Songs pages document.
export function SongView({ song, tuning, copy, instrumentHref, own = false }: {
  song: Song; tuning: Tuning | null; copy: SongsPage; instrumentHref?: string | null;
  /** The song's own page: the tuning is only where the demo plays it, not what the page is about. */
  own?: boolean;
}) {
  const on = tuning ? songOn(song.id, tuning) : null;
  const after = tuning && on ? songsAfter(song.id, tuning) : [];
  const families = SONG_FAMILIES.map((family) => ({ family, ...songTunings(song.id, family) })).filter((f) => f.fits.length || f.almost.length);
  const total = families.reduce((a, f) => a + f.fits.length, 0);
  return (
    <div className={`${container} pt-8 pb-24`}>
      <nav aria-label="Breadcrumb" className="mb-7 text-[15px]">
        <Link href="/">Home</Link> <span aria-hidden="true" className="text-muted">/</span>{" "}
        <Link href="/songs">Songs</Link> <span aria-hidden="true" className="text-muted">/</span>{" "}
        {tuning && !own ? <><Link href={songHref(song.id)}>{song.shortTitle}</Link> <span aria-hidden="true" className="text-muted">/</span> <span>{tuningTitle(tuning)}</span></> : <span>{song.shortTitle}</span>}
      </nav>

      <div className="flex flex-wrap items-start gap-14">
        <div className="min-w-0 flex-[1_1_460px]">
          <h1 className="m-0 mb-5 text-[clamp(34px,5vw,56px)] font-semibold leading-[1.05] tracking-[-0.025em]">
            {tuning && !own ? `${song.shortTitle} on ${inSentence(tuningTitle(tuning))}` : song.title}
          </h1>
          <dl className="m-0 mb-8 flex flex-wrap gap-x-8 gap-y-4 border-y border-border py-6">
            <Fact label="From" value={song.country} />
            <Fact label={on && !own ? "Key on this instrument" : "Key as written"} value={on && !own ? on.key : song.key} />
            <Fact label="Time" value={song.time} />
            <Fact label="Notes" value={String(song.noteCount)} />
          </dl>
          {on?.missing && !own ? (
            <p className="m-0 mb-6 rounded-card bg-soon-soft px-5 py-4 text-soon">
              One note is missing: {noteLabel(on.missing)}, {on.missingTimes === 1 ? "once" : `${on.missingTimes} times`}. {copy.almostText}
            </p>
          ) : null}
          {copy.appTitle ? <h2 className="m-0 mb-2 text-[26px] font-semibold tracking-[-0.015em]">{copy.appTitle}</h2> : null}
          {copy.appText ? <p className="m-0 mb-6 max-w-[560px] text-body">{copy.appText}</p> : null}
          <div className="flex flex-wrap gap-3">
            <a href={songAppLink(song.id, on && !own ? tuning ?? undefined : undefined)} className={btnPrimary}>{copy.appCta ?? "Open in the app"}</a>
            {tuning && instrumentHref && !own ? <Link href={instrumentHref} className={btnSecondary}>{songAfterWord(tuning.family)}</Link> : null}
          </div>
        </div>

        {tuning && on ? (
          <div className={`min-w-0 flex-[1_1_380px] rounded-card p-5 ${isPanFamily(tuning.family) ? "bg-pan-stage" : "bg-surface shadow-[inset_0_0_0_1px_var(--border)]"}`}>
            <SongDemo tuning={tuning} notes={on.notes} bars={on.bars} voice={isPanFamily(tuning.family) ? tuning.family : windVoice(tuning)} caption={own ? `Played here on the ${inSentence(tuningTitle(tuning))}, in ${on.key}. ${copy.demoText ?? ""}` : copy.demoText} />
          </div>
        ) : null}
      </div>

      {after.length && tuning && !own ? (
        <section className="mt-16">
          <h2 className="m-0 mb-4 text-[26px] font-semibold tracking-[-0.015em]">Goes well after it</h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {after.map((s) => <li key={s.id}><Link href={songHref(s.id, tuning)} className={btnSecondary}>{s.shortTitle}</Link></li>)}
          </ul>
        </section>
      ) : null}

      <section className="mt-16">
        <h2 className={`${h2} m-0 mb-3`}>{copy.fitTitle ?? "Which instruments can play it"}</h2>
        <p className="m-0 mb-8 max-w-[720px] text-body">
          {total} tuning{total === 1 ? "" : "s"} in the catalogue {total === 1 ? "has" : "have"} every note of {song.shortTitle}. {copy.fitText}
        </p>
        <div className="flex flex-col gap-8">
          {families.map((f) => (
            <div key={f.family}>
              <h3 className="m-0 mb-3 text-[19px] font-semibold">{FAMILY_NAMES[f.family]} · {f.fits.length}</h3>
              {f.fits.length ? (
                <ul className="m-0 grid list-none grid-cols-1 gap-x-6 gap-y-1.5 p-0 text-[15px] sm:grid-cols-2 lg:grid-cols-3">
                  {f.fits.map((x) => (
                    <li key={x.tuning.slug}>
                      <Link href={songHref(song.id, x.tuning)} aria-current={!own && tuning?.path === x.tuning.path ? "page" : undefined}>{tuningTitle(x.tuning)}</Link>{" "}
                      <span className="text-muted">in {x.key}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {f.almost.length ? (
                <p className="m-0 mt-3 max-w-[720px] text-[15px] text-muted">
                  One note missing on {f.almost.length} more: {f.almost.slice(0, 6).map((x) => `${tuningTitle(x.tuning)} (${noteLabel(x.missing!)})`).join(", ")}{f.almost.length > 6 ? "…" : "."}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <p className="mt-16 max-w-[720px] text-[15px] text-muted">
        {song.sourceName
          ? <>Melody from <a href={song.source} rel="noopener">{song.sourceName}</a>, public domain.</>
          : <>The tune is traditional. Melody from <a href={song.source} rel="noopener">its Wikipedia article</a>, CC BY-SA 4.0.</>}
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[15px] text-muted">{label}</dt>
      <dd className="m-0 mt-0.5 text-[19px] font-semibold">{value}</dd>
    </div>
  );
}
