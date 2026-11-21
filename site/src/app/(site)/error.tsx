"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Problem } from "@/components/Problem";
import { btnPrimary } from "@/lib/ui";

// Something failed while a page was being drawn. Reported to Sentry; the
// visitor gets a way to try again and the usual ways on.
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <Problem title="Something went wrong" text="This page didn’t load as it should. It has been reported to us. Trying again usually helps.">
      <button type="button" onClick={() => retry()} className={`${btnPrimary} cursor-pointer border-0`}>Try again</button>
    </Problem>
  );
}
