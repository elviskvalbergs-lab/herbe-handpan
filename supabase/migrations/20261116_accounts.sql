-- Accounts: save, sync by item and account basics (docs/free-to-play.md,
-- Phase 4 steps 2–4, "Data model").
-- Additive only: new tables and functions. user_data and instruments stay as
-- they are; instruments keeps serving shared codes (get_shared_instrument).
-- Applied automatically by the build (supabase/migrate.py) when DATABASE_URL is set.

-- One row per person, nothing personal beyond what auth already holds.
create table if not exists public.profiles (
  user_id         uuid        primary key references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now(),
  privacy_version text,         -- the privacy notice version shown at sign-up
  signup_source   text,         -- the path they signed up on, e.g. '/handpan/d-kurd'
  signup_intent   text,         -- what they were saving, e.g. 'chord'
  last_seen_on    date,         -- set at most once a day
  can_build       boolean not null default false  -- may build ocarinas (the Build tab, clay bodies); ticked by the owner in Supabase
);

alter table public.profiles enable row level security;

-- Everything a person saves, one row per item.
create table if not exists public.saved_items (
  owner_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text        not null check (kind in ('playlist', 'progression', 'layout', 'instrument', 'prefs')),
  id          text        not null,
  data        jsonb       not null,
  version     bigint      not null default 1,       -- bumped by save_item on every write
  updated_at  timestamptz not null default now(),   -- server time of the last write
  edited_at   timestamptz,                          -- device time of the edit ("later edit wins")
  device_id   text,                                 -- random per install
  device_kind text,                                 -- 'phone' | 'tablet' | 'computer', to name a kept copy
  deleted_at  timestamptz,
  primary key (owner_id, kind, id)
);

create index if not exists saved_items_owner_updated on public.saved_items (owner_id, updated_at);

alter table public.saved_items enable row level security;

-- Owners read their own rows. Writes go through save_item only (there are
-- no insert / update policies), so every write bumps the version.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_items' and policyname = 'saved_items: owner reads') then
    create policy "saved_items: owner reads" on public.saved_items for select using (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles: owner reads') then
    create policy "profiles: owner reads" on public.profiles for select using (auth.uid() = user_id);
  end if;
end
$$;

-- Writes one item if the caller's copy started from the current version
-- (p_base_version; 0 for an item the device thinks is new). Otherwise
-- nothing is written and the current row comes back for a three-way merge
-- on the device. Returns { ok, version, updated_at } or { ok: false, current }.
create or replace function public.save_item(
  p_kind text, p_id text, p_data jsonb, p_base_version bigint,
  p_deleted boolean default false, p_edited_at timestamptz default null,
  p_device_id text default null, p_device_kind text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur public.saved_items;
  ts  timestamptz := clock_timestamp();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_kind not in ('playlist', 'progression', 'layout', 'instrument', 'prefs') then
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;

  select * into cur from public.saved_items
   where owner_id = uid and kind = p_kind and id = p_id
   for update;

  if not found then
    insert into public.saved_items (owner_id, kind, id, data, version, updated_at, edited_at, device_id, device_kind, deleted_at)
    values (uid, p_kind, p_id, p_data, 1, ts, p_edited_at, p_device_id, p_device_kind, case when p_deleted then ts end)
    on conflict (owner_id, kind, id) do nothing;
    if found then
      return jsonb_build_object('ok', true, 'version', 1, 'updated_at', ts);
    end if;
    -- Another device inserted it in the meantime: merge against theirs.
    select * into cur from public.saved_items where owner_id = uid and kind = p_kind and id = p_id;
    return jsonb_build_object('ok', false, 'current', to_jsonb(cur) - 'owner_id');
  end if;

  if cur.version <> coalesce(p_base_version, 0) then
    return jsonb_build_object('ok', false, 'current', to_jsonb(cur) - 'owner_id');
  end if;

  update public.saved_items
     set data = p_data, version = cur.version + 1, updated_at = ts, edited_at = p_edited_at,
         device_id = p_device_id, device_kind = p_device_kind,
         deleted_at = case when p_deleted then coalesce(cur.deleted_at, ts) else null end
   where owner_id = uid and kind = p_kind and id = p_id;
  return jsonb_build_object('ok', true, 'version', cur.version + 1, 'updated_at', ts);
end;
$$;

revoke all on function public.save_item(text, text, jsonb, bigint, boolean, timestamptz, text, text) from public;
grant execute on function public.save_item(text, text, jsonb, bigint, boolean, timestamptz, text, text) to authenticated;

-- Marks the account as used today (return counts without tracking anyone),
-- creating the profile on the first call with where and why they signed up.
create or replace function public.touch_last_seen(
  p_privacy_version text default null, p_signup_source text default null, p_signup_intent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  insert into public.profiles (user_id, privacy_version, signup_source, signup_intent, last_seen_on)
  values (uid, p_privacy_version, left(p_signup_source, 200), left(p_signup_intent, 40), current_date)
  on conflict (user_id) do update
    set last_seen_on = current_date
    where public.profiles.last_seen_on is distinct from current_date;
end;
$$;

revoke all on function public.touch_last_seen(text, text, text) from public;
grant execute on function public.touch_last_seen(text, text, text) to authenticated;

-- Deletes the caller's account. Every row they own goes with it
-- (on delete cascade: profiles, saved_items, instruments, user_data).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  -- user_data was created by hand before migrations existed, so its
  -- foreign key may not cascade: clear it (and instruments) explicitly.
  delete from public.user_data where user_id = uid;
  delete from public.instruments where owner_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
