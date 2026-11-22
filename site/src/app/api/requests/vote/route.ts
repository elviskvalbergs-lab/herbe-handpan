import { NextResponse } from "next/server";
import { clientIp, createRateLimiter, NOT_FROM_HERE, originAllowed, TOO_MANY } from "@/lib/guard";
import { writeClient } from "@/sanity/lib/writeClient";

// The list shows twelve requests, so thirty votes in ten minutes covers
// anyone voting by hand; one address votes once a day for the same request.
const limiter = createRateLimiter(30, 10 * 60_000);
const oncePerRequest = createRateLimiter(1, 24 * 60 * 60_000);

// One vote for a public request. The page remembers what this browser voted
// for, so a vote can't be repeated by tapping again; the limits above stop a
// script doing it instead.
export async function POST(req: Request) {
  if (!originAllowed(req.headers.get("origin"), req.headers.get("host"))) return NextResponse.json({ error: NOT_FROM_HERE }, { status: 403 });
  const ip = clientIp(req.headers);
  const rate = limiter.hit(ip);
  if (!rate.ok) return NextResponse.json({ error: TOO_MANY }, { status: 429, headers: { "retry-after": String(rate.retryAfter) } });
  let id = "";
  try { id = String(JSON.parse((await req.text()).slice(0, 400))?.id ?? ""); } catch { /* empty */ }
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(id) || id.startsWith("drafts.")) return NextResponse.json({ error: "Unknown request." }, { status: 400 });
  if (!writeClient) return NextResponse.json({ error: "Voting isn't open yet." }, { status: 503 });
  try {
    const doc = await writeClient.fetch<{ public?: boolean } | null>(`*[_id == $id && _type == "request"][0]{public}`, { id });
    if (!doc?.public) return NextResponse.json({ error: "Unknown request." }, { status: 404 });
    if (!oncePerRequest.hit(`${ip} ${id}`).ok) return NextResponse.json({ error: "You've already voted for this one." }, { status: 429 });
    const updated = await writeClient.patch(id).setIfMissing({ votes: 0 }).inc({ votes: 1 }).commit<{ votes: number }>();
    return NextResponse.json({ votes: updated.votes });
  } catch (e) {
    console.error("Vote: Sanity failed", e);
    return NextResponse.json({ error: "Your vote didn't go through. Please try again in a minute." }, { status: 502 });
  }
}
