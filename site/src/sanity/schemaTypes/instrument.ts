import { defineArrayMember, defineField, defineType } from "sanity";

// An instrument page (/instruments/[slug]). Tunings, notes and chords are not
// stored: they come from the app's own catalogue (src/lib/engine.ts), which
// cites its published sources. A coming-soon instrument gets a page too, so it
// can be found in search before the app plays it.
export const instrument = defineType({
  name: "instrument",
  title: "Instrument",
  type: "document",
  fields: [
    defineField({ name: "name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "name" }, validation: (r) => r.required() }),
    defineField({
      name: "family",
      type: "string",
      description: "Which of the app's instruments this page shows. 'Not in the app yet' for coming-soon ones.",
      options: { list: [{ title: "Handpan", value: "handpan" }, { title: "Ocarina", value: "ocarina" }, { title: "Flute", value: "flute" }, { title: "Not in the app yet", value: "none" }] },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "status",
      type: "string",
      options: { list: [{ title: "In the app", value: "available" }, { title: "Coming soon", value: "soon" }], layout: "radio" },
      initialValue: "available",
      validation: (r) => r.required(),
    }),
    defineField({ name: "order", type: "number", initialValue: 10 }),
    defineField({ name: "tuningsLine", title: "Tunings line (list)", type: "string", description: "One line under the name in the instrument list." }),
    defineField({ name: "title", title: "Page title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "intro", type: "text", rows: 3, validation: (r) => r.required() }),
    defineField({
      name: "featuredTunings",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      description: "App link slugs to offer first, in order: d-kurd, d-celtic-minor, alto-c-12, tin-whistle-d…",
    }),
    defineField({ name: "playAlongTitle", type: "string" }),
    defineField({ name: "playAlongText", type: "text", rows: 3 }),
    defineField({ name: "ctaTitle", type: "string" }),
    defineField({ name: "ctaText", type: "text", rows: 2 }),
    defineField({ name: "faqs", type: "array", of: [defineArrayMember({ type: "qa" })] }),
    defineField({ name: "seo", type: "seo" }),
  ],
  orderings: [{ title: "Order", name: "order", by: [{ field: "order", direction: "asc" }] }],
  preview: { select: { title: "name", subtitle: "status" } },
});
