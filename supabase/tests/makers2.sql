-- Serial codes and scan counting (20261122_maker_codes_scans.sql), run after
-- makers.sql by tests/makers-sql.test.mjs.
\set ON_ERROR_STOP 1
\set QUIET 1
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'maker2@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'buyer2@example.com');
insert into public.instruments (owner_id, id, public_id, data) values
  ('00000000-0000-0000-0000-0000000000a1', 'hp-1', 'MDK222', '{"name":"D Kurd 9","family":"handpan"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'hp-2', null, '{"name":"Not shared","family":"handpan"}');

create function public.t_headers(p_ip text, p_country text default 'LV', p_ua text default 'Phone') returns void language sql as $$
  select set_config('request.headers', jsonb_build_object('x-forwarded-for', p_ip || ', 10.0.0.1', 'user-agent', p_ua, 'cf-ipcountry', p_country)::text, false);
$$;
create function public.t_days(p_code text) returns jsonb language sql security definer as $$
  select coalesce(jsonb_agg(to_jsonb(d) - 'day' order by d.country, d.via), '[]'::jsonb) from public.maker_scan_days d where d.code = p_code;
$$;

-- ── Serial numbers ──────────────────────────────────────────────────────────
select public.t_as('00000000-0000-0000-0000-0000000000a1');
do $$
declare r jsonb;
begin
  assert public.create_maker_codes('hp-2', array['1'])->>'error' = 'not-shared', 'only a shared instrument gets serial codes';
  assert public.create_maker_codes('nope', array['1'])->>'error' = 'not-shared';
  r := public.create_maker_codes('hp-1', array['17', ' 18 ', '', '17']);
  assert (r->>'ok')::boolean and jsonb_array_length(r->'codes') = 2, 'two serial numbers, blanks and repeats dropped';
  assert r->'codes'->0->>'code' ~ '^[A-HJKMNP-Z2-9]{6}$';
  r := public.create_maker_codes('hp-1', array['18', '19']);
  assert jsonb_array_length(r->'codes') = 3, 'a serial number keeps its code';
  assert public.create_maker_codes('hp-1', (select array_agg(g::text) from generate_series(1, 501) g))->>'error' = 'too-many';
  assert (select count(distinct code) from public.maker_codes) = 3;
  assert public.open_shared_instrument((select code from public.maker_codes where serial = '19'))->>'serial' = '19';
  assert public.retire_maker_code((select code from public.maker_codes where serial = '19'));
  assert public.open_shared_instrument((select code from public.maker_codes where serial = '19')) is null, 'retired';
  assert public.retire_maker_code((select code from public.maker_codes where serial = '19'), false);
  assert public.open_shared_instrument((select code from public.maker_codes where serial = '19')) is not null, 'and back';
end $$;

select public.t_as('00000000-0000-0000-0000-0000000000b1');
do $$
begin
  assert public.create_maker_codes('hp-1', array['99'])->>'error' = 'not-shared', 'not someone else''s instrument';
  assert (select count(*) from public.maker_codes) = 0, 'nor its codes';
  assert not public.retire_maker_code('MDK222');
end $$;
reset role;
select public.t_as('00000000-0000-0000-0000-0000000000b1');
select public.retire_maker_code(c.code) from (select code from public.maker_codes) c;
reset role;
do $$
begin
  assert (select count(*) from public.maker_codes where owner_id = '00000000-0000-0000-0000-0000000000a1' and retired_at is null) = 3, 'another account retired nothing';
end $$;

-- ── Counting ────────────────────────────────────────────────────────────────
-- A buyer's phone opens the model code from the QR card, twice, plays and saves.
select public.t_as(null);
select public.t_headers('203.0.113.7');
select public.log_maker_event('mdk222', 'open', 'qr');
select public.log_maker_event('MDK222', 'open', 'qr');
select public.log_maker_event('MDK222', 'chords', 'qr', 12, true);
select public.log_maker_event('MDK222', 'chords', 'qr', 100000, false);
select public.log_maker_event('MDK222', 'songs', 'qr', 2, true);
select public.log_maker_event('MDK222', 'save', 'qr');
-- Another phone, another country, from the NFC tag.
select public.t_headers('198.51.100.9', 'EE');
select public.log_maker_event('MDK222', 'open', 'nfc');
-- Nonsense does nothing.
select public.log_maker_event('MDK222', 'explode');
select public.log_maker_event('NOPE22', 'open');
select public.log_maker_event('not a code', 'open');
select public.log_maker_event(null, null);
-- A device that never opened the code can't write its numbers.
select public.t_headers('192.0.2.1', 'FR');
select public.log_maker_event('MDK222', 'save', 'qr');
select public.log_maker_event('MDK222', 'chords', 'qr', 50, true);
-- A country header that isn't a country.
select public.t_headers('192.0.2.2', '<script>');
select public.log_maker_event('MDK222', 'open', 'somewhere');

do $$
declare d jsonb := public.t_days('MDK222');
begin
  assert jsonb_array_length(d) = 3, d::text;
  -- '' · link, EE · nfc, LV · qr
  assert d->0 @> '{"country":"","via":"link","opens":1,"devices":1}', d->>0;
  assert d->1 @> '{"country":"EE","via":"nfc","opens":1,"devices":1,"saves":0}', d->>1;
  assert d->2 @> '{"country":"LV","via":"qr","opens":2,"devices":1,"saves":1,"chord_visits":1,"song_visits":1,"chords":512,"songs":2}', d->>2;
  assert public.t_days('NOPE22') = '[]'::jsonb;
end $$;

-- The same phone opening it again by a plain link is a second open, not a second device.
select public.t_headers('198.51.100.9', 'EE');
select public.log_maker_event('MDK222', 'open');
do $$
declare d jsonb := public.t_days('MDK222');
begin
  assert jsonb_array_length(d) = 4 and d->1 @> '{"country":"EE","via":"link","opens":1,"devices":0}', d::text;
  assert (select sum((x->>'devices')::int) from jsonb_array_elements(d) x) = 3, 'three devices so far';
end $$;
reset role;
delete from public.maker_scan_days where code = 'MDK222' and country = 'EE' and via = 'link';
select public.t_as(null);

-- One device can't push a count past 20 opens a day.
select public.t_headers('203.0.113.50');
do $$ begin for i in 1..60 loop perform public.log_maker_event('MDK222', 'open', 'qr'); end loop; end $$;
do $$
declare d jsonb := public.t_days('MDK222');
begin
  assert (d->2->>'opens')::int = 22 and (d->2->>'devices')::int = 2, d->>2;
end $$;

-- The maker's own opens don't count; a signed-in buyer's do.
select public.t_as('00000000-0000-0000-0000-0000000000a1');
select public.t_headers('203.0.113.99');
select public.log_maker_event('MDK222', 'open', 'qr');
select public.t_as('00000000-0000-0000-0000-0000000000b1');
select public.log_maker_event((select 'MDK222'), 'open', 'qr');
do $$
declare d jsonb := public.t_days('MDK222');
begin
  assert (d->2->>'opens')::int = 23, 'the buyer''s open counted, the maker''s did not: ' || (d->2->>'opens');
  assert (select count(*) from public.maker_scan_days) = 0, 'the counts can''t be read directly';
  assert (select count(*) from public.maker_scan_seen) = 0;
  assert (select count(*) from public.maker_scan_salts) = 0;
end $$;

-- What is kept holds no address, and old hashes and random values go.
reset role;
do $$
begin
  assert not exists (select 1 from public.maker_scan_seen where hash ~ '203\.0\.113' or hash !~ '^[0-9a-f]{64}$'), 'hashes only';
  assert (select count(*) from public.maker_scan_salts) = 1;
  update public.maker_scan_seen set day = day - 3;
  update public.maker_scan_salts set day = day - 3;
end $$;
select public.t_as(null);
select public.t_headers('203.0.113.7');
select public.log_maker_event('MDK222', 'open', 'qr');
reset role;
do $$
begin
  assert (select count(*) from public.maker_scan_seen) = 1 and (select count(*) from public.maker_scan_salts) = 1, 'older days are deleted';
  assert (select min(day) from public.maker_scan_seen) = (now() at time zone 'utc')::date;
end $$;
select public.t_as(null);
