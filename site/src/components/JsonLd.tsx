import { stegaClean } from "next-sanity";
import { ldJson } from "@/lib/seo";

// Structured data for search engines (src/lib/seo.ts). Texts come from Sanity,
// so the editing marks of draft mode are cleaned off first.
export function JsonLd({ data }: { data: unknown }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(stegaClean(data)) }} />;
}
