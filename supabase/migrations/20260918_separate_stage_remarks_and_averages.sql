-- PACSA separate Mid-Term/Exam remarks + publication + averages
-- Run once in Supabase SQL Editor after the existing result/report migrations.

begin;

alter table public.student_reports
  add column if not exists midterm_teacher_remark text,
  add column if not exists midterm_principal_remark text,
  add column if not exists midterm_published_at timestamptz,
  add column if not exists exam_teacher_remark text,
  add column if not exists exam_principal_remark text,
  add column if not exists exam_published_at timestamptz;

-- Backfill existing published records into the correct stage bucket.
update public.student_reports sr
set
  exam_teacher_remark = coalesce(sr.exam_teacher_remark, sr.teacher_remark, sr.remark),
  exam_principal_remark = coalesce(sr.exam_principal_remark, sr.principal_remark),
  exam_published_at = coalesce(sr.exam_published_at, sr.published_at)
where lower(coalesce(sr.status,''))='published'
  and exists (
    select 1
    from public.results r
    where lower(trim(r.student_id::text))=lower(trim(sr.student_id::text))
      and lower(trim(r.class::text))=lower(trim(sr.class::text))
      and lower(trim(r.term::text))=lower(trim(sr.term::text))
      and lower(trim(r.session::text))=lower(trim(sr.session::text))
      and lower(coalesce(r.assessment_stage,''))='exam'
  );

update public.student_reports sr
set
  midterm_teacher_remark = coalesce(sr.midterm_teacher_remark, sr.teacher_remark, sr.remark),
  midterm_principal_remark = coalesce(sr.midterm_principal_remark, sr.principal_remark),
  midterm_published_at = coalesce(sr.midterm_published_at, sr.published_at)
where lower(coalesce(sr.status,''))='published'
  and not exists (
    select 1
    from public.results r
    where lower(trim(r.student_id::text))=lower(trim(sr.student_id::text))
      and lower(trim(r.class::text))=lower(trim(sr.class::text))
      and lower(trim(r.term::text))=lower(trim(sr.term::text))
      and lower(trim(r.session::text))=lower(trim(sr.session::text))
      and lower(coalesce(r.assessment_stage,''))='exam'
  );

