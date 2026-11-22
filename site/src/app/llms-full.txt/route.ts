import { llmsFullTxt } from "@/lib/help";

// Every help article in full, as one Markdown file. Prerendered at build time.
export function GET() {
  return new Response(llmsFullTxt(), { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=3600" } });
}
