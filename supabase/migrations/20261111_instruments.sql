-- Ocarina mode, phase 7: instruments sync and public sharing.
-- Additive only: a new table and a new function. Nothing existing changes.
-- Applied automatically by the build (supabase/migrate.py) when HP_DATABASE_URL is set.

create table if not exists public.instruments (
  owner_id   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,          -- the app's instrument id, unique per owner
  public_id  text        unique,            -- 6-character share code, set when first shared
  data       jsonb       not null,          -- the whole instrument as the app stores it
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (owner_id, id)
);

alter table public.instruments enable row level security;

-- Owners read and write only their own rows. (Each policy is created only
-- if missing, so the file is safe to run again by hand.)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'instruments' and policyname = 'instruments: owner reads') then
    create policy "instruments: owner reads" on public.instruments for select using (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'instruments' and policyname = 'instruments: owner inserts') then
    create policy "instruments: owner inserts" on public.instruments for insert with check (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'instruments' and policyname = 'instruments: owner updates') then
    create policy "instruments: owner updates" on public.instruments for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'instruments' and policyname = 'instruments: owner deletes') then
    create policy "instruments: owner deletes" on public.instruments for delete using (auth.uid() = owner_id);
  end if;
end
$$;

-- Anyone, signed in or not, reads a shared instrument by its exact public ID.
-- There is no public select policy, so shared instruments can't be listed;
-- this function returns one instrument for one code and nothing else.
create or replace function public.get_shared_instrument(p_public_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select data
  from public.instruments
  where public_id = upper(p_public_id)
    and deleted_at is null
  limit 1;
$$;

revoke all on function public.get_shared_instrument(text) from public;
grant execute on function public.get_shared_instrument(text) to anon, authenticated;
