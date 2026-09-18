-- PACSA stage-aware report submission
-- Run once in Supabase SQL Editor.

begin;

-- =========================================================
-- CLASS TEACHER SUBMISSION
-- Detect Mid-Term vs Examination from assessment_periods.
-- =========================================================

create or replace function public.pacsa_class_teacher_submit_report(
  p_student_id text,
  p_class text,
  p_term text,
  p_session text,
  p_teacher_remark text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_teacher_id text;
  current_stage text;
  registered_count integer;
  completed_count integer;
begin
  select t.teacher_id
  into current_teacher_id
  from public."Teachers" t
  where t.auth_user_id = auth.uid()
    and lower(coalesce(t.portal_status,'active')) = 'active'
  limit 1;

  if current_teacher_id is null then
    raise exception 'Teacher account could not be verified.';
  end if;

  if not exists (
    select 1
    from public.class_teacher_assignments c
    where c.teacher_id = current_teacher_id
      and lower(trim(c.class)) = lower(trim(p_class))
      and lower(trim(c.session)) = lower(trim(p_session))
  ) then
    raise exception 'You are not the Class Teacher for this class and session.';
  end if;

  if nullif(trim(coalesce(p_teacher_remark,'')),'') is null then
    raise exception 'Class Teacher remark is required.';
  end if;

  select lower(coalesce(ap.current_stage,'ca'))
  into current_stage
  from public.assessment_periods ap
  where lower(trim(ap.session)) = lower(trim(p_session))
    and lower(trim(ap.term)) = lower(trim(p_term))
  limit 1;

  current_stage := coalesce(current_stage,'ca');

  if current_stage = 'closed' then
    raise exception 'Result submission is currently closed.';
  end if;

  select count(distinct lower(trim(ss.subject)))
  into registered_count
  from public.student_subjects ss
  where ss.student_id = p_student_id
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
      on ss.student_id = r.student_id
     and lower(trim(ss.class)) = lower(trim(r.class))
     and lower(trim(ss.session)) = lower(trim(r.session))
     and lower(trim(ss.subject)) = lower(trim(r.subject))
    where r.student_id = p_student_id
      and lower(trim(r.class)) = lower(trim(p_class))
      and lower(trim(r.term)) = lower(trim(p_term))
      and lower(trim(r.session)) = lower(trim(p_session))
      and r.first_ca is not null
      and r.second_ca is not null
      and r.ca is not null
      and lower(coalesce(r.ca_status,'')) = 'published';

    if completed_count <> registered_count then
      raise exception
        'All registered subjects must have complete Mid-Term scores before submission. Completed % of % subject(s).',
        completed_count, registered_count;
    end if;

  elsif current_stage = 'exam' then
    select count(distinct lower(trim(r.subject)))
    into completed_count
    from public.results r
    join public.student_subjects ss
      on ss.student_id = r.student_id
     and lower(trim(ss.class)) = lower(trim(r.class))
     and lower(trim(ss.session)) = lower(trim(r.session))
     and lower(trim(ss.subject)) = lower(trim(r.subject))
    where r.student_id = p_student_id
      and lower(trim(r.class)) = lower(trim(p_class))
      and lower(trim(r.term)) = lower(trim(p_term))
      and lower(trim(r.session)) = lower(trim(p_session))
      and lower(coalesce(r.assessment_stage,'')) = 'exam'
      and r.first_ca is not null
      and r.second_ca is not null
      and r.ca is not null
      and r.exam is not null
      and r.total is not null;

    if completed_count <> registered_count then
      raise exception
        'All registered subjects must have complete Test and Examination scores before submission. Completed % of % subject(s).',
        completed_count, registered_count;
    end if;
  else
    raise exception 'Unknown assessment stage.';
  end if;

  insert into public.student_reports(
    student_id,class,term,session,remark,teacher_remark,status,published_at
  )
  values(
    p_student_id,p_class,p_term,p_session,
    trim(p_teacher_remark),trim(p_teacher_remark),'pending',null
  )
  on conflict(student_id,class,term,session)
  do update set
    remark = excluded.remark,
    teacher_remark = excluded.teacher_remark,
    status = 'pending',
    published_at = null,
    principal_remark = null,
    principal_teacher_id = null,
    principal_reviewed_at = null;

  return true;
end;
$$;

revoke all on function public.pacsa_class_teacher_submit_report(text,text,text,text,text) from public, anon;
grant execute on function public.pacsa_class_teacher_submit_report(text,text,text,text,text) to authenticated;


-- =========================================================
-- PRINCIPAL PUBLISHING
-- Mid-Term: publish remarks after all /30 results are complete.
-- Exam: publish final /100 report after all exam results are complete.
-- =========================================================

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
    and lower(coalesce(t.role,'teacher')) = 'principal'
    and lower(coalesce(t.portal_status,'active')) = 'active'
  limit 1;

  if principal_id is null then
    raise exception 'Principal access is required.';
  end if;

  if nullif(trim(coalesce(p_principal_remark,'')),'') is null then
    raise exception 'Principal remark is required.';
  end if;

  if not exists (
    select 1
    from public.student_reports r
    where r.student_id = p_student_id
      and lower(trim(r.class)) = lower(trim(p_class))
      and lower(trim(r.term)) = lower(trim(p_term))
      and lower(trim(r.session)) = lower(trim(p_session))
      and lower(coalesce(r.status,'')) = 'pending'
      and nullif(trim(coalesce(r.teacher_remark,r.remark,'')),'') is not null
  ) then
    raise exception 'This report is not ready for Principal approval or the Class Teacher remark is missing.';
  end if;

  select lower(coalesce(ap.current_stage,'ca'))
  into current_stage
  from public.assessment_periods ap
  where lower(trim(ap.session)) = lower(trim(p_session))
    and lower(trim(ap.term)) = lower(trim(p_term))
  limit 1;

  current_stage := coalesce(current_stage,'ca');

  select count(distinct lower(trim(ss.subject)))
  into registered_count
  from public.student_subjects ss
  where ss.student_id = p_student_id
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
      on ss.student_id = r.student_id
     and lower(trim(ss.class)) = lower(trim(r.class))
     and lower(trim(ss.session)) = lower(trim(r.session))
     and lower(trim(ss.subject)) = lower(trim(r.subject))
    where r.student_id = p_student_id
      and lower(trim(r.class)) = lower(trim(p_class))
      and lower(trim(r.term)) = lower(trim(p_term))
      and lower(trim(r.session)) = lower(trim(p_session))
      and r.first_ca is not null
      and r.second_ca is not null
      and r.ca is not null
      and lower(coalesce(r.ca_status,'')) = 'published';

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
      on ss.student_id = r.student_id
     and lower(trim(ss.class)) = lower(trim(r.class))
     and lower(trim(ss.session)) = lower(trim(r.session))
     and lower(trim(ss.subject)) = lower(trim(r.subject))
    where r.student_id = p_student_id
      and lower(trim(r.class)) = lower(trim(p_class))
      and lower(trim(r.term)) = lower(trim(p_term))
      and lower(trim(r.session)) = lower(trim(p_session))
      and lower(coalesce(r.assessment_stage,'')) = 'exam'
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
  where student_id = p_student_id
    and lower(trim(class)) = lower(trim(p_class))
    and lower(trim(term)) = lower(trim(p_term))
    and lower(trim(session)) = lower(trim(p_session));

  -- Only final Examination results use the final result publication status.
  if current_stage = 'exam' then
    update public.results
    set status = 'published'
    where student_id = p_student_id
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
