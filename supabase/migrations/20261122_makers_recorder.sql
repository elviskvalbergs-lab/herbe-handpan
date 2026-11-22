-- Makers can say they make recorders (the recorder family, PR #93).
-- The check on makers.families (20261121_makers.sql) listed the five families
-- of that day; it is replaced by the same check with 'recorder' added. Every
-- row that passed the old check passes this one.
alter table public.makers drop constraint if exists makers_families_check;
alter table public.makers add constraint makers_families_check
  check (families <@ array['handpan', 'tongue-drum', 'kalimba', 'ocarina', 'flute', 'recorder']);
