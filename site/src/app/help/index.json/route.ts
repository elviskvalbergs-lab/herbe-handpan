import { helpExport } from "@/lib/help";

// The whole help centre as JSON, one passage per heading, for a chatbot or a
// retrieval pipeline (../docs/help-centre.md). Prerendered at build time.
export function GET() {
  return Response.json(helpExport(), { headers: { "cache-control": "public, max-age=300, s-maxage=3600", "access-control-allow-origin": "*" } });
}
