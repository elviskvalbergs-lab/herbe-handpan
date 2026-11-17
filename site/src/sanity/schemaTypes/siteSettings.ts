import { defineField, defineType } from "sanity";

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", initialValue: "Oakhum", validation: (r) => r.required() }),
    defineField({ name: "description", type: "text", rows: 2, description: "Search engines and link previews.", validation: (r) => r.required().max(160) }),
    defineField({ name: "storyTitle", title: "Story title (footer)", type: "string" }),
    defineField({ name: "story", title: "Story (footer)", type: "text", rows: 8, description: "A blank line starts a new paragraph." }),
    defineField({ name: "storyVerse", title: "Verse (footer)", type: "text", rows: 4, description: "Lines of a folk song, shown as verse under the story, one line per line." }),
    defineField({ name: "storyVerseTranslation", title: "Verse in English", type: "text", rows: 4, description: "Shown smaller under the verse. Leave empty to show the verse alone." }),
    defineField({ name: "storyVerseSource", title: "Verse source", type: "string", description: "E.g. “Latvian folk song (daina)”." }),
    defineField({ name: "contactEmail", type: "string", validation: (r) => r.required().email() }),
  ],
  preview: { prepare: () => ({ title: "Site settings" }) },
});
