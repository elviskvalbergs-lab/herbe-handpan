# herbe-handpan: standing rules for Claude Code sessions

Design brief for the ocarina work: `docs/ocarina-mode.md`. Read it before starting a phase.

## The website
- The public website (Next.js + Sanity) is in `site/`, with its own rules in `site/CLAUDE.md`. It imports the app's engine from `js/` and `css/pan-drawing.css`, so changes there must keep `site/` building (`cd site && pnpm test && pnpm build`).

## Branches and pull requests
- Work on one feature branch per phase from the brief's Build order (for example `ocarina/phase-1-maths`), branched off `preview`, and open a pull request into `preview`.
- Never push to `preview` directly. Never merge pull requests yourself.

## Commits
- Commits must be authored by the GitHub account elviskvalbergs-lab, because Vercel blocks deployments from other commit authors.
- Before the first commit in a session, check `git config user.name` and `git config user.email` and tell the user what they are. If they don't belong to elviskvalbergs-lab, stop and ask before committing.
- Do not add a "Co-Authored-By" line or a "Generated with Claude Code" line to commits or pull request descriptions.

## Scope
- Don't change existing handpan behaviour unless the current phase says so.
- Progressions, chord-sheet import, the play levels from the brief's last two sections and Songs to learn (folk melodies in `js/songs.js`, each read from a published score with its source and licence noted) are built (at the owner's request). The rest of the songs project (MusicXML/MIDI import, a large song catalogue) is still for later: don't build it unless asked. Melodies follow the same rule as fingering charts: from a published source, never from memory.
- If anything in the brief conflicts with the code, stop and ask rather than guessing.

## Design consistency (reuse, don't copy)
- Every instrument uses the same screens and components. A screen that exists for one instrument (Chords, Playlists, Set up, a sheet, a card, a list row) is built from shared parts, and another instrument plugs its own content into them instead of getting its own version. The Chords screen is `chordsScreenHtml` / `chordCardHtml` / `chordRowHtml` in `js/app.js`: an instrument gives its picture and its chord rows, nothing else.
- Before adding UI for one instrument, look for the pattern the others already use and reuse it (or extend the shared part so all of them get it). Only the parts that really differ between instruments (the picture of the instrument, its fingerings) are instrument-specific.
- When a screen's pattern changes, change the shared part so every instrument changes with it, and remove the old copy. `docs/design-system.md` lists the shared patterns; keep it up to date.

## Adding an instrument (kalimba, tongue drum, …)
Every instrument gets the same experience, in the app and on the website. A new instrument is not done until all of this exists for it:
- **Data from a published source** (see Data and database): its tunings/scales or fingering charts, with the source URL in the data file.
- **Its picture and its fingerings or strike map**: the only instrument-specific UI. Everything else plugs into the shared parts.
- **Its brand picture**: a 512 × 512 transparent WebP in `brand/instruments/` in the same style as the others (see `docs/design-system.md` §0), shown on its setup tile (`SETUP_TILES` in `js/app.js`) and in the website's instrument list (`site/src/lib/pictures.ts`).
- **App, the same screens as every other instrument**: the beginner setup (default "Play my notes": the app listens and works out the tuning; second "I know my scale/key"; details only behind "Show all"), Play, Chords (`chordsScreenHtml` / `chordCardHtml` / `chordRowHtml`), playlists, progressions and chord sheets, Listen, Save (through the shared save sheet, so it syncs and works offline for accounts), Share, deep links in `js/links.js` (`/<family>/<slug>[/tab[/chord]]`) and a preview image under `og/`.
- **Sound**: a voice in `js/audio.js`. Instruments that sound one note at a time play chords as arpeggios (as the ocarina and flute do).
- **Website, the same pages as every other instrument**: its instrument page and one page per tuning (`site/src/app/(site)/instruments/[slug]/…`), with the **playable demo**: the instrument's own picture from the app's engine, chord buttons that play the chord with the app's sound and light the notes/fingerings, exactly as the handpan demo does. Its Sanity `instrument` document (copy, FAQ, status "available"), and it appears in the home page list, the sitemap and the request form.
- **Tests**: data round-trips (every tuning has a link, `parseLink(linkFor(x))`), chords found on at least one real tuning, the site's engine tests for the new family.
- **Docs**: `docs/design-system.md` (anything new in the shared patterns) and this checklist if something was missing.

## Data and database
- Database changes are additive only: new tables, columns, functions or policies, never altering or dropping existing ones. Write them as new SQL files under `supabase/migrations/` (`YYYYMMDD_short_name.sql`); the build applies them automatically (`supabase/migrate.py`, see `supabase/README.md`). Never edit a migration file after it has been merged: add a new one. Never ask for, print or commit the database connection string or any Supabase secret key; it lives only in Vercel's environment variables.
- Fingering charts and instrument ranges must come from a published source (maker or manufacturer chart), with the source URL noted in the data file. Never fill them in from memory. If no reliable source is found, leave a clearly marked TODO with the data structure in place.

## Build
- `build.py` bundles `styles.css` and the files in its `js_files` list into `index.html` (imports and `export` keywords are stripped, everything shares one script scope). Vercel runs it on every deploy. `index.html` is build output and is **not committed** (it's in `.gitignore`): run `python3 build.py` locally to try the app, but never add `index.html` to a commit.
- New JS files go into `js_files` in the order the brief gives: `js/ocarina.js` and `js/tuner.js` after `js/chords.js`, `js/ocarina-ui.js` after `js/pan.js`.
- Because the bundle is one scope, top-level names must be unique across all `js/` files.

## Tests
- Unit tests live in `tests/*.test.mjs` and use only `node:test` and `node:assert` (no dependencies, no package.json). Run them with `node --test` from the repo root.
- Run the tests and `python3 build.py` before every commit (the build checks the bundle; its output stays uncommitted).
