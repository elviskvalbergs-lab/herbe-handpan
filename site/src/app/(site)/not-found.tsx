import type { Metadata } from "next";
import { Problem } from "@/components/Problem";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

// An address inside the site that doesn't exist (an unknown instrument, tuning or page).
export default function NotFound() {
  return <Problem title="This page isn’t here" text="The link may be old, or the address has a typo. Your instrument is most likely one step away." />;
}
