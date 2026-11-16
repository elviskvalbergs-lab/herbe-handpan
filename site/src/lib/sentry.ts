// Shared Sentry settings for the browser, server and edge inits.
// The DSN is public by design (it only allows sending events).
export const SENTRY_DSN = "https://755f19eb882129cea3e45cde2f7214fa@o4511403643043840.ingest.de.sentry.io/4512443095908432";

// Vercel exposes its environment to the browser as NEXT_PUBLIC_VERCEL_ENV.
export const SENTRY_ENVIRONMENT = process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || "development";

// Every trace locally, a tenth in preview and production.
export const SENTRY_TRACES_RATE = SENTRY_ENVIRONMENT === "development" ? 1.0 : 0.1;

// No user identity (IP and the like) is sent; the project also discards IPs.
export const SENTRY_DATA = { userInfo: false } as const;