-- Class Teacher submission, stage-aware and remark-safe.
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

  select lower(coalesce(ap.current_stage,'ca'))
  into current_stage
  from public.assessment_periods ap
  where lower(trim(ap.session))=lower(trim(p_session))
    and lower(trim(ap.term))=lower(trim(p_term))
  limit 1;

  current_stage:=coalesce(current_stage,'ca');

  if current_stage='closed' then
    raise exception 'Result submission is currently closed.';
  end if;

  select count(distinct lower(trim(ss.subject)))
  into registered_count
  from public.student_subjects ss
  where lower(trim(ss.student_id::text))=lower(trim(p_student_id))
    and lower(trim(ss.class))=lower(trim(p_class))
    and lower(trim(ss.session))=lower(trim(p_session));

  if registered_count=0 then
    raise exception 'No registered subjects were found for this student.';
  end if;

  if current_stage='ca' then
    select count(distinct lower(trim(r.subject)))
    into completed_count
    from public.results r
    join public.student_subjects ss
      on lower(trim(ss.student_id::text))=lower(trim(r.student_id::text))
     and lower(trim(ss.class))=lower(trim(r.class))
     and lower(trim(ss.session))=lower(trim(r.session))
     and lower(trim(ss.subject))=lower(trim(r.subject))
    where lower(trim(r.student_id::text))=lower(trim(p_student_id))
      and lower(trim(r.class))=lower(trim(p_class))
      and lower(trim(r.term))=lower(trim(p_term))
      and lower(trim(r.session))=lower(trim(p_session))
      and r.first_ca is not null
      and r.second_ca is not null
      and r.ca is not null
      and lower(coalesce(r.ca_status,''))='published';

    if completed_count<>registered_count then
      raise exception
        'All registered subjects must have complete Mid-Term scores before submission. Completed % of % subject(s).',
        completed_count,registered_count;
    end if;
  elsif current_stage='exam' then
    select count(distinct lower(trim(r.subject)))
    into completed_count
    from public.results r
    join public.student_subjects ss
      on lower(trim(ss.student_id::text))=lower(trim(r.student_id::text))
     and lower(trim(ss.class))=lower(trim(r.class))
     and lower(trim(ss.session))=lower(trim(r.session))
     and lower(trim(ss.subject))=lower(trim(r.subject))
    where lower(trim(r.student_id::text))=lower(trim(p_student_id))
      and lower(trim(r.class))=lower(trim(p_class))
      and lower(trim(r.term))=lower(trim(p_term))
      and lower(trim(r.session))=lower(trim(p_session))
      and lower(coalesce(r.assessment_stage,''))='exam'
      and r.first_ca is not null
      and r.second_ca is not null
      and r.ca is not null
      and r.exam is not null
      and r.total is not null;

    if completed_count<>registered_count then
      raise exception
        'All registered subjects must have complete Test and Examination scores before submission. Completed % of % subject(s).',
        completed_count,registered_count;
    end if;
  else
    raise exception 'Unknown assessment stage.';
  end if;

  insert into public.student_reports(
    student_id,class,term,session,status,published_at
  )
  values(
    p_student_id,p_class,p_term,p_session,'pending',null
  )
  on conflict(student_id,class,term,session)
  do update set status='pending',published_at=null;

  if current_stage='ca' then
    update public.student_reports
    set
      midterm_teacher_remark=trim(p_teacher_remark),
      teacher_remark=trim(p_teacher_remark),
      remark=trim(p_teacher_remark),
      principal_remark=null,
      principal_teacher_id=null,
      principal_reviewed_at=null
    where lower(trim(student_id::text))=lower(trim(p_student_id))
      and lower(trim(class))=lower(trim(p_class))
      and lower(trim(term))=lower(trim(p_term))
      and lower(trim(session))=lower(trim(p_session));
  else
    update public.student_reports
    set
      exam_teacher_remark=trim(p_teacher_remark),
      teacher_remark=trim(p_teacher_remark),
      remark=trim(p_teacher_remark),
      principal_remark=null,
      principal_teacher_id=null,
      principal_reviewed_at=null
    where lower(trim(student_id::text))=lower(trim(p_student_id))
      and lower(trim(class))=lower(trim(p_class))
      and lower(trim(term))=lower(trim(p_term))
      and lower(trim(session))=lower(trim(p_session));
  end if;

  return true;
end;
$$;

revoke all on function public.pacsa_class_teacher_submit_report(text,text,text,text,text) from public,anon;
grant execute on function public.pacsa_class_teacher_submit_report(text,text,text,text,text) to authenticated;

