import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { clientIp, createRateLimiter, NOT_FROM_HERE, originAllowed, TOO_MANY } from "@/lib/guard";
import { SITE_URL } from "@/lib/site";
import { checkListenFiles, LISTEN_REPORT_LIMITS, listenReportIssueFields, listenReportOriginAllowed, listenReportTitle, validateListenReport } from "@/lib/listenReport";
import { attachToJiraIssue, createJiraIssue, jiraOn, jiraSettings } from "@/lib/jiraSend";
import { writeClient } from "@/sanity/lib/writeClient";

// A listening report from the app (src/lib/listenReport.ts): kept in the Studio
// with its recordings and the photo of the instrument, if any, and opened as a Jira issue when Jira is set up. The app
// on oakhum.com/play posts here on the same origin; its own Vercel addresses
// and a local build post across origins, so they get CORS headers.
// A report is sent by hand after a failed setup: five in ten minutes is generous.
const limiter = createRateLimiter(5, 10 * 60_000);
// The files' limit plus room for the form's own framing and the meta JSON.
const MAX_BODY = LISTEN_REPORT_LIMITS.bytes + 100_000;

function cors(origin: string | null): Record<string, string> {
  return listenReportOriginAllowed(origin)
    ? { "access-control-allow-origin": origin!, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" }
    : {};
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cors(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const headers = cors(req.headers.get("origin"));
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });
  // Only from Oakhum's own pages (the app on this domain, its Vercel addresses, a local build).
  if (!originAllowed(req.headers.get("origin"), req.headers.get("host"))) return fail(NOT_FROM_HERE, 403);
  const rate = limiter.hit(clientIp(req.headers));
  if (!rate.ok) return NextResponse.json({ error: TOO_MANY }, { status: 429, headers: { ...headers, "retry-after": String(rate.retryAfter) } });
  // Refused before the upload is read into memory.
  const length = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(length) && length > MAX_BODY) return fail("The recording is too long to send. Try again with a shorter one.", 413);
  let form: FormData;
  try { form = await req.formData(); } catch { return fail("Something went wrong reading the report. Please try again.", 400); }
  let meta: unknown = null;
  try { meta = JSON.parse(String(form.get("meta") ?? "")); } catch { /* checked below */ }
  const check = validateListenReport(meta);
  if (!check.ok) return fail(check.error, 400);
  const files = form.getAll("audio").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  const photos = form.getAll("photo").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  const bad = checkListenFiles(files, photos);
  if (bad) return fail(bad, 400);
  if (!writeClient) return fail("Reports can't be saved yet. Please email oakhummusic@gmail.com instead.", 503);

  const r = check.value;
  const id = `listenReports.${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const data = await Promise.all(files.map(async (f, i) => ({ name: f.name || `take-${i + 1}`, type: f.type.split(";")[0], data: Buffer.from(await f.arrayBuffer()) })));
  const photo = photos[0] ? { name: "instrument.jpg", type: photos[0].type, data: Buffer.from(await photos[0].arrayBuffer()) } : null;
  let assets: { _id: string; url: string }[];
  let photoAsset: { _id: string; url: string } | null = null;
  try {
    assets = await Promise.all(data.map((f) => writeClient!.assets.upload("file", f.data, { filename: f.name, contentType: f.type })));
    if (photo) photoAsset = await writeClient.assets.upload("image", photo.data, { filename: photo.name, contentType: photo.type });
    await writeClient.create({
      _id: id, _type: "listenReport", status: "new", title: listenReportTitle(r), comment: r.comment, email: r.email,
      recordings: assets.map((a, i) => ({ _type: "file", _key: `take${i + 1}`, asset: { _type: "reference", _ref: a._id } })),
      ...(photoAsset ? { photo: { _type: "image", asset: { _type: "reference", _ref: photoAsset._id } } } : {}),
      family: r.family, heard: r.heard.map((n) => n ?? "–").join(" "), matched: r.matched ? `${r.matched.name} (${r.matched.id})` : undefined,
      a4: r.a4, meta: JSON.stringify(r, null, 2), createdAt,
    });
  } catch (e) {
    console.error("Listening report: saving in Sanity failed", e);
    return fail("We couldn't save your report just now. Please try again in a minute.", 502);
  }

  // Jira is the to-do list; the report is already safe in Sanity if this fails.
  if (jiraOn) {
    try {
      const studio = `${SITE_URL}/studio/structure/listenReports;${id}`;
      const key = await createJiraIssue(listenReportIssueFields(r, jiraSettings, { studio, recordings: assets.map((a) => a.url), photo: photoAsset?.url }, createdAt));
      await writeClient.patch(id).set({ jiraKey: key }).commit();
      await attachToJiraIssue(key, photo ? [...data, photo] : data).catch((e) => console.error("Listening report: attaching the recording to Jira failed", e));
    } catch (e) {
      console.error("Listening report: Jira failed (kept in Sanity)", e);
    }
  }
  return NextResponse.json({ ok: true, ref: id.slice(-6) }, { headers });
}
