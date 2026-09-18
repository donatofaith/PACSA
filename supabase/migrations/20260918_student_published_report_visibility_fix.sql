-- PACSA secure student published report access
-- Fixes student portal visibility independent of table RLS.

begin;

create or replace function public.pacsa_get_my_published_reports()
returns table(
  id bigint,
  student_id text,
  class text,
  term text,
  session text,
  remark text,
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
    r.id,
    r.student_id::text,
    r.class::text,
    r.term::text,
    r.session::text,
    r.remark::text,
    r.teacher_remark::text,
    r.principal_remark::text,
    r.status::text,
    r.published_at
  from public.student_reports r
  join public.students s
    on lower(trim(s.student_id)) = lower(trim(r.student_id))
  where s.auth_user_id = auth.uid()
    and lower(trim(coalesce(r.status,''))) = 'published'
  order by r.published_at desc nulls last;
$$;

create or replace function public.pacsa_get_my_published_report_results(
  p_class text,
  p_term text,
  p_session text
)
returns table(
  id uuid,
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
    r.id,
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
    on lower(trim(s.student_id)) = lower(trim(r.student_id))
  where s.auth_user_id = auth.uid()
    and lower(trim(r.class)) = lower(trim(p_class))
    and lower(trim(r.term)) = lower(trim(p_term))
    and lower(trim(r.session)) = lower(trim(p_session))
    and exists (
      select 1
      from public.student_reports sr
      where lower(trim(sr.student_id)) = lower(trim(r.student_id))
        and lower(trim(sr.class)) = lower(trim(r.class))
        and lower(trim(sr.term)) = lower(trim(r.term))
        and lower(trim(sr.session)) = lower(trim(r.session))
        and lower(trim(coalesce(sr.status,''))) = 'published'
    )
  order by r.subject;
$$;

revoke all on function public.pacsa_get_my_published_reports() from public, anon;
revoke all on function public.pacsa_get_my_published_report_results(text,text,text) from public, anon;

grant execute on function public.pacsa_get_my_published_reports() to authenticated;
grant execute on function public.pacsa_get_my_published_report_results(text,text,text) to authenticated;

commit;
