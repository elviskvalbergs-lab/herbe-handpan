# herbe-handpan: standing rules for Claude Code sessions

Design brief for the ocarina work: `docs/ocarina-mode.md`. Read it before starting a phase.

## Branches and pull requests
- Work on one feature branch per phase from the brief's Build order (for example `ocarina/phase-1-maths`), branched off `preview`, and open a pull request into `preview`.
- Never push to `preview` directly. Never merge pull requests yourself.

## Commits
- Commits must be authored by the GitHub account elviskvalbergs-lab, because Vercel blocks deployments from other commit authors.
- Before the first commit in a session, check `git config user.name` and `git config user.email` and tell the user what they are. If they don't belong to elviskvalbergs-lab, stop and ask before committing.
- Do not add a "Co-Authored-By" line or a "Generated with Claude Code" line to commits or pull request descriptions.

## Scope
- Don't change existing handpan behaviour unless the current phase says so.
- The last two sections of the brief (songs, and from chord sheet to playing) are a later project. Keep them in mind when designing the instrument model, but don't build them.
- If anything in the brief conflicts with the code, stop and ask rather than guessing.

## Data and database
- Database changes are additive only: new tables, columns, functions or policies, never altering or dropping existing ones. Write them as new SQL files under `supabase/migrations/` (`YYYYMMDD_short_name.sql`); the build applies them automatically (`supabase/migrate.py`, see `supabase/README.md`). Never edit a migration file after it has been merged: add a new one. Never ask for, print or commit the database connection string or any Supabase secret key; it lives only in Vercel's environment variables.
- Fingering charts and instrument ranges must come from a published source (maker or manufacturer chart), with the source URL noted in the data file. Never fill them in from memory. If no reliable source is found, leave a clearly marked TODO with the data structure in place.

## Build
- `build.py` bundles `styles.css` and the files in its `js_files` list into `index.html` (imports and `export` keywords are stripped, everything shares one script scope). Vercel runs it on deploy, and `index.html` is also committed: run `python3 build.py` and commit the regenerated `index.html` with every JS or CSS change.
- New JS files go into `js_files` in the order the brief gives: `js/ocarina.js` and `js/tuner.js` after `js/chords.js`, `js/ocarina-ui.js` after `js/pan.js`.
- Because the bundle is one scope, top-level names must be unique across all `js/` files.

## Tests
- Unit tests live in `tests/*.test.mjs` and use only `node:test` and `node:assert` (no dependencies, no package.json). Run them with `node --test` from the repo root.
- Run the tests and `python3 build.py` before every commit.
