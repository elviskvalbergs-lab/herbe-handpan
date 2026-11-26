import type { Metadata } from "next";
import { HomePage } from "@/components/HomePage";

// Version "b" of the home page experiment (src/lib/experiment.ts): the home
// page with the overview video in place of the playable demo. Visitors reach it at "/" through
// src/proxy.ts, which also sends anyone who asks for /home-b itself to "/".
// No "noindex" here: this page is served as "/", and search engines must keep
// indexing "/". Its canonical and og:url are "/".
export const metadata: Metadata = { alternates: { canonical: "/" }, openGraph: { url: "/" } };

export default function Page() {
  return <HomePage variant="b" />;
}
