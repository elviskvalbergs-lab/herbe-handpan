import Link from "next/link";
import { APP_URL } from "@/lib/site";
import { container } from "@/lib/ui";
import type { SiteSettings } from "@/sanity/lib/types";
import { Logo } from "./Logo";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="bg-band">
      <div className={`${container} flex flex-wrap justify-between gap-12 py-16`}>
        <div className="max-w-[560px] flex-[1_1_420px]">
          <Logo className="mb-5 h-9 text-oak" label="Oakhum" />
          {settings.storyTitle ? <p className="m-0 mb-2 text-[21px] font-semibold">{settings.storyTitle}</p> : null}
          {settings.story ? <p className="m-0 text-body">{settings.story}</p> : null}
        </div>
        <div className="flex flex-wrap gap-12">
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            <li><Link href="/#instruments">Instruments</Link></li>
            <li><Link href="/#how">How it works</Link></li>
            <li><Link href="/#faq">Questions</Link></li>
            <li><a href={APP_URL}>Open the app</a></li>
          </ul>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            <li><Link href="/request">Request an instrument</Link></li>
            <li><Link href="/request?kind=feature">Suggest a feature</Link></li>
            <li><Link href="/privacy">Privacy</Link></li>
            <li><a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
