-- The makers programme, phase 3 (docs/makers-programme.md): a maker reads
-- the totals of their own codes. Additive only: one new function.
-- The counting tables stay closed (no policies); this is the only way to
-- read them, and it only ever returns the caller's own codes.
-- Applied automatically by the build (supabase/migrate.py) when DATABASE_URL is set.

-- Totals for the caller's codes over the last p_days days (1 to 90, UTC days):
-- { days, since, until, totals, by_day, by_via, by_country, by_code }.
-- "devices" is devices per day, added up: the same phone on two days counts
-- twice (nothing is kept that could tell it is the same phone).
-- Countries are left out below 5 devices in the period, so one buyer's
-- country is never singled out.
create or replace function public.maker_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  n       integer := least(greatest(coalesce(p_days, 30), 1), 90);
  v_until date := (now() at time zone 'utc')::date;
  v_since date;
  res     jsonb;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  v_since := v_until - (n - 1);

  with mine as (
    select i.public_id as code, i.id as instrument_id, null::text as serial, false as retired
      from public.instruments i
     where i.owner_id = uid and i.public_id is not null and i.deleted_at is null
    union all
    select c.code, c.instrument_id, c.serial, c.retired_at is not null
      from public.maker_codes c
      join public.instruments i on i.owner_id = c.owner_id and i.id = c.instrument_id and i.deleted_at is null
     where c.owner_id = uid
  ), d as (
    select s.* from public.maker_scan_days s join mine m on m.code = s.code
     where s.day between v_since and v_until
  ), sums as (
    select coalesce(sum(opens), 0) as opens, coalesce(sum(devices), 0) as devices, coalesce(sum(saves), 0) as saves,
           coalesce(sum(chord_visits), 0) as chord_visits, coalesce(sum(song_visits), 0) as song_visits,
           coalesce(sum(chords), 0) as chords, coalesce(sum(songs), 0) as songs
      from d
  )
  select jsonb_build_object(
    'days', n, 'since', v_since, 'until', v_until,
    'totals', (select to_jsonb(sums) from sums),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('day', x.day, 'opens', x.opens, 'devices', x.devices) order by x.day)
                          from (select day, sum(opens) as opens, sum(devices) as devices from d group by day) x), '[]'::jsonb),
    'by_via', coalesce((select jsonb_object_agg(x.via, x.opens) from (select via, sum(opens) as opens from d group by via) x), '{}'::jsonb),
    'by_country', case when (select devices from sums) < 5 then '[]'::jsonb else coalesce((
        select jsonb_agg(jsonb_build_object('country', x.country, 'opens', x.opens, 'devices', x.devices) order by x.opens desc, x.country)
          from (select country, sum(opens) as opens, sum(devices) as devices from d group by country order by sum(opens) desc, country limit 12) x), '[]'::jsonb) end,
    'by_code', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'code', m.code, 'instrument_id', m.instrument_id, 'serial', m.serial, 'retired', m.retired,
                 'opens', coalesce(x.opens, 0), 'devices', coalesce(x.devices, 0), 'saves', coalesce(x.saves, 0),
                 'chord_visits', coalesce(x.chord_visits, 0), 'song_visits', coalesce(x.song_visits, 0),
                 'chords', coalesce(x.chords, 0), 'songs', coalesce(x.songs, 0), 'last_day', x.last_day)
               order by coalesce(x.opens, 0) desc, m.instrument_id, m.serial nulls first)
          from mine m
          left join (select code, sum(opens) as opens, sum(devices) as devices, sum(saves) as saves, sum(chord_visits) as chord_visits,
                            sum(song_visits) as song_visits, sum(chords) as chords, sum(songs) as songs, max(day) filter (where opens > 0) as last_day
                       from d group by code) x on x.code = m.code), '[]'::jsonb)
  ) into res;
  return res;
end;
$$;

revoke all on function public.maker_stats(integer) from public, anon;
grant execute on function public.maker_stats(integer) to authenticated;
