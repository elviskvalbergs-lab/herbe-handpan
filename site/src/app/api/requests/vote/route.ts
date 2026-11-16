import { NextResponse } from "next/server";
import { writeClient } from "@/sanity/lib/writeClient";

// One vote for a public request. The page remembers what this browser voted
// for, so a vote can't be repeated by tapping again.
export async function POST(req: Request) {
  let id = "";
  try { id = String((await req.json())?.id ?? ""); } catch { /* empty */ }
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(id) || id.startsWith("drafts.")) return NextResponse.json({ error: "Unknown request." }, { status: 400 });
  if (!writeClient) return NextResponse.json({ error: "Voting isn't open yet." }, { status: 503 });
  const doc = await writeClient.fetch<{ public?: boolean } | null>(`*[_id == $id && _type == "request"][0]{public}`, { id });
  if (!doc?.public) return NextResponse.json({ error: "Unknown request." }, { status: 404 });
  const updated = await writeClient.patch(id).setIfMissing({ votes: 0 }).inc({ votes: 1 }).commit<{ votes: number }>();
  return NextResponse.json({ votes: updated.votes });
}
