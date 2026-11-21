// A listening report: someone set up their instrument by ear, Oakhum heard it
// wrong, and they sent what it heard (and usually the recording) from the app
// (listenReportSheet in ../js/app.js). The API route (app/api/listen-report)
// keeps it in the Studio and opens a Jira issue, so it can be replayed
// (scripts/replay-listen.mjs in the repository root), fixed and answered.
//
// Pure, so it is unit-tested (tests/listenReport.spec.ts).
import { originAllowed } from "./guard";
import type { JiraSettings } from "./jira";

export type ListenReport = {
  comment: string;
  email?: string;
  where: string;
  family: string;
  mode: string;
  heard: (string | null)[];
  raw: number[];
  places?: number;
  windChart?: string;
  tuningCents: number;
  a4: number;
  matched?: { id: string; name: string };
  takes: { seconds: number; type: string }[];
  photo: boolean;
  app: string;
  host: string;
  ua: string;
  screen: string;
  lang: string;
};

export const LISTEN_REPORT_LIMITS = { files: 3, bytes: 4_400_000, comment: 2000, notes: 40 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOTE = /^[A-G][#b]?-?\d$/;
const AUDIO = /^audio\/(webm|mp4|ogg|x-m4a|aac|mpeg|wav)$/;

type Result = { ok: true; value: ListenReport } | { ok: false; error: string };

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown, lo: number, hi: number, d = 0) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : d);

/** Checks the `meta` JSON the app sends with the recording. */
export function validateListenReport(meta: unknown): Result {
  if (!meta || typeof meta !== "object") return { ok: false, error: "Something went wrong reading the report. Please try again." };
  const m = meta as Record<string, unknown>;
  const comment = str(m.comment, 10_000);
  if (comment.length > LISTEN_REPORT_LIMITS.comment) return { ok: false, error: "That's longer than we can take: shorten what was wrong." };
  const email = str(m.email);
  if (email && !EMAIL.test(email)) return { ok: false, error: "That email address doesn't look right. Check it, or leave it empty." };
  const heard = Array.isArray(m.heard) ? m.heard.slice(0, LISTEN_REPORT_LIMITS.notes).map((n) => (typeof n === "string" && NOTE.test(n) ? n : null)) : [];
  const raw = Array.isArray(m.raw) ? m.raw.slice(0, 200).filter((x): x is number => typeof x === "number" && x > 0 && x < 140) : [];
  const takes = Array.isArray(m.takes)
    ? m.takes.slice(0, LISTEN_REPORT_LIMITS.files).map((t) => ({ seconds: num((t as { seconds?: unknown })?.seconds, 0, 3600), type: str((t as { type?: unknown })?.type, 40) }))
    : [];
  const matched = m.matched && typeof m.matched === "object"
    ? { id: str((m.matched as { id?: unknown }).id, 80), name: str((m.matched as { name?: unknown }).name, 120) }
    : undefined;
  return {
    ok: true,
    value: {
      comment, email: email || undefined,
      where: str(m.where, 20) || "unknown", family: str(m.family, 20) || "unknown", mode: str(m.mode, 20) || "free",
      heard, raw,
      places: num(m.places, 1, 40) || undefined,
      windChart: str(m.windChart, 80) || undefined,
      tuningCents: num(m.tuningCents, -100, 100), a4: num(m.a4, 400, 480, 440),
      matched: matched?.id ? matched : undefined,
      takes,
      photo: m.photo === true,
      app: str(m.app, 40), host: str(m.host, 80), ua: str(m.ua, 300), screen: str(m.screen, 20), lang: str(m.lang, 20),
    },
  };
}

const PHOTO = /^image\/(jpeg|png|webp)$/;
const PHOTO_MAX = 2_500_000;

/** Checks the recordings and the photo (at most one): how many, how big,
 *  and that they are sound and a picture. */
