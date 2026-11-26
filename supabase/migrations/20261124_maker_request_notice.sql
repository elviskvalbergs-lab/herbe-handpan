-- The makers programme: an email to the owner when a maker asks for the role
-- (docs/makers-programme.md, "Open questions", 11). Additive only: one new
-- column and one new function.
--
-- The app calls the website after a request is saved; the website calls
-- claim_maker_request_notice() as that maker (with their own sign-in), so
-- only a real, pending request can cause an email, and each request causes
-- at most one: the first call marks it, later ones get null.
-- Applied automatically by the build (supabase/migrate.py) when DATABASE_URL is set.

alter table public.makers add column if not exists notified_at timestamptz;  -- when the owner was told about the current request

-- The caller's pending request, once: what the owner's email needs, or null
-- (no request, not pending, or already told about it).
create or replace function public.claim_maker_request_notice()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cur public.makers;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update public.makers
     set notified_at = now()
   where owner_id = auth.uid()
     and status = 'pending'
     and (notified_at is null or notified_at < requested_at)
  returning * into cur;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'name', cur.name, 'slug', cur.slug, 'kind', cur.kind, 'place', cur.place, 'country', cur.country,
    'website', cur.website, 'families', to_jsonb(cur.families), 'request_note', cur.request_note,
    'resent', cur.reviewed_at is not null,
    'email', (select email from auth.users where id = auth.uid()));
end;
$$;

revoke all on function public.claim_maker_request_notice() from public, anon;
grant execute on function public.claim_maker_request_notice() to authenticated;
