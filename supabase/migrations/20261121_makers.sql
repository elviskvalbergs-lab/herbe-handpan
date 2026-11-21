-- The makers programme, phase 1 (docs/makers-programme.md): the maker role,
-- the public maker profile, codes for individual instruments and "Made by"
-- on an instrument opened by code.
-- Additive only: two new columns on profiles, new tables and new functions.
-- get_shared_instrument stays as it is (older app versions keep using it).
-- Every new table has row-level security on and no write policy: writes go
-- through the security-definer functions below, as save_item does.
-- Supabase grants new functions to anon and authenticated by default, so the
-- helpers are revoked from those roles by name, not only from public.
-- Applied automatically by the build (supabase/migrate.py) when DATABASE_URL is set.

-- ── Roles ────────────────────────────────────────────────────────────────────
-- is_maker: set when a maker request is approved (the trigger below keeps it
-- in step with makers.status). is_admin: ticked by the owner in Supabase on
-- their own row; it opens the review list in the app.
alter table public.profiles add column if not exists is_maker boolean not null default false;
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- ── Maker profiles ───────────────────────────────────────────────────────────
create table if not exists public.makers (
  id           uuid        primary key default gen_random_uuid(),
  owner_id     uuid        not null unique references auth.users (id) on delete cascade,
  slug         text        not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$'),
  name         text        not null check (char_length(name) between 2 and 60),
  kind         text        not null default 'maker' check (kind in ('maker', 'shop')),
  place        text        check (char_length(place) <= 80),
  country      text        check (country ~ '^[A-Z]{2}$'),
  website      text        check (website ~ '^https://[^\s<>"'']+$' and char_length(website) <= 200),
  story        text        check (char_length(story) <= 1200),
  story_lang   text        check (story_lang ~ '^[a-z]{2}$'),
  families     text[]      not null default '{}'
                           check (families <@ array['handpan', 'tongue-drum', 'kalimba', 'ocarina', 'flute']),
  -- A small raster picture, shrunk on the device. Never SVG.
  logo         text        check (logo ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' and char_length(logo) <= 90000),
  listed       boolean     not null default true,   -- shown in the website's directory
  request_note text        check (char_length(request_note) <= 600),  -- for the reviewer only
  status       text        not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  status_note  text        check (char_length(status_note) <= 600),   -- the reviewer's words to the maker
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  requested_at timestamptz not null default now(),
  reviewed_at  timestamptz
);

alter table public.makers enable row level security;

-- A code for one physical instrument (a serial number) of a shared
-- instrument. The instrument's own share code (instruments.public_id) is the
-- model's code; these open the same instrument.
create table if not exists public.maker_codes (
  code          text        primary key check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  owner_id      uuid        not null,
  instrument_id text        not null,
  serial        text        not null check (char_length(serial) between 1 and 40),
  created_at    timestamptz not null default now(),
  retired_at    timestamptz,
  foreign key (owner_id, instrument_id) references public.instruments (owner_id, id) on delete cascade,
  unique (owner_id, instrument_id, serial)
);

alter table public.maker_codes enable row level security;

-- Reports of a maker profile, read by admins.
create table if not exists public.maker_reports (
  id          uuid        primary key default gen_random_uuid(),
  maker_id    uuid        not null references public.makers (id) on delete cascade,
  reason      text        not null check (reason in ('not-them', 'offensive', 'spam', 'other')),
  detail      text        check (char_length(detail) <= 500),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists maker_reports_maker on public.maker_reports (maker_id, created_at);

alter table public.maker_reports enable row level security;

-- Makers read their own profile row and their own codes. Nobody else reads
-- these tables directly: the public parts come from get_maker / list_makers.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'makers' and policyname = 'makers: owner reads') then
    create policy "makers: owner reads" on public.makers for select using (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'maker_codes' and policyname = 'maker_codes: owner reads') then
    create policy "maker_codes: owner reads" on public.maker_codes for select using (auth.uid() = owner_id);
  end if;
end
$$;

-- The role follows the status, whoever changes it (review_maker, or the
-- owner editing the cell in Supabase).
create or replace function public.makers_sync_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, is_maker)
  values (new.owner_id, new.status = 'approved')
  on conflict (user_id) do update set is_maker = excluded.is_maker
    where public.profiles.is_maker is distinct from excluded.is_maker;
  return new;
