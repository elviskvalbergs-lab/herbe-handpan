import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HelpBody } from "@/components/HelpBody";
import { getHelpArticle, getHelpArticles, helpJsonLd, helpSections, passagesOf } from "@/lib/help";
import { btnPrimary } from "@/lib/ui";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  const list = getHelpArticles();
  return (list.length ? list : [{ id: "-" }]).map((a) => ({ slug: a.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  if (!article) return {};
  return { title: `${article.title} · Help`, description: article.summary, alternates: { canonical: `/help/${article.id}` } };
}

export default async function HelpArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  if (!article) notFound();
  const section = helpSections.find((s) => s.id === article.section);
  const all = getHelpArticles();
  const at = all.findIndex((a) => a.id === article.id);
  const prev = all[at - 1] ?? null;
  const next = all[at + 1] ?? null;
  const onPage = passagesOf(article).filter((p) => p.id);
  return (
    <article className="max-w-[760px]">
      {helpJsonLd(article).map((data, i) => (
        // "<" is escaped so no text in an article can close the script element.
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
      ))}
      <nav aria-label="Breadcrumb" className="mb-6 text-[15px] text-muted">
        <Link href="/help">Help</Link>
        {section ? <> <span aria-hidden="true">›</span> <Link href={`/help#${section.id}`}>{section.title}</Link></> : null}
      </nav>
      <h1 className="m-0 mb-4 text-[clamp(32px,5vw,46px)] font-semibold leading-[1.08] tracking-[-0.02em]">{article.title}</h1>
      <p className="m-0 mb-6 max-w-measure text-[19px] text-body">{article.summary}</p>
      {article.app ? <p className="m-0 mb-8"><a href={article.app} className={btnPrimary}>Try it in the app</a></p> : null}
      {onPage.length > 2 ? (
        <nav aria-label="On this page" className="mb-8 rounded-card border border-border px-5 py-4">
          <p className="m-0 mb-2 text-[14px] font-semibold tracking-[0.04em] text-muted uppercase">On this page</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {onPage.map((p) => <li key={p.id}><a href={`#${p.id}`}>{p.heading}</a></li>)}
          </ul>
        </nav>
      ) : null}
      <HelpBody blocks={article.blocks} />
      <p className="mt-12 mb-0 text-[15px] text-muted">
        Checked against the app on {article.verified}. Something wrong or missing? <Link href="/request?kind=feedback">Tell us</Link>.
      </p>
      <nav aria-label="Previous and next" className="mt-12 flex flex-wrap justify-between gap-4 border-t border-border pt-8">
        {prev ? <Link href={`/help/${prev.id}`} className="max-w-[45%] no-underline"><span className="block text-[14px] text-muted">Previous</span><span className="font-semibold">{prev.title}</span></Link> : <span />}
        {next ? <Link href={`/help/${next.id}`} className="ml-auto max-w-[45%] text-right no-underline"><span className="block text-[14px] text-muted">Next</span><span className="font-semibold">{next.title}</span></Link> : null}
      </nav>
    </article>
  );
}
