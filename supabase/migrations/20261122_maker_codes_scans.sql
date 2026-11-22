-- The makers programme, phase 2 (docs/makers-programme.md): codes for
-- individual instruments (serial numbers), and counting how codes are used.
-- Additive only: new tables and functions.
--
-- What is counted is counts, never people (docs/makers-programme.md, "Scan
-- logging"): one row per code, day, country and source holds totals.
-- To count a device once a day, a hash of the day's random value, the code,
-- the request's address and browser name is kept for at most two days; the
-- random value is deleted with it, so the hash can't be worked out again or
-- linked to another day. No IP address is stored, and nothing is written on
-- the visitor's device.
-- Supabase grants new functions to anon and authenticated by default, so the
-- helpers are revoked from those roles by name, not only from public.
-- Applied automatically by the build (supabase/migrate.py) when DATABASE_URL is set.

-- ── Serial numbers ───────────────────────────────────────────────────────────
-- Gives each serial number of one of the caller's shared instruments its own
-- code. Serial numbers that already have a code keep it. At most 500 at a
-- time and 5,000 for one instrument.
-- Returns { ok: true, codes: [{ code, serial, created_at, retired_at }] } (all
-- of the instrument's codes) or { ok: false, error }.
create or replace function public.create_maker_codes(p_instrument_id text, p_serials text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  chars   constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  s       text;
  v_code  text;
  tries   integer;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.instruments where owner_id = uid and id = p_instrument_id and public_id is not null and deleted_at is null) then
    return jsonb_build_object('ok', false, 'error', 'not-shared');
  end if;
  if coalesce(array_length(p_serials, 1), 0) > 500 then
    return jsonb_build_object('ok', false, 'error', 'too-many');
  end if;
  if (select count(*) from public.maker_codes where owner_id = uid and instrument_id = p_instrument_id) + coalesce(array_length(p_serials, 1), 0) > 5000 then
    return jsonb_build_object('ok', false, 'error', 'too-many');
  end if;
  foreach s in array coalesce(p_serials, '{}') loop
    s := btrim(s);
    continue when s = '' or char_length(s) > 40;
    continue when exists (select 1 from public.maker_codes where owner_id = uid and instrument_id = p_instrument_id and serial = s);
    tries := 0;
    loop
      select string_agg(substr(chars, 1 + floor(random() * 31)::int, 1), '') into v_code from generate_series(1, 6);
      tries := tries + 1;
      exit when not exists (select 1 from public.maker_codes where code = v_code)
            and not exists (select 1 from public.instruments where public_id = v_code);
      if tries > 20 then
        raise exception 'no free code' using errcode = '54000';
      end if;
    end loop;
    insert into public.maker_codes (code, owner_id, instrument_id, serial) values (v_code, uid, p_instrument_id, s);
  end loop;
  return jsonb_build_object('ok', true, 'codes', coalesce((
    select jsonb_agg(jsonb_build_object('code', c.code, 'serial', c.serial, 'created_at', c.created_at, 'retired_at', c.retired_at) order by c.created_at, c.serial)
      from public.maker_codes c where c.owner_id = uid and c.instrument_id = p_instrument_id), '[]'::jsonb));
end;
$$;

revoke all on function public.create_maker_codes(text, text[]) from public, anon;
grant execute on function public.create_maker_codes(text, text[]) to authenticated;

-- Retires one of the caller's serial codes (a lost card, a returned
-- instrument), or brings it back. A retired code opens nothing and is
-- never given to another instrument.
create or replace function public.retire_maker_code(p_code text, p_retired boolean default true)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update public.maker_codes
     set retired_at = case when p_retired then coalesce(retired_at, now()) else null end
   where code = upper(p_code) and owner_id = auth.uid();
  return found;
end;
$$;

revoke all on function public.retire_maker_code(text, boolean) from public, anon;
grant execute on function public.retire_maker_code(text, boolean) to authenticated;

-- ── Counting ─────────────────────────────────────────────────────────────────
create table if not exists public.maker_scan_days (
  code         text    not null,
  day          date    not null,
  country      text    not null default '',   -- two letters from the request's edge header; '' when unknown
  via          text    not null default 'link' check (via in ('qr', 'nfc', 'link', 'embed')),
  opens        integer not null default 0,    -- times the code was opened
  devices      integer not null default 0,    -- devices that opened it that day
  saves        integer not null default 0,    -- saved into an account
  chord_visits integer not null default 0,    -- visits in which a chord was played
  song_visits  integer not null default 0,    -- visits in which a song was opened
  chords       integer not null default 0,    -- chords played
  songs        integer not null default 0,    -- songs opened
  primary key (code, day, country, via)
);

alter table public.maker_scan_days enable row level security;

-- One row per code, day and device hash, only to count a device once a day
-- and to stop one device inflating a count. Deleted after two days.
create table if not exists public.maker_scan_seen (
  day   date     not null,
  code  text     not null,
  hash  text     not null,
  opens smallint not null default 1,
  primary key (day, code, hash)
);

alter table public.maker_scan_seen enable row level security;

-- The day's random value mixed into the hash. Deleted after two days.
create table if not exists public.maker_scan_salts (
  day  date primary key,
  salt text not null
);

alter table public.maker_scan_salts enable row level security;
-- No policies on these three: nobody reads or writes them directly. Makers
-- read their own totals through a function (phase 3).

-- One thing that happened with a code. Called by the app of whoever opened
-- it, signed in or not:
--   'open'   the code was opened (p_via: 'qr' | 'nfc' | 'embed', anything else is a plain link)
--   'save'   the instrument was saved into an account
--   'chords' p_count chords were played since the last call; p_first on the visit's first
--   'songs'  the same for songs opened
-- The owner's own use isn't counted. Unknown codes and events do nothing.
create or replace function public.log_maker_event(
  p_code text, p_event text, p_via text default null, p_count integer default 1, p_first boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    text := upper(coalesce(p_code, ''));
  v_owner   uuid;
  v_via     text := case when p_via in ('qr', 'nfc', 'embed') then p_via else 'link' end;
  v_today   date := (now() at time zone 'utc')::date;
  h         jsonb;
  v_country text;
  v_salt    text;
  v_hash    text;
  v_opens   integer;
  n         integer := least(greatest(coalesce(p_count, 1), 0), case when p_event = 'songs' then 100 else 500 end);
begin
  if v_code !~ '^[A-HJKMNP-Z2-9]{6}$' or p_event not in ('open', 'save', 'chords', 'songs') then
    return;
  end if;
  select r.owner_id into v_owner from public.resolve_shared_code(v_code) r;
  if v_owner is null or v_owner = auth.uid() then
    return;
  end if;

  begin
    h := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  exception when others then
    h := '{}'::jsonb;
  end;
  v_country := upper(coalesce(h->>'cf-ipcountry', h->>'x-vercel-ip-country', ''));
  if v_country !~ '^[A-Z]{2}$' or v_country in ('XX', 'T1') then
    v_country := '';
  end if;

  -- Yesterday's hashes and random values go; today's random value is made once.
  delete from public.maker_scan_seen where day < v_today - 1;
  delete from public.maker_scan_salts where day < v_today - 1;
  insert into public.maker_scan_salts (day, salt) values (v_today, gen_random_uuid()::text || gen_random_uuid()::text)
  on conflict (day) do nothing;
  select salt into v_salt from public.maker_scan_salts where day = v_today;
  v_hash := encode(sha256(convert_to(
    v_salt || '|' || v_code || '|' || split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1) || '|' || coalesce(h->>'user-agent', ''), 'UTF8')), 'hex');

  if p_event = 'open' then
    insert into public.maker_scan_seen (day, code, hash) values (v_today, v_code, v_hash)
    on conflict (day, code, hash) do update set opens = least(public.maker_scan_seen.opens + 1, 1000)
    returning opens into v_opens;
    if v_opens > 20 then
      return;   -- one device, one code, one day: enough
    end if;
    insert into public.maker_scan_days (code, day, country, via, opens, devices)
    values (v_code, v_today, v_country, v_via, 1, case when v_opens = 1 then 1 else 0 end)
    on conflict (code, day, country, via) do update
      set opens = public.maker_scan_days.opens + 1,
          devices = public.maker_scan_days.devices + case when v_opens = 1 then 1 else 0 end;
    return;
  end if;

  -- Everything else only counts for a device that opened the code today or
  -- yesterday (a visit across midnight), so the function can't be used to
  -- write numbers for a code out of nowhere.
  if not exists (select 1 from public.maker_scan_seen s where s.code = v_code and s.day >= v_today - 1
                    and s.hash in (v_hash, encode(sha256(convert_to(
                      coalesce((select salt from public.maker_scan_salts where day = v_today - 1), '') || '|' || v_code || '|'
                      || split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1) || '|' || coalesce(h->>'user-agent', ''), 'UTF8')), 'hex'))) then
    return;
  end if;
  insert into public.maker_scan_days (code, day, country, via, saves, chord_visits, song_visits, chords, songs)
  values (v_code, v_today, v_country, v_via,
          case when p_event = 'save' then 1 else 0 end,
          case when p_event = 'chords' and p_first then 1 else 0 end,
          case when p_event = 'songs' and p_first then 1 else 0 end,
          case when p_event = 'chords' then n else 0 end,
          case when p_event = 'songs' then n else 0 end)
  on conflict (code, day, country, via) do update
    set saves = public.maker_scan_days.saves + excluded.saves,
        chord_visits = public.maker_scan_days.chord_visits + excluded.chord_visits,
        song_visits = public.maker_scan_days.song_visits + excluded.song_visits,
        chords = public.maker_scan_days.chords + excluded.chords,
        songs = public.maker_scan_days.songs + excluded.songs;
end;
$$;

revoke all on function public.log_maker_event(text, text, text, integer, boolean) from public;
grant execute on function public.log_maker_event(text, text, text, integer, boolean) to anon, authenticated;