end;
$$;

revoke all on function public.makers_sync_role() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'makers_sync_role' and tgrelid = 'public.makers'::regclass) then
    create trigger makers_sync_role after insert or update of status on public.makers
      for each row execute function public.makers_sync_role();
  end if;
end
$$;

-- The public part of a maker, as the app and the website show it.
create or replace function public.maker_public_card(m public.makers)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'slug', m.slug, 'name', m.name, 'kind', m.kind, 'place', m.place, 'country', m.country,
    'website', m.website, 'story', m.story, 'story_lang', m.story_lang, 'families', to_jsonb(m.families),
    'logo', m.logo);
$$;

revoke all on function public.maker_public_card(public.makers) from public, anon, authenticated;

-- The caller's own maker state: { is_maker, is_admin, maker, waiting }.
-- maker is their profile row (null before a request); waiting is the number
-- of requests and reports to look at, for admins.
create or replace function public.my_maker()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  p     public.profiles;
  m     public.makers;
  n     integer := 0;
begin
  if uid is null then
    return jsonb_build_object('is_maker', false, 'is_admin', false, 'maker', null, 'waiting', 0);
  end if;
  select * into p from public.profiles where user_id = uid;
  select * into m from public.makers where owner_id = uid;
  if coalesce(p.is_admin, false) then
    select (select count(*) from public.makers where status = 'pending')
         + (select count(*) from public.maker_reports where resolved_at is null) into n;
  end if;
  return jsonb_build_object(
    'is_maker', coalesce(p.is_maker, false),
    'is_admin', coalesce(p.is_admin, false),
    'maker', case when m.id is null then null else to_jsonb(m) - 'owner_id' end,
    'waiting', n);
end;
$$;

revoke all on function public.my_maker() from public, anon;
grant execute on function public.my_maker() to authenticated;

-- Creates or edits the caller's maker profile from
-- { slug, name, kind, place, country, website, story, story_lang, families,
--   logo, listed, request_note }.
-- The first save is the request (status 'pending'); saving a rejected
-- profile sends it again. The slug is fixed once the profile was approved.
-- Returns { ok: true, maker } or { ok: false, error: 'slug-taken' | 'slug-reserved' }.
create or replace function public.save_maker_profile(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  cur   public.makers;
  v_slug text := lower(btrim(coalesce(p->>'slug', '')));
  fams  text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p->'families', '[]'::jsonb))), '{}');
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into cur from public.makers where owner_id = uid for update;

  if found and cur.status in ('approved', 'suspended') then
    v_slug := cur.slug;   -- links to the page must keep working
  end if;
  if v_slug in ('admin', 'oakhum', 'request', 'requests', 'makers', 'maker', 'new', 'edit', 'api', 'embed',
                'studio', 'play', 'privacy', 'terms', 'about', 'help', 'support', 'directory', 'instruments') then
    return jsonb_build_object('ok', false, 'error', 'slug-reserved');
  end if;
  if exists (select 1 from public.makers where slug = v_slug and owner_id <> uid) then
    return jsonb_build_object('ok', false, 'error', 'slug-taken');
  end if;

  if not found then
    insert into public.makers (owner_id, slug, name, kind, place, country, website, story, story_lang, families, logo, listed, request_note)
    values (uid, v_slug, btrim(p->>'name'), coalesce(nullif(p->>'kind', ''), 'maker'),
            nullif(btrim(p->>'place'), ''), nullif(upper(btrim(p->>'country')), ''), nullif(btrim(p->>'website'), ''),
            nullif(btrim(p->>'story'), ''), nullif(lower(btrim(p->>'story_lang')), ''), fams,
            nullif(p->>'logo', ''), coalesce((p->>'listed')::boolean, true), nullif(btrim(p->>'request_note'), ''))
    returning * into cur;
  else
    update public.makers set
      slug = v_slug,
      name = btrim(p->>'name'),
      kind = coalesce(nullif(p->>'kind', ''), 'maker'),
      place = nullif(btrim(p->>'place'), ''),
      country = nullif(upper(btrim(p->>'country')), ''),
      website = nullif(btrim(p->>'website'), ''),
      story = nullif(btrim(p->>'story'), ''),
      story_lang = nullif(lower(btrim(p->>'story_lang')), ''),
      families = fams,
      logo = nullif(p->>'logo', ''),
      listed = coalesce((p->>'listed')::boolean, true),
      request_note = nullif(btrim(p->>'request_note'), ''),
      status = case when cur.status = 'rejected' then 'pending' else cur.status end,
      requested_at = case when cur.status = 'rejected' then now() else cur.requested_at end,
      updated_at = now()
    where owner_id = uid
    returning * into cur;
  end if;
  return jsonb_build_object('ok', true, 'maker', to_jsonb(cur) - 'owner_id');
