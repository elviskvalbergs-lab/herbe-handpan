import { getImageProps } from "next/image";
import Link from "next/link";
import { Faq } from "@/components/Faq";
import { Features } from "@/components/Features";
import { HandpanDemo } from "@/components/HandpanDemo";
import { InstrumentList } from "@/components/InstrumentList";
import { Reasons } from "@/components/Reasons";
import { Steps } from "@/components/Steps";
import { findTuning, handpanChords, triads } from "@/lib/engine";
import { APP_URL } from "@/lib/site";
import { btnCta, btnInk, btnOnPicture, btnPrimary, container, h2, h3 } from "@/lib/ui";
import * as seed from "@/content/seed";
import { getFeatures, getHome, getInstruments } from "@/sanity/lib/data";

const DEMO_SCALE = "d-kurd";

// The hero's picture, art-directed: brand/hero-sky-wide.webp (2:1) from
// 768px, brand/hero-sky-tall.webp (2:3) on phones. Decorative, so alt="".
const { props: { srcSet: heroWide } } = getImageProps({ src: "/brand/hero-sky-wide.webp", alt: "", width: 1774, height: 887, sizes: "100vw", priority: true });
const { props: heroImg } = getImageProps({ src: "/brand/hero-sky-tall.webp", alt: "", width: 1024, height: 1536, sizes: "100vw", priority: true });

export default async function HomePage() {
  const [home, instruments, features] = await Promise.all([getHome(), getInstruments(), getFeatures()]);
  const demoChords = triads(handpanChords(DEMO_SCALE)).slice(0, 7);
  const demoPath = findTuning("handpan", DEMO_SCALE)?.path;
  const dm = Math.max(0, demoChords.findIndex((c) => c.id === "d-min"));

  return (
    <>
      {/* Hero A (docs/design/hero-a-reference.webp): the brand landscape full
          bleed, words over its open sky (kept left of the tree). Phones get the tall picture. */}
      <section className="relative isolate overflow-hidden bg-bg">
        <picture>
          <source media="(min-width: 768px)" srcSet={heroWide} sizes="100vw" />
          <img {...heroImg} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-[80%_100%] md:object-[75%_100%]" />
        </picture>
        <div className={`${container} relative flex min-h-[185vw] flex-col pt-[58vw] pb-10 sm:min-h-[150vw] sm:pt-[44vw] md:min-h-[max(560px,min(56vw,calc(100svh-84px)))] md:pt-[max(64px,6vw)] md:pb-28`}>
          <div className="max-w-[80%] md:max-w-[min(54%,720px)]">
            <h1 className="m-0 mb-5 text-[clamp(36px,4.9vw,70px)] font-bold leading-[1.03] tracking-[-0.03em] text-text">{home.heroTitle}</h1>
            <p className="m-0 mb-8 max-w-[620px] text-[clamp(17px,1.5vw,21px)] leading-[1.5] text-body">{home.heroText}</p>
            <div className="flex flex-wrap gap-3.5">
              <a href={APP_URL} className={btnPrimary}>{home.heroCta ?? seed.home.heroCta}</a>
              <a href="#demo" className={btnOnPicture}>{home.heroListen ?? seed.home.heroListen}</a>
            </div>
          </div>
          <a href="#demo" className={`${btnInk} absolute bottom-8 left-4 px-5 py-2.5 text-[16px] max-md:hidden sm:left-8`}>
            <span aria-hidden="true">↓</span> {home.heroTry ?? seed.home.heroTry}
          </a>
        </div>
      </section>

      <section id="demo" className="on-dark scroll-mt-4 bg-dark text-on-dark">
        <div className={`${container} flex flex-wrap items-center gap-10 py-16 lg:py-20`}>
          <div className="min-w-0 flex-[1_1_320px]">
            <h2 className={`${h2} m-0 mb-4`}>{home.heroTry ?? seed.home.heroTry}</h2>
            {home.heroNote ? <p className="m-0 text-[17px] text-on-dark-muted">{home.heroNote}</p> : null}
          </div>
          <div className="min-w-0 flex-[1_1_420px]">
            <HandpanDemo slug={DEMO_SCALE} chords={demoChords} initial={dm} caption={home.demoCaption} tone="dark" appPath={demoPath} />
          </div>
        </div>
      </section>

      <Steps id="how" title={home.howTitle} steps={home.steps} />

      <section id="instruments" className={`${container} pt-16 pb-24 lg:pt-24`}>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 className={`${h2} m-0`}>Instruments</h2>
          {home.instrumentsText ? <p className="m-0 max-w-[440px] text-body">{home.instrumentsText}</p> : null}
        </div>
        <InstrumentList instruments={instruments} />
        <p className="mt-6 mb-0">
          Playing something else? <Link href="/request" className="font-semibold">Ask for your instrument</Link>, and vote for ones others have asked for.
        </p>
      </section>

      <Reasons title={home.whyTitle} items={home.why} />

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
