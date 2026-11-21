-- A size cap on saved items. Until now save_item took whatever it was given,
-- so one account (or a script holding its session) could fill the database.
-- Additive: a new function and a new trigger on saved_items; save_item
-- itself is unchanged, and rows already stored are not looked at until they
-- are next written.
--
-- 1 MB per item is far above anything the app writes: the largest item is an
-- instrument with its photo (720 px wide, a data URL of 100-300 KB). The app
-- names an item the server refused and keeps it on the device (js/sync.js,
-- js/auth.js: 'item_too_large').
create or replace function public.saved_items_check_size()
returns trigger
language plpgsql
as $$
begin
  if octet_length(new.data::text) > 1048576 then
    raise exception 'item_too_large' using errcode = '54000',
      detail = format('%s bytes; the limit is 1048576', octet_length(new.data::text));
  end if;
  if char_length(new.id) > 200 then
    raise exception 'item_id_too_long' using errcode = '54000';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'saved_items_size' and tgrelid = 'public.saved_items'::regclass and not tgisinternal
  ) then
    create trigger saved_items_size
      before insert or update of data, id on public.saved_items
      for each row execute function public.saved_items_check_size();
  end if;
end
$$;