end;
$$;

revoke all on function public.save_maker_profile(jsonb) from public, anon;
grant execute on function public.save_maker_profile(jsonb) to authenticated;

-- ── Review (admins) ──────────────────────────────────────────────────────────
create or replace function public.is_admin_caller()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where user_id = auth.uid()), false);
$$;

revoke all on function public.is_admin_caller() from public, anon, authenticated;

-- Every maker (newest request first) and the open reports, for the review list.
create or replace function public.admin_list_makers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin_caller() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'makers', coalesce((select jsonb_agg(to_jsonb(m) - 'owner_id' order by m.requested_at desc) from public.makers m), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'maker_id', r.maker_id, 'name', m.name, 'slug', m.slug,
                                          'reason', r.reason, 'detail', r.detail, 'created_at', r.created_at) order by r.created_at desc)
        from public.maker_reports r join public.makers m on m.id = r.maker_id
       where r.resolved_at is null), '[]'::jsonb));
end;
$$;

revoke all on function public.admin_list_makers() from public, anon;
grant execute on function public.admin_list_makers() to authenticated;

-- Approve, reject (with a sentence the maker sees), suspend or reopen.
create or replace function public.review_maker(p_maker_id uuid, p_status text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cur public.makers;
begin
  if not public.is_admin_caller() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'approved', 'rejected', 'suspended') then
    raise exception 'unknown status %', p_status using errcode = '22023';
  end if;
  update public.makers
     set status = p_status, status_note = nullif(btrim(left(p_note, 600)), ''), reviewed_at = now(), updated_at = now()
   where id = p_maker_id
   returning * into cur;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not-found');
  end if;
  return jsonb_build_object('ok', true, 'maker', to_jsonb(cur) - 'owner_id');
end;
$$;

revoke all on function public.review_maker(uuid, text, text) from public, anon;
grant execute on function public.review_maker(uuid, text, text) to authenticated;

create or replace function public.resolve_maker_report(p_report_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_caller() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  update public.maker_reports set resolved_at = now() where id = p_report_id and resolved_at is null;
  return found;
end;
$$;

revoke all on function public.resolve_maker_report(uuid) from public, anon;
grant execute on function public.resolve_maker_report(uuid) to authenticated;

-- ── Public reads ─────────────────────────────────────────────────────────────
-- The instruments a maker shows: their shared instruments, unless "Made by"
-- is switched off on one (data.hideMaker).
create or replace function public.maker_public_instruments(p_owner uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', i.public_id,
           'name', i.data->>'name',
           'family', coalesce(i.data->>'family', 'handpan'),
           'scale', case when coalesce(i.data->'layout'->>'isCustom', 'false') = 'true' then null else i.data->'layout'->>'id' end
         ) order by i.data->>'name'), '[]'::jsonb)
    from public.instruments i
   where i.owner_id = p_owner and i.public_id is not null and i.deleted_at is null
     and coalesce(i.data->>'hideMaker', 'false') <> 'true';
$$;

revoke all on function public.maker_public_instruments(uuid) from public, anon, authenticated;

