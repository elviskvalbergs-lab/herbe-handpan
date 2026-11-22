import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { EmbedCount } from "@/components/EmbedCount";
import { EmbedShell } from "@/components/EmbedShell";
import { HandpanDemo } from "@/components/HandpanDemo";
import { isPanFamily } from "@/lib/engine";
import { getEmbed, publicApi } from "@/lib/makers";
import { instrumentPicture } from "@/lib/pictures";
import { btnPrimary } from "@/lib/ui";

// A maker's instrument, playable, to put on their own shop page in an
// <iframe> (docs/makers-programme.md in the repository root, "Embed"). It is
// the site's own demo (HandpanDemo) drawn from the instrument's saved notes,
// without the site around it. An open counts for the maker as "On your
// website".
type Props = { params: Promise<{ code: string }> };

export const metadata: Metadata = { robots: { index: false, follow: false } };

export async function generateStaticParams() {
  return [{ code: "-" }];
}

export default async function EmbedCodePage({ params }: Props) {
  const { code } = await params;
  const inst = await getEmbed(code);
  if (!inst) notFound();
  const open = `/s/${inst.code}?via=embed`;
  const pan = isPanFamily(inst.family) ? inst.family : null;
  const brand = instrumentPicture(inst.family);
  return (
    <EmbedShell title={inst.name} maker={inst.maker?.name} href={open}>
      <EmbedCount code={inst.code} api={publicApi()} />
      {pan && inst.layout ? (
        <HandpanDemo slug={inst.name} layout={inst.layout} family={pan} chords={inst.chords}
          cta={{ href: open, label: "Play it in Oakhum", newTab: true }} />
      ) : (
        <>
          {brand ? <Image src={brand} alt="" width={512} height={512} className="h-auto w-full max-w-[240px]" /> : null}
          <a href={open} target="_blank" rel="noopener" className={btnPrimary}>Play it in Oakhum</a>
        </>
      )}
    </EmbedShell>
  );
}
