-- The makers programme's database, exercised as a guest, a maker, another
-- maker and an admin (docs/makers-programme.md). Run by
-- tests/makers-sql.test.mjs against a throwaway database, after stubs.sql
-- and every migration. Any failed assert stops psql with an error.
\set ON_ERROR_STOP 1
\set QUIET 1

-- ilze (a maker), nora (another), anna (a buyer), oak (the admin)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ilze@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'nora@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'anna@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'oak@example.com');
insert into public.profiles (user_id, is_admin) values ('00000000-0000-0000-0000-00000000000d', true);

create function public.t_profile(p_slug text, p_name text) returns jsonb language sql as $$
  select jsonb_build_object('slug', p_slug, 'name', p_name, 'kind', 'maker', 'place', 'Cēsis', 'country', 'lv',
    'website', 'https://ilzepans.example', 'story', 'One at a time.', 'story_lang', 'en',
    'families', jsonb_build_array('handpan'), 'request_note', 'About 40 a year');
$$;

-- ── A guest can do nothing but read what is public ──────────────────────────
select public.t_as(null);
do $$
begin
  assert (select count(*) from public.makers) = 0, 'a guest reads no maker rows';
  assert public.list_makers() = '[]'::jsonb, 'the directory starts empty';
  assert public.get_maker('ilze-pans') is null;
  begin
    perform public.save_maker_profile(public.t_profile('ilze-pans', 'Ilze Pans'));
    assert false, 'a guest must not save a profile';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.makers (owner_id, slug, name) values ('00000000-0000-0000-0000-00000000000a', 'x-y-z', 'Nope');
    assert false, 'no direct inserts';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── Ilze asks for the role ──────────────────────────────────────────────────
select public.t_as('00000000-0000-0000-0000-00000000000a');
do $$
declare r jsonb;
begin
  r := public.my_maker();
  assert r->>'maker' is null and (r->>'is_maker')::boolean = false, 'no profile yet';
  assert public.save_maker_profile(public.t_profile('admin', 'Ilze Pans'))->>'error' = 'slug-reserved';
  r := public.save_maker_profile(public.t_profile('Ilze-Pans', 'Ilze Pans'));
  assert (r->>'ok')::boolean, 'the request is saved';
  assert r->'maker'->>'slug' = 'ilze-pans' and r->'maker'->>'status' = 'pending' and r->'maker'->>'country' = 'LV';
  assert r->'maker' ? 'owner_id' = false, 'the owner id is not sent back';
  assert (public.my_maker()->>'is_maker')::boolean = false, 'pending is not yet a maker';
  assert (select count(*) from public.makers) = 1, 'she reads her own row';
  -- Rules the table enforces whatever the app sends.
  begin
    perform public.save_maker_profile(public.t_profile('ilze-pans', 'Ilze Pans') || '{"website":"javascript:alert(1)"}');
    assert false, 'only https websites';
  exception when check_violation then null;
  end;
  begin
    perform public.save_maker_profile(public.t_profile('ilze-pans', 'Ilze Pans') || '{"logo":"data:image/svg+xml;base64,PHN2Zz4="}');
    assert false, 'no SVG logos';
  exception when check_violation then null;
  end;
  begin
    perform public.save_maker_profile(public.t_profile('ilze-pans', 'Ilze Pans') || '{"families":["handpan","theremin"]}');
    assert false, 'only known instrument families';
  exception when check_violation then null;
  end;
  begin
    perform public.review_maker((select id from public.makers), 'approved');
    assert false, 'a maker must not approve herself';
  exception when insufficient_privilege then null;
  end;
  update public.makers set status = 'approved';   -- no update policy: changes nothing
  assert (select status from public.makers) = 'pending', 'no direct updates';
  begin
    perform public.admin_list_makers();
    assert false, 'the review list is for admins';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Her instruments: a shared D Kurd with two serial numbers, and one she
-- shares but did not make.
insert into public.instruments (owner_id, id, public_id, data) values
  ('00000000-0000-0000-0000-00000000000a', 'hp-1', 'KURD22', '{"name":"D Kurd 9","family":"handpan","layout":{"id":"D-Kurd"},"madeBy":{"name":"Someone Famous"}}'),
  ('00000000-0000-0000-0000-00000000000a', 'hp-2', 'NTMNE2', '{"name":"A friend''s pan","family":"handpan","hideMaker":true,"layout":{"id":"custom","isCustom":true}}'),
  ('00000000-0000-0000-0000-00000000000a', 'oc-1', null, '{"name":"Not shared","family":"ocarina"}');
