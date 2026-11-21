import { defineField, defineType } from "sanity";

// The words of /songs and the song pages. The songs themselves (titles,
// notes, sources), which instruments can play them and the playable demo
// come from the app's engine (../js/songs.js), never from here.
export const songsPage = defineType({
  name: "songsPage",
  title: "Songs pages",
  type: "document",
  fields: [
    defineField({ name: "heroTitle", title: "Title of /songs", type: "string", validation: (r) => r.required().max(70) }),
    defineField({ name: "heroText", title: "Text under it", type: "text", rows: 3, validation: (r) => r.required().max(320) }),
    defineField({ name: "fitTitle", title: "Heading: which instruments", type: "string", validation: (r) => r.max(70) }),
    defineField({ name: "fitText", title: "How a song is fitted", type: "text", rows: 3, description: "On every song page, above the list of instruments.", validation: (r) => r.max(320) }),
    defineField({ name: "almostText", title: "About songs that almost fit", type: "text", rows: 2, validation: (r) => r.max(240) }),
    defineField({ name: "demoText", title: "Under the playable picture", type: "text", rows: 2, validation: (r) => r.max(240) }),
    defineField({ name: "appTitle", title: "Heading: in the app", type: "string", validation: (r) => r.max(70) }),
    defineField({ name: "appText", title: "What the app adds", type: "text", rows: 3, validation: (r) => r.max(320) }),
    defineField({ name: "appCta", title: "Button to the app", type: "string", validation: (r) => r.max(40) }),
    defineField({ name: "seo", type: "seo" }),
  ],
  preview: { prepare: () => ({ title: "Songs pages" }) },
});
