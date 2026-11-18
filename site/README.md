# Oakhum website (oakhum.com)

The public website for the Oakhum app: home, a page per instrument and per
tuning, requests with votes, and plain pages (privacy). Next.js 16 (App
Router) + Sanity, built the same way as lgaa-site. Sanity Studio is part of
the site, at `/studio`.

It lives next to the app (repository root) on purpose: it imports the app's
own engine from `../js` (scales, chords, fingering charts, deep links, the pan
drawing, the logo) and `../css/pan-drawing.css`, so the website and the app
never disagree. See `src/lib/engine.ts`.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000, copies ../fonts and ../brand into public/ first
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Without a Sanity project the site shows the starting content in
`src/content/seed.ts`, so it can be built and reviewed before Sanity exists.

## Deploy on Vercel (a second project, next to the app's)

1. Vercel → Add New → Project → this repository. **Root Directory: `site`**.
   Keep "Include files outside the root directory" on (the default): the site
   reads `../js`, `../css`, `../fonts` and `../brand`.
2. Storage / Marketplace → **Sanity** → connect it to this project (as on
   lgaa-site). It sets `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`,
   `SANITY_API_READ_TOKEN` and `SANITY_API_WRITE_TOKEN`. Pick the EU region.
3. Environment variables:
   - `NEXT_PUBLIC_APP_URL`: the app's own Vercel address (default `https://oakhum.vercel.app`).
     The site serves the app on its own domain (one domain): `/play` and the deep links
     `/handpan/…`, `/ocarina/…`, `/flute/…`, `/s/…`, plus the app's service worker,
     manifest, icons and preview images, are fetched from there (`rewrites` in
     `next.config.ts`). Links to the app are plain paths (`/play`, `/handpan/d-kurd`).
   - `NEXT_PUBLIC_SITE_URL`: the site's own address (for the sitemap and link previews).
   - Feedback to Jira (optional; without these, feedback is saved in Sanity):
     `JIRA_BASE_URL` (e.g. `https://burti.atlassian.net`), `JIRA_EMAIL` and
     `JIRA_API_TOKEN` (an Atlassian API token of the account that creates the issues),
     `JIRA_FEEDBACK_PROJECT` (the project key) and, if not "Task",
     `JIRA_FEEDBACK_ISSUE_TYPE`. Each piece of feedback becomes an issue labelled
     `feedback` and `can-reply` or `anonymous`. If Jira fails, it is saved in Sanity instead.
4. In sanity.io/manage → API → CORS origins, add the site's address with
   credentials allowed, so `/studio` can sign in.
5. Load the starting content once: `SANITY_API_WRITE_TOKEN=… NEXT_PUBLIC_SANITY_PROJECT_ID=… pnpm seed`.

## Content

| Type | What | Route |
| --- | --- | --- |
| `homePage` (singleton) | every word on the home page | `/` |
| `siteSettings` (singleton) | title, description, footer story, contact email | — |
| `instrument` | an instrument page: status, intro, featured tunings, FAQ | `/instruments/[slug]`, `/instruments/[slug]/[tuning]` |
| `feature` | "In the app now" / "On the way" | `/` |
| `request` | requests from the form; shown only when "Show on the site" is ticked; emails never shown | `/request` |
| `page` | text pages (closed block list) | `/[slug]` |

Tunings, notes and chords are not content: they come from the app's catalogue.

## Requests

`POST /api/requests` validates (`src/lib/requests.ts`) and writes a hidden
`request` with the write token. `POST /api/requests/vote` adds a vote to a
public one. Both answer 503 with a plain message until the write token is set.

## Error reporting (Sentry)

Errors and 10% of traces go to the Sentry project **oakhum-site** (organisation burti, EU region); the app reports to **oakhum-app**. Settings are in `src/lib/sentry.ts` and the `instrumentation*.ts` / `sentry.*.config.ts` files. Session replay is off (it needs consent) and no user identity or IP is stored.

Readable stack traces in production need source maps: create a Sentry auth token (Sentry › Settings › Auth Tokens, scope `project:releases`) and add it in Vercel as `SENTRY_AUTH_TOKEN` (sensitive) on the oakhum-site project. Without it the build still works.

## Content fixes

`scripts/content-fixes.ts` runs on every production build on Vercel (`prebuild`; previews skip it, since they share the dataset) and applies
named, one-time changes to the live Sanity content, like database migrations:
each runs once and is recorded in the `contentFixes` document. A fix changes a
text only while it still reads exactly as the starting content had it, so
edits made in the Studio are never overwritten. Without the write token
(local builds) it does nothing. Add a new fix to its `FIXES` list.
