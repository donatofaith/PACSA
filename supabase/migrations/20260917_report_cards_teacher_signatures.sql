-- PACSA REPORT CARD + TEACHER SIGNATURE SUPPORT
-- Run once in Supabase SQL Editor.

begin;

alter table public."Teachers"
  add column if not exists signature_path text;

alter table public.results
  add column if not exists teacher_id text;

create or replace function public.pacsa_midterm_grade(p_score numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_score,0) = 30 then 'A'
    when coalesce(p_score,0) between 23 and 29.999 then 'B'
    when coalesce(p_score,0) between 15 and 22.999 then 'C'
    when coalesce(p_score,0) between 10 and 14.999 then 'D'
    else 'F'
  end;
$$;

create or replace function public.pacsa_midterm_remark(p_score numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_score,0) = 30 then 'Excellent'
    when coalesce(p_score,0) >= 23 then 'Very Good'
    when coalesce(p_score,0) >= 15 then 'Good'
    when coalesce(p_score,0) >= 10 then 'Fair'
    else 'Poor'
  end;
$$;

create or replace function public.pacsa_final_grade(p_score numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_score,0) >= 80 then 'A1'
    when coalesce(p_score,0) >= 75 then 'B2'
    when coalesce(p_score,0) >= 70 then 'B3'
    when coalesce(p_score,0) >= 65 then 'C4'
    when coalesce(p_score,0) >= 60 then 'C5'
    when coalesce(p_score,0) >= 50 then 'C6'
    when coalesce(p_score,0) >= 45 then 'D7'
    when coalesce(p_score,0) >= 40 then 'E8'
    else 'F9'
  end;
$$;

create or replace function public.pacsa_final_remark(p_score numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_score,0) >= 80 then 'Excellent'
    when coalesce(p_score,0) >= 75 then 'Very Good'
    when coalesce(p_score,0) >= 70 then 'Good'
    when coalesce(p_score,0) >= 50 then 'Credit'
    when coalesce(p_score,0) >= 40 then 'Pass'
    else 'Fail'
  end;
$$;

-- Keep grades consistent even when a client forgets to calculate them.
create or replace function public.pacsa_normalize_result_scores()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.first_ca is not null or new.second_ca is not null then
    new.ca := coalesce(new.first_ca,0) + coalesce(new.second_ca,0);
  end if;

  if new.assessment_stage = 'ca' then
    new.total := new.ca;
    new.grade := public.pacsa_midterm_grade(new.ca);
  else
    new.total := coalesce(new.ca,0) + coalesce(new.exam,0);
    new.grade := public.pacsa_final_grade(new.total);
  end if;

  return new;
end;
$$;

-- Private teacher-signature bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'teacher-signatures',
  'teacher-signatures',
  false,
  2097152,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update set
  public=false,
  file_size_limit=2097152,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "PACSA teachers upload own signatures" on storage.objects;
drop policy if exists "PACSA teachers update own signatures" on storage.objects;
drop policy if exists "PACSA teachers delete own signatures" on storage.objects;
drop policy if exists "PACSA authenticated read teacher signatures" on storage.objects;

create policy "PACSA teachers upload own signatures"
on storage.objects for insert to authenticated
with check (
  bucket_id='teacher-signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public."Teachers" t
    where t.auth_user_id=auth.uid()
      and lower(coalesce(t.portal_status,'active'))='active'
  )
);

