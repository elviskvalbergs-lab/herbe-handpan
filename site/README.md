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
   - `NEXT_PUBLIC_SITE_URL`: the site's own address (for the sitemap, canonical links and link previews). Defaults to `https://oakhum.com`.
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
| not Sanity: `../help/en/*.md` | help articles, with the app's feature registry (`../docs/help-centre.md`) | `/help`, `/help/[slug]`, `/help/index.json`, `/llms.txt`, `/llms-full.txt` |

Tunings, notes and chords are not content: they come from the app's catalogue.

## Requests

`POST /api/requests` validates (`src/lib/requests.ts`) and writes a hidden
`request` with the write token. `POST /api/requests/vote` adds a vote to a
public one. Both answer 503 with a plain message until the write token is set.

## Abuse limits

The three public routes (`/api/requests`, `/api/requests/vote`, `/api/listen-report`) only answer Oakhum's own pages (the `Origin` header, `src/lib/guard.ts`), cap what they read (16 KB for a request; 4.5 MB for a listening report, refused from `Content-Length` before the upload is read) and limit each address: 5 requests, 30 votes and 5 reports per 10 minutes, and one vote a day per request. The counters live in the function's memory, so they cost nothing and need no service, but they are per warm instance, not exact. For a hard limit add one Vercel Firewall rule on the oakhum-site project (Firewall › Custom rules › path starts with `/api/` › Rate limit, e.g. 30 per minute per IP).

## Measurement

- **Vercel Web Analytics and Speed Insights** (`src/components/Measure.tsx`): page views and loading speed, no cookies. Each must be switched on once per project in Vercel (project › Analytics › Enable, and › Speed Insights › Enable). The app's page loads the same script (`build.py`), so switch Web Analytics on for the app's project too.
- **PostHog** (`src/lib/analytics.ts`): the same EU project and the same settings as the app (cookieless, no person profiles, no session recording), so one funnel runs from a page here to playing in the app. Site events carry `surface: "site"`: `demo_chord_played` (family, tuning, chord), `app_cta_click` (location, href), `request_submitted` (kind), `maker_contact_click`, `video_play`. `NEXT_PUBLIC_POSTHOG_KEY` overrides the project key; set it empty to turn PostHog off.
- **Home page experiment** (`src/lib/experiment.ts`, started 2026-11-26): each visit to `/` gets version "a" (with the playable handpan demo) or "b" (no demo, one button into the app) at random, from `src/proxy.ts`. Nothing is stored on the device, so a reload can show the other version. The page sends `home_view` with `variant`, and every later site event on it carries `home_variant`. `HOME_EXPERIMENT` in Vercel: `off` or `a` serves everyone "a", `b` serves everyone "b"; unset runs the split. `?home=a` / `?home=b` shows one version. Version b's own address, `/home-b`, redirects to `/`. To end it, set `HOME_EXPERIMENT` to the winner, then remove the losing version from `src/components/HomePage.tsx`.
- A link into the app carries the visit's `utm_…` tags, so a tagged visit is still counted for its campaign once the app opens.

## Search

- Every page has a canonical link and `og:url` of its own address (the layout's `"./"`); instrument and tuning pages use `pageMeta` (`src/lib/seo.ts`) for the family's share picture (`/og/<family>.jpg`, the app's).
- A tuning's page is written from the app's data: its notes and character, every chord, the fingering chart in words (ocarinas, flutes) and the Songs to learn that fit it (`src/lib/engine.ts`, `src/lib/tuningText.ts`).
- The same key in another octave (Native American flutes, pendant ocarinas) points at one page (`canonicalTuning`) and is left out of the sitemap. The app's own deep links (`/handpan/d-kurd`) name the site's page as canonical or ask not to be indexed (`../middleware.js`).
- Structured data (`src/components/JsonLd.tsx`): the app as a free `WebApplication` and the questions on the home page, a breadcrumb on instrument and tuning pages, the questions on instrument pages.

## Screenshots of the app

`public/shots/*.webp` are real screens of the app, taken by `scripts/app-shots.mjs` from a local build (`python3 build.py` in the repository root, then `node site/scripts/app-shots.mjs`). Re-run it when the app's look changes. Their alt texts are in `src/lib/pictures.ts`.

## Error reporting (Sentry)

Errors and 10% of traces go to the Sentry project **oakhum-site** (organisation burti, EU region); the app reports to **oakhum-app**. Settings are in `src/lib/sentry.ts` and the `instrumentation*.ts` / `sentry.*.config.ts` files. Session replay is off (it needs consent) and no user identity or IP is stored.

Readable stack traces in production need source maps: create a Sentry auth token (Sentry › Settings › Auth Tokens, scope `project:releases`) and add it in Vercel as `SENTRY_AUTH_TOKEN` (sensitive) on the oakhum-site project. Without it the build still works.

## Content fixes

`scripts/content-fixes.ts` runs on every production build on Vercel (`prebuild`; previews skip it, since they share the dataset) and applies
named, one-time changes to the live Sanity content, like database migrations:
each runs once and is recorded in the `contentFixes` document. A fix changes a
text only while it still reads exactly as the starting content had it, so
edits made in the Studio are never overwritten. A fix that follows a rewrite of
`src/content/seed.ts` keeps the old texts next to it (`scripts/seed-before-<date>.ts`)
to compare with. Without the write token
(local builds) it does nothing. Add a new fix to its `FIXES` list.
