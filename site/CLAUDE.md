# Oakhum website: rules for Claude

The site is in `site/`; the app is the repository root. The root CLAUDE.md
rules about commits, branches and pull requests apply here too.

## Three kinds of change, three places (as on lgaa-site)

1. **Text** → Sanity documents (Studio at `/studio`, or `scripts/`). Never hard-code
   copy into JSX. `src/content/seed.ts` is only the starting content.
2. **Look** → tokens in `src/app/globals.css` and the components in `src/components/`.
   No raw hex or colour functions elsewhere (`tests/design-tokens.spec.ts`).
   The brand is the app's: `docs/design-system.md` §0 in the repository root.
3. **Structure** → schema in `src/sanity/schemaTypes/` + renderer + test, in one commit.

## Music comes from the app

Scales, notes, chords, fingering charts, deep links and the pan drawing are the
app's (`../js`), through `src/lib/engine.ts`. Never copy or re-implement them here,
and never put tunings or fingerings into Sanity.

## Makers come from the app's database

A maker's name, logo, story and instruments are theirs: they edit them in the
app, and the site reads them through the database's public functions
(`src/lib/makers.ts`; `docs/makers-programme.md` in the repository root).
Never put a maker into Sanity. Sanity holds only the fixed words of `/makers`
and of a maker's page (`makersPage`). Everything read from the database is
cleaned before it is shown, and a layout passes the engine's `safeLayout`.

## Embeds

`/embed/s/<code>` and `/embed/<family>/<tuning>` are the playable demo alone,
for a maker's or shop's own website (an `<iframe>`). They use the same demo
components as the tuning pages inside `EmbedShell`, sit outside the `(site)`
layout (no header or footer), are the only paths other sites may frame
(`next.config.ts`), and are kept out of search.

## Every instrument gets the same pages

Handpan, tongue drum, ocarina, flute and any instrument added later have the same
instrument page and tuning pages, built from the same components, each with a
**playable demo**: the instrument's picture from the app's engine, and chord buttons
that play the chord with the app's sound (`src/lib/sound.ts`, which uses `../js/audio.js`)
and light it on the picture. One-note instruments play the chord as an arpeggio and
show each fingering in turn. A new instrument only adds its picture and its engine
functions in `src/lib/engine.ts`; the full checklist is "Adding an instrument" in the
root CLAUDE.md.

## One of each

The chord buttons under a demo are `ChordButtons`; a 404 or an error is `Problem`;
structured data is `JsonLd` + `src/lib/seo.ts`; an event is `track()` in
`src/lib/analytics.ts` (links into the app, maker emails and videos are caught
once in `Measure`, so a new page needs no wiring). Buttons that open the app all
read the home page's `heroCta`; a link to a tuning or chord reads "Play … in the app".

## Before you say it is done

`pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass, and the root
`node --test` too. Look at the pages in a browser at 375px and 1280px wide.

## This is NOT the Next.js you know

Next.js 16: read `node_modules/next/dist/docs/` before using an API you haven't
seen in this repo.
