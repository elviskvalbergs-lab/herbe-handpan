import type { QA } from "@/sanity/lib/types";

// Native <details>: works without JavaScript, keyboard and screen readers included.
export function Faq({ items }: { items: QA[] }) {
  return (
    <div className="border-t border-border">
      {items.map((q, i) => (
        <details key={i} className="group border-b border-border" open={i === 0}>
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[19px] font-semibold [&::-webkit-details-marker]:hidden">
            <span>{q.question}</span>
            <span aria-hidden="true" className="flex-none text-[26px] font-normal text-oak group-open:rotate-45 transition-transform">+</span>
          </summary>
          <p className="m-0 mb-6 max-w-[68ch] text-body">{q.answer}</p>
        </details>
      ))}
    </div>
  );
}