-- Principal list returns remarks for the currently active stage.
create or replace function public.pacsa_principal_get_reports()
returns table(
  student_id text,
  class text,
  term text,
  session text,
  teacher_remark text,
  principal_remark text,
  status text,
  published_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    sr.student_id::text,
    sr.class::text,
    sr.term::text,
    sr.session::text,
    case
      when lower(coalesce(ap.current_stage,'ca'))='exam'
        then sr.exam_teacher_remark
      else sr.midterm_teacher_remark
    end::text,
    case
      when lower(coalesce(ap.current_stage,'ca'))='exam'
        then sr.exam_principal_remark
      else sr.midterm_principal_remark
    end::text,
    sr.status::text,
    sr.published_at
  from public.student_reports sr
  left join public.assessment_periods ap
    on lower(trim(ap.session))=lower(trim(sr.session))
   and lower(trim(ap.term))=lower(trim(sr.term))
  where exists (
    select 1
    from public."Teachers" t
    where t.auth_user_id=auth.uid()
      and lower(coalesce(t.role,'teacher'))='principal'
      and lower(coalesce(t.portal_status,'active'))='active'
  )
    and lower(coalesce(sr.status,'')) in ('pending','published','rejected')
  order by sr.session desc,sr.term,sr.class,sr.student_id;
$$;

revoke all on function public.pacsa_principal_get_reports() from public,anon;
grant execute on function public.pacsa_principal_get_reports() to authenticated;

-- Principal publication preserves stage-specific remarks.
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

  select lower(coalesce(ap.current_stage,'ca'))
  into current_stage
  from public.assessment_periods ap
  where lower(trim(ap.session))=lower(trim(p_session))
    and lower(trim(ap.term))=lower(trim(p_term))
  limit 1;

  current_stage:=coalesce(current_stage,'ca');

  if not exists (
    select 1
    from public.student_reports sr
    where lower(trim(sr.student_id::text))=lower(trim(p_student_id))
      and lower(trim(sr.class))=lower(trim(p_class))
      and lower(trim(sr.term))=lower(trim(p_term))
      and lower(trim(sr.session))=lower(trim(p_session))
      and lower(coalesce(sr.status,''))='pending'
      and (
        (current_stage='ca' and nullif(trim(coalesce(sr.midterm_teacher_remark,'')),'') is not null)
        or
        (current_stage='exam' and nullif(trim(coalesce(sr.exam_teacher_remark,'')),'') is not null)
      )
  ) then
    raise exception 'This report is not ready for Principal approval or the Class Teacher remark is missing.';
  end if;

  if current_stage='ca' then
    update public.student_reports
    set
      midterm_principal_remark=trim(p_principal_remark),
      midterm_published_at=now(),
      principal_remark=trim(p_principal_remark),
      principal_teacher_id=principal_id,
      principal_reviewed_at=now(),
      status='published',
      published_at=now()
    where lower(trim(student_id::text))=lower(trim(p_student_id))
      and lower(trim(class))=lower(trim(p_class))
      and lower(trim(term))=lower(trim(p_term))
      and lower(trim(session))=lower(trim(p_session));
  elsif current_stage='exam' then
    update public.student_reports
    set
      exam_principal_remark=trim(p_principal_remark),
      exam_published_at=now(),
      principal_remark=trim(p_principal_remark),
      principal_teacher_id=principal_id,
      principal_reviewed_at=now(),
      status='published',
      published_at=now()
    where lower(trim(student_id::text))=lower(trim(p_student_id))
      and lower(trim(class))=lower(trim(p_class))
      and lower(trim(term))=lower(trim(p_term))
      and lower(trim(session))=lower(trim(p_session));

    update public.results
    set status='published'
    where lower(trim(student_id::text))=lower(trim(p_student_id))
      and lower(trim(class))=lower(trim(p_class))
      and lower(trim(term))=lower(trim(p_term))
      and lower(trim(session))=lower(trim(p_session));
  else
    raise exception 'Reports cannot be published while result entry is closed.';
  end if;

  return true;
end;
$$;

revoke all on function public.pacsa_principal_publish_report(text,text,text,text,text) from public,anon;
grant execute on function public.pacsa_principal_publish_report(text,text,text,text,text) to authenticated;

-- Student gets a separate virtual Mid-Term and Exam publication for the same term.
drop function if exists public.pacsa_get_my_published_reports();

create function public.pacsa_get_my_published_reports()
returns table(
  id text,
  student_id text,
  class text,
  term text,
  session text,
  remark text,
  teacher_remark text,
  principal_remark text,
  status text,
  published_at timestamptz,
  report_stage text
)
language sql
security definer
set search_path = public
as $$
  select * from (
    select
      sr.id::text||':ca' as id,
      sr.student_id::text,
      sr.class::text,
      sr.term::text,
      sr.session::text,
      sr.midterm_teacher_remark::text as remark,
      sr.midterm_teacher_remark::text as teacher_remark,
      sr.midterm_principal_remark::text as principal_remark,
      'published'::text as status,
      sr.midterm_published_at as published_at,
      'ca'::text as report_stage
    from public.student_reports sr
    join public.students s
      on lower(trim(s.student_id::text))=lower(trim(sr.student_id::text))
    where s.auth_user_id=auth.uid()
      and sr.midterm_published_at is not null

    union all

    select
      sr.id::text||':exam' as id,
      sr.student_id::text,
      sr.class::text,
      sr.term::text,
      sr.session::text,
      sr.exam_teacher_remark::text as remark,
      sr.exam_teacher_remark::text as teacher_remark,
      sr.exam_principal_remark::text as principal_remark,
      'published'::text as status,
      sr.exam_published_at as published_at,
      'exam'::text as report_stage
    from public.student_reports sr
    join public.students s
      on lower(trim(s.student_id::text))=lower(trim(sr.student_id::text))
    where s.auth_user_id=auth.uid()
      and sr.exam_published_at is not null
  ) q
  order by q.published_at desc nulls last;
$$;

revoke all on function public.pacsa_get_my_published_reports() from public,anon;
grant execute on function public.pacsa_get_my_published_reports() to authenticated;

-- Mid-Term visibility remains available after Exam begins.
create or replace function public.pacsa_get_my_ca_results()
returns table(
  subject text,
  first_ca numeric,
  second_ca numeric,
  ca numeric,
  term text,
  session text,
  class text,
  ca_published_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    r.subject::text,
    r.first_ca::numeric,
    r.second_ca::numeric,
    r.ca::numeric,
    r.term::text,
    r.session::text,
    r.class::text,
    r.ca_published_at
  from public.results r
  join public.students s
    on lower(trim(s.student_id::text))=lower(trim(r.student_id::text))
  join public.student_reports sr
    on lower(trim(sr.student_id::text))=lower(trim(r.student_id::text))
   and lower(trim(sr.class))=lower(trim(r.class))
   and lower(trim(sr.term))=lower(trim(r.term))
   and lower(trim(sr.session))=lower(trim(r.session))
  where s.auth_user_id=auth.uid()
    and lower(coalesce(r.ca_status,''))='published'
    and sr.midterm_published_at is not null
  order by sr.midterm_published_at desc,r.subject;
$$;

revoke all on function public.pacsa_get_my_ca_results() from public,anon;
grant execute on function public.pacsa_get_my_ca_results() to authenticated;

drop function if exists public.pacsa_get_my_midterm_report();

create function public.pacsa_get_my_midterm_report()
returns table(
  subject text,
  first_ca numeric,
  second_ca numeric,
  total_ca numeric,
  subject_position bigint,
  grade text,
  remark text,
  teacher_signature_path text,
  term text,
  session text,
  class text,
  published_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select s.student_id
    from public.students s
    where s.auth_user_id=auth.uid()
    limit 1
  ),
  ranked as (
    select
      r.*,
      rank() over(
        partition by r.class,r.session,r.term,r.subject
        order by r.ca desc nulls last
      ) as subject_position
    from public.results r
    where lower(coalesce(r.ca_status,''))='published'
  )
  select
    r.subject::text,
    r.first_ca::numeric,
    r.second_ca::numeric,
    r.ca::numeric,
    r.subject_position,
    public.pacsa_midterm_grade(r.ca)::text,
    public.pacsa_midterm_remark(r.ca)::text,
    t.signature_path::text,
    r.term::text,
    r.session::text,
    r.class::text,
    sr.midterm_published_at
  from ranked r
  join me
    on lower(trim(me.student_id::text))=lower(trim(r.student_id::text))
  join public.student_reports sr
    on lower(trim(sr.student_id::text))=lower(trim(r.student_id::text))
   and lower(trim(sr.class))=lower(trim(r.class))
   and lower(trim(sr.term))=lower(trim(r.term))
   and lower(trim(sr.session))=lower(trim(r.session))
   and sr.midterm_published_at is not null
  left join public."Teachers" t on t.teacher_id=r.teacher_id
  order by sr.midterm_published_at desc,r.subject;
$$;

revoke all on function public.pacsa_get_my_midterm_report() from public,anon;
grant execute on function public.pacsa_get_my_midterm_report() to authenticated;

-- Metadata exposes stage-specific remarks.
drop function if exists public.pacsa_get_my_report_meta(text,text,text);

create function public.pacsa_get_my_report_meta(
  p_session text,
  p_term text,
  p_class text
)
returns table(
  date_of_birth date,
  age integer,
  number_in_class bigint,
  class_position bigint,
  next_term_begins date,
  midterm_teacher_remark text,
  midterm_principal_remark text,
  exam_teacher_remark text,
  exam_principal_remark text,
  class_teacher_signature_path text,
  principal_signature_path text
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select s.student_id,s.date_of_birth
    from public.students s
    where s.auth_user_id=auth.uid()
    limit 1
  ),
  exam_scores as (
    select
      r.student_id,
      avg(r.total) as avg_score
    from public.results r
    where lower(trim(r.class))=lower(trim(p_class))
      and lower(trim(r.session))=lower(trim(p_session))
      and lower(trim(r.term))=lower(trim(p_term))
      and lower(coalesce(r.assessment_stage,''))='exam'
      and exists (
        select 1
        from public.student_reports sr
        where lower(trim(sr.student_id::text))=lower(trim(r.student_id::text))
          and lower(trim(sr.class))=lower(trim(r.class))
          and lower(trim(sr.term))=lower(trim(r.term))
          and lower(trim(sr.session))=lower(trim(r.session))
          and sr.exam_published_at is not null
      )
    group by r.student_id
  ),
  midterm_scores as (
    select
      r.student_id,
      avg(r.ca) as avg_score
    from public.results r
    where lower(trim(r.class))=lower(trim(p_class))
      and lower(trim(r.session))=lower(trim(p_session))
      and lower(trim(r.term))=lower(trim(p_term))
      and lower(coalesce(r.ca_status,''))='published'
      and exists (
        select 1
        from public.student_reports sr
        where lower(trim(sr.student_id::text))=lower(trim(r.student_id::text))
          and lower(trim(sr.class))=lower(trim(r.class))
          and lower(trim(sr.term))=lower(trim(r.term))
          and lower(trim(sr.session))=lower(trim(r.session))
          and sr.midterm_published_at is not null
      )
    group by r.student_id
  ),
  chosen_scores as (
    select * from exam_scores
    union all
    select m.*
    from midterm_scores m
    where not exists(select 1 from exam_scores)
  ),
  ranked as (
    select student_id,rank() over(order by avg_score desc nulls last) pos
    from chosen_scores
  )
  select
    me.date_of_birth,
    case when me.date_of_birth is null then null
      else extract(year from age(current_date,me.date_of_birth))::integer
    end,
    (
      select count(*)
      from public.students s
      where lower(trim(s.class))=lower(trim(p_class))
        and lower(coalesce(s.status,'active'))='active'
    ),
    (select pos from ranked where student_id=me.student_id limit 1),
    (
      select st.next_term_begins
      from public.sessions_terms st
      where lower(trim(st.session))=lower(trim(p_session))
        and lower(trim(st.term))=lower(trim(p_term))
      limit 1
    ),
    sr.midterm_teacher_remark,
    sr.midterm_principal_remark,
    sr.exam_teacher_remark,
    sr.exam_principal_remark,
    ct.signature_path,
    pt.signature_path
  from me
  left join public.student_reports sr
    on lower(trim(sr.student_id::text))=lower(trim(me.student_id::text))
   and lower(trim(sr.class))=lower(trim(p_class))
   and lower(trim(sr.session))=lower(trim(p_session))
   and lower(trim(sr.term))=lower(trim(p_term))
  left join public.class_teacher_assignments ca
    on lower(trim(ca.class))=lower(trim(p_class))
   and lower(trim(ca.session))=lower(trim(p_session))
  left join public."Teachers" ct on ct.teacher_id=ca.teacher_id
  left join public."Teachers" pt on pt.teacher_id=sr.principal_teacher_id
  limit 1;
$$;

revoke all on function public.pacsa_get_my_report_meta(text,text,text) from public,anon;
grant execute on function public.pacsa_get_my_report_meta(text,text,text) to authenticated;

-- Final report rows: only published Exam reports contribute to class/final averages.
drop function if exists public.pacsa_get_my_final_report_rows(text,text,text);

create function public.pacsa_get_my_final_report_rows(
  p_session text,
  p_term text,
  p_class text
)
returns table(
  subject text,
  ca numeric,
  exam numeric,
  total numeric,
  class_average numeric,
  first_term_total numeric,
  second_term_total numeric,
  final_average numeric,
  grade text,
  remark text,
  teacher_signature_path text
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select s.student_id
    from public.students s
    where s.auth_user_id=auth.uid()
    limit 1
  ),
  mine as (
    select r.*
    from public.results r,me
    where lower(trim(r.student_id::text))=lower(trim(me.student_id::text))
      and lower(trim(r.session))=lower(trim(p_session))
      and lower(trim(r.class))=lower(trim(p_class))
      and lower(trim(r.term))=lower(trim(p_term))
      and lower(coalesce(r.assessment_stage,''))='exam'
      and exists (
        select 1
        from public.student_reports sr
        where lower(trim(sr.student_id::text))=lower(trim(r.student_id::text))
          and lower(trim(sr.class))=lower(trim(r.class))
          and lower(trim(sr.term))=lower(trim(r.term))
          and lower(trim(sr.session))=lower(trim(r.session))
          and sr.exam_published_at is not null
      )
  ),
  historical as (
    select
      r.subject,
      max(r.total) filter(where lower(r.term)='first term') as first_total,
      max(r.total) filter(where lower(r.term)='second term') as second_total,
      max(r.total) filter(where lower(r.term)='third term') as third_total
    from public.results r,me
    where lower(trim(r.student_id::text))=lower(trim(me.student_id::text))
      and lower(trim(r.session))=lower(trim(p_session))
      and lower(trim(r.class))=lower(trim(p_class))
      and lower(coalesce(r.assessment_stage,''))='exam'
      and exists (
        select 1
        from public.student_reports sr
        where lower(trim(sr.student_id::text))=lower(trim(r.student_id::text))
          and lower(trim(sr.class))=lower(trim(r.class))
          and lower(trim(sr.term))=lower(trim(r.term))
          and lower(trim(sr.session))=lower(trim(r.session))
          and sr.exam_published_at is not null
      )
    group by r.subject
  )
  select
    m.subject::text,
    m.ca::numeric,
    m.exam::numeric,
    m.total::numeric,
    round((
      select avg(x.total)
      from public.results x
      where lower(trim(x.class))=lower(trim(p_class))
        and lower(trim(x.session))=lower(trim(p_session))
        and lower(trim(x.term))=lower(trim(p_term))
        and lower(trim(x.subject))=lower(trim(m.subject))
        and lower(coalesce(x.assessment_stage,''))='exam'
        and exists (
          select 1
          from public.student_reports sx
          where lower(trim(sx.student_id::text))=lower(trim(x.student_id::text))
            and lower(trim(sx.class))=lower(trim(x.class))
            and lower(trim(sx.term))=lower(trim(x.term))
            and lower(trim(sx.session))=lower(trim(x.session))
            and sx.exam_published_at is not null
        )
    ),2)::numeric as class_average,
    h.first_total::numeric,
    h.second_total::numeric,
    case
      when lower(p_term)='third term' then round(
        (coalesce(h.first_total,0)+coalesce(h.second_total,0)+coalesce(h.third_total,m.total)) /
        nullif(
          (case when h.first_total is null then 0 else 1 end)+
          (case when h.second_total is null then 0 else 1 end)+
          (case when h.third_total is null then 0 else 1 end),
          0
        ),2
      )
      when lower(p_term)='second term' then round(
        (coalesce(h.first_total,0)+coalesce(h.second_total,m.total)) /
        nullif(
          (case when h.first_total is null then 0 else 1 end)+
          (case when h.second_total is null then 0 else 1 end),
          0
        ),2
      )
      else null
    end::numeric as final_average,
    public.pacsa_final_grade(m.total)::text,
    public.pacsa_final_remark(m.total)::text,
    t.signature_path::text
  from mine m
  left join historical h on h.subject=m.subject
  left join public."Teachers" t on t.teacher_id=m.teacher_id
  order by m.subject;
$$;

revoke all on function public.pacsa_get_my_final_report_rows(text,text,text) from public,anon;
grant execute on function public.pacsa_get_my_final_report_rows(text,text,text) to authenticated;

commit;
