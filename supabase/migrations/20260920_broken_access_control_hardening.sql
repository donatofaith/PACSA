-- PACSA broken-access-control hardening.
-- Mandatory RLS gates are RESTRICTIVE so older permissive policies cannot
-- accidentally expose rows outside the caller's ownership or school role.

begin;

create or replace function public.pacsa_is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.admins a
    where a.auth_user_id = auth.uid()
      and lower(coalesce(a.status, 'active')) = 'active'
  );
$$;

create or replace function public.pacsa_current_teacher_id()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select t.teacher_id
  from public."Teachers" t
  where t.auth_user_id = auth.uid()
    and lower(coalesce(t.portal_status, 'active')) = 'active'
  limit 1;
$$;

create or replace function public.pacsa_current_student_id()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select s.student_id
  from public.students s
  where s.auth_user_id = auth.uid()
    and lower(coalesce(s.status, 'active')) = 'active'
    and lower(coalesce(s.portal_status, 'active')) = 'active'
  limit 1;
$$;

create or replace function public.pacsa_is_principal()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public."Teachers" t
    where t.auth_user_id = auth.uid()
      and lower(coalesce(t.portal_status, 'active')) = 'active'
      and lower(coalesce(t.role, 'teacher')) = 'principal'
  );
$$;

create or replace function public.pacsa_teacher_has_subject(
  p_class text,
  p_subject text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.teacher_assignments ta
    where ta.teacher_id = public.pacsa_current_teacher_id()
      and lower(trim(ta.class)) = lower(trim(p_class))
      and lower(trim(ta.subject)) = lower(trim(p_subject))
  );
$$;

create or replace function public.pacsa_teacher_has_class(
  p_class text,
  p_session text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.class_teacher_assignments ca
    where ca.teacher_id = public.pacsa_current_teacher_id()
      and lower(trim(ca.class)) = lower(trim(p_class))
      and (p_session is null or ca.session = p_session)
  );
$$;

revoke all on function public.pacsa_is_active_admin() from public, anon;
revoke all on function public.pacsa_current_teacher_id() from public, anon;
revoke all on function public.pacsa_current_student_id() from public, anon;
revoke all on function public.pacsa_is_principal() from public, anon;
revoke all on function public.pacsa_teacher_has_subject(text,text) from public, anon;
revoke all on function public.pacsa_teacher_has_class(text,text) from public, anon;
grant execute on function public.pacsa_is_active_admin() to authenticated;
grant execute on function public.pacsa_current_teacher_id() to authenticated;
grant execute on function public.pacsa_current_student_id() to authenticated;
grant execute on function public.pacsa_is_principal() to authenticated;
grant execute on function public.pacsa_teacher_has_subject(text,text) to authenticated;
grant execute on function public.pacsa_teacher_has_class(text,text) to authenticated;

-- Student rows: students may read only themselves; teachers only students in
-- their assigned classes; active admins retain school-wide management access.
alter table public.students enable row level security;

drop policy if exists "PACSA authorized student reads" on public.students;
create policy "PACSA authorized student reads"
on public.students for select to authenticated
using (
  public.pacsa_is_active_admin()
  or auth_user_id = auth.uid()
  or public.pacsa_is_principal()
  or exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id = public.pacsa_current_teacher_id()
      and lower(trim(ta.class)) = lower(trim(students.class))
  )
  or public.pacsa_teacher_has_class(students.class, null)
);

drop policy if exists "PACSA mandatory student read scope" on public.students;
create policy "PACSA mandatory student read scope"
on public.students as restrictive for select to authenticated
using (
  public.pacsa_is_active_admin()
  or auth_user_id = auth.uid()
  or public.pacsa_is_principal()
  or exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id = public.pacsa_current_teacher_id()
      and lower(trim(ta.class)) = lower(trim(students.class))
  )
  or public.pacsa_teacher_has_class(students.class, null)
);

drop policy if exists "PACSA admins insert students" on public.students;
create policy "PACSA admins insert students"
on public.students for insert to authenticated
with check (public.pacsa_is_active_admin());

drop policy if exists "PACSA mandatory student insert scope" on public.students;
create policy "PACSA mandatory student insert scope"
on public.students as restrictive for insert to authenticated
with check (public.pacsa_is_active_admin());

drop policy if exists "PACSA admins update students" on public.students;
create policy "PACSA admins update students"
on public.students for update to authenticated
using (public.pacsa_is_active_admin())
with check (public.pacsa_is_active_admin());

