"use client";

import { NextStudio } from "next-sanity/studio";
import config from "../../../../sanity.config";

// A client module, so the whole Sanity config (and `sanity` itself) stays out of the server graph.
export function Studio() {
  return <NextStudio config={config} />;
}
