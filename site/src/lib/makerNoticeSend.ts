import "server-only";
import { createJiraIssue, jiraOn, jiraSettings } from "./jiraSend";
import type { MakerNotice } from "./makerNotice";
import { CONTACT_EMAIL } from "./site";

// Sends the owner's maker-request email. Through Resend when RESEND_API_KEY
// is set in Vercel (the owner's setup is in supabase/README.md, "Makers");
// otherwise, when Jira is set up, as a Jira issue, so the request still lands
// somewhere the owner looks. Returns how it went out, or "off" when neither
// is set up (the app's Settings still shows the count).
const resendKey = process.env.RESEND_API_KEY;
const to = process.env.MAKER_NOTIFY_EMAIL || CONTACT_EMAIL;
// Resend's own sender works without a domain of our own, but only to the
// address the Resend account was made with; set MAKER_NOTIFY_FROM to an
// address on a verified domain to send anywhere.
const from = process.env.MAKER_NOTIFY_FROM || "Oakhum <onboarding@resend.dev>";

export async function sendMakerNotice(n: MakerNotice): Promise<"email" | "jira" | "off"> {
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: n.subject, text: n.text }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return "email";
    console.error(`Maker request email failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  if (jiraOn) {
    await createJiraIssue({
      project: { key: jiraSettings.project },
      issuetype: { name: jiraSettings.issueType },
      summary: n.subject,
      description: {
        type: "doc", version: 1,
        content: n.text.split("\n").filter(Boolean).map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })),
      },
      labels: ["maker-request"],
    });
    return "jira";
  }
  return "off";
}
