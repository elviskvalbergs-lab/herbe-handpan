-- A maker's totals (20261123_maker_stats.sql), run after makers2.sql, which
-- left maker2 (…a1) with the instrument MDK222 (three serial codes) and its
-- counts, and buyer2 (…b1) with nothing.
\set ON_ERROR_STOP 1
\set QUIET 1
reset role;
-- Known counts for today: 20 by QR (LV), 3 by NFC (EE), 2 by link; 4 devices.
delete from public.maker_scan_days where code = 'MDK222';
insert into public.maker_scan_days (code, day, country, via, opens, devices, saves, chord_visits, song_visits, chords, songs) values
  ('MDK222', (now() at time zone 'utc')::date, 'LV', 'qr', 20, 2, 1, 1, 1, 512, 2),
  ('MDK222', (now() at time zone 'utc')::date, 'EE', 'nfc', 3, 1, 0, 0, 0, 0, 0),
  ('MDK222', (now() at time zone 'utc')::date, '', 'link', 2, 1, 0, 0, 0, 0, 0);
-- Counts from 40 days ago, and another maker's code with counts of its own.
insert into public.maker_scan_days (code, day, country, via, opens, devices)
values ('MDK222', (now() at time zone 'utc')::date - 40, 'LV', 'qr', 7, 7);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'maker3@example.com');
insert into public.instruments (owner_id, id, public_id, data) values ('00000000-0000-0000-0000-0000000000c1', 'hp-1', 'THEM22', '{"name":"Theirs"}');
insert into public.maker_scan_days (code, day, country, via, opens, devices) values ('THEM22', (now() at time zone 'utc')::date, 'LV', 'qr', 99, 99);

select public.t_as(null);
do $$
begin
  perform public.maker_stats(30);
  assert false, 'totals need an account';
exception when insufficient_privilege then null;
end $$;

select public.t_as('00000000-0000-0000-0000-0000000000a1');
do $$
declare r jsonb := public.maker_stats(30); r90 jsonb := public.maker_stats(9999); model jsonb;
begin
  assert (r->>'days')::int = 30 and (r90->>'days')::int = 90, 'the period is 1 to 90 days';
  assert (r->'totals'->>'opens')::int = 25, r->>'totals';
  assert (r90->'totals'->>'opens')::int = 32, 'the older opens are inside 90 days';
  assert (r->'totals'->>'saves')::int = 1 and (r->'totals'->>'chords')::int = 512 and (r->'totals'->>'chord_visits')::int = 1;
  assert (r->'by_via'->>'qr')::int = 20 and (r->'by_via'->>'nfc')::int = 3 and (r->'by_via'->>'link')::int = 2, r->>'by_via';
  assert jsonb_array_length(r->'by_day') = 1 and (r->'by_day'->0->>'opens')::int = 25;
  assert jsonb_array_length(r->'by_code') = 4, 'the model code and three serial codes, scanned or not';
  model := r->'by_code'->0;
  assert model->>'code' = 'MDK222' and model->>'serial' is null and (model->>'opens')::int = 25 and model->>'last_day' is not null;
  assert (r->'by_code'->1->>'opens')::int = 0 and r->'by_code'->1->>'last_day' is null and r->'by_code'->1->>'serial' is not null;
  assert not (r::text like '%THEM22%') and (r->'totals'->>'opens')::int < 99, 'nothing of another maker';
  assert jsonb_array_length(r->'by_country') = 0, 'under 5 devices no countries are shown: ' || (r->'totals'->>'devices');
end $$;

-- With enough devices the countries show.
reset role;
insert into public.maker_scan_days (code, day, country, via, opens, devices) values ('MDK222', (now() at time zone 'utc')::date - 1, 'DE', 'qr', 6, 6);
select public.t_as('00000000-0000-0000-0000-0000000000a1');
do $$
declare r jsonb := public.maker_stats(7);
begin
  assert r->'by_country'->0->>'country' = 'LV' and (select count(*) from jsonb_array_elements(r->'by_country') c where c->>'country' = 'DE') = 1, r->>'by_country';
  assert jsonb_array_length(r->'by_day') = 2;
end $$;

-- The buyer has no codes: zeros, not an error, and nothing of the makers'.
select public.t_as('00000000-0000-0000-0000-0000000000b1');
do $$
declare r jsonb := public.maker_stats(30);
begin
  assert (r->'totals'->>'opens')::int = 0 and r->'by_code' = '[]'::jsonb and r->'by_day' = '[]'::jsonb;
end $$;
select public.t_as(null);
