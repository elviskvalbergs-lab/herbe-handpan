import { defineField, defineType } from "sanity";

export const feature = defineType({
  name: "feature",
  title: "Feature",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required().max(60) }),
    defineField({ name: "text", type: "text", rows: 3, validation: (r) => r.required().max(300) }),
    defineField({
      name: "status",
      type: "string",
      options: { list: [{ title: "In the app", value: "ready" }, { title: "On the way", value: "next" }], layout: "radio" },
      validation: (r) => r.required(),
    }),
    defineField({ name: "order", type: "number", initialValue: 10 }),
  ],
  orderings: [{ title: "Order", name: "order", by: [{ field: "order", direction: "asc" }] }],
  preview: { select: { title: "title", subtitle: "status" } },
});
