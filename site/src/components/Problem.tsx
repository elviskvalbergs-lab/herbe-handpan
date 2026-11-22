import Link from "next/link";
import { APP_URL } from "@/lib/site";
import { btnPrimary, btnSecondary } from "@/lib/ui";

// The page for "not here" and "something broke": says what happened in plain
// words and gives the three places people were most likely heading for.
export function Problem({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-[720px] px-4 pt-16 pb-24 sm:px-8 lg:pt-24">
      <h1 className="m-0 mb-4 text-[clamp(36px,5vw,56px)] font-semibold leading-[1.05] tracking-[-0.025em]">{title}</h1>
      <p className="m-0 mb-8 text-[19px] text-body">{text}</p>
      <div className="flex flex-wrap gap-3">
        {children}
        <Link href="/" className={children ? btnSecondary : btnPrimary}>Go to the home page</Link>
        <Link href="/#instruments" className={btnSecondary}>Find your instrument</Link>
        <a href={APP_URL} className={btnSecondary}>Open the app</a>
      </div>
    </section>
  );
}
