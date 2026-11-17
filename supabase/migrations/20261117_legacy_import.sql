-- One-time import of what the first app versions kept per account into
-- saved_items: the one user_data row (layouts, playlists, progressions,
-- prefs) and the ocarinas and flutes in instruments. The accounts migration
-- (20261116) started saved_items without bringing these over, so an account
-- from before it signed in to an empty My instruments.
-- Additive only: one new column on profiles and one new function. Nothing
-- existing is changed or removed; user_data and instruments stay as they are.
-- Applied automatically by the build (supabase/migrate.py) when DATABASE_URL is set.

alter table public.profiles add column if not exists legacy_imported_at timestamptz;

-- Called by the app once an account starts syncing. Copies each old item
-- that saved_items doesn't hold yet (nothing is overwritten), marks the
-- profile so it never runs twice, and returns how many items it added.
create or replace function public.import_legacy_data()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  added integer := 0;
  n integer;
  udj jsonb;
  has_ud boolean;
begin
  if uid is null then return 0; end if;
  insert into public.profiles (user_id) values (uid) on conflict (user_id) do nothing;
  if exists (select 1 from public.profiles where user_id = uid and legacy_imported_at is not null) then
    return 0;
  end if;

  select to_regclass('public.user_data') is not null into has_ud;
  if has_ud then
    execute 'select to_jsonb(u) from public.user_data u where u.user_id = $1' into udj using uid;
  end if;

  if udj is not null then
    -- Saved layouts (handpans, tongue drums, kalimbas), without deleted ones.
    insert into public.saved_items (owner_id, kind, id, data, edited_at, device_kind)
      select uid, 'layout', e->>'id', e, now(), 'import'
      from jsonb_array_elements(case when jsonb_typeof(udj->'layouts') = 'array' then udj->'layouts' else '[]'::jsonb end) e
      where jsonb_typeof(e) = 'object' and e->>'id' is not null and e->>'deletedAt' is null
      on conflict (owner_id, kind, id) do nothing;
    get diagnostics n = row_count; added := added + n;

    insert into public.saved_items (owner_id, kind, id, data, edited_at, device_kind)
      select uid, 'playlist', e->>'id', e, now(), 'import'
      from jsonb_array_elements(case when jsonb_typeof(udj->'playlists') = 'array' then udj->'playlists' else '[]'::jsonb end) e
      where jsonb_typeof(e) = 'object' and e->>'id' is not null and e->>'deletedAt' is null
      on conflict (owner_id, kind, id) do nothing;
    get diagnostics n = row_count; added := added + n;

    insert into public.saved_items (owner_id, kind, id, data, edited_at, device_kind)
      select uid, 'progression', e->>'id', e, now(), 'import'
      from jsonb_array_elements(case when jsonb_typeof(udj->'progressions') = 'array' then udj->'progressions' else '[]'::jsonb end) e
      where jsonb_typeof(e) = 'object' and e->>'id' is not null and e->>'deletedAt' is null
      on conflict (owner_id, kind, id) do nothing;
    get diagnostics n = row_count; added := added + n;

    if jsonb_typeof(udj->'prefs') = 'object' then
      insert into public.saved_items (owner_id, kind, id, data, edited_at, device_kind)
        values (uid, 'prefs', 'prefs', (udj->'prefs') || '{"id": "prefs"}'::jsonb, now(), 'import')
        on conflict (owner_id, kind, id) do nothing;
    end if;
  end if;

  -- Ocarinas and flutes (handpan-like instruments are made from the layouts).
  insert into public.saved_items (owner_id, kind, id, data, edited_at, device_kind)
    select uid, 'instrument', i.id, i.data, now(), 'import'
    from public.instruments i
    where i.owner_id = uid and i.deleted_at is null and jsonb_typeof(i.data) = 'object'
      and coalesce(i.data->>'family', '') not in ('handpan', 'tongue-drum', 'kalimba')
    on conflict (owner_id, kind, id) do nothing;
  get diagnostics n = row_count; added := added + n;

  update public.profiles set legacy_imported_at = now() where user_id = uid;
  return added;
end;
$$;

revoke all on function public.import_legacy_data() from public;
grant execute on function public.import_legacy_data() to authenticated;