create policy "PACSA teachers update own signatures"
on storage.objects for update to authenticated
using (
  bucket_id='teacher-signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id='teacher-signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "PACSA teachers delete own signatures"
on storage.objects for delete to authenticated
using (
  bucket_id='teacher-signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Signatures are displayed only inside authenticated PACSA portals/report sheets.
create policy "PACSA authenticated read teacher signatures"
on storage.objects for select to authenticated
using (bucket_id='teacher-signatures');

create or replace function public.pacsa_update_my_teacher_signature(p_path text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_path is null or position(auth.uid()::text || '/' in p_path) <> 1 then
    raise exception 'Invalid signature path.';
  end if;

  update public."Teachers"
  set signature_path=p_path
  where auth_user_id=auth.uid()
    and lower(coalesce(portal_status,'active'))='active';

  return found;
end;
$$;

revoke all on function public.pacsa_update_my_teacher_signature(text) from public;
grant execute on function public.pacsa_update_my_teacher_signature(text) to authenticated;

-- Student mid-term sheet rows, including class position and subject-teacher signature.
create or replace function public.pacsa_get_my_midterm_report()
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
    select s.student_id,s.class
    from public.students s
    where s.auth_user_id=auth.uid()
    limit 1
  ), ranked as (
    select
      r.*,
      rank() over(
        partition by r.class,r.session,r.term,r.subject
        order by r.ca desc nulls last
      ) as subject_position
    from public.results r
    where r.ca_status='published'
  )
  select
    r.subject::text,
    r.first_ca,
    r.second_ca,
    r.ca as total_ca,
    r.subject_position,
    public.pacsa_midterm_grade(r.ca),
    public.pacsa_midterm_remark(r.ca),
    t.signature_path,
    r.term::text,
    r.session::text,
    r.class::text,
    r.ca_published_at
  from ranked r
  join me on me.student_id=r.student_id
  left join public."Teachers" t on t.teacher_id=r.teacher_id
  order by r.ca_published_at desc nulls last,r.subject;
$$;

revoke all on function public.pacsa_get_my_midterm_report() from public;
grant execute on function public.pacsa_get_my_midterm_report() to authenticated;

-- Full final sheet rows. Historical term totals are included when available.
create or replace function public.pacsa_get_my_final_report_rows(
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
  ), mine as (
    select r.*
    from public.results r, me
    where r.student_id=me.student_id
      and r.session=p_session
      and r.class=p_class
      and r.term=p_term
      and r.assessment_stage='exam'
      and lower(coalesce(r.status,''))='published'
  ), historical as (
    select
      r.subject,
      max(r.total) filter(where lower(r.term)='first term') as first_total,
      max(r.total) filter(where lower(r.term)='second term') as second_total,
      max(r.total) filter(where lower(r.term)='third term') as third_total
    from public.results r, me
    where r.student_id=me.student_id
      and r.session=p_session
      and r.class=p_class
      and r.assessment_stage='exam'
      and lower(coalesce(r.status,''))='published'
    group by r.subject
  )
  select
    m.subject::text,
    m.ca,
    m.exam,
    m.total,
    round((select avg(x.total) from public.results x
      where x.class=p_class and x.session=p_session and x.term=p_term
        and x.subject=m.subject and x.assessment_stage='exam'
        and lower(coalesce(x.status,''))='published'),2) as class_average,
    h.first_total,
    h.second_total,
    case
      when lower(p_term)='third term' then round((coalesce(h.first_total,0)+coalesce(h.second_total,0)+coalesce(h.third_total,m.total)) /
        nullif((case when h.first_total is null then 0 else 1 end)+(case when h.second_total is null then 0 else 1 end)+1,0),2)
      when lower(p_term)='second term' then round((coalesce(h.first_total,0)+coalesce(h.second_total,m.total)) /
        nullif((case when h.first_total is null then 0 else 1 end)+1,0),2)
      else null
    end as final_average,
    public.pacsa_final_grade(m.total),
    public.pacsa_final_remark(m.total),
    t.signature_path
  from mine m
  left join historical h on h.subject=m.subject
  left join public."Teachers" t on t.teacher_id=m.teacher_id
  order by m.subject;
$$;

revoke all on function public.pacsa_get_my_final_report_rows(text,text,text) from public;
grant execute on function public.pacsa_get_my_final_report_rows(text,text,text) to authenticated;

commit;
