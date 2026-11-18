import type { StructureResolver } from "sanity/structure";

/** One fixed document each, shown as a single item. */
export const SINGLETON_TYPES = new Set(["siteSettings", "homePage", "makersPage"]);

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      S.listItem().title("Home page").id("homePage").child(S.document().schemaType("homePage").documentId("homePage").title("Home page")),
      S.listItem().title("Makers page").id("makersPage").child(S.document().schemaType("makersPage").documentId("makersPage").title("Makers page")),
      S.listItem().title("Site settings").id("siteSettings").child(S.document().schemaType("siteSettings").documentId("siteSettings").title("Site settings")),
      S.divider(),
      S.documentTypeListItem("instrument").title("Instruments"),
      S.documentTypeListItem("feature").title("Features"),
      S.documentTypeListItem("request").title("Requests"),
      S.documentTypeListItem("page").title("Pages"),
    ]);
