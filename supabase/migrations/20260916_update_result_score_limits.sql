-- Replace legacy CA /40 and Exam /60 checks with PACSA CA /30 + Exam /70.

begin;

do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public'
      and t.relname='results'
      and c.contype='c'
      and (
        pg_get_constraintdef(c.oid) ilike '% ca %'
        or pg_get_constraintdef(c.oid) ilike '%ca)%'
        or pg_get_constraintdef(c.oid) ilike '%exam%'
        or pg_get_constraintdef(c.oid) ilike '%total%'
        or pg_get_constraintdef(c.oid) ilike '%first_ca%'
        or pg_get_constraintdef(c.oid) ilike '%second_ca%'
      )
  loop
    execute format('alter table public.results drop constraint if exists %I',r.conname);
  end loop;
end $$;

alter table public.results
  add constraint results_first_ca_check check (first_ca is null or first_ca between 0 and 10),
  add constraint results_second_ca_check check (second_ca is null or second_ca between 0 and 20),
  add constraint results_ca_30_check check (ca is null or ca between 0 and 30),
  add constraint results_exam_70_check check (exam is null or exam between 0 and 70),
  add constraint results_total_100_check check (total is null or total between 0 and 100);

commit;
