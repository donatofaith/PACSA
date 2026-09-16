-- PACSA targeted RLS/security hardening
-- Run after 20260916_security_notifications_audit.sql.

begin;

-- Admission no longer accepts document uploads. Remove anonymous uploads to the
-- private document bucket, and allow future manual document uploads only by Admins.
drop policy if exists "PACSA public document uploads" on storage.objects;
drop policy if exists "PACSA authenticated document uploads" on storage.objects;
drop policy if exists "PACSA admins can upload documents" on storage.objects;

create policy "PACSA admins can upload documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'pacsa-documents'
  and public.pacsa_get_my_admin_role() in ('admin','super_admin')
);

-- Admin identities are sensitive. Clients can only read their own Admin row;
-- Super Admin can read all Admin rows. Creation/deletion/status changes use the
-- create-admin-user Edge Function (service role) rather than direct table writes.
alter table public.admins enable row level security;

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='public' and tablename='admins'
  loop
    execute format('drop policy if exists %I on public.admins',p.policyname);
  end loop;
end $$;

create policy "Admins can read permitted admin records"
on public.admins
for select
to authenticated
using (
  auth_user_id = auth.uid()
  or public.pacsa_get_my_admin_role() = 'super_admin'
);

-- No direct INSERT/UPDATE/DELETE policy is intentionally created for authenticated users.
-- Service-role Edge Functions and SECURITY DEFINER RPCs remain able to perform controlled changes.

-- Notify a Class Teacher only when an authenticated subject teacher changes a result.
create or replace function public.pacsa_notify_class_teacher_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  class_teacher_id text;
  actor_teacher_id text;
  should_notify boolean := false;
begin
  select t.teacher_id into actor_teacher_id
  from public."Teachers" t
  where t.auth_user_id=auth.uid()
    and lower(coalesce(t.portal_status,'active'))='active'
  limit 1;

  -- Admin/system changes are not Class Teacher notifications.
  if actor_teacher_id is null then
    return new;
  end if;

  if tg_op='INSERT' then
    should_notify := true;
  else
    should_notify :=
      new.first_ca is distinct from old.first_ca or
      new.second_ca is distinct from old.second_ca or
      new.ca is distinct from old.ca or
      new.exam is distinct from old.exam or
      new.total is distinct from old.total or
      new.status is distinct from old.status;
  end if;

  if not should_notify then
    return new;
  end if;

  select c.teacher_id into class_teacher_id
  from public.class_teacher_assignments c
  where lower(trim(c.class))=lower(trim(new.class))
    and lower(trim(c.session))=lower(trim(new.session))
  order by c.id desc
  limit 1;

  if class_teacher_id is null or class_teacher_id=actor_teacher_id then
    return new;
  end if;

  -- The actor must actually be assigned to this class + subject.
  if not exists (
    select 1
    from public.teacher_assignments a
    where a.teacher_id=actor_teacher_id
      and lower(trim(a.class))=lower(trim(new.class))
      and lower(trim(a.subject))=lower(trim(new.subject))
  ) then
    return new;
  end if;

  insert into public.teacher_notifications(
    teacher_id,type,title,message,student_id,class,subject,term,session,result_id
  ) values (
    class_teacher_id,
    'result_added',
    'Student result updated',
    coalesce(new.subject,'Subject') || ' result was entered for ' || coalesce(new.student_id,'a student') || '.',
    new.student_id,new.class,new.subject,new.term,new.session,new.id::text
  );

  return new;
end;
$$;

-- Internal helper should not be callable directly from the public API.
revoke all on function public.pacsa_actor_role() from public, anon, authenticated;

-- Privileged report functions are authenticated-only and perform their own role checks.
revoke all on function public.pacsa_principal_get_reports() from public;
revoke all on function public.pacsa_principal_get_report_results(text,text,text,text) from public;
revoke all on function public.pacsa_principal_publish_report(text,text,text,text,text) from public;
revoke all on function public.pacsa_principal_return_report(text,text,text,text,text) from public;
grant execute on function public.pacsa_principal_get_reports() to authenticated;
grant execute on function public.pacsa_principal_get_report_results(text,text,text,text) to authenticated;
grant execute on function public.pacsa_principal_publish_report(text,text,text,text,text) to authenticated;
grant execute on function public.pacsa_principal_return_report(text,text,text,text,text) to authenticated;

commit;
