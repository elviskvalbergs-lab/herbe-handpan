import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HelpBody } from "@/components/HelpBody";
import { getHelpArticle, getHelpArticles, helpJsonLd, helpSections } from "@/lib/help";
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
  const related = getHelpArticles().filter((a) => a.section === article.section && a.id !== article.id);
  return (
    <article className="mx-auto max-w-[760px] px-4 pt-10 pb-24 sm:px-8">
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
      <HelpBody blocks={article.blocks} />
      <p className="mt-12 mb-0 text-[15px] text-muted">
        Checked against the app on {article.verified}. Something wrong or missing? <Link href="/request?kind=feedback">Tell us</Link>.
      </p>
      {related.length ? (
        <aside className="mt-12 border-t border-border pt-8">
          <h2 className="m-0 mb-4 text-[21px] font-semibold">{section?.title ?? "More help"}</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {related.map((a) => <li key={a.id}><Link href={`/help/${a.id}`}>{a.title}</Link></li>)}
          </ul>
        </aside>
      ) : null}
    </article>
  );
}
