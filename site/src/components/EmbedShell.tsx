import { Logo } from "./Logo";

// The frame of an embed (/embed/…): the instrument's name, who made it, the
// playable demo, and a line that says where it comes from. No site header or
// footer: it sits inside someone else's page.
export function EmbedShell({ title, maker, children, href }: { title: string; maker?: string | null; children: React.ReactNode; href: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col items-center gap-4 px-4 py-5">
      <div className="text-center">
        <h1 className="m-0 text-[22px] font-semibold leading-tight">{title}</h1>
        {maker ? <p className="m-0 mt-0.5 text-[15px] text-muted">Made by {maker}</p> : null}
      </div>
      {children}
      <a href={href} target="_blank" rel="noopener" className="mt-auto inline-flex items-center gap-2 pt-2 text-[14px] text-muted no-underline hover:text-text">
        <span>Chords and songs for this instrument on</span><Logo className="h-5" label="Oakhum" />
      </a>
    </main>
  );
}
