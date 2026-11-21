-- What a Supabase project has before the migrations run, as little of it as
-- the migrations and their tests need: the two API roles, auth.users,
-- auth.uid() (PostgREST puts the signed-in user in request.jwt.claim.sub)
-- and user_data, which was created by hand before migrations existed.
-- Only for a throwaway test database (tests/makers-sql.test.mjs).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end
$$;
create schema auth;
create table auth.users (id uuid primary key, email text, created_at timestamptz not null default now());
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
-- As Supabase does: tables and functions in public are open to the API
-- roles, and row-level security is what protects the rows.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
create table public.user_data (
  user_id uuid primary key references auth.users (id),
  layouts jsonb, playlists jsonb, prefs jsonb, updated_at timestamptz
);
alter table public.user_data enable row level security;

-- Test helpers: act as a signed-in user, or as a guest.
create function public.t_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), false);
  execute format('set role %I', case when p_uid is null then 'anon' else 'authenticated' end);
end;
$$;
