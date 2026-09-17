-- PACSA shared Administration Control
-- Allows active normal Admins to manage normal Admin accounts, Principal role,
-- assessment stage, and read audit activity. Super Admin remains protected.

begin;

-- All active Admins can read the Admin list.
alter table public.admins enable row level security;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname='public' and tablename='admins'
  loop
    execute format('drop policy if exists %I on public.admins',p.policyname);
  end loop;
end $$;

create policy "Active admins can read admin records"
on public.admins
for select
to authenticated
using (
  public.pacsa_get_my_admin_role() in ('admin','super_admin')
);

-- All active Admins can read PACSA audit activity.
drop policy if exists "Super Admin can read audit logs" on public.audit_logs;
drop policy if exists "Active admins can read audit logs" on public.audit_logs;
create policy "Active admins can read audit logs"
on public.audit_logs
for select
to authenticated
using (
  public.pacsa_get_my_admin_role() in ('admin','super_admin')
);

-- Keep function names for frontend compatibility, but allow any active Admin.
create or replace function public.pacsa_superadmin_set_teacher_role(
  p_teacher_id text,
  p_role text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.pacsa_get_my_admin_role() not in ('admin','super_admin') then
    raise exception 'Active Admin access is required.';
  end if;

  if p_role not in ('teacher','principal') then
    raise exception 'Invalid teacher role.';
  end if;

  if p_role = 'principal' and exists (
    select 1
    from public.class_teacher_assignments c
    where c.teacher_id = p_teacher_id
  ) then
    raise exception 'Remove this teacher from Class Teacher assignments before assigning Principal.';
  end if;

  update public."Teachers"
  set role = p_role
  where teacher_id = p_teacher_id;

  return found;
end;
$$;

create or replace function public.pacsa_superadmin_set_assessment_stage(
  p_session text,
  p_term text,
  p_stage text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.pacsa_get_my_admin_role() not in ('admin','super_admin') then
    raise exception 'Active Admin access is required.';
  end if;

  if p_stage not in ('ca','exam','closed') then
    raise exception 'Invalid assessment stage.';
  end if;

  insert into public.assessment_periods(
    session,
    term,
    current_stage,
    ca_open,
    exam_open,
    updated_at
  )
  values (
    p_session,
    p_term,
    p_stage,
    p_stage='ca',
    p_stage='exam',
    now()
  )
  on conflict(session,term)
  do update set
    current_stage=excluded.current_stage,
    ca_open=excluded.ca_open,
    exam_open=excluded.exam_open,
    updated_at=now();

  return true;
end;
$$;

revoke all on function public.pacsa_superadmin_set_teacher_role(text,text) from public;
revoke all on function public.pacsa_superadmin_set_assessment_stage(text,text,text) from public;
grant execute on function public.pacsa_superadmin_set_teacher_role(text,text) to authenticated;
grant execute on function public.pacsa_superadmin_set_assessment_stage(text,text,text) to authenticated;

commit;
