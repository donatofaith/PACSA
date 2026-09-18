-- PACSA definitive result score-limit cleanup
-- Removes legacy Exam /60 validation and enforces current Test /30 + Exam /70.
-- Safe to run once after the existing result workflow migrations.

begin;

-- Remove every CHECK constraint attached to the score columns.
do $$
declare
  r record;
begin
  for r in
    select distinct c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join lateral unnest(c.conkey) as k(attnum) on true
    join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
    where n.nspname = 'public'
      and t.relname = 'results'
      and c.contype = 'c'
      and a.attname in ('first_ca','second_ca','ca','exam','total')
  loop
    execute format('alter table public.results drop constraint if exists %I', r.conname);
  end loop;
end
$$;

-- Remove legacy BEFORE INSERT/UPDATE validation triggers whose function body
-- still contains the old Exam /60 rule.
do $$
declare
  r record;
begin
  for r in
    select
      t.tgname,
      p.oid
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.results'::regclass
      and not t.tgisinternal
      and (
        lower(pg_get_functiondef(p.oid)) like '%exam%'
        and (
          lower(pg_get_functiondef(p.oid)) like '%0 and 60%'
          or lower(pg_get_functiondef(p.oid)) like '%between 0 and 60%'
          or lower(pg_get_functiondef(p.oid)) like '%> 60%'
          or lower(pg_get_functiondef(p.oid)) like '%<= 60%'
          or lower(pg_get_functiondef(p.oid)) like '%exam score%'
        )
      )
  loop
    execute format('drop trigger if exists %I on public.results', r.tgname);
  end loop;
end
$$;

-- Current PACSA limits.
alter table public.results
  add constraint results_first_ca_check
    check (first_ca is null or first_ca between 0 and 10),
  add constraint results_second_ca_check
    check (second_ca is null or second_ca between 0 and 20),
  add constraint results_ca_30_check
    check (ca is null or ca between 0 and 30),
  add constraint results_exam_70_check
    check (exam is null or exam between 0 and 70),
  add constraint results_total_100_check
    check (total is null or total between 0 and 100);

commit;
