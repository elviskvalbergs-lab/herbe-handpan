import { defineField, defineType } from "sanity";

// A listening report from the app (POST /api/listen-report, src/lib/listenReport.ts):
// what Oakhum heard when someone set up their instrument by ear, what they say
// was wrong, and the recording. Kept under the "listenReports." id path, which
// only signed-in Studio users can read. Delete it once it is fixed and answered,
// and at the latest a year after it came in (the privacy notice says so).
export const listenReport = defineType({
  name: "listenReport",
  title: "Listening report",
  type: "document",
  fields: [
    defineField({
      name: "status",
      type: "string",
      options: { list: ["new", "looking", "fixed", "answered", "not a bug"] },
      initialValue: "new",
    }),
    defineField({ name: "title", type: "string", readOnly: true }),
    defineField({ name: "comment", title: "What was wrong (their words)", type: "text", rows: 4, readOnly: true }),
    defineField({ name: "email", type: "string", readOnly: true, description: "Only to tell them when it's fixed." }),
    defineField({ name: "recordings", type: "array", of: [{ type: "file" }], readOnly: true }),
    defineField({ name: "photo", title: "Photo of the instrument", type: "image", readOnly: true }),
    defineField({ name: "family", type: "string", readOnly: true }),
    defineField({ name: "heard", title: "Heard", type: "string", readOnly: true }),
    defineField({ name: "matched", title: "Oakhum's match", type: "string", readOnly: true }),
    defineField({ name: "a4", title: "A (Hz)", type: "number", readOnly: true }),
    defineField({ name: "jiraKey", title: "Jira issue", type: "string" }),
    defineField({ name: "fixNotes", title: "What we found and fixed", type: "text", rows: 3 }),
    defineField({ name: "meta", title: "Everything the app sent (JSON)", type: "text", rows: 6, readOnly: true }),
    defineField({ name: "createdAt", type: "datetime", readOnly: true }),
  ],
  orderings: [{ title: "Newest", name: "newest", by: [{ field: "createdAt", direction: "desc" }] }],
  preview: {
    select: { title: "title", status: "status", heard: "heard", createdAt: "createdAt" },
    prepare: ({ title, status, heard, createdAt }) => ({ title, subtitle: `${status ?? "new"} · ${(createdAt ?? "").slice(0, 10)} · ${heard ?? ""}` }),
  },
});
