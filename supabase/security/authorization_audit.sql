-- PACSA authorization audit (read-only)
-- Run in Supabase SQL Editor. This does not change data or permissions.

-- 1) Core tables and whether RLS is enabled.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r'
  and n.nspname in ('public','storage')
  and c.relname in (
    'admins','applications','students','Teachers','results','student_reports',
    'teacher_assignments','class_teacher_assignments','student_subjects',
    'assessment_periods','audit_logs','teacher_notifications','objects'
  )
order by n.nspname,c.relname;

-- 2) Policies currently enforcing row-level authorization.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('public','storage')
order by schemaname,tablename,policyname;

-- 3) Direct grants to anonymous/authenticated API roles.
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema in ('public','storage')
  and grantee in ('anon','authenticated')
order by table_schema,table_name,grantee,privilege_type;

-- 4) SECURITY DEFINER functions. Review every one for auth.uid()/role checks.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  array_to_string(p.proconfig, ', ') as function_settings
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.prosecdef
order by p.proname,arguments;

-- 5) Functions callable by anon. Any privileged function here is a finding.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by p.proname,arguments;
