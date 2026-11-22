"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";

// The last resort: an error in the layout itself, so nothing of the site can
// be relied on. Reports to Sentry and offers a way back, in plain HTML.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body className="min-h-dvh bg-bg font-sans text-text">
        <main className="mx-auto max-w-[720px] px-4 pt-16 pb-24 sm:px-8">
          <h1 className="m-0 mb-4 text-[40px] font-semibold leading-[1.05]">Something went wrong</h1>
          <p className="m-0 mb-8 text-[19px] text-body">Oakhum didn’t load as it should. It has been reported to us. Please try again in a moment.</p>
          {/* A full page load on purpose: the app around this page has failed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="font-semibold">Go to the home page</a>
        </main>
      </body>
    </html>
  );
}
