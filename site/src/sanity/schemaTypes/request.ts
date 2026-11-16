import { defineField, defineType } from "sanity";

// Requests come from the form on /request (POST /api/requests, server-side
// with the write token). Votes are counted by /api/requests/vote. Only
// requests marked "Show on the site" appear in the public list, and the
// email address never leaves the Studio.
export const request = defineType({
  name: "request",
  title: "Request",
  type: "document",
  fields: [
    defineField({
      name: "kind",
      type: "string",
      options: { list: [{ title: "Instrument or tuning", value: "instrument" }, { title: "Feature", value: "feature" }], layout: "radio" },
      validation: (r) => r.required(),
    }),
    defineField({ name: "title", type: "string", validation: (r) => r.required().max(120) }),
    defineField({ name: "notes", title: "Notes or tuning", type: "string" }),
    defineField({ name: "details", type: "text", rows: 4 }),
    defineField({ name: "email", type: "string", description: "Only to tell them when it is ready. Never shown on the site." }),
    defineField({ name: "votes", type: "number", initialValue: 1, readOnly: true }),
    defineField({ name: "public", title: "Show on the site", type: "boolean", initialValue: false }),
    defineField({
      name: "status",
      type: "string",
      options: { list: ["new", "planned", "in progress", "done", "declined"] },
      initialValue: "new",
    }),
    defineField({ name: "createdAt", type: "datetime", readOnly: true }),
  ],
  orderings: [{ title: "Votes", name: "votes", by: [{ field: "votes", direction: "desc" }] }],
  preview: { select: { title: "title", subtitle: "kind", votes: "votes" }, prepare: ({ title, subtitle, votes }) => ({ title, subtitle: `${subtitle} · ${votes ?? 0} votes` }) },
});
