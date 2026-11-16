import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

// Leaves draft mode and returns to the published site. `?redirect=/path` is honoured
// only for a same-site path, so this cannot be used as an open redirect.
export async function GET(request: Request) {
  (await draftMode()).disable();
  const target = new URL(request.url).searchParams.get("redirect") ?? "/";
  redirect(target.startsWith("/") && !target.startsWith("//") && !target.includes("\\") ? target : "/");
}
