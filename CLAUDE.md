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
- Progressions, chord-sheet import, the play levels from the brief's last two sections (on one-note instruments as Roots, Arpeggio and Melody: `windPattern` in `js/chordsheet.js`) and Songs to learn (folk melodies in `js/songs.js`, each read from a published score with its source and licence noted) are built (at the owner's request). The rest of the songs project (MusicXML/MIDI import, a large song catalogue) is still for later: don't build it unless asked. Melodies follow the same rule as fingering charts: from a published source, never from memory.
- If anything in the brief conflicts with the code, stop and ask rather than guessing.

## Design consistency (reuse, don't copy)
- Every instrument uses the same screens and components. A screen that exists for one instrument (Chords, Playlists — one kind of list, stored as progressions —, Set up, a sheet, a card, a list row) is built from shared parts, and another instrument plugs its own content into them instead of getting its own version. The Chords screen is `chordsScreenHtml` / `chordCardHtml` / `chordRowHtml` in `js/app/views/chords.js`: an instrument gives its picture and its chord rows, nothing else.
- Before adding UI for one instrument, look for the pattern the others already use and reuse it (or extend the shared part so all of them get it). Only the parts that really differ between instruments (the picture of the instrument, its fingerings) are instrument-specific.
- When a screen's pattern changes, change the shared part so every instrument changes with it, and remove the old copy. `docs/design-system.md` lists the shared patterns; keep it up to date.

