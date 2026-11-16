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
   - `NEXT_PUBLIC_APP_URL`: where the app answers (default `https://oakhum.vercel.app`).
   - `NEXT_PUBLIC_SITE_URL`: the site's own address (for the sitemap and link previews).
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
