import { defineArrayMember, defineField, defineType } from "sanity";

/** A short title + text pair: steps, reasons, account benefits. */
export const point = defineType({
  name: "point",
  title: "Point",
  type: "object",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required().max(80) }),
    defineField({ name: "text", type: "text", rows: 3, validation: (r) => r.required().max(400) }),
  ],
  preview: { select: { title: "title", subtitle: "text" } },
});

export const qa = defineType({
  name: "qa",
  title: "Question",
  type: "object",
  fields: [
    defineField({ name: "question", type: "string", validation: (r) => r.required().max(140) }),
    defineField({ name: "answer", type: "text", rows: 4, validation: (r) => r.required().max(900) }),
  ],
  preview: { select: { title: "question", subtitle: "answer" } },
});

export const seo = defineType({
  name: "seo",
  title: "Search and sharing",
  type: "object",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.max(70) }),
    defineField({ name: "description", type: "text", rows: 2, validation: (r) => r.max(160) }),
  ],
});

/**
 * Page text. A closed list on purpose (as on lgaa-site): paragraphs, two heading
 * levels, lists, bold, italic and links. No raw HTML, no colours, no embeds.
 */
export const body = defineType({
  name: "body",
  title: "Text",
  type: "array",
  of: [
    defineArrayMember({
      type: "block",
      styles: [
        { title: "Paragraph", value: "normal" },
        { title: "Heading", value: "h2" },
        { title: "Subheading", value: "h3" },
      ],
      lists: [
        { title: "Bullets", value: "bullet" },
        { title: "Numbers", value: "number" },
      ],
      marks: {
        decorators: [
          { title: "Bold", value: "strong" },
          { title: "Italic", value: "em" },
        ],
        annotations: [
          {
            name: "link",
            type: "object",
            title: "Link",
            fields: [{ name: "href", type: "url", validation: (r) => r.uri({ scheme: ["http", "https", "mailto"], allowRelative: true }) }],
          },
        ],
      },
    }),
  ],
});