## Adding an instrument (kalimba, tongue drum, …)
Every instrument gets the same experience, in the app and on the website. A new instrument is not done until all of this exists for it:
- **Data from a published source** (see Data and database): its tunings/scales or fingering charts, with the source URL in the data file.
- **Its picture and its fingerings or strike map**: the only instrument-specific UI. Everything else plugs into the shared parts.
- **Its brand picture**: a 512 × 512 transparent WebP in `brand/instruments/` in the same style as the others (see `docs/design-system.md` §0), shown on its setup tile (`SETUP_TILES` in `js/app/views/setup.js`) and in the website's instrument list (`site/src/lib/pictures.ts`).
- **App, the same screens as every other instrument**: the beginner setup, one set of steps in one frame (struck instruments: default "Play my notes", where the app listens and works out the tuning, second "I know my scale/key"; wind instruments, whose fingerings come from their type's published chart: "Which one do you have?", then "Do you know its key?", with "I don't know: listen" and "play it my own way" beside it; details only behind "Show all"), the same four tabs (`instrumentTabs`: Chords, Songs, Playlists and its own), Chords (`chordsScreenHtml` / `chordCardHtml` / `chordRowHtml`), Songs to learn, Playlists (with chord sheets), Listen, Save (through the shared save sheet, so it syncs and works offline for accounts), Share, deep links in `js/links.js` (`/<family>/<slug>[/tab[/chord]]`) and a preview image under `og/`.
- **Its family everywhere it is listed**: `INSTRUMENT_FAMILIES` (`js/instruments.js`), `LINK_FAMILIES` / `LINK_TABS` (`js/links.js`), the rewrites in `vercel.json`, the matcher in `middleware.js`, `APP_PAGES` in `sw.js`, `APP_PATHS` in `site/next.config.ts`, and the `Family` type, schema list and seed document on the website. A one-note instrument also goes into the setup (`SETUP_WIND_WORDS`, `SETUP_WIND_TYPES`), `PLAY_POPULAR`, and `isTubeFamily` / `windWord` if it is a tube.
- **Sound**: a voice in `js/audio.js`. Instruments that sound one note at a time play chords as arpeggios (as the ocarina and flute do).
- **Website, the same pages as every other instrument**: its instrument page and one page per tuning (`site/src/app/(site)/instruments/[slug]/…`), with the **playable demo**: the instrument's own picture from the app's engine, chord buttons that play the chord with the app's sound and light the notes/fingerings, exactly as the handpan demo does. Its Sanity `instrument` document (copy, FAQ, status "available"; written in `site/src/content/seed.ts` and created in the live content by a named fix in `site/scripts/content-fixes.ts`, which the production build runs once), and it appears in the home page list, the sitemap and the request form.
- **Makers**: the family is in `MAKER_FAMILIES` (`js/makers.js`) and in the `makers.families` check of a new migration, so makers can say they make it (a test compares the list with the link families).
- **Tests**: data round-trips (every tuning has a link, `parseLink(linkFor(x))`), chords found on at least one real tuning, the site's engine tests for the new family.
- **Docs**: `docs/design-system.md` (anything new in the shared patterns) and this checklist if something was missing.

## Makers and shops
- The design is `docs/makers-programme.md`; read it before changing anything for makers. Makers and shops are one of the two public audiences (the other is players). The clay ocarina builder (`profiles.can_build`) is internal and is never offered to makers.
- Who made an instrument is only ever what the server says for its code (`open_shared_instrument`). Never read a maker from shared data or from a link.
- Scan counts are counts: no cookies, no stored identifiers, no IP addresses. Anything that would identify a buyer needs the owner's decision first.

## Docs
- Every document in `docs/` has a **status line** directly under its title, one of: **current** (describes the product or the plan as it is now; keep it true), **plan** (agreed or proposed, not done yet: say what is and isn't built), **built** (a design record of something that has shipped; the code wins where they differ) or **history** (kept for the record; don't work from it). A document with mixed parts says which part is which.
- A pull request that makes a document untrue updates that document in the same pull request: the status line, and any sentence that says a thing is "not built yet", "for later" or "for review" when it no longer is. Check `docs/messaging.md` (feature names, the free/account line, numbers), `docs/video-plan.md` (shots marked "(needs: …)" that your change makes filmable, and taps or labels your change renames), `docs/launch-campaign.md` and `docs/design-system.md`.
- One topic, one document: merge into the existing document instead of adding a second version next to it. How Oakhum is described (names of features, what is free, tone) comes from `docs/messaging.md`; the website copy, videos and posts follow it.
- The clay ocarina builder is an internal tool: it does not appear in marketing copy, videos or the maker kit.

## Help and docs
The help centre (oakhum.com/help, the app's Help sheet, and the exports an AI assistant reads) is built from `help/en/*.md` and the feature registry `js/features.js`. Design: `docs/help-centre.md`.
- Every pull request that adds, renames, moves or removes something a user sees updates, in the same pull request: its entry in `js/features.js`, its help article (new feature: new article or a new `##` section; removed feature: remove both), and the article's `verified` date once you have re-read it against the running app.
- A new screen, section or sheet gets a "?" (`uiHelp('article', 'anchor')` in `js/app.js`, or `uiSheet({ help })`) next to its heading, pointing at the section of the article that explains it.
- Names live in one place. Articles never spell a tab, button or feature name: they write `{{id}}` and `js/features.js` holds the text exactly as the app shows it.
- Never describe a screen you have not opened. Walk the built app (`python3 build.py`, served with the deep-link fallback) before writing or re-verifying an article.
- Pictures are made by `node scripts/help-screenshots.mjs` from `help/screenshots.json`, never by hand. Re-run it when a pictured screen changes.
- Anchors (`{#like-this}`) and article ids are permanent: they are links on other sites and citation ids for an assistant. Reword a heading freely; keep its anchor.
- Help never states a tuning's notes, a fingering or a chord's notes: it links into the app, where that data comes from published sources.
- No public help for the clay ocarina builder (internal).
- `node --test` (`tests/help.test.mjs`) and `site`'s `pnpm test` fail when any of this is out of step.

## Data and database
- Database changes are additive only: new tables, columns, functions or policies, never altering or dropping existing ones. Write them as new SQL files under `supabase/migrations/` (`YYYYMMDD_short_name.sql`); the build applies them automatically (`supabase/migrate.py`, see `supabase/README.md`). Never edit a migration file after it has been merged: add a new one. Never ask for, print or commit the database connection string or any Supabase secret key; it lives only in Vercel's environment variables.
- Fingering charts and instrument ranges must come from a published source (maker or manufacturer chart), with the source URL noted in the data file. Never fill them in from memory. If no reliable source is found, leave a clearly marked TODO with the data structure in place.

## Build
- `build.py` bundles `styles.css` and the files in its `js_files` list into `index.html` (imports and `export` keywords are stripped, everything shares one script scope). Vercel runs it on every deploy. `index.html` is build output and is **not committed** (it's in `.gitignore`): run `python3 build.py` locally to try the app, but never add `index.html` to a commit.
- New JS files go into `js_files` in the order the brief gives: `js/ocarina.js` and `js/tuner.js` after `js/chords.js`, `js/ocarina-ui.js` after `js/pan.js`.
- Because the bundle is one scope, top-level names must be unique across all `js/` files.
- The app itself is `js/app/` (it was one `js/app.js`; `docs/app-structure-plan.md` lists the files). Its files come after the engine files in `js_files`: `js/app/state.js` first, `js/app/actions.js` second, `js/app/main.js` (the bootstrap and the event listeners) last. A `const` or `let` that code reads while the page loads must be in an earlier file than that code, and two listeners for the same event keep their order, so a new file goes where its top-level statements ran before. App files import what they use from the engine files; names from other `js/app/` files are shared through the one scope.
- Every control carries `data-action`; the screen that owns it registers the handler with `registerActions({ 'name': (el, e, action) => { … } })` in its own file (`CHANGE_ACTIONS` for selects and inputs, `EARLY_ACTIONS` for the few that run before a menu row closes its menu). A name registered twice stops the app at load. Don't add branches to the listeners in `js/app/main.js`.

## Tests
- Unit tests live in `tests/*.test.mjs` and use only `node:test` and `node:assert` (no dependencies, no package.json). Run them with `node --test` from the repo root.
- Run the tests and `python3 build.py` before every commit (the build checks the bundle; its output stays uncommitted).
- Browser tests live in `tests/e2e/*.e2e.mjs` (Playwright, headless Chromium, a stand-in for Supabase from `tests/e2e/harness.mjs`): `smoke.e2e.mjs` opens the app the way people do (first-run setup, one deep link per instrument family, a chord, a song, Playlists, Settings, hostile links) and fails on any page error, console error or missing file; `accounts.e2e.mjs` covers sign-in, sync and offline. Run them with `scripts/e2e.sh` after a build. The app (`js/app/`) has no unit tests, so this is its safety net: when a pull request adds a screen or a flow, add a step that opens it.
- `scripts/ci.sh` runs everything a pull request must pass (unit tests, build, browser tests, the website's tests and build); CI runs the same script.