do $$
begin
  begin
    insert into public.maker_codes (code, owner_id, instrument_id, serial) values ('SER222', '00000000-0000-0000-0000-00000000000a', 'hp-1', '17');
    assert false, 'codes are made by a function, not inserted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
insert into public.maker_codes (code, owner_id, instrument_id, serial, retired_at) values
  ('SER222', '00000000-0000-0000-0000-00000000000a', 'hp-1', '17', null),
  ('SER333', '00000000-0000-0000-0000-00000000000a', 'hp-1', '18', now());

-- ── While pending nothing of hers is public ─────────────────────────────────
select public.t_as(null);
do $$
declare r jsonb;
begin
  assert (select count(*) from public.maker_codes) = 0, 'a guest reads no codes';
  assert public.get_maker('ilze-pans') is null and public.list_makers() = '[]'::jsonb, 'pending is not public';
  r := public.open_shared_instrument('kurd22');
  assert r->'data'->>'name' = 'D Kurd 9' and r->>'code' = 'KURD22' and r->>'serial' is null, 'the share code still opens it';
  assert r->>'maker' is null, 'no "Made by" before approval';
  assert public.report_maker('ilze-pans', 'spam') = false, 'only approved profiles can be reported';
  assert public.get_shared_instrument('KURD22')->>'name' = 'D Kurd 9', 'the old function is untouched';
end $$;

-- ── Nora can't take Ilze's address ──────────────────────────────────────────
select public.t_as('00000000-0000-0000-0000-00000000000b');
do $$
begin
  assert public.save_maker_profile(public.t_profile('ilze-pans', 'Nora'))->>'error' = 'slug-taken';
  assert (public.save_maker_profile(public.t_profile('north-kalimba', 'North Kalimba'))->>'ok')::boolean;
  assert (select count(*) from public.makers) = 1, 'she reads only her own row';
  assert (select count(*) from public.maker_codes) = 0, 'and none of Ilze''s codes';
end $$;

-- ── The admin reviews ───────────────────────────────────────────────────────
select public.t_as('00000000-0000-0000-0000-00000000000d');
do $$
declare r jsonb; ilze uuid; nora uuid;
begin
  assert (public.my_maker()->>'waiting')::int = 2, 'two requests wait';
  r := public.admin_list_makers();
  assert jsonb_array_length(r->'makers') = 2;
  assert r->'makers'->0->>'request_note' = 'About 40 a year', 'the reviewer sees the note';
  ilze := (select (m->>'id')::uuid from jsonb_array_elements(r->'makers') m where m->>'slug' = 'ilze-pans');
  nora := (select (m->>'id')::uuid from jsonb_array_elements(r->'makers') m where m->>'slug' = 'north-kalimba');
  assert (public.review_maker(ilze, 'approved')->>'ok')::boolean;
  assert (public.review_maker(nora, 'rejected', 'Please add your website')->>'ok')::boolean;
  begin
    perform public.review_maker(ilze, 'famous');
    assert false, 'unknown status';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- ── Approved: the role, the page, the directory, "Made by" ──────────────────
select public.t_as('00000000-0000-0000-0000-00000000000a');
do $$
declare r jsonb;
begin
  assert (public.my_maker()->>'is_maker')::boolean, 'approval gives the role';
  assert (select count(*) from public.maker_codes) = 2, 'she reads her codes';
  -- The address is fixed once approved; everything else is hers to edit.
  r := public.save_maker_profile(public.t_profile('new-name', 'Ilze Pans Studio'));
  assert r->'maker'->>'slug' = 'ilze-pans' and r->'maker'->>'name' = 'Ilze Pans Studio' and r->'maker'->>'status' = 'approved';
end $$;

