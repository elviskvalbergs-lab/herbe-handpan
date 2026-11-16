import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { apiVersion, dataset, projectId } from "./src/sanity/env";
import { schemaTypes } from "./src/sanity/schemaTypes";
import { SINGLETON_TYPES, structure } from "./src/sanity/structure";

export default defineConfig({
  name: "oakhum",
  title: "Oakhum",
  basePath: "/studio",
  // Placeholder keeps `next build` working before the Sanity project exists;
  // the Studio itself cannot load content until the real id is set.
  projectId: projectId || "missing-project-id",
  dataset,
  plugins: [structureTool({ structure }), visionTool({ defaultApiVersion: apiVersion })],
  schema: {
    types: schemaTypes,
    templates: (templates) => templates.filter(({ schemaType }) => !SINGLETON_TYPES.has(schemaType)),
  },
  document: {
    actions: (input, context) =>
      SINGLETON_TYPES.has(context.schemaType)
        ? input.filter(({ action }) => action && !["unpublish", "delete", "duplicate"].includes(action))
        : input,
  },
});
