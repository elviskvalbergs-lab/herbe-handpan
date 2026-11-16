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

## Before you say it is done

`pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass, and the root
`node --test` too. Look at the pages in a browser at 375px and 1280px wide.

## This is NOT the Next.js you know

Next.js 16: read `node_modules/next/dist/docs/` before using an API you haven't
seen in this repo.
