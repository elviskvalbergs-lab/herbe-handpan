import "server-only";
import { feedbackIssueFields } from "./jira";
import type { RequestInput } from "./requests";

// Jira Cloud, set in Vercel's environment variables. Until all four are set,
// feedback is saved in Sanity like the other requests.
const base = process.env.JIRA_BASE_URL?.replace(/\/+$/, "");
const email = process.env.JIRA_EMAIL;
const token = process.env.JIRA_API_TOKEN;
const project = process.env.JIRA_FEEDBACK_PROJECT;
const issueType = process.env.JIRA_FEEDBACK_ISSUE_TYPE || "Task";

export const jiraOn = Boolean(base && email && token && project);

/** Creates the Jira issue; returns its key (e.g. "OAK-12") or throws. */
export async function sendFeedbackToJira(v: RequestInput): Promise<string> {
  const res = await fetch(`${base}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ fields: feedbackIssueFields(v, { project: project!, issueType }, new Date().toISOString()) }),
  });
  if (!res.ok) throw new Error(`Jira ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as { key: string }).key;
}
