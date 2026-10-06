-- PACSA: Automatically generate sequential Teacher IDs for new teachers.
-- Existing IDs such as TCH001, TCH002, TCH003 remain unchanged.

begin;

create or replace function public.pacsa_next_teacher_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  if not exists (
    select 1
    from public.admins a
    where a.auth_user_id = auth.uid()
      and lower(coalesce(a.status,'active')) = 'active'
  ) then
    raise exception 'Active Admin access is required.';
  end if;

  -- Prevent two admins creating teachers at the same time from receiving
  -- the same next Teacher ID.
  perform pg_advisory_xact_lock(hashtext('pacsa_teacher_id_sequence'));

  select coalesce(max((substring(t.teacher_id from 4))::integer), 0) + 1
    into next_number
  from public."Teachers" t
  where t.teacher_id ~ '^TCH[0-9]+$';

  return 'TCH' || lpad(next_number::text, 3, '0');
end;
$$;

grant execute on function public.pacsa_next_teacher_id() to authenticated;

commit;
