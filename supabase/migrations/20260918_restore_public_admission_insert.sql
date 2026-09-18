-- PACSA public admission insert policy
-- Restores public admission submissions without exposing application records.

begin;

alter table public.applications enable row level security;

drop policy if exists "PACSA public admission insert" on public.applications;

create policy "PACSA public admission insert"
on public.applications
for insert
to anon
with check (
  lower(coalesce(status,'pending')) = 'pending'
);

grant insert on public.applications to anon;

do $$
begin
  if to_regclass('public.applications_id_seq') is not null then
    grant usage, select on sequence public.applications_id_seq to anon;
  end if;
end
$$;

commit;
