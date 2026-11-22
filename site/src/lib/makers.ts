// Makers and shops on the website (docs/makers-programme.md in the repository
// root). A maker's profile and instruments are the maker's own data: they
// edit them in the app, and they are read here from the app's database
// through its public functions (supabase/migrations/20261121_makers.sql):
// list_makers, get_maker, open_shared_instrument. Never from Sanity.
//
// Everything that comes back is treated as untrusted: only known fields are
// kept, the website must be https, the logo a small raster picture, and a
// layout passes the engine's safeLayout before it is drawn.
import { cacheLife } from "next/cache";
import { supabasePublic } from "@engine/auth.js";
import { makerWebsite, makerWebsiteLabel, makerLogoOk, makerPlaceLine, makerInitials, MAKER_FAMILIES } from "@engine/makers.js";
import { type Family, type PanFamily, isPanFamily, layoutPicture, layoutNotes, findTuningById } from "./engine";

export type MakerCard = {
  slug: string;
  name: string;
  kind: "maker" | "shop";
  /** "Maker · Cēsis, Latvia" */
  line: string;
  families: Family[];
  /** A data: URL of a small PNG, JPEG or WebP, or "". */
  logo: string;
  initials: string;
  instruments: number;
};

export type MakerInstrument = {
  code: string;
  name: string;
  family: Family;
  /** The app's link for it: /s/CODE. */
  path: string;
  /** Its tuning page on this site, when it is one of the catalogue's scales. */
  tuningPath: string | null;
  /** The app's drawing of it (handpan, tongue drum, kalimba), or null. */
  picture: string | null;
  /** Its notes, low to high, for the line under the name. */
  notes: string[];
};

export type Maker = Omit<MakerCard, "instruments"> & {
  website: string;
  websiteLabel: string;
  story: string;
  storyLang: string;
  instruments: MakerInstrument[];
};

const FAMILY_IDS = MAKER_FAMILIES.map((f: { id: string }) => f.id) as Family[];
const SLUG = /^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$/;
const CODE = /^[A-HJKMNP-Z2-9]{6}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** What "they make" reads as: "handpans and kalimbas". */
export function familiesLine(families: Family[]): string {
  const words = families.map((f) => MAKER_FAMILIES.find((x: { id: string }) => x.id === f)?.label.toLowerCase()).filter(Boolean) as string[];
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function cleanBase(raw: unknown): Omit<MakerCard, "instruments"> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const slug = str(r.slug, 40), name = str(r.name, 60);
  if (!SLUG.test(slug) || name.length < 2) return null;
  const kind = r.kind === "shop" ? "shop" : "maker";
  const families = (Array.isArray(r.families) ? r.families : []).filter((f): f is Family => FAMILY_IDS.includes(f as Family));
  const logo = typeof r.logo === "string" && makerLogoOk(r.logo) ? r.logo : "";
  return { slug, name, kind, line: makerPlaceLine({ kind, place: str(r.place, 80), country: str(r.country, 2) }), families, logo, initials: makerInitials(name) };
}

/** list_makers' answer, cleaned: the directory. */
export function cleanMakerList(raw: unknown): MakerCard[] {
  if (!Array.isArray(raw)) return [];
  const out: MakerCard[] = [];
  for (const item of raw) {
    const base = cleanBase(item);
    if (base) out.push({ ...base, instruments: Math.max(0, Math.min(9999, Number((item as { instruments?: unknown }).instruments) || 0)) });
  }
  return out;
}

/** One instrument of get_maker's list, with the data open_shared_instrument gave for its code (or null). */
export function cleanMakerInstrument(raw: unknown, data: unknown): MakerInstrument | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const code = str(r.code, 6).toUpperCase(), name = str(r.name, 80);
  if (!CODE.test(code) || !name) return null;
  const family: Family = FAMILY_IDS.includes(r.family as Family) ? (r.family as Family) : "handpan";
  const layout = data && typeof data === "object" ? (data as { layout?: unknown }).layout : null;
  const pan: PanFamily | null = isPanFamily(family) ? family : null;
  const tuning = pan && typeof r.scale === "string" ? findTuningById(pan, r.scale) : null;
  return {
    code, name, family, path: `/s/${code}`,
    tuningPath: tuning ? `/instruments/${tuning.instrumentSlug}/${tuning.slug}` : null,
    picture: pan && layout ? layoutPicture(layout, pan, name) : null,
    notes: pan && layout ? layoutNotes(layout) : [],
  };
}

/** get_maker's answer, cleaned (instruments are added by getMaker). */
export function cleanMaker(raw: unknown): Omit<Maker, "instruments"> | null {
  const base = cleanBase(raw);
  if (!base) return null;
  const r = raw as Record<string, unknown>;
  const website = makerWebsite(str(r.website, 200));
  return { ...base, website, websiteLabel: makerWebsiteLabel(website), story: str(r.story, 1200), storyLang: /^[a-z]{2}$/.test(str(r.story_lang, 2)) ? str(r.story_lang, 2) : "" };
}

// ── Reading the app's database ───────────────────────────────────────────────
// The project's public address and key (the same the app's page carries);
// a preview build can point at the test project (supabase/README.md).
async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const pub = supabasePublic();
  const base = process.env.HP_SUPABASE_URL || pub.url;
  const key = process.env.HP_SUPABASE_KEY || pub.key;
  try {
    const res = await fetch(`${base}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null; // offline, or before the migration: the pages show no makers
  }
}

const MAX_INSTRUMENTS = 60;

/** The directory: approved makers who chose to be listed. Refreshed about hourly. */
export async function listMakers(): Promise<MakerCard[]> {
  "use cache";
  cacheLife("hours");
  return cleanMakerList(await rpc("list_makers", {}));
}

/** One approved maker's page, or null. Refreshed about hourly. */
export async function getMaker(slug: string): Promise<Maker | null> {
  "use cache";
  cacheLife("hours");
  if (!SLUG.test(slug)) return null;
  const raw = await rpc("get_maker", { p_slug: slug });
  const maker = cleanMaker(raw);
  if (!maker) return null;
  const list = Array.isArray((raw as { instruments?: unknown }).instruments) ? ((raw as { instruments: unknown[] }).instruments).slice(0, MAX_INSTRUMENTS) : [];
  const instruments = (await Promise.all(list.map(async (item) => {
    const code = str((item as { code?: unknown })?.code, 6);
    const opened = CODE.test(code) ? await rpc("open_shared_instrument", { p_code: code }) : null;
    return cleanMakerInstrument(item, (opened as { data?: unknown } | null)?.data ?? null);
  }))).filter((i): i is MakerInstrument => !!i);
  return { ...maker, instruments };
}
