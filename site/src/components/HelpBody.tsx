import Image from "next/image";
import Link from "next/link";
import type { HelpBlock, HelpInline } from "@/lib/help";

function Inline({ parts }: { parts: HelpInline[] }) {
  return (
    <>
      {parts.map((p, i) => {
        // A name from the app's feature registry reads as the label it is.
        if (p.t === "bold" || p.t === "label") return <strong key={i} className="font-semibold text-text">{p.v}</strong>;
        if (p.t === "link") return <Link key={i} href={p.href}>{p.v}</Link>;
        return <span key={i}>{p.v}</span>;
      })}
    </>
  );
}

/** A help article's body. The same blocks the app's help sheet shows (../js/helpdoc.js). */
export function HelpBody({ blocks }: { blocks: HelpBlock[] }) {
  return (
    <div className="max-w-measure text-body">
      {blocks.map((b, i) => {
        if (b.t === "h2") {
          return (
            <h2 key={i} id={b.id} className="group mt-12 mb-3 scroll-mt-6 text-[26px] font-semibold leading-tight text-text">
              <Inline parts={b.parts} />{" "}
              <a href={`#${b.id}`} aria-label="Link to this answer" className="text-muted no-underline opacity-0 focus:opacity-100 group-hover:opacity-100">#</a>
            </h2>
          );
        }
        if (b.t === "h3") return <h3 key={i} className="mt-8 mb-2 text-[20px] font-semibold text-text"><Inline parts={b.parts} /></h3>;
        if (b.t === "note") return <p key={i} className="my-5 rounded-tile bg-surface px-5 py-4"><Inline parts={b.parts} /></p>;
        if (b.t === "list") {
          const List = b.ordered ? "ol" : "ul";
          return (
            <List key={i} className={`my-4 flex flex-col gap-2 pl-6 ${b.ordered ? "list-decimal" : "list-disc"}`}>
              {b.items.map((it, j) => <li key={j}><Inline parts={it} /></li>)}
            </List>
          );
        }
        if (b.t === "img") {
          return (
            <figure key={i} className="my-8 mx-0">
              <Image src={`/help/img/${b.name}.jpg`} alt={b.alt} width={390} height={760} className="h-auto w-full max-w-[300px] rounded-card border border-border" />
              <figcaption className="mt-2 text-[15px] text-muted">{b.alt}</figcaption>
            </figure>
          );
        }
        return <p key={i} className="my-4"><Inline parts={b.parts} /></p>;
      })}
    </div>
  );
}
