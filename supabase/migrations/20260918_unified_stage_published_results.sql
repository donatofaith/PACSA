-- PACSA unified Mid-Term / Examination publication flow
-- Run once in Supabase SQL Editor after the previous report migrations.

begin;

drop function if exists public.pacsa_get_my_published_reports();
drop function if exists public.pacsa_get_my_published_report_results(text,text,text);
drop function if exists public.pacsa_get_my_ca_results();
drop function if exists public.pacsa_get_my_midterm_report();
drop function if exists public.pacsa_get_my_final_report_rows(text,text,text);

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
  select
    sr.id::text,
    sr.student_id::text,
    sr.class::text,
    sr.term::text,
    sr.session::text,
    sr.remark::text,
    coalesce(sr.teacher_remark,sr.remark)::text,
    sr.principal_remark::text,
    sr.status::text,
    sr.published_at,
    case
      when exists (
        select 1
        from public.results r
        where lower(trim(r.student_id::text))=lower(trim(sr.student_id::text))
          and lower(trim(r.class::text))=lower(trim(sr.class::text))
          and lower(trim(r.term::text))=lower(trim(sr.term::text))
          and lower(trim(r.session::text))=lower(trim(sr.session::text))
          and lower(trim(coalesce(r.assessment_stage::text,'')))='exam'
          and r.exam is not null
      )
      then 'exam'
      else 'ca'
    end::text as report_stage
  from public.student_reports sr
  join public.students s
    on lower(trim(s.student_id::text))=lower(trim(sr.student_id::text))
  where s.auth_user_id=auth.uid()
    and lower(trim(coalesce(sr.status::text,'')))='published'
  order by sr.published_at desc nulls last;
$$;


create function public.pacsa_get_my_published_report_results(
  p_class text,
  p_term text,
  p_session text
)
returns table(
  id text,
  student_id text,
  subject text,
  first_ca numeric,
  second_ca numeric,
  ca numeric,
  exam numeric,
  total numeric,
  grade text,
  term text,
  session text,
  class text,
  status text,
  assessment_stage text
)
language sql
security definer
set search_path = public
as $$
  select
    r.id::text,
    r.student_id::text,
    r.subject::text,
    r.first_ca::numeric,
    r.second_ca::numeric,
    r.ca::numeric,
    r.exam::numeric,
    r.total::numeric,
    r.grade::text,
    r.term::text,
    r.session::text,
    r.class::text,
    r.status::text,
    r.assessment_stage::text
  from public.results r
  join public.students s
    on lower(trim(s.student_id::text))=lower(trim(r.student_id::text))
  where s.auth_user_id=auth.uid()
    and lower(trim(r.class::text))=lower(trim(p_class))
    and lower(trim(r.term::text))=lower(trim(p_term))
    and lower(trim(r.session::text))=lower(trim(p_session))
    and exists (
      select 1
      from public.student_reports sr
      where lower(trim(sr.student_id::text))=lower(trim(r.student_id::text))
        and lower(trim(sr.class::text))=lower(trim(r.class::text))
        and lower(trim(sr.term::text))=lower(trim(r.term::text))
        and lower(trim(sr.session::text))=lower(trim(r.session::text))
        and lower(trim(coalesce(sr.status::text,'')))='published'
    )
  order by r.subject;
$$;


create function public.pacsa_get_my_ca_results()
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
  where s.auth_user_id=auth.uid()
    and lower(trim(coalesce(r.ca_status::text,'')))='published'
    and exists (
      select 1
      from public.student_reports sr
      where lower(trim(sr.student_id::text))=lower(trim(r.student_id::text))
        and lower(trim(sr.class::text))=lower(trim(r.class::text))
        and lower(trim(sr.term::text))=lower(trim(r.term::text))
        and lower(trim(sr.session::text))=lower(trim(r.session::text))
        and lower(trim(coalesce(sr.status::text,'')))='published'
    )
  order by r.ca_published_at desc nulls last,r.subject;
$$;


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
    where lower(trim(coalesce(r.ca_status::text,'')))='published'
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
    r.ca_published_at
  from ranked r
  join me on lower(trim(me.student_id::text))=lower(trim(r.student_id::text))
  left join public."Teachers" t on t.teacher_id=r.teacher_id
  where exists (
    select 1
    from public.student_reports sr
    where lower(trim(sr.student_id::text))=lower(trim(r.student_id::text))
      and lower(trim(sr.class::text))=lower(trim(r.class::text))
      and lower(trim(sr.term::text))=lower(trim(r.term::text))
      and lower(trim(sr.session::text))=lower(trim(r.session::text))
      and lower(trim(coalesce(sr.status::text,'')))='published'
  )
  order by r.ca_published_at desc nulls last,r.subject;
$$;


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
      and lower(trim(r.session::text))=lower(trim(p_session))
      and lower(trim(r.class::text))=lower(trim(p_class))
      and lower(trim(r.term::text))=lower(trim(p_term))
      and lower(trim(coalesce(r.assessment_stage::text,'')))='exam'
      and exists (
        select 1
        from public.student_reports sr
        where lower(trim(sr.student_id::text))=lower(trim(r.student_id::text))
          and lower(trim(sr.class::text))=lower(trim(r.class::text))
          and lower(trim(sr.term::text))=lower(trim(r.term::text))
          and lower(trim(sr.session::text))=lower(trim(r.session::text))
          and lower(trim(coalesce(sr.status::text,'')))='published'
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
      and lower(trim(r.session::text))=lower(trim(p_session))
      and lower(trim(r.class::text))=lower(trim(p_class))
      and lower(trim(coalesce(r.assessment_stage::text,'')))='exam'
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
      where lower(trim(x.class::text))=lower(trim(p_class))
        and lower(trim(x.session::text))=lower(trim(p_session))
        and lower(trim(x.term::text))=lower(trim(p_term))
        and lower(trim(x.subject::text))=lower(trim(m.subject::text))
        and lower(trim(coalesce(x.assessment_stage::text,'')))='exam'
    ),2)::numeric as class_average,
    h.first_total::numeric,
    h.second_total::numeric,
    case
      when lower(p_term)='third term' then round(
        (coalesce(h.first_total,0)+coalesce(h.second_total,0)+coalesce(h.third_total,m.total)) /
        nullif((case when h.first_total is null then 0 else 1 end)+(case when h.second_total is null then 0 else 1 end)+1,0),2
      )
      when lower(p_term)='second term' then round(
        (coalesce(h.first_total,0)+coalesce(h.second_total,m.total)) /
        nullif((case when h.first_total is null then 0 else 1 end)+1,0),2
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


revoke all on function public.pacsa_get_my_published_reports() from public,anon;
revoke all on function public.pacsa_get_my_published_report_results(text,text,text) from public,anon;
revoke all on function public.pacsa_get_my_ca_results() from public,anon;
revoke all on function public.pacsa_get_my_midterm_report() from public,anon;
revoke all on function public.pacsa_get_my_final_report_rows(text,text,text) from public,anon;

grant execute on function public.pacsa_get_my_published_reports() to authenticated;
grant execute on function public.pacsa_get_my_published_report_results(text,text,text) to authenticated;
grant execute on function public.pacsa_get_my_ca_results() to authenticated;
grant execute on function public.pacsa_get_my_midterm_report() to authenticated;
grant execute on function public.pacsa_get_my_final_report_rows(text,text,text) to authenticated;

commit;
