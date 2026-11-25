import { NextResponse } from "next/server";
import { supabasePublic } from "@engine/auth.js";
import { makerNotice } from "@/lib/makerNotice";
import { sendMakerNotice } from "@/lib/makerNoticeSend";
import { SITE_URL } from "@/lib/site";

// The app calls this right after a maker sends their request (js/makers-ui.js),
// with the maker's own sign-in. The database says whether there is a pending
// request the owner hasn't been told about yet (claim_maker_request_notice,
// supabase/migrations/20261124_maker_request_notice.sql), and marks it told,
// so each request sends one email at most and nobody else can cause one.
export async function POST(req: Request) {
  const token = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const pub = supabasePublic();
  const base = process.env.HP_SUPABASE_URL || pub.url;
  const key = process.env.HP_SUPABASE_KEY || pub.key;
  let claimed: unknown = null;
  try {
    const res = await fetch(`${base}/rest/v1/rpc/claim_maker_request_notice`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.status === 403) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    if (!res.ok) return NextResponse.json({ error: "The request couldn't be checked." }, { status: 502 });
    claimed = await res.json();
  } catch {
    return NextResponse.json({ error: "The request couldn't be checked." }, { status: 502 });
  }
  const notice = makerNotice(claimed, SITE_URL);
  if (!notice) return NextResponse.json({ sent: false });
  try {
    const via = await sendMakerNotice(notice);
    if (via === "off") console.warn("A maker request came in, but neither RESEND_API_KEY nor Jira is set up: see supabase/README.md, Makers.");
    return NextResponse.json({ sent: via !== "off", via });
  } catch (e) {
    console.error("Maker request notice failed", e);
    return NextResponse.json({ sent: false }, { status: 502 });
  }
}
