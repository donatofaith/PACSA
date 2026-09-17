-- PACSA student age + class count + next-term date support
-- Run once in Supabase SQL Editor.

begin;

alter table public.students
  add column if not exists date_of_birth date;

alter table public.sessions_terms
  add column if not exists next_term_begins date;

create or replace function public.pacsa_get_my_report_meta(
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
  teacher_remark text,
  principal_remark text,
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
  scores as (
    select
      r.student_id,
      avg(
        case
          when r.assessment_stage='exam' and lower(coalesce(r.status,''))='published'
            then r.total
          when r.ca_status='published'
            then r.ca
          else null
        end
      ) as avg_score
    from public.results r
    where lower(trim(r.class))=lower(trim(p_class))
      and r.session=p_session
      and r.term=p_term
      and (
        (r.assessment_stage='exam' and lower(coalesce(r.status,''))='published')
        or r.ca_status='published'
      )
    group by r.student_id
  ),
  ranked as (
    select student_id,rank() over(order by avg_score desc nulls last) pos
    from scores
  )
  select
    me.date_of_birth,
    case
      when me.date_of_birth is null then null
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
      where st.session=p_session
        and st.term=p_term
      limit 1
    ),
    sr.teacher_remark,
    sr.principal_remark,
    ct.signature_path,
    pt.signature_path
  from me
  left join public.student_reports sr
    on sr.student_id=me.student_id
   and sr.class=p_class
   and sr.session=p_session
   and sr.term=p_term
  left join public.class_teacher_assignments ca
    on ca.class=p_class
   and ca.session=p_session
  left join public."Teachers" ct
    on ct.teacher_id=ca.teacher_id
  left join public."Teachers" pt
    on pt.teacher_id=sr.principal_teacher_id
  limit 1;
$$;

revoke all on function public.pacsa_get_my_report_meta(text,text,text) from public;
grant execute on function public.pacsa_get_my_report_meta(text,text,text) to authenticated;

commit;
