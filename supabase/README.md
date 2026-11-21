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
| `20261116_accounts.sql` | `profiles` (signup source and intent, last seen date), `saved_items` (sync by item, owner reads; writes only through `save_item`, which bumps a version and returns the current row on a conflict), `touch_last_seen()`, `delete_my_account()` (deletes the user and every row they own) |
| `20261117_legacy_import.sql` | `profiles.legacy_imported_at` and `import_legacy_data()`: once per account, copies what the first app versions kept (`user_data` layouts, playlists, progressions and prefs; ocarinas and flutes in `instruments`) into `saved_items`, adding only what isn't there yet |
| `20261121_makers.sql` | The makers programme (docs/makers-programme.md): `profiles.is_maker` and `profiles.is_admin`; `makers` (the public profile and its status), `maker_codes` (a code per serial number), `maker_reports`; `my_maker()`, `save_maker_profile()`, `review_maker()`, `admin_list_makers()`, `resolve_maker_report()` for accounts, and `get_maker()`, `list_makers()`, `report_maker()`, `open_shared_instrument()`, `shared_instrument_card()` for everyone. No table can be written directly |
| `20261121_saved_item_size.sql` | `saved_items_check_size()` and the `saved_items_size` trigger: an item's data may be at most 1 MB and its id 200 characters; a larger write is refused with `item_too_large`, which the app reports and keeps on the device |

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

## Sign-in setup (the owner, in Supabase → Authentication)

The app signs in with an emailed code (works now), and shows **Continue with
Google** and **Continue with Apple** as soon as each is switched on here (it
reads the enabled providers from Supabase's public auth settings, so no app
change is needed).

1. **URL Configuration → Redirect URLs:** add `https://oakhum-site.vercel.app/**`
   (the shared domain: the website with the app at /play), `https://oakhum.vercel.app/**`
   and `https://handpan.herbe.app/**` (and the custom domain once it's set
   up). Sign-in links and Google/Apple come back to the page you were on;
   without this they land on the Site URL instead.
2. **Email Templates → Magic Link:** put both the code and the link in the
   email, for example:
   `<p>Your Oakhum code: <strong>{{ .Token }}</strong></p><p>Or open this link on the same device: <a href="{{ .ConfirmationURL }}">sign in</a></p>`
3. **Google:** in Google Cloud Console → APIs & Services → Credentials,
   create an OAuth client ID (Web application) with the authorised redirect
   URI shown in Supabase → Providers → Google (`https://<project>.supabase.co/auth/v1/callback`).
   Paste its client ID and secret into Supabase → Providers → Google and
   switch it on.
4. **Apple:** in the Apple Developer site → Certificates, Identifiers &
   Profiles: create a Services ID (Sign in with Apple, with the same
   Supabase callback URL as its return URL and the Supabase domain) and a
   key with Sign in with Apple. In Supabase → Providers → Apple, fill in the
   Services ID, Team ID, Key ID and the key, and switch it on. Apple's key
   expires after six months: renew it there.

## Who can build ocarinas

Building a clay ocarina (the wizard's "I'm making one", the Build tab and
Settings › Clay bodies) is hidden from everyone except accounts you choose.
To turn it on for someone: they sign in to the app once (that creates their
row), then in Supabase → Table Editor → `profiles` tick **can_build** on
their row (find it by `user_id`, which Authentication → Users shows next to
their email). The app picks it up at their next start or sign-in. Untick it
to hide building again; their instruments stay, they just play them.

## Makers: who approves, and how

Makers and shops ask for the maker role in the app (Settings › Makers and
shops). Nothing of theirs is public until a request is approved.

1. **Once:** make yourself the reviewer. Sign in to the app, then in Supabase
   → Table Editor → `profiles` tick **is_admin** on your row (find it by
   `user_id`, shown next to your email under Authentication → Users).
2. **Each request:** in the app, Settings › Makers and shops › Requests and
   reports: Approve, or "Not now…" with a sentence the maker will see.
   Approving sets `makers.status` to `approved` and gives the account
   `profiles.is_maker`. Editing the `status` cell in Supabase does the same
   (a trigger keeps the role in step).
3. **Taking a page down:** "Suspend…" in the same list. The maker's page,
   directory entry and "Made by" disappear at once; their codes keep opening
   the instruments.

## Testing the SQL

`tests/makers-sql.test.mjs` applies every migration to a throwaway database
(after `supabase/tests/stubs.sql`, which stands in for what Supabase
provides: the `anon` and `authenticated` roles, `auth.users`, `auth.uid()`),
runs each migration a second time, then runs `supabase/tests/*.sql`, which
act as a guest, a maker, another maker and an admin.

It needs `psql` and a local Postgres, and is skipped without them:

```
HP_TEST_DATABASE_URL=postgresql://postgres:<password>@localhost:5432/postgres node --test
```

The same variable runs the browser check of the maker screens against the
real functions: `python3 build.py && node tests/e2e/makers.e2e.mjs`.
