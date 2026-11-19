import { expect, it } from "vitest";
import { checkListenFiles, listenReportIssueFields, listenReportOriginAllowed, listenReportTitle, validateListenReport } from "@/lib/listenReport";

const meta = {
  where: "setup", family: "tongue-drum", mode: "guided", heard: ["C4", "D4", null, "F4"], raw: [59.38, 61.66, 64.69],
  places: 8, tuningCents: -33, a4: 432, matched: { id: "TD-c-major-11", name: "C Major (11)" },
  comment: "It didn't hear my lowest note\nMine has 8 notes", email: "a@b.lv",
  takes: [{ seconds: 42, type: "audio/webm" }], app: "abc123", host: "oakhum.com", ua: "Mozilla/5.0", screen: "390x844", lang: "lv-LV",
};

it("takes what the app sends and drops what isn't a note", () => {
  const c = validateListenReport({ ...meta, heard: ["C4", "<script>", 7, "Bb3"] });
  expect(c.ok).toBe(true);
  if (!c.ok) return;
  expect(c.value.heard).toEqual(["C4", null, null, "Bb3"]);
  expect(c.value.a4).toBe(432);
  expect(c.value.matched).toEqual({ id: "TD-c-major-11", name: "C Major (11)" });
});

it("refuses a bad email and a very long comment", () => {
  expect(validateListenReport({ ...meta, email: "nope" }).ok).toBe(false);
  expect(validateListenReport({ ...meta, comment: "x".repeat(2001) }).ok).toBe(false);
  expect(validateListenReport(null).ok).toBe(false);
});

it("takes up to three recordings of sound, within the size limit", () => {
  expect(checkListenFiles([{ size: 700_000, type: "audio/webm;codecs=opus" }, { size: 500_000, type: "audio/mp4" }])).toBeNull();
  expect(checkListenFiles([{ size: 5_000_000, type: "audio/webm" }])).toMatch(/too long/);
  expect(checkListenFiles([{ size: 10, type: "image/png" }])).toMatch(/isn't a recording/);
  expect(checkListenFiles(Array(4).fill({ size: 10, type: "audio/webm" }))).toMatch(/Too many/);
});

it("opens a Jira issue with what was heard, the links and how to replay it", () => {
  const c = validateListenReport(meta);
  if (!c.ok) throw new Error("invalid");
  expect(listenReportTitle(c.value)).toBe("Listening, tongue drum: It didn't hear my lowest note");
  const f = listenReportIssueFields(c.value, { project: "OAK", issueType: "Task" }, { studio: "https://oakhum.com/studio/x", recordings: ["https://cdn.sanity.io/files/a.webm"] }, "2026-11-19T10:00:00Z");
  expect(f.labels).toEqual(["listening", "family-tongue-drum", "can-reply"]);
  const text = JSON.stringify(f.description);
  for (const s of ["C4 D4 – F4", "A = 432 Hz (-33 cents)", "C Major (11)", "https://cdn.sanity.io/files/a.webm", "replay-listen.mjs"]) expect(text).toContain(s);
  // Jira refuses empty text nodes.
  expect(text).not.toContain('"text":""');
});

it("lets the app post from its own addresses only", () => {
  expect(listenReportOriginAllowed("https://oakhum.com")).toBe(true);
  expect(listenReportOriginAllowed("https://oakhum.vercel.app")).toBe(true);
  expect(listenReportOriginAllowed("https://herbe-handpan-git-x-team.vercel.app")).toBe(true);
  expect(listenReportOriginAllowed("http://localhost:8080")).toBe(true);
  expect(listenReportOriginAllowed("https://evil.example")).toBe(false);
  expect(listenReportOriginAllowed(null)).toBe(false);
});
