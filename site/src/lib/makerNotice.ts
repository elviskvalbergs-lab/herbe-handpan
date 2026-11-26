// The owner's email when a maker or shop asks for the maker role
// (docs/makers-programme.md in the repository root, "Open questions", 11).
// Pure, so it is unit-tested (tests/makerNotice.spec.ts); the route
// (src/app/api/maker-request) asks the database and sends it.
import { makerPlaceLine, makerWebsite } from "@engine/makers.js";

export type MakerNotice = { subject: string; text: string };

const line = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\r\n\t]+/g, " ").trim().slice(0, max) : "");
const block = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim().slice(0, max) : "");

/**
 * claim_maker_request_notice's answer as a plain-text email, or null when it
 * isn't one. Plain text only: nothing the maker typed can become markup.
 */
export function makerNotice(raw: unknown, origin: string): MakerNotice | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = line(r.name, 60);
  if (!name) return null;
  const kind = r.kind === "shop" ? "shop" : "maker";
  const website = makerWebsite(line(r.website, 200));
  const families = Array.isArray(r.families) ? r.families.filter((f): f is string => typeof f === "string").map((f) => f.replace("-", " ")).join(", ") : "";
  const note = block(r.request_note, 600);
  const base = origin.replace(/\/$/, "");
  const resent = r.resent === true;
  const text = [
    `${name} ${resent ? "has changed their request and sent it again" : `asks to join Oakhum as a ${kind}`}.`,
    "",
    makerPlaceLine({ kind, place: line(r.place, 80), country: line(r.country, 2) }),
    families ? `Makes or sells: ${families}` : "",
    `Website: ${website || "none given"}`,
    `Email: ${line(r.email, 200) || "not known"}`,
    `Their page would be: ${base}/makers/${line(r.slug, 40)}`,
    "",
    note ? `Their note:\n${note}` : "No note.",
    "",
    `Approve it, or say what is missing, in the app: ${base}/play#maker/review`,
    "(Settings › Makers and shops › Requests and reports, signed in with your admin account.)",
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  return { subject: `${resent ? "Maker request, sent again" : "New maker request"}: ${name}`, text };
}
