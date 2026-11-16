import Image from "next/image";
import Link from "next/link";
import { Faq } from "@/components/Faq";
import { Features } from "@/components/Features";
import { HandpanDemo } from "@/components/HandpanDemo";
import { InstrumentList } from "@/components/InstrumentList";
import { handpanChords, triads } from "@/lib/engine";
import { APP_URL } from "@/lib/site";
import { btnCta, btnOnDark, btnPrimary, container, h2, h3 } from "@/lib/ui";
import { getFeatures, getHome, getInstruments } from "@/sanity/lib/data";

const DEMO_SCALE = "d-kurd";

export default async function HomePage() {
  const [home, instruments, features] = await Promise.all([getHome(), getInstruments(), getFeatures()]);
  const demoChords = triads(handpanChords(DEMO_SCALE)).slice(0, 7);
  const dm = Math.max(0, demoChords.findIndex((c) => c.id === "d-min"));

  return (
    <>
      <section className="on-dark bg-dark text-on-dark">
        <div className={`${container} flex flex-wrap items-center gap-14 pt-10 pb-20 lg:pt-14`}>
          <div className="min-w-0 flex-[1_1_440px]">
            <h1 className="m-0 mb-6 text-[clamp(40px,6vw,68px)] font-semibold leading-[1.03] tracking-[-0.025em]">{home.heroTitle}</h1>
            <p className="m-0 mb-9 max-w-[540px] text-[20px] text-on-dark-muted">{home.heroText}</p>
            <div className="flex flex-wrap gap-3.5">
              <a href={APP_URL} className={btnCta}>Start playing, free</a>
              <Link href="#instruments" className={btnOnDark}>Choose your instrument</Link>
            </div>
            {home.heroNote ? <p className="mt-5 mb-0 text-[15px] text-on-dark-muted">{home.heroNote}</p> : null}
          </div>
          <div className="min-w-0 flex-[1_1_380px]">
            <HandpanDemo slug={DEMO_SCALE} chords={demoChords} initial={dm} caption={home.demoCaption} tone="dark" />
          </div>
        </div>
      </section>

      <section id="how" className={`${container} py-20 lg:py-24`}>
        {home.howTitle ? <h2 className={`${h2} m-0 mb-12 max-w-[680px]`}>{home.howTitle}</h2> : null}
        <ol className="m-0 grid list-none gap-10 p-0 md:grid-cols-3">
          {(home.steps ?? []).map((s, i) => (
            <li key={i} className="flex flex-col gap-2.5">
              <span aria-hidden="true" className="text-[52px] font-semibold leading-none text-accent">{i + 1}</span>
              <h3 className={`${h3} m-0`}>{s.title}</h3>
              <p className="m-0 text-body">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className={container}>
        <Image
          src="/brand/hero-wide.webp"
          alt="An oak on a hill above a river valley, someone playing a flute in its shade"
          width={1600}
          height={900}
          sizes="(min-width: 1200px) 1136px, 100vw"
          className="aspect-[21/9] h-auto w-full rounded-card object-cover object-[60%_45%]"
        />
      </div>

      <section id="instruments" className={`${container} pt-20 pb-24`}>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 className={`${h2} m-0`}>Instruments</h2>
          {home.instrumentsText ? <p className="m-0 max-w-[440px] text-body">{home.instrumentsText}</p> : null}
        </div>
        <InstrumentList instruments={instruments} />
        <p className="mt-6 mb-0">
          Playing something else? <Link href="/request" className="font-semibold">Ask for your instrument</Link>, and vote for ones others have asked for.
        </p>
      </section>

      <section className="bg-band">
        <div className={`${container} flex flex-wrap gap-14 py-24`}>
          <div className="flex-[1_1_300px]">{home.whyTitle ? <h2 className={`${h2} m-0`}>{home.whyTitle}</h2> : null}</div>
          <div className="flex flex-[2_1_560px] flex-col gap-8">
            {(home.why ?? []).map((w, i) => (
              <div key={i}>
                <h3 className={`${h3} m-0 mb-1.5`}>{w.title}</h3>
                <p className="m-0 text-body">{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${container} pt-24`}>
        {home.accountTitle ? <h2 className={`${h2} m-0 mb-3 max-w-[760px]`}>{home.accountTitle}</h2> : null}
        {home.accountText ? <p className="m-0 mb-10 max-w-[640px] text-body">{home.accountText}</p> : null}
        <div className="flex flex-wrap items-stretch gap-6">
          <div className="flex-[1_1_320px] rounded-card bg-surface p-8 shadow-[inset_0_0_0_1px_var(--border)]">
            <h3 className={`${h3} m-0 mb-4`}>{home.guestTitle}</h3>
            <ul className="m-0 flex flex-col gap-2 pl-5 text-body">
              {(home.guestPoints ?? []).map((p, i) => <li key={i}>{p}</li>)}
            </ul>
            {home.guestNote ? <p className="mt-5 mb-0 text-[15px] text-muted">{home.guestNote}</p> : null}
            <a href={APP_URL} className={`${btnPrimary} mt-6`}>Start playing</a>
          </div>
          <div className="on-dark flex-[2_1_560px] rounded-card bg-dark p-8 text-on-dark">
            <h3 className={`${h3} m-0 mb-6`}>{home.memberTitle}</h3>
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {(home.memberPoints ?? []).map((p, i) => (
                <div key={i}>
                  <h4 className="m-0 mb-1 text-[18px] font-semibold">{p.title}</h4>
                  <p className="m-0 text-on-dark-muted">{p.text}</p>
                </div>
              ))}
            </div>
            {home.memberNote ? <p className="mt-7 mb-0 text-[15px] text-on-dark-muted">{home.memberNote}</p> : null}
          </div>
        </div>
      </section>

      <section className={`${container} py-24`}>
        {home.featuresTitle ? <h2 className={`${h2} m-0 mb-10`}>{home.featuresTitle}</h2> : null}
        <Features features={features} />
      </section>

      <section className="on-dark bg-dark text-on-dark">
        <div className={`${container} flex flex-wrap items-center justify-between gap-8 py-20`}>
          <div className="flex-[1_1_520px]">
            {home.requestTitle ? <h2 className="m-0 mb-3 text-[clamp(28px,3.5vw,40px)] font-semibold leading-[1.1] tracking-[-0.02em]">{home.requestTitle}</h2> : null}
            {home.requestText ? <p className="m-0 max-w-[560px] text-on-dark-muted">{home.requestText}</p> : null}
          </div>
          <Link href="/request" className={btnCta}>Make a request</Link>
        </div>
      </section>

      {home.faqs?.length ? (
        <section id="faq" className="mx-auto max-w-[860px] px-4 py-24 sm:px-8">
          <h2 className={`${h2} m-0 mb-8`}>{home.faqTitle ?? "Questions"}</h2>
          <Faq items={home.faqs} />
        </section>
      ) : null}
    </>
  );
}