select public.t_as(null);
do $$
declare r jsonb;
begin
  r := public.get_maker('ILZE-PANS');
  assert r->>'name' = 'Ilze Pans Studio' and r->>'country' = 'LV';
  assert not (r ? 'request_note') and not (r ? 'status') and not (r ? 'owner_id') and not (r ? 'id'), 'only the public fields';
  assert jsonb_array_length(r->'instruments') = 1, 'shared instruments, without the hidden and the unshared one';
  assert r->'instruments'->0->>'code' = 'KURD22' and r->'instruments'->0->>'scale' = 'D-Kurd';
  r := public.list_makers();
  assert jsonb_array_length(r) = 1 and r->0->>'slug' = 'ilze-pans' and (r->0->>'instruments')::int = 1, 'rejected makers are not listed';
  assert not (r->0 ? 'story'), 'the directory carries no stories';

  r := public.open_shared_instrument('KURD22');
  assert r->'maker'->>'slug' = 'ilze-pans', 'Made by, from the server';
  r := public.open_shared_instrument('ser222');
  assert r->>'serial' = '17' and r->>'model_code' = 'KURD22' and r->'data'->>'name' = 'D Kurd 9', 'a serial code opens its instrument';
  assert r->'maker'->>'name' = 'Ilze Pans Studio';
  assert public.open_shared_instrument('SER333') is null, 'a retired code opens nothing';
  assert public.open_shared_instrument('NOPE22') is null;
  assert public.open_shared_instrument('NTMNE2')->>'maker' is null, 'Made by can be switched off per instrument';
  r := public.shared_instrument_card('SER222');
  assert r->>'name' = 'D Kurd 9' and r->>'maker' = 'Ilze Pans Studio' and r->>'serial' = '17' and not (r ? 'data');
  -- The helpers aren't callable from outside.
  begin
    perform public.resolve_shared_code('KURD22');
    assert false, 'resolve_shared_code is internal';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.maker_public_instruments('00000000-0000-0000-0000-00000000000a');
    assert false, 'maker_public_instruments is internal';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.my_maker();
    assert false, 'my_maker needs an account';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── Rejected: fix it and it is sent again ───────────────────────────────────
select public.t_as('00000000-0000-0000-0000-00000000000b');
do $$
declare r jsonb;
begin
  r := public.my_maker();
  assert r->'maker'->>'status' = 'rejected' and r->'maker'->>'status_note' = 'Please add your website';
  r := public.save_maker_profile(public.t_profile('north-kalimbas', 'North Kalimba'));
  assert r->'maker'->>'status' = 'pending' and r->'maker'->>'slug' = 'north-kalimbas', 'sent again, and the address may still change';
end $$;

-- ── Reports and suspension ──────────────────────────────────────────────────
select public.t_as('00000000-0000-0000-0000-00000000000c');
do $$
begin
  assert public.report_maker('ilze-pans', 'not-them', 'That is another workshop''s logo');
  assert public.report_maker('ilze-pans', 'nonsense') = false;
  for i in 1..30 loop perform public.report_maker('ilze-pans', 'spam'); end loop;
  assert (select count(*) from public.maker_reports) = 0, 'reports are not readable';
end $$;

select public.t_as('00000000-0000-0000-0000-00000000000d');
do $$
declare r jsonb;
begin
  r := public.admin_list_makers();
  assert jsonb_array_length(r->'reports') = 20, 'at most 20 a day per maker are kept';
  assert public.resolve_maker_report((r->'reports'->0->>'id')::uuid);
  assert jsonb_array_length(public.admin_list_makers()->'reports') = 19;
  perform public.review_maker((r->'reports'->0->>'maker_id')::uuid, 'suspended', 'Under review');
end $$;

select public.t_as(null);
do $$
declare r jsonb;
begin
  assert public.get_maker('ilze-pans') is null and public.list_makers() = '[]'::jsonb, 'suspended: nothing public';
  r := public.open_shared_instrument('SER222');
  assert r->'data'->>'name' = 'D Kurd 9' and r->>'maker' is null, 'the code still opens; Made by is gone';
end $$;

reset role;
do $$
begin
  assert (select is_maker from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a') = false, 'suspension takes the role';
  -- The owner approving in the Supabase table editor does the same as the app.
  update public.makers set status = 'approved' where slug = 'ilze-pans';
  assert (select is_maker from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'), 'the trigger gives it back';
end $$;

-- ── Delete account takes the profile, the codes and the reports ─────────────
select public.t_as('00000000-0000-0000-0000-00000000000a');
select public.delete_my_account();
reset role;
do $$
begin
  assert (select count(*) from public.makers where slug = 'ilze-pans') = 0;
  assert (select count(*) from public.maker_codes) = 0;
  assert (select count(*) from public.maker_reports) = 0;
end $$;
select public.t_as(null);
