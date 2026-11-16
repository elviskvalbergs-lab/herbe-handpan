import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortableText, stegaClean } from "next-sanity";
import { getPage, getPageSlugs } from "@/sanity/lib/data";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await getPageSlugs();
  return (slugs.length ? slugs : ["-"]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return {};
  return { title: stegaClean(page.seo?.title) || stegaClean(page.title), description: stegaClean(page.seo?.description) || undefined };
}

export default async function TextPage({ params }: Props) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();
  return (
    <article className="mx-auto max-w-[760px] px-4 pt-14 pb-24 sm:px-8">
      <h1 className="m-0 mb-3 text-[clamp(36px,5vw,52px)] font-semibold leading-[1.05] tracking-[-0.02em]">{page.title}</h1>
      {page.updated ? <p className="m-0 mb-10 text-[15px] text-muted">Updated {page.updated}</p> : null}
      <div className="max-w-measure text-body [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-[26px] [&_h2]:font-semibold [&_h2]:text-text [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-[20px] [&_h3]:font-semibold [&_h3]:text-text [&_p]:my-4 [&_ul]:pl-6 [&_ol]:pl-6">
        <PortableText value={page.body as never} />
      </div>
    </article>
  );
}
