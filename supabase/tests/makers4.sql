-- One email per maker request (20261124_maker_request_notice.sql).
\set ON_ERROR_STOP 1
\set QUIET 1
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'kalimba@example.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'boss@example.com');
insert into public.profiles (user_id, is_admin) values ('00000000-0000-0000-0000-0000000000e2', true);

select public.t_as(null);
do $$
begin
  perform public.claim_maker_request_notice();
  assert false, 'a guest can''t claim anything';
exception when insufficient_privilege then null;
end $$;

select public.t_as('00000000-0000-0000-0000-0000000000e1');
do $$
declare r jsonb;
begin
  assert public.claim_maker_request_notice() is null, 'no request yet';
  perform public.save_maker_profile('{"slug":"tartu-kalimba","name":"Tartu Kalimba","kind":"shop","country":"ee","website":"https://tartu.example","families":["kalimba"],"request_note":"We sell 200 a year"}'::jsonb);
  r := public.claim_maker_request_notice();
  assert r->>'name' = 'Tartu Kalimba' and r->>'email' = 'kalimba@example.com' and r->>'request_note' = 'We sell 200 a year' and r->>'country' = 'EE', r::text;
  assert (r->>'resent')::boolean = false;
  assert public.claim_maker_request_notice() is null, 'one email per request';
  -- Editing the profile while it waits is not a new request.
  perform public.save_maker_profile('{"slug":"tartu-kalimba","name":"Tartu Kalimba OÜ","families":["kalimba"]}'::jsonb);
  assert public.claim_maker_request_notice() is null;
end $$;

-- Not now; the maker fixes it and sends it again: one more email, marked as sent again.
reset role;
select id as maker_id from public.makers where slug = 'tartu-kalimba' \gset
select public.t_as('00000000-0000-0000-0000-0000000000e2');
select public.review_maker(:'maker_id', 'rejected', 'Add your website');
select public.t_as('00000000-0000-0000-0000-0000000000e1');
do $$
declare r jsonb;
begin
  assert public.claim_maker_request_notice() is null, 'nothing while it is rejected';
  perform public.save_maker_profile('{"slug":"tartu-kalimba","name":"Tartu Kalimba OÜ","website":"https://tartu.example","families":["kalimba"]}'::jsonb);
  r := public.claim_maker_request_notice();
  assert r->>'name' = 'Tartu Kalimba OÜ' and (r->>'resent')::boolean, r::text;
  assert public.claim_maker_request_notice() is null;
end $$;

-- Approved: nothing to tell.
select public.t_as('00000000-0000-0000-0000-0000000000e2');
select public.review_maker(:'maker_id', 'approved');
do $$ begin assert public.claim_maker_request_notice() is null, 'the admin has no request of their own'; end $$;
select public.t_as('00000000-0000-0000-0000-0000000000e1');
do $$ begin assert public.claim_maker_request_notice() is null; end $$;
select public.t_as(null);