-- One approved maker's public page, or null.
create or replace function public.get_maker(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.maker_public_card(m) || jsonb_build_object('instruments', public.maker_public_instruments(m.owner_id))
    from public.makers m
   where m.slug = lower(p_slug) and m.status = 'approved';
$$;

revoke all on function public.get_maker(text) from public;
grant execute on function public.get_maker(text) to anon, authenticated;

-- The directory: approved makers who chose to be listed.
create or replace function public.list_makers()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
           (public.maker_public_card(m) - 'story' - 'story_lang' - 'website')
           || jsonb_build_object('instruments', jsonb_array_length(public.maker_public_instruments(m.owner_id)))
           order by m.name), '[]'::jsonb)
    from public.makers m
   where m.status = 'approved' and m.listed;
$$;

revoke all on function public.list_makers() from public;
grant execute on function public.list_makers() to anon, authenticated;

-- Anyone may report an approved maker's profile. At most 20 a day per maker
-- are kept, so the list can't be flooded.
create or replace function public.report_maker(p_slug text, p_reason text, p_detail text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  mid uuid;
begin
  select id into mid from public.makers where slug = lower(p_slug) and status = 'approved';
  if mid is null or p_reason not in ('not-them', 'offensive', 'spam', 'other') then
    return false;
  end if;
  if (select count(*) from public.maker_reports where maker_id = mid and created_at > now() - interval '1 day') >= 20 then
    return true;   -- quietly dropped
  end if;
  insert into public.maker_reports (maker_id, reason, detail) values (mid, p_reason, nullif(btrim(left(p_detail, 500)), ''));
  return true;
end;
$$;

revoke all on function public.report_maker(text, text, text) from public;
grant execute on function public.report_maker(text, text, text) to anon, authenticated;

-- ── Opening a code ───────────────────────────────────────────────────────────
-- Which instrument a code opens: the instrument's own share code, or a
-- serial number's code that isn't retired.
create or replace function public.resolve_shared_code(p_code text, out owner_id uuid, out instrument_id text, out serial text)
language sql
stable
security definer
set search_path = public
as $$
  select x.owner_id, x.instrument_id, x.serial from (
    select i.owner_id, i.id as instrument_id, null::text as serial, 1 as ord
      from public.instruments i
     where i.public_id = upper(p_code) and i.deleted_at is null
    union all
    select c.owner_id, c.instrument_id, c.serial, 2
      from public.maker_codes c
      join public.instruments i on i.owner_id = c.owner_id and i.id = c.instrument_id
     where c.code = upper(p_code) and c.retired_at is null and i.deleted_at is null
  ) x order by x.ord limit 1;
$$;

revoke all on function public.resolve_shared_code(text) from public, anon, authenticated;

-- Anyone, signed in or not, opens an instrument by its exact code:
-- { data, code, model_code, serial, maker }. maker is the approved maker who
-- shared it (null for everyone else, and when "Made by" is off on it).
-- The maker always comes from here, never from the instrument's own data.
create or replace function public.open_shared_instrument(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'data', i.data,
           'code', upper(p_code),
           'model_code', i.public_id,
           'serial', r.serial,
           'maker', (select public.maker_public_card(m) from public.makers m
                      where m.owner_id = i.owner_id and m.status = 'approved'
                        and coalesce(i.data->>'hideMaker', 'false') <> 'true'))
    from public.resolve_shared_code(p_code) r
    join public.instruments i on i.owner_id = r.owner_id and i.id = r.instrument_id;
$$;

revoke all on function public.open_shared_instrument(text) from public;
grant execute on function public.open_shared_instrument(text) to anon, authenticated;

-- The few words a link preview needs for a code: { name, family, serial,
-- maker } (the maker's name only), without the instrument's data.
create or replace function public.shared_instrument_card(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'name', i.data->>'name',
           'family', coalesce(i.data->>'family', 'handpan'),
           'serial', r.serial,
           'maker', (select m.name from public.makers m
                      where m.owner_id = i.owner_id and m.status = 'approved'
                        and coalesce(i.data->>'hideMaker', 'false') <> 'true'))
    from public.resolve_shared_code(p_code) r
    join public.instruments i on i.owner_id = r.owner_id and i.id = r.instrument_id;
$$;

revoke all on function public.shared_instrument_card(text) from public;
grant execute on function public.shared_instrument_card(text) to anon, authenticated;
