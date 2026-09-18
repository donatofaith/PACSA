-- PACSA complete report validation + Principal full result fix
-- Run once in Supabase SQL Editor.

begin;

create or replace function public.pacsa_principal_get_report_results(
  p_student_id text,
  p_class text,
  p_term text,
  p_session text
)
returns table(
  subject text,
  first_ca numeric,
  second_ca numeric,
  ca numeric,
  exam numeric,
  total numeric,
  grade text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public."Teachers" t
    where t.auth_user_id=auth.uid()
      and lower(coalesce(t.role,'teacher'))='principal'
      and lower(coalesce(t.portal_status,'active'))='active'
  ) then
    raise exception 'Principal access is required.';
  end if;

  return query
  select
    r.subject::text,
    r.first_ca::numeric,
    r.second_ca::numeric,
    r.ca::numeric,
    r.exam::numeric,
    r.total::numeric,
    r.grade::text
  from public.results r
  where r.student_id=p_student_id
    and lower(trim(r.class))=lower(trim(p_class))
    and lower(trim(r.term))=lower(trim(p_term))
    and lower(trim(r.session))=lower(trim(p_session))
  order by r.subject;
end;
$$;

revoke all on function public.pacsa_principal_get_report_results(text,text,text,text) from public, anon;
grant execute on function public.pacsa_principal_get_report_results(text,text,text,text) to authenticated;


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
  registered_count integer;
  completed_count integer;
begin
  select t.teacher_id
  into current_teacher_id
  from public."Teachers" t
  where t.auth_user_id=auth.uid()
    and lower(coalesce(t.portal_status,'active'))='active'
  limit 1;

  if current_teacher_id is null then
    raise exception 'Teacher account could not be verified.';
  end if;

  if not exists (
    select 1
    from public.class_teacher_assignments c
    where c.teacher_id=current_teacher_id
      and lower(trim(c.class))=lower(trim(p_class))
      and lower(trim(c.session))=lower(trim(p_session))
  ) then
    raise exception 'You are not the Class Teacher for this class and session.';
  end if;

  if nullif(trim(coalesce(p_teacher_remark,'')),'') is null then
    raise exception 'Class Teacher remark is required.';
  end if;

  select count(distinct lower(trim(ss.subject)))
  into registered_count
  from public.student_subjects ss
  where ss.student_id=p_student_id
    and lower(trim(ss.class))=lower(trim(p_class))
    and lower(trim(ss.session))=lower(trim(p_session));

  if registered_count = 0 then
    raise exception 'No registered subjects were found for this student.';
  end if;

  select count(distinct lower(trim(r.subject)))
  into completed_count
  from public.results r
  join public.student_subjects ss
    on ss.student_id=r.student_id
   and lower(trim(ss.class))=lower(trim(r.class))
   and lower(trim(ss.session))=lower(trim(r.session))
   and lower(trim(ss.subject))=lower(trim(r.subject))
  where r.student_id=p_student_id
    and lower(trim(r.class))=lower(trim(p_class))
    and lower(trim(r.term))=lower(trim(p_term))
    and lower(trim(r.session))=lower(trim(p_session))
    and lower(coalesce(r.assessment_stage,''))='exam'
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

  insert into public.student_reports(
    student_id,class,term,session,remark,teacher_remark,status,published_at
  )
  values(
    p_student_id,p_class,p_term,p_session,
    trim(p_teacher_remark),trim(p_teacher_remark),'pending',null
  )
  on conflict(student_id,class,term,session)
  do update set
    remark=excluded.remark,
    teacher_remark=excluded.teacher_remark,
    status='pending',
    published_at=null,
    principal_remark=null,
    principal_teacher_id=null,
    principal_reviewed_at=null;

  return true;
end;
$$;

revoke all on function public.pacsa_class_teacher_submit_report(text,text,text,text,text) from public, anon;
grant execute on function public.pacsa_class_teacher_submit_report(text,text,text,text,text) to authenticated;


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
  registered_count integer;
  completed_count integer;
begin
  select t.teacher_id
  into principal_id
  from public."Teachers" t
  where t.auth_user_id=auth.uid()
    and lower(coalesce(t.role,'teacher'))='principal'
    and lower(coalesce(t.portal_status,'active'))='active'
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
    where r.student_id=p_student_id
      and lower(trim(r.class))=lower(trim(p_class))
      and lower(trim(r.term))=lower(trim(p_term))
      and lower(trim(r.session))=lower(trim(p_session))
      and lower(coalesce(r.status,''))='pending'
      and nullif(trim(coalesce(r.teacher_remark,r.remark,'')),'') is not null
  ) then
    raise exception 'This report is not ready for Principal approval or the Class Teacher remark is missing.';
  end if;

  select count(distinct lower(trim(ss.subject)))
  into registered_count
  from public.student_subjects ss
  where ss.student_id=p_student_id
    and lower(trim(ss.class))=lower(trim(p_class))
    and lower(trim(ss.session))=lower(trim(p_session));

  select count(distinct lower(trim(r.subject)))
  into completed_count
  from public.results r
  join public.student_subjects ss
    on ss.student_id=r.student_id
   and lower(trim(ss.class))=lower(trim(r.class))
   and lower(trim(ss.session))=lower(trim(r.session))
   and lower(trim(ss.subject))=lower(trim(r.subject))
  where r.student_id=p_student_id
    and lower(trim(r.class))=lower(trim(p_class))
    and lower(trim(r.term))=lower(trim(p_term))
    and lower(trim(r.session))=lower(trim(p_session))
    and lower(coalesce(r.assessment_stage,''))='exam'
    and r.first_ca is not null
    and r.second_ca is not null
    and r.ca is not null
    and r.exam is not null
    and r.total is not null;

  if registered_count = 0 or completed_count <> registered_count then
    raise exception
      'This report is incomplete. Completed % of % registered subject(s).',
      completed_count, registered_count;
  end if;

  update public.student_reports
  set
    principal_remark=trim(p_principal_remark),
    principal_teacher_id=principal_id,
    principal_reviewed_at=now(),
    status='published',
    published_at=now()
  where student_id=p_student_id
    and lower(trim(class))=lower(trim(p_class))
    and lower(trim(term))=lower(trim(p_term))
    and lower(trim(session))=lower(trim(p_session));

  update public.results
  set status='published'
  where student_id=p_student_id
    and lower(trim(class))=lower(trim(p_class))
    and lower(trim(term))=lower(trim(p_term))
    and lower(trim(session))=lower(trim(p_session));

  return true;
end;
$$;

revoke all on function public.pacsa_principal_publish_report(text,text,text,text,text) from public, anon;
grant execute on function public.pacsa_principal_publish_report(text,text,text,text,text) to authenticated;

commit;
