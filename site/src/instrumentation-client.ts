import * as Sentry from "@sentry/nextjs";
import { SENTRY_DATA, SENTRY_DSN, SENTRY_ENVIRONMENT, SENTRY_TRACES_RATE } from "@/lib/sentry";

// Session replay is left out on purpose: recordings need consent (see the app's docs/free-to-play.md §9).
Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  tracesSampleRate: SENTRY_TRACES_RATE,
  dataCollection: SENTRY_DATA,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
