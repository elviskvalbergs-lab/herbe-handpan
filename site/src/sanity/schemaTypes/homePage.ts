import { defineArrayMember, defineField, defineType } from "sanity";

// The home page's words. The layout, the handpan demo and the instrument list
// come from the components; everything a person reads is here.
export const homePage = defineType({
  name: "homePage",
  title: "Home page",
  type: "document",
  groups: [
    { name: "hero", title: "Top", default: true },
    { name: "how", title: "How it works" },
    { name: "why", title: "Why" },
    { name: "account", title: "Free and account" },
    { name: "request", title: "Request" },
  ],
  fields: [
    defineField({ name: "heroTitle", type: "string", group: "hero", validation: (r) => r.required().max(70) }),
    defineField({ name: "heroText", type: "text", rows: 3, group: "hero", validation: (r) => r.required().max(260) }),
    defineField({ name: "heroNote", type: "string", group: "hero", description: "The small line under the buttons." }),
    defineField({ name: "heroCta", title: "Main button", type: "string", group: "hero", description: "Opens the app.", validation: (r) => r.max(40) }),
    defineField({ name: "heroListen", title: "Second button", type: "string", group: "hero", description: "Goes to the playable handpan below the picture.", validation: (r) => r.max(40) }),
    defineField({ name: "heroTry", title: "Hint at the bottom of the picture", type: "string", group: "hero", description: "Points down to the playable handpan.", validation: (r) => r.max(60) }),
    defineField({ name: "demoCaption", type: "string", group: "hero" }),
    defineField({ name: "howTitle", type: "string", group: "how" }),
    defineField({ name: "steps", type: "array", group: "how", of: [defineArrayMember({ type: "point" })], validation: (r) => r.max(4) }),
    defineField({ name: "instrumentsText", type: "text", rows: 2, group: "how" }),
    defineField({ name: "whyTitle", type: "string", group: "why" }),
    defineField({ name: "why", type: "array", group: "why", of: [defineArrayMember({ type: "point" })], validation: (r) => r.max(4) }),
    defineField({ name: "accountTitle", type: "string", group: "account" }),
    defineField({ name: "accountText", type: "text", rows: 2, group: "account" }),
    defineField({ name: "guestTitle", type: "string", group: "account" }),
    defineField({ name: "guestPoints", type: "array", group: "account", of: [defineArrayMember({ type: "string" })] }),
    defineField({ name: "guestNote", type: "string", group: "account" }),
    defineField({ name: "memberTitle", type: "string", group: "account" }),
    defineField({ name: "memberPoints", type: "array", group: "account", of: [defineArrayMember({ type: "point" })] }),
    defineField({ name: "memberNote", type: "string", group: "account" }),
    defineField({ name: "featuresTitle", type: "string", group: "account" }),
    defineField({ name: "requestTitle", type: "string", group: "request" }),
    defineField({ name: "requestText", type: "text", rows: 2, group: "request" }),
    defineField({ name: "faqTitle", type: "string", group: "request" }),
    defineField({ name: "faqs", type: "array", group: "request", of: [defineArrayMember({ type: "qa" })] }),
  ],
  preview: { prepare: () => ({ title: "Home page" }) },
});
