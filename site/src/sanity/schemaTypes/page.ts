import { defineField, defineType } from "sanity";

// Plain text pages: privacy, about, terms. Route: /[slug].
export const page = defineType({
  name: "page",
  title: "Page",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "title" }, validation: (r) => r.required() }),
    defineField({ name: "updated", type: "date" }),
    defineField({ name: "body", type: "body" }),
    defineField({ name: "seo", type: "seo" }),
  ],
});
