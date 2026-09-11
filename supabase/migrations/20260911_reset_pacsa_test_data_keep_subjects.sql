-- PACSA CLEAN RESET SCRIPT
-- Keeps subjects, admins, sessions/classes/settings.
-- Removes current students, teachers, applications, assignments, results, reports,
-- and deletes student/teacher Supabase Auth logins linked to those records.

begin;

-- 1) Keep subjects, but remove subject codes from current/future records.
alter table if exists public.subjects
  alter column code drop not null;

update public.subjects
set code = null
where code is not null;

-- Drop unique/check constraints and indexes that only exist for subject code.
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'subjects'
      and c.contype in ('u','c')
      and pg_get_constraintdef(c.oid) ilike '%code%'
  loop
    execute format('alter table public.subjects drop constraint if exists %I', r.conname);
  end loop;

  for r in
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'subjects'
      and indexdef ilike '%code%'
  loop
    execute format('drop index if exists public.%I', r.indexname);
  end loop;
end $$;

-- 2) Make NIN available for admission and student records.
alter table if exists public.applications
  add column if not exists nin text;

alter table if exists public.students
  add column if not exists nin text;

alter table if exists public.applications
  drop constraint if exists applications_nin_format_check;

alter table if exists public.students
  drop constraint if exists students_nin_format_check;

alter table if exists public.applications
  add constraint applications_nin_format_check
  check (nin is null or nin ~ '^\d{11}$');

alter table if exists public.students
  add constraint students_nin_format_check
  check (nin is null or nin ~ '^\d{11}$');

-- 3) Collect auth users linked to students/teachers before deleting records.
create temp table pacsa_auth_users_to_delete(id uuid primary key) on commit drop;

insert into pacsa_auth_users_to_delete(id)
select distinct auth_user_id
from public.students
where auth_user_id is not null
on conflict do nothing;

insert into pacsa_auth_users_to_delete(id)
select distinct auth_user_id
from public."Teachers"
where auth_user_id is not null
on conflict do nothing;

insert into pacsa_auth_users_to_delete(id)
select distinct u.id
from auth.users u
where lower(u.email) in (
  select lower(email) from public.students where email is not null
  union
  select lower(email) from public."Teachers" where email is not null
)
on conflict do nothing;

-- Never delete admin auth accounts.
delete from pacsa_auth_users_to_delete d
using public.admins a
where a.auth_user_id = d.id;

-- 4) Clear academic/student/teacher/application data.
truncate table if exists public.student_reports restart identity cascade;
truncate table if exists public.results restart identity cascade;
truncate table if exists public.student_subjects restart identity cascade;
truncate table if exists public.teacher_assignments restart identity cascade;
truncate table if exists public.class_teacher_assignments restart identity cascade;
truncate table if exists public.applications restart identity cascade;
truncate table if exists public.students restart identity cascade;
truncate table if exists public."Teachers" restart identity cascade;

-- Optional cleanup for document/profile storage rows owned by removed students/teachers.
delete from storage.objects
where bucket_id in ('pacsa-documents','profile-photos')
  and (
    name like 'students/%'
    or name like 'teachers/%'
    or name like 'applications/%'
  );

-- 5) Delete linked student/teacher Supabase Auth login accounts.
-- This does NOT delete admin auth users.
delete from auth.users
where id in (select id from pacsa_auth_users_to_delete);

commit;
