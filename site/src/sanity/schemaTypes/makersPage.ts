import { defineArrayMember, defineField, defineType } from "sanity";

// The words of /makers, the page for people who make or sell instruments.
// The layout, the playable demo, the video file and the contact address come
// from the site.
export const makersPage = defineType({
  name: "makersPage",
  title: "Makers page",
  type: "document",
  groups: [
    { name: "hero", title: "Top", default: true },
    { name: "why", title: "Why" },
    { name: "how", title: "How" },
    { name: "offer", title: "What they get" },
    { name: "contact", title: "Contact and questions" },
  ],
  fields: [
    defineField({ name: "heroTitle", type: "string", group: "hero", validation: (r) => r.required().max(70) }),
    defineField({ name: "heroText", type: "text", rows: 3, group: "hero", validation: (r) => r.required().max(320) }),
    defineField({ name: "heroCta", title: "Main button", type: "string", group: "hero", description: "Writes an email to the site's contact address.", validation: (r) => r.max(40) }),
    defineField({ name: "heroSecondary", title: "Second button", type: "string", group: "hero", description: "Goes to the playable instrument below.", validation: (r) => r.max(40) }),
    defineField({ name: "videoTitle", title: "Video title", type: "string", group: "hero", description: "Above the makers video, under the top of the page.", validation: (r) => r.max(70) }),
    defineField({ name: "videoText", title: "Video text", type: "text", rows: 2, group: "hero", validation: (r) => r.max(240) }),
    defineField({ name: "whyTitle", type: "string", group: "why" }),
    defineField({ name: "why", type: "array", group: "why", of: [defineArrayMember({ type: "point" })], validation: (r) => r.max(4) }),
    defineField({ name: "howTitle", type: "string", group: "how" }),
    defineField({ name: "steps", type: "array", group: "how", of: [defineArrayMember({ type: "point" })], validation: (r) => r.max(3) }),
    defineField({ name: "howNote", type: "text", rows: 2, group: "how", description: "The small print under the steps." }),
    defineField({ name: "demoTitle", type: "string", group: "how" }),
    defineField({ name: "demoText", type: "text", rows: 2, group: "how" }),
    defineField({ name: "offerTitle", type: "string", group: "offer" }),
    defineField({ name: "offer", type: "array", group: "offer", of: [defineArrayMember({ type: "point" })], validation: (r) => r.max(6) }),
    defineField({ name: "ctaTitle", type: "string", group: "contact" }),
    defineField({ name: "ctaText", type: "text", rows: 2, group: "contact" }),
    defineField({ name: "emailSubject", type: "string", group: "contact", description: "Subject of the email the buttons start." }),
    defineField({ name: "faqTitle", type: "string", group: "contact" }),
    defineField({ name: "faqs", type: "array", group: "contact", of: [defineArrayMember({ type: "qa" })] }),
    defineField({ name: "seo", type: "seo", group: "hero" }),
  ],
  preview: { prepare: () => ({ title: "Makers page" }) },
});
