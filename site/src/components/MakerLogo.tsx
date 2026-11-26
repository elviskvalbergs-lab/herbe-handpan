import type { MakerCard } from "@/lib/makers";

// A maker's logo, or their initials on a tile. The logo is a small picture
// the maker uploaded in the app (a data: URL the database has checked), so
// it is a plain <img>, not next/image.
export function MakerLogo({ maker, size = 56 }: { maker: Pick<MakerCard, "logo" | "initials">; size?: number }) {
  const box = { width: size, height: size };
  return maker.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={maker.logo} alt="" style={box} className="shrink-0 rounded-tile bg-surface object-cover shadow-[inset_0_0_0_1px_var(--border)]" />
  ) : (
    <span aria-hidden="true" style={{ ...box, fontSize: Math.round(size * 0.36) }}
      className="grid shrink-0 place-items-center rounded-tile bg-band font-semibold text-text">{maker.initials}</span>
  );
}
