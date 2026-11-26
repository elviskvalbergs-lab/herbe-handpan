import "server-only";
import { feedbackIssueFields } from "./jira";
import type { RequestInput } from "./requests";

// Jira Cloud, set in Vercel's environment variables. Until all four are set,
// feedback is saved in Sanity like the other requests, and listening reports
// only in Sanity.
const base = process.env.JIRA_BASE_URL?.replace(/\/+$/, "");
const email = process.env.JIRA_EMAIL;
const token = process.env.JIRA_API_TOKEN;
const project = process.env.JIRA_FEEDBACK_PROJECT;
const issueType = process.env.JIRA_FEEDBACK_ISSUE_TYPE || "Task";

export const jiraOn = Boolean(base && email && token && project);
export const jiraSettings = { project: project ?? "", issueType };

const auth = () => `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;

/** Creates a Jira issue from its `fields`; returns its key (e.g. "OAK-12") or throws. */
export async function createJiraIssue(fields: unknown): Promise<string> {
  const res = await fetch(`${base}/rest/api/3/issue`, {
    method: "POST",
    headers: { authorization: auth(), "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Jira ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as { key: string }).key;
}

/** Attaches files to an issue (a listening report's recordings). */
export async function attachToJiraIssue(key: string, files: { name: string; type: string; data: Buffer }[]): Promise<void> {
  if (!files.length) return;
  const form = new FormData();
  for (const f of files) form.append("file", new Blob([new Uint8Array(f.data)], { type: f.type }), f.name);
  const res = await fetch(`${base}/rest/api/3/issue/${encodeURIComponent(key)}/attachments`, {
    method: "POST",
    headers: { authorization: auth(), "X-Atlassian-Token": "no-check", accept: "application/json" },
    body: form,
  });
  if (!res.ok) throw new Error(`Jira attachments ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** Creates the Jira issue for feedback from /request; returns its key or throws. */
export async function sendFeedbackToJira(v: RequestInput): Promise<string> {
  return createJiraIssue(feedbackIssueFields(v, jiraSettings, new Date().toISOString()));
}
