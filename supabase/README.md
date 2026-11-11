# Supabase

The app talks to Supabase with the project URL and publishable key in
`js/auth.js`. No secret keys are used or needed.

## Migrations

`migrations/` holds SQL to run by hand in the Supabase SQL editor, in file
name order. They are additive only: new tables, columns and functions,
never changes to existing ones.

| File | What it adds |
| --- | --- |
| `20261111_instruments.sql` | `instruments` table (sync of ocarinas and other instruments, owner-only by row-level security) and `get_shared_instrument(public_id)` for read-only sharing by public ID |

Until a migration is run, the features that need it fail quietly: the app
keeps working, instruments just stay on the device and sharing says it
isn't available.

## Test project for preview builds

Every build shares the production database unless told otherwise. To point
Vercel preview builds at a separate test project:

1. Create a second Supabase project, enable email sign-in, create the
   `user_data` table the same way as in production, and run the migrations.
2. In Vercel → Project → Settings → Environment Variables, add for the
   **Preview** environment only:
   - `HP_SUPABASE_URL`: the test project's URL
   - `HP_SUPABASE_KEY`: the test project's publishable key
3. Redeploy a preview. `build.py` swaps these into the bundle; production
   builds, which don't have the variables, keep the values in `js/auth.js`.
