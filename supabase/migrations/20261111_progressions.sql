-- Progressions: ordered chord steps in which a chord can repeat
-- (docs/ocarina-mode.md, "Progressions: the same chord more than once").
-- Additive only: one new, nullable column on user_data. Nothing existing changes.
-- Applied automatically by the build (supabase/migrate.py) when DATABASE_URL is set.
--
-- The app reads and writes this column in requests of its own, separate from
-- the playlists / layouts / prefs upsert, so until this has been run the app
-- keeps working and progressions simply stay on the device. The existing
-- row-level security of user_data (each user reads and writes only their own
-- row) covers the new column as well.

alter table public.user_data
  add column if not exists progressions jsonb;