export function checkListenFiles(files: { size: number; type: string }[], photos: { size: number; type: string }[] = []): string | null {
  if (files.length > LISTEN_REPORT_LIMITS.files) return "Too many recordings.";
  if (photos.length > 1) return "One photo is enough.";
  if ([...files, ...photos].reduce((a, f) => a + f.size, 0) > LISTEN_REPORT_LIMITS.bytes) return "The recording is too long to send. Try again with a shorter one.";
  if (files.some((f) => !AUDIO.test(f.type.split(";")[0]))) return "That isn't a recording we can take.";
  if (photos.some((f) => !PHOTO.test(f.type) || f.size > PHOTO_MAX)) return "That photo can't be sent. Try another one.";
  return null;
}

const FAMILY_WORDS: Record<string, string> = { handpan: "handpan", "tongue-drum": "tongue drum", kalimba: "kalimba", ocarina: "ocarina", flute: "flute" };

/** One line for the Studio list and the Jira summary. */
export function listenReportTitle(r: ListenReport): string {
  const what = FAMILY_WORDS[r.family] ?? r.family;
  const first = r.comment.split("\n")[0];
  const said = first ? `: ${first.length > 70 ? `${first.slice(0, 69).trimEnd()}…` : first}` : "";
  return `Listening, ${what}${said}`;
}

type AdfNode = { type: string; content?: AdfNode[]; text?: string; marks?: { type: string; attrs?: Record<string, string> }[] };
const p = (...content: AdfNode[]): AdfNode => ({ type: "paragraph", content });
const t = (text: string): AdfNode => ({ type: "text", text });
const b = (text: string): AdfNode => ({ type: "text", text, marks: [{ type: "strong" }] });
const a = (text: string, href: string): AdfNode => ({ type: "text", text, marks: [{ type: "link", attrs: { href } }] });
const row = (label: string, value: string) => p(b(`${label}: `), t(value || "–"));

/** The `fields` of the Jira issue for a report. `links` are the recordings' and the Studio's URLs. */
export function listenReportIssueFields(r: ListenReport, s: JiraSettings, links: { studio?: string; recordings: string[]; photo?: string }, receivedAt: string) {
  const content: AdfNode[] = [
    ...(r.comment ? r.comment.split("\n").map((l) => l.trimEnd()).filter(Boolean).map((l) => p(t(l))) : [p(t("(Nothing written.)"))]),
    row("Instrument", `${FAMILY_WORDS[r.family] ?? r.family} · ${r.where} · ${r.mode}${r.places ? ` · ${r.places} places` : ""}${r.windChart ? ` · ${r.windChart}` : ""}`),
    row("Heard", r.heard.map((n) => n ?? "–").join(" ")),
    row("Heard (MIDI, as measured)", r.raw.join(" ")),
    row("Tuning", r.a4 === 440 ? "A = 440 Hz" : `A = ${r.a4} Hz (${r.tuningCents} cents)`),
    row("Oakhum's match", r.matched ? `${r.matched.name} (${r.matched.id})` : "none"),
    row("Recordings", r.takes.length ? r.takes.map((k) => `${k.seconds} s ${k.type}`).join(", ") : "none sent"),
    ...links.recordings.map((u, i) => p(a(`Recording ${i + 1}`, u))),
    ...(links.photo ? [p(a("Photo of the instrument", links.photo))] : []),
    ...(links.studio ? [p(a("Open in the Studio", links.studio))] : []),
    row("Email", r.email ?? "not given (can't be told when it's fixed)"),
    row("Device", `${r.ua} · ${r.screen} · ${r.lang}`),
    row("App", `${r.app} on ${r.host}`),
    row("Received", receivedAt),
    p(t("Replay: node scripts/replay-listen.mjs <recording> --family " + r.family)),
  ];
  return {
    project: { key: s.project },
    issuetype: { name: s.issueType },
    summary: listenReportTitle(r),
    description: { type: "doc", version: 1, content },
    labels: ["listening", `family-${r.family}`, r.email ? "can-reply" : "anonymous"],
  };
}

// Where the app may send reports from: the site's own domain (no CORS needed),
// the app's own Vercel addresses and a local build (src/lib/guard.ts).
export const listenReportOriginAllowed = (origin: string | null): boolean => originAllowed(origin);
