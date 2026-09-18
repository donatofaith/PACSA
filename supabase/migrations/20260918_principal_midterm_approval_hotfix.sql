-- PACSA Principal Mid-Term review + approval matching hotfix
-- Run after the stage-aware report migration.

begin;

create or replace function public.pacsa_principal_publish_report(
  p_student_id text,
  p_class text,
  p_term text,
  p_session text,
  p_principal_remark text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  principal_id text;
  current_stage text;
  registered_count integer;
  completed_count integer;
begin
  select t.teacher_id
  into principal_id
  from public."Teachers" t
  where t.auth_user_id = auth.uid()
    and lower(trim(coalesce(t.role,'teacher'))) = 'principal'
    and lower(trim(coalesce(t.portal_status,'active'))) = 'active'
  limit 1;

  if principal_id is null then
    raise exception 'Principal access is required.';
  end if;

  if nullif(trim(coalesce(p_principal_remark,'')),'') is null then
    raise exception 'Principal remark is required.';
  end if;

  -- Match the exact report logically, while tolerating accidental whitespace/case.
  if not exists (
    select 1
    from public.student_reports r
    where lower(trim(r.student_id)) = lower(trim(p_student_id))
      and lower(trim(r.class)) = lower(trim(p_class))
      and lower(trim(r.term)) = lower(trim(p_term))
      and lower(trim(r.session)) = lower(trim(p_session))
      and lower(trim(coalesce(r.status,''))) = 'pending'
  ) then
    raise exception 'This report is no longer pending for Principal approval. Refresh the report list and try again.';
  end if;

  if not exists (
    select 1
    from public.student_reports r
    where lower(trim(r.student_id)) = lower(trim(p_student_id))
      and lower(trim(r.class)) = lower(trim(p_class))
      and lower(trim(r.term)) = lower(trim(p_term))
      and lower(trim(r.session)) = lower(trim(p_session))
      and lower(trim(coalesce(r.status,''))) = 'pending'
      and coalesce(
        nullif(trim(r.teacher_remark),''),
        nullif(trim(r.remark),'')
      ) is not null
  ) then
    raise exception 'The Class Teacher remark is missing.';
  end if;

  select lower(trim(coalesce(ap.current_stage,'ca')))
  into current_stage
  from public.assessment_periods ap
  where lower(trim(ap.session)) = lower(trim(p_session))
    and lower(trim(ap.term)) = lower(trim(p_term))
  limit 1;

  current_stage := coalesce(current_stage,'ca');

  select count(distinct lower(trim(ss.subject)))
  into registered_count
  from public.student_subjects ss
  where lower(trim(ss.student_id)) = lower(trim(p_student_id))
    and lower(trim(ss.class)) = lower(trim(p_class))
    and lower(trim(ss.session)) = lower(trim(p_session));

  if registered_count = 0 then
    raise exception 'No registered subjects were found for this student.';
  end if;

  if current_stage = 'ca' then
    select count(distinct lower(trim(r.subject)))
    into completed_count
    from public.results r
    join public.student_subjects ss
      on lower(trim(ss.student_id)) = lower(trim(r.student_id))
     and lower(trim(ss.class)) = lower(trim(r.class))
     and lower(trim(ss.session)) = lower(trim(r.session))
     and lower(trim(ss.subject)) = lower(trim(r.subject))
    where lower(trim(r.student_id)) = lower(trim(p_student_id))
      and lower(trim(r.class)) = lower(trim(p_class))
      and lower(trim(r.term)) = lower(trim(p_term))
      and lower(trim(r.session)) = lower(trim(p_session))
      and r.first_ca is not null
      and r.second_ca is not null
      and r.ca is not null
      and lower(trim(coalesce(r.ca_status,''))) = 'published';

    if completed_count <> registered_count then
      raise exception
        'This Mid-Term report is incomplete. Completed % of % registered subject(s).',
        completed_count, registered_count;
    end if;

  elsif current_stage = 'exam' then
    select count(distinct lower(trim(r.subject)))
    into completed_count
    from public.results r
    join public.student_subjects ss
      on lower(trim(ss.student_id)) = lower(trim(r.student_id))
     and lower(trim(ss.class)) = lower(trim(r.class))
     and lower(trim(ss.session)) = lower(trim(r.session))
     and lower(trim(ss.subject)) = lower(trim(r.subject))
    where lower(trim(r.student_id)) = lower(trim(p_student_id))
      and lower(trim(r.class)) = lower(trim(p_class))
      and lower(trim(r.term)) = lower(trim(p_term))
      and lower(trim(r.session)) = lower(trim(p_session))
      and lower(trim(coalesce(r.assessment_stage,''))) = 'exam'
      and r.first_ca is not null
      and r.second_ca is not null
      and r.ca is not null
      and r.exam is not null
      and r.total is not null;

    if completed_count <> registered_count then
      raise exception
        'This Examination report is incomplete. Completed % of % registered subject(s).',
        completed_count, registered_count;
    end if;
  else
    raise exception 'Reports cannot be published while result entry is closed.';
  end if;

  update public.student_reports
  set
    principal_remark = trim(p_principal_remark),
    principal_teacher_id = principal_id,
    principal_reviewed_at = now(),
    status = 'published',
    published_at = now()
  where lower(trim(student_id)) = lower(trim(p_student_id))
    and lower(trim(class)) = lower(trim(p_class))
    and lower(trim(term)) = lower(trim(p_term))
    and lower(trim(session)) = lower(trim(p_session))
    and lower(trim(coalesce(status,''))) = 'pending';

  if current_stage = 'exam' then
    update public.results
    set status = 'published'
    where lower(trim(student_id)) = lower(trim(p_student_id))
      and lower(trim(class)) = lower(trim(p_class))
      and lower(trim(term)) = lower(trim(p_term))
      and lower(trim(session)) = lower(trim(p_session));
  end if;

  return true;
end;
$$;

revoke all on function public.pacsa_principal_publish_report(text,text,text,text,text) from public, anon;
grant execute on function public.pacsa_principal_publish_report(text,text,text,text,text) to authenticated;

commit;
