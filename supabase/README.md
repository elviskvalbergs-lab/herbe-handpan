# Supabase

The app talks to Supabase with the project URL and publishable key in
`js/auth.js`. The browser never gets any secret key.

## Migrations are applied automatically on deploy

`migrations/` holds the SQL files; `migrate.py` applies them. Every Vercel
build runs `build.py`, which first runs `migrate.py` when the environment
variable `DATABASE_URL` is set:

- Pending files are applied in file-name order, each in its own transaction.
- Applied files are recorded in `public._hp_migrations` (name, SHA-256,
  time), so each runs exactly once. Editing a file after it was applied
  only prints a warning: put further changes in a new file.
- A failing migration rolls back and **stops the build**, so code that
  needs the change never deploys without it (production keeps running the
  previous version).
- An advisory lock keeps two builds from migrating the same database at once.
- Local builds without the variable skip this step.

Migrations stay additive only: new tables, columns, functions and policies,
never changes to existing ones. Name new files `YYYYMMDD_short_name.sql`.

| File | What it adds |
| --- | --- |
| `20261111_instruments.sql` | `instruments` table (sync of ocarinas and other instruments, owner-only by row-level security) and `get_shared_instrument(public_id)` for read-only sharing by public ID |
| `20261111_progressions.sql` | nullable `progressions` jsonb column on `user_data` (sync of chord progressions, read and written in requests of their own) |

Until a migration has been applied, the features that need it fail quietly:
the app keeps working, instruments and progressions stay on the device and
sharing says it isn't available.

## One-time setup (the owner, in Vercel)

1. In Supabase → the project → **Connect**, copy the **Session pooler**
   connection string (`postgresql://postgres.<ref>:<password>@aws-…pooler.supabase.com:5432/postgres`)
   and put in the database password. Use the pooler, not the direct
   connection: the direct host is IPv6-only and Vercel's build machines
   may not reach it.
2. In Vercel → Project → Settings → **Environment Variables**, add
   `DATABASE_URL` with that value for the **Production** environment.
3. Redeploy production (or merge the next PR). The build log shows
   `[migrate] … applied`.

The value lives only in Vercel. It is never committed, printed or sent to
the browser.

## Test project for preview builds

Every build shares the production database unless told otherwise, and with
`DATABASE_URL` set for Preview a pull request's build would migrate
production before the PR is merged. To give previews their own database:

1. Create a second Supabase project, enable email sign-in, and create the
   `user_data` table the same way as in production (the migrations then add
   everything else on the first preview build).
2. In Vercel → Environment Variables, for the **Preview** environment only:
   - `DATABASE_URL`: the test project's session pooler connection string
   - `HP_SUPABASE_URL`: the test project's URL
   - `HP_SUPABASE_KEY`: the test project's publishable key
3. Redeploy a preview. `build.py` migrates the test database and swaps the
   test URL and key into the bundle; production keeps the values in
   `js/auth.js`.

Without a test project, leave `DATABASE_URL` unset for Preview: previews
then don't migrate anything, and new tables appear only once the PR is
merged and production deploys.
