// Feedback from /request goes to a Jira project, where the owner (and Claude,
// through the Atlassian connector) sorts it, links it to the fix and thanks the
// person when it's done. Instrument and feature requests stay in Sanity: they
// make the public list people vote on.
//
// Pure, so it is unit-tested (tests/jira.spec.ts). The API route does the
// sending (src/lib/jiraSend.ts), only when the JIRA_* variables are set.
import type { RequestInput } from "./requests";

export type JiraSettings = { project: string; issueType: string };

type AdfText = { type: "text"; text: string; marks?: { type: "strong" }[] };
type AdfParagraph = { type: "paragraph"; content: AdfText[] };

// Jira's rich text (ADF). A paragraph per line; an empty line is skipped
// because Jira refuses empty text nodes.
function paragraphs(text: string): AdfParagraph[] {
  return text.split("\n").map((l) => l.trimEnd()).filter(Boolean).map((l) => ({ type: "paragraph", content: [{ type: "text", text: l }] }));
}
const labelled = (label: string, value: string): AdfParagraph => ({
  type: "paragraph",
  content: [{ type: "text", text: `${label}: `, marks: [{ type: "strong" }] }, { type: "text", text: value }],
});

/** The `fields` of a Jira "create issue" call for one piece of feedback. */
export function feedbackIssueFields(v: RequestInput, s: JiraSettings, receivedAt: string) {
  const content: AdfParagraph[] = [
    ...paragraphs(v.details ?? v.title),
    labelled("Instrument", v.notes ?? "not given"),
    labelled("Email", v.email ?? "not given (can't be thanked)"),
    labelled("Received", receivedAt),
  ];
  return {
    project: { key: s.project },
    issuetype: { name: s.issueType },
    summary: v.title,
    description: { type: "doc", version: 1, content },
    labels: ["feedback", v.email ? "can-reply" : "anonymous"],
  };
}
