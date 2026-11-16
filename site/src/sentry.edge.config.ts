import * as Sentry from "@sentry/nextjs";
import { SENTRY_DATA, SENTRY_DSN, SENTRY_ENVIRONMENT, SENTRY_TRACES_RATE } from "@/lib/sentry";

Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  tracesSampleRate: SENTRY_TRACES_RATE,
  dataCollection: SENTRY_DATA,
});
