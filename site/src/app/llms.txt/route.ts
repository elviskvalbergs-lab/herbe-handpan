import { llmsTxt } from "@/lib/help";

// llmstxt.org: a short map of the site for language models. Prerendered at build time.
export function GET() {
  return new Response(llmsTxt(), { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=3600" } });
}