drop policy if exists "PACSA mandatory student update scope" on public.students;
create policy "PACSA mandatory student update scope"
on public.students as restrictive for update to authenticated
using (public.pacsa_is_active_admin())
with check (public.pacsa_is_active_admin());

drop policy if exists "PACSA admins delete students" on public.students;
create policy "PACSA admins delete students"
on public.students for delete to authenticated
using (public.pacsa_is_active_admin());

drop policy if exists "PACSA mandatory student delete scope" on public.students;
create policy "PACSA mandatory student delete scope"
on public.students as restrictive for delete to authenticated
using (public.pacsa_is_active_admin());

-- Results: a student can only read their own published result. A teacher can
-- read assigned subjects/classes, but may write only rows they personally own
-- and still hold the matching class+subject assignment for.
alter table public.results enable row level security;

drop policy if exists "PACSA authorized result reads" on public.results;
create policy "PACSA authorized result reads"
on public.results for select to authenticated
using (
  public.pacsa_is_active_admin()
  or public.pacsa_is_principal()
  or public.pacsa_teacher_has_subject(results.class, results.subject)
  or public.pacsa_teacher_has_class(results.class, results.session)
  or (
    results.student_id = public.pacsa_current_student_id()
    and (
      lower(coalesce(results.status, '')) = 'published'
      or lower(coalesce(results.ca_status, '')) = 'published'
    )
  )
);

drop policy if exists "PACSA mandatory result read scope" on public.results;
create policy "PACSA mandatory result read scope"
on public.results as restrictive for select to authenticated
using (
  public.pacsa_is_active_admin()
  or public.pacsa_is_principal()
  or public.pacsa_teacher_has_subject(results.class, results.subject)
  or public.pacsa_teacher_has_class(results.class, results.session)
  or (
    results.student_id = public.pacsa_current_student_id()
    and (
      lower(coalesce(results.status, '')) = 'published'
      or lower(coalesce(results.ca_status, '')) = 'published'
    )
  )
);

drop policy if exists "PACSA authorized result inserts" on public.results;
create policy "PACSA authorized result inserts"
on public.results for insert to authenticated
with check (
  public.pacsa_is_active_admin()
  or (
    results.teacher_id = public.pacsa_current_teacher_id()
    and public.pacsa_teacher_has_subject(results.class, results.subject)
  )
);

drop policy if exists "PACSA mandatory result insert ownership" on public.results;
create policy "PACSA mandatory result insert ownership"
on public.results as restrictive for insert to authenticated
with check (
  public.pacsa_is_active_admin()
  or (
    results.teacher_id = public.pacsa_current_teacher_id()
    and public.pacsa_teacher_has_subject(results.class, results.subject)
  )
);

drop policy if exists "PACSA authorized result updates" on public.results;
create policy "PACSA authorized result updates"
on public.results for update to authenticated
using (
  public.pacsa_is_active_admin()
  or (
    results.teacher_id = public.pacsa_current_teacher_id()
    and public.pacsa_teacher_has_subject(results.class, results.subject)
    and lower(coalesce(results.status, '')) <> 'published'
  )
)
with check (
  public.pacsa_is_active_admin()
  or (
    results.teacher_id = public.pacsa_current_teacher_id()
    and public.pacsa_teacher_has_subject(results.class, results.subject)
    and lower(coalesce(results.status, '')) <> 'published'
  )
);

drop policy if exists "PACSA mandatory result update ownership" on public.results;
create policy "PACSA mandatory result update ownership"
on public.results as restrictive for update to authenticated
using (
  public.pacsa_is_active_admin()
  or (
    results.teacher_id = public.pacsa_current_teacher_id()
    and public.pacsa_teacher_has_subject(results.class, results.subject)
    and lower(coalesce(results.status, '')) <> 'published'
  )
)
with check (
  public.pacsa_is_active_admin()
  or (
    results.teacher_id = public.pacsa_current_teacher_id()
    and public.pacsa_teacher_has_subject(results.class, results.subject)
    and lower(coalesce(results.status, '')) <> 'published'
  )
);

drop policy if exists "PACSA authorized result deletes" on public.results;
create policy "PACSA authorized result deletes"
on public.results for delete to authenticated
using (
  public.pacsa_is_active_admin()
  or (
    results.teacher_id = public.pacsa_current_teacher_id()
    and public.pacsa_teacher_has_subject(results.class, results.subject)
    and lower(coalesce(results.status, '')) <> 'published'
  )
);

