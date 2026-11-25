import { HelpNav } from "@/components/HelpNav";
import { getHelpArticles, helpSections } from "@/lib/help";
import { container } from "@/lib/ui";

// The help centre as a wiki: every page has the contents beside it (a fold
// on phones), built from the same articles as the pages (../help/en).
export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const articles = getHelpArticles();
  const sections = helpSections
    .map((s) => ({ ...s, articles: articles.filter((a) => a.section === s.id).map((a) => ({ id: a.id, title: a.title })) }))
    .filter((s) => s.articles.length);
  return (
    <div className={`${container} pt-10 pb-24 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14`}>
      <aside>
        <HelpNav sections={sections} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
