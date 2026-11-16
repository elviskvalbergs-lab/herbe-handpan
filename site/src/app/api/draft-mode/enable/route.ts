import { defineEnableDraftMode } from "next-sanity/draft-mode";
import { readToken } from "@/sanity/env";
import { client } from "@/sanity/lib/client";

// Called by the Studio's Presentation tool (`previewMode.enable` in sanity.config.ts)
// with a one-time secret that only a signed-in editor can mint. The viewer token is
// what lets this route check that secret against the dataset.
export const { GET } = defineEnableDraftMode({
  client: client.withConfig({ token: readToken }),
});
