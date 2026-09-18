-- PACSA Principal role helper permission fix
-- Run once in Supabase SQL Editor.

begin;

create or replace function public.pacsa_get_my_teacher_role()
returns text
language sql
security definer
set search_path = public
as $$
  select lower(coalesce(t.role,'teacher'))
  from public."Teachers" t
  where t.auth_user_id = auth.uid()
    and lower(coalesce(t.portal_status,'active')) = 'active'
  limit 1;
$$;

revoke all on function public.pacsa_get_my_teacher_role() from public, anon;
grant execute on function public.pacsa_get_my_teacher_role() to authenticated;

commit;
