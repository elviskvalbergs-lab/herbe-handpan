import { NextResponse } from "next/server";
import { validateRequest } from "@/lib/requests";
import { writeClient } from "@/sanity/lib/writeClient";

// A new request from /request. Saved hidden (public: false): the owner decides
// in the Studio which requests show in the public list. The email is stored
// only to say when the request is ready.
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { body = null; }
  const check = validateRequest(body);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
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
