import type { Metadata } from "next";
import Image from "next/image";
import { stegaClean } from "next-sanity";
import { Faq } from "@/components/Faq";
import { HandpanDemo } from "@/components/HandpanDemo";
import { Reasons } from "@/components/Reasons";
import { Steps } from "@/components/Steps";
import { findTuning, handpanChords, triads } from "@/lib/engine";
import { instrumentPicture } from "@/lib/pictures";
import { btnCta, btnOnPicture, btnPrimary, container, h2, h3 } from "@/lib/ui";
import * as seed from "@/content/seed";
import { getMakers, getSettings } from "@/sanity/lib/data";

// For people who make or sell instruments: why Oakhum helps their buyers keep
// playing, how a QR code or NFC tag in the box opens the instrument, and what
// the buyer sees (the same playable demo as the home page).
const DEMO_SCALE = "d-kurd";
const PICTURES = ["handpan", "kalimba", "ocarina"];

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMakers();
  return { title: stegaClean(m.seo?.title) || stegaClean(m.heroTitle), description: stegaClean(m.seo?.description) || undefined };
}

export default async function MakersPage() {
  const [m, settings] = await Promise.all([getMakers(), getSettings()]);
  const mail = `mailto:${settings.contactEmail}?subject=${encodeURIComponent(stegaClean(m.emailSubject) || "Oakhum for makers")}`;
  const demoChords = triads(handpanChords(DEMO_SCALE)).slice(0, 7);
  const dm = Math.max(0, demoChords.findIndex((c) => c.id === "d-min"));

  return (
    <>
      <section className={`${container} flex flex-wrap items-center gap-10 pt-14 pb-16 lg:pt-20 lg:pb-24`}>
        <div className="min-w-0 flex-[1_1_480px]">
          <h1 className="m-0 mb-5 text-[clamp(36px,4.9vw,64px)] font-bold leading-[1.03] tracking-[-0.03em]">{m.heroTitle}</h1>
          <p className="m-0 mb-8 max-w-[620px] text-[clamp(17px,1.5vw,21px)] leading-[1.5] text-body">{m.heroText}</p>
          <div className="flex flex-wrap gap-3.5">
            <a href={mail} className={btnPrimary}>{m.heroCta ?? seed.makers.heroCta}</a>
            <a href="#demo" className={btnOnPicture}>{m.heroSecondary ?? seed.makers.heroSecondary}</a>
          </div>
        </div>
        <div aria-hidden="true" className="flex w-full min-w-0 max-w-[560px] flex-[1_1_320px] items-end justify-center">
          {PICTURES.map((slug, i) => {
            const src = instrumentPicture(slug);
            return src ? (
              <Image key={slug} src={src} alt="" width={512} height={512}
                className={`h-auto min-w-0 ${i === 0 ? "z-10 w-[52%]" : "-mx-[6%] w-[34%]"} ${i === 1 ? "order-first" : ""}`} />
            ) : null;
          })}
        </div>
      </section>

      <Reasons title={m.whyTitle} items={m.why} band={false} />

      <Steps id="how" title={m.howTitle} steps={m.steps} note={m.howNote} />

      <section id="demo" className="on-dark scroll-mt-4 bg-dark text-on-dark">
        <div className={`${container} flex flex-wrap items-center gap-10 py-16 lg:py-20`}>
          <div className="min-w-0 flex-[1_1_320px]">
            {m.demoTitle ? <h2 className={`${h2} m-0 mb-4`}>{m.demoTitle}</h2> : null}
            {m.demoText ? <p className="m-0 text-[17px] text-on-dark-muted">{m.demoText}</p> : null}
          </div>
          <div className="min-w-0 flex-[1_1_420px]">
            <HandpanDemo slug={DEMO_SCALE} chords={demoChords} initial={dm} tone="dark" appPath={findTuning("handpan", DEMO_SCALE)?.path} />
          </div>
        </div>
      </section>

      <section className={`${container} py-24`}>
        {m.offerTitle ? <h2 className={`${h2} m-0 mb-10`}>{m.offerTitle}</h2> : null}
        <div className="grid gap-4 sm:grid-cols-2 md:gap-6">
          {(m.offer ?? []).map((o, i) => (
            <div key={i} className="rounded-card bg-surface p-6 shadow-[inset_0_0_0_1px_var(--border)] lg:p-8">
              <h3 className={`${h3} m-0 mb-2`}>{o.title}</h3>
              <p className="m-0 text-body">{o.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="on-dark bg-dark text-on-dark">
        <div className={`${container} flex flex-wrap items-center justify-between gap-8 py-20`}>
          <div className="flex-[1_1_520px]">
            {m.ctaTitle ? <h2 className="m-0 mb-3 text-[clamp(28px,3.5vw,40px)] font-semibold leading-[1.1] tracking-[-0.02em]">{m.ctaTitle}</h2> : null}
            {m.ctaText ? <p className="m-0 max-w-[560px] text-on-dark-muted">{m.ctaText}</p> : null}
          </div>
          <a href={mail} className={btnCta}>{m.heroCta ?? seed.makers.heroCta}</a>
        </div>
      </section>

      {m.faqs?.length ? (
        <section id="faq" className="mx-auto max-w-[860px] px-4 py-24 sm:px-8">
          <h2 className={`${h2} m-0 mb-8`}>{m.faqTitle ?? "Questions"}</h2>
          <Faq items={m.faqs} />
        </section>
      ) : null}
    </>
  );
}
