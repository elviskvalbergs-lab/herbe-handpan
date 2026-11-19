import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { checkListenFiles, listenReportIssueFields, listenReportOriginAllowed, listenReportTitle, validateListenReport } from "@/lib/listenReport";
import { attachToJiraIssue, createJiraIssue, jiraOn, jiraSettings } from "@/lib/jiraSend";
import { writeClient } from "@/sanity/lib/writeClient";

// A listening report from the app (src/lib/listenReport.ts): kept in the Studio
// with its recordings, and opened as a Jira issue when Jira is set up. The app
// on oakhum.com/play posts here on the same origin; its own Vercel addresses
// and a local build post across origins, so they get CORS headers.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oakhum.com";

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
  let form: FormData;
  try { form = await req.formData(); } catch { return fail("Something went wrong reading the report. Please try again.", 400); }
  let meta: unknown = null;
  try { meta = JSON.parse(String(form.get("meta") ?? "")); } catch { /* checked below */ }
  const check = validateListenReport(meta);
  if (!check.ok) return fail(check.error, 400);
  const files = form.getAll("audio").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  const bad = checkListenFiles(files);
  if (bad) return fail(bad, 400);
  if (!writeClient) return fail("Reports can't be saved yet. Please email oakhummusic@gmail.com instead.", 503);

  const r = check.value;
  const id = `listenReports.${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const data = await Promise.all(files.map(async (f, i) => ({ name: f.name || `take-${i + 1}`, type: f.type.split(";")[0], data: Buffer.from(await f.arrayBuffer()) })));
  let assets: { _id: string; url: string }[];
  try {
    assets = await Promise.all(data.map((f) => writeClient!.assets.upload("file", f.data, { filename: f.name, contentType: f.type })));
    await writeClient.create({
      _id: id, _type: "listenReport", status: "new", title: listenReportTitle(r), comment: r.comment, email: r.email,
      recordings: assets.map((a, i) => ({ _type: "file", _key: `take${i + 1}`, asset: { _type: "reference", _ref: a._id } })),
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
      const studio = `${SITE}/studio/structure/listenReports;${id}`;
      const key = await createJiraIssue(listenReportIssueFields(r, jiraSettings, { studio, recordings: assets.map((a) => a.url) }, createdAt));
      await writeClient.patch(id).set({ jiraKey: key }).commit();
      await attachToJiraIssue(key, data).catch((e) => console.error("Listening report: attaching the recording to Jira failed", e));
    } catch (e) {
      console.error("Listening report: Jira failed (kept in Sanity)", e);
    }
  }
  return NextResponse.json({ ok: true, ref: id.slice(-6) }, { headers });
}
