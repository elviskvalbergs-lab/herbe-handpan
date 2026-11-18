import { expect, it } from "vitest";
import { feedbackIssueFields } from "@/lib/jira";

const s = { project: "OAK", issueType: "Task" };

it("turns feedback into a Jira issue with the text, instrument and email", () => {
  const f = feedbackIssueFields(
    { kind: "feedback", title: "Chords didn't light up", details: "Chords didn't light up\n\non my phone", notes: "D Kurd", email: "a@b.lv" },
    s, "2026-11-18T10:00:00.000Z",
  );
  expect(f.project).toEqual({ key: "OAK" });
  expect(f.issuetype).toEqual({ name: "Task" });
  expect(f.summary).toBe("Chords didn't light up");
  expect(f.labels).toEqual(["feedback", "can-reply"]);
  const text = f.description.content.map((p) => p.content.map((t) => t.text).join("")).join("|");
  expect(text).toBe("Chords didn't light up|on my phone|Instrument: D Kurd|Email: a@b.lv|Received: 2026-11-18T10:00:00.000Z");
  // Jira refuses empty text nodes.
  expect(f.description.content.every((p) => p.content.every((t) => t.text.length > 0))).toBe(true);
});

it("marks feedback without an email as anonymous", () => {
  const f = feedbackIssueFields({ kind: "feedback", title: "Hi", details: "Hi" }, s, "x");
  expect(f.labels).toEqual(["feedback", "anonymous"]);
  expect(JSON.stringify(f.description)).toContain("not given (can't be thanked)");
});
