import { defineField, defineType } from "sanity";

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", initialValue: "Oakhum", validation: (r) => r.required() }),
    defineField({ name: "description", type: "text", rows: 2, description: "Search engines and link previews.", validation: (r) => r.required().max(160) }),
    defineField({ name: "storyTitle", title: "Story title (footer)", type: "string" }),
    defineField({ name: "story", title: "Story (footer)", type: "text", rows: 5 }),
    defineField({ name: "contactEmail", type: "string", validation: (r) => r.required().email() }),
  ],
  preview: { prepare: () => ({ title: "Site settings" }) },
});
