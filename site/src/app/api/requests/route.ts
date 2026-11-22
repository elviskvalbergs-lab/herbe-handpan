import { NextResponse } from "next/server";
import { clientIp, createRateLimiter, NOT_FROM_HERE, originAllowed, TOO_MANY } from "@/lib/guard";
import { validateRequest } from "@/lib/requests";
import { jiraOn, sendFeedbackToJira } from "@/lib/jiraSend";
import { writeClient } from "@/sanity/lib/writeClient";

// Five requests in ten minutes from one address is plenty for a person.
const limiter = createRateLimiter(5, 10 * 60_000);
// The form's fields add up to under 3 KB; anything much bigger isn't the form.
const MAX_BYTES = 16_000;

// A new request from /request. Saved hidden (public: false): the owner decides
// in the Studio which requests show in the public list. The email is stored
// only to say when the request is ready.
export async function POST(req: Request) {
  if (!originAllowed(req.headers.get("origin"), req.headers.get("host"))) return NextResponse.json({ error: NOT_FROM_HERE }, { status: 403 });
  const rate = limiter.hit(clientIp(req.headers));
  if (!rate.ok) return NextResponse.json({ error: TOO_MANY }, { status: 429, headers: { "retry-after": String(rate.retryAfter) } });
  let body: unknown = null;
  try {
    const text = await req.text();
    if (text.length > MAX_BYTES) return NextResponse.json({ error: "That's longer than we can take. Please shorten it." }, { status: 413 });
    body = JSON.parse(text);
  } catch { body = null; }
  const check = validateRequest(body);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  // Feedback goes to Jira when it's set up (src/lib/jira.ts), so it can be sorted
  // and answered there. If Jira fails, it falls back to Sanity so nothing is lost.
  if (check.value.kind === "feedback" && jiraOn) {
    try {
      await sendFeedbackToJira(check.value);
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error("Feedback to Jira failed, saving it in Sanity instead", e);
    }
  }
  if (!writeClient) {
    return NextResponse.json({ error: "Requests can't be saved yet. Please email oakhummusic@gmail.com instead." }, { status: 503 });
  }
  const v = check.value;
  try {
    await writeClient.create({
      _type: "request", kind: v.kind, title: v.title, notes: v.notes, details: v.details, email: v.email,
      votes: 1, public: false, status: "new", createdAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "We couldn't save your request just now. Please try again in a minute." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
