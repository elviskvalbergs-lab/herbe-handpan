-- Free to play, step 1: privacy-friendly measurement (docs/free-to-play.md, "9. Measurement").
-- Additive only: two new tables and one new function. Nothing existing changes.
-- Applied automatically by the build (supabase/migrate.py) when DATABASE_URL is set.
--
-- No user id, device id, IP address or cookie is stored: each row is an
-- event name, a few known properties and whether someone was signed in.
-- Nobody reads the tables through the app (no policies); the owner reads
-- them in the Supabase dashboard.

create table if not exists public.event_names (
  name text primary key,
  keys text[] not null default '{}'   -- the only properties kept for this event
);

alter table public.event_names enable row level security;

-- Later steps add their events with new rows (in new migration files).
insert into public.event_names (name, keys) values
  ('open',            array['path', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign']),
  ('first_play',      array['family', 'seconds']),
  ('feature',         array['name', 'family']),
  ('save_tap',        array['what']),
  ('signup_shown',    array['what']),
  ('signup_method',   array['what', 'method']),
  ('signup_done',     array['what', 'method', 'returning']),
  ('save_completed',  array['what']),
  ('return_visit',    array['days']),
  ('offline_session', array[]::text[]),
  ('guest_offline',   array['action'])
on conflict (name) do nothing;

create table if not exists public.events (
  id        bigserial   primary key,
  at        timestamptz not null default now(),
  name      text        not null references public.event_names (name),
  props     jsonb       not null default '{}'::jsonb,
  signed_in boolean     not null default false
);

alter table public.events enable row level security;

create index if not exists events_name_at on public.events (name, at);

-- The only way in: a known event name, known keys only, short text values.
create or replace function public.log_event(p_name text, p_props jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed text[];
  clean   jsonb := '{}'::jsonb;
  k       text;
begin
  select keys into allowed from public.event_names where name = p_name;
  if not found then return; end if;
  if jsonb_typeof(p_props) = 'object' then
    foreach k in array allowed loop
      if p_props ? k then
        clean := clean || jsonb_build_object(k,
          case jsonb_typeof(p_props -> k)
            when 'number'  then p_props -> k
            when 'boolean' then p_props -> k
            else to_jsonb(left(p_props ->> k, 120))
          end);
      end if;
    end loop;
  end if;
  insert into public.events (name, props, signed_in) values (p_name, clean, auth.uid() is not null);
end;
$$;

revoke all on function public.log_event(text, jsonb) from public;
grant execute on function public.log_event(text, jsonb) to anon, authenticated;
