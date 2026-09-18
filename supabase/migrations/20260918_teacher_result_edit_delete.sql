-- PACSA secure teacher result deletion
-- Allows a teacher to delete only their own unpublished result.

begin;

create or replace function public.pacsa_teacher_delete_result(p_result_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  teacher_record public."Teachers"%rowtype;
  result_record public.results%rowtype;
begin
  select *
  into teacher_record
  from public."Teachers"
  where auth_user_id = auth.uid()
  limit 1;

  if teacher_record.teacher_id is null then
    raise exception 'Teacher account could not be verified.';
  end if;

  select *
  into result_record
  from public.results
  where id = p_result_id
  limit 1;

  if result_record.id is null then
    raise exception 'Result not found.';
  end if;

  if lower(coalesce(result_record.status,'')) = 'published' then
    raise exception 'Published results cannot be deleted.';
  end if;

  if coalesce(result_record.teacher_id,'') <> teacher_record.teacher_id then
    raise exception 'You can only delete results you entered.';
  end if;

  if not exists (
    select 1
    from public.teacher_assignments ta
    where ta.teacher_id = teacher_record.teacher_id
      and lower(trim(ta.class)) = lower(trim(result_record.class))
      and lower(trim(ta.subject)) = lower(trim(result_record.subject))
  ) then
    raise exception 'This result is not part of your current teaching assignment.';
  end if;

  delete from public.results
  where id = p_result_id;

  update public.student_reports
  set
    status = case
      when lower(coalesce(status,'')) = 'published' then status
      else 'draft'
    end,
    published_at = case
      when lower(coalesce(status,'')) = 'published' then published_at
      else null
    end
  where student_id = result_record.student_id
    and class = result_record.class
    and term = result_record.term
    and session = result_record.session;

  return true;
end;
$$;

revoke all on function public.pacsa_teacher_delete_result(bigint) from public;
grant execute on function public.pacsa_teacher_delete_result(bigint) to authenticated;

commit;