drop policy if exists "PACSA mandatory result delete ownership" on public.results;
create policy "PACSA mandatory result delete ownership"
on public.results as restrictive for delete to authenticated
using (
  public.pacsa_is_active_admin()
  or (
    results.teacher_id = public.pacsa_current_teacher_id()
    and public.pacsa_teacher_has_subject(results.class, results.subject)
    and lower(coalesce(results.status, '')) <> 'published'
  )
);

-- Report rows contain remarks and publication state. Students may read only
-- their own published report; class teachers may access only assigned classes.
alter table public.student_reports enable row level security;

drop policy if exists "PACSA authorized report reads" on public.student_reports;
create policy "PACSA authorized report reads"
on public.student_reports for select to authenticated
using (
  public.pacsa_is_active_admin()
  or public.pacsa_is_principal()
  or public.pacsa_teacher_has_class(student_reports.class, student_reports.session)
  or (
    student_reports.student_id = public.pacsa_current_student_id()
    and lower(coalesce(student_reports.status, '')) = 'published'
  )
);

drop policy if exists "PACSA mandatory report read scope" on public.student_reports;
create policy "PACSA mandatory report read scope"
on public.student_reports as restrictive for select to authenticated
using (
  public.pacsa_is_active_admin()
  or public.pacsa_is_principal()
  or public.pacsa_teacher_has_class(student_reports.class, student_reports.session)
  or (
    student_reports.student_id = public.pacsa_current_student_id()
    and lower(coalesce(student_reports.status, '')) = 'published'
  )
);

drop policy if exists "PACSA authorized report inserts" on public.student_reports;
create policy "PACSA authorized report inserts"
on public.student_reports for insert to authenticated
with check (
  public.pacsa_is_active_admin()
  or public.pacsa_teacher_has_class(student_reports.class, student_reports.session)
);

drop policy if exists "PACSA mandatory report insert scope" on public.student_reports;
create policy "PACSA mandatory report insert scope"
on public.student_reports as restrictive for insert to authenticated
with check (
  public.pacsa_is_active_admin()
  or public.pacsa_teacher_has_class(student_reports.class, student_reports.session)
);

drop policy if exists "PACSA authorized report updates" on public.student_reports;
create policy "PACSA authorized report updates"
on public.student_reports for update to authenticated
using (
  public.pacsa_is_active_admin()
  or public.pacsa_teacher_has_class(student_reports.class, student_reports.session)
)
with check (
  public.pacsa_is_active_admin()
  or public.pacsa_teacher_has_class(student_reports.class, student_reports.session)
);

drop policy if exists "PACSA mandatory report update scope" on public.student_reports;
create policy "PACSA mandatory report update scope"
on public.student_reports as restrictive for update to authenticated
using (
  public.pacsa_is_active_admin()
  or public.pacsa_teacher_has_class(student_reports.class, student_reports.session)
)
with check (
  public.pacsa_is_active_admin()
  or public.pacsa_teacher_has_class(student_reports.class, student_reports.session)
);

drop policy if exists "PACSA authorized report deletes" on public.student_reports;
create policy "PACSA authorized report deletes"
on public.student_reports for delete to authenticated
using (
  public.pacsa_is_active_admin()
  or public.pacsa_teacher_has_class(student_reports.class, student_reports.session)
);

drop policy if exists "PACSA mandatory report delete scope" on public.student_reports;
create policy "PACSA mandatory report delete scope"
on public.student_reports as restrictive for delete to authenticated
using (
  public.pacsa_is_active_admin()
  or public.pacsa_teacher_has_class(student_reports.class, student_reports.session)
);

-- Admission records are never owned by ordinary authenticated portal users.
-- Only active admins can read/update/delete them; the separate anonymous
-- INSERT-only policy remains available for the public application form.
alter table public.applications enable row level security;

drop policy if exists "PACSA admins access applications" on public.applications;
create policy "PACSA admins access applications"
on public.applications for all to authenticated
using (public.pacsa_is_active_admin())
with check (public.pacsa_is_active_admin());

drop policy if exists "PACSA mandatory application scope" on public.applications;
create policy "PACSA mandatory application scope"
on public.applications as restrictive for all to authenticated
using (public.pacsa_is_active_admin())
with check (public.pacsa_is_active_admin());

commit;
