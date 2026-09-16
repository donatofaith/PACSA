-- PACSA: enforce Class Teacher -> Principal publication workflow

begin;

create or replace function public.pacsa_validate_report_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Class Teacher submission requires a remark and completed Examination rows.
  if lower(coalesce(new.status,'')) = 'pending'
     and lower(coalesce(old.status,'')) is distinct from 'pending' then

    if nullif(trim(coalesce(new.teacher_remark,new.remark,'')),'') is null then
      raise exception 'Class Teacher remark is required before submission.';
    end if;

    if not exists (
      select 1 from public.results r
      where r.student_id = new.student_id
        and r.class = new.class
        and r.term = new.term
        and r.session = new.session
    ) then
      raise exception 'No subject results exist for this report.';
    end if;

    if exists (
      select 1 from public.results r
      where r.student_id = new.student_id
        and r.class = new.class
        and r.term = new.term
        and r.session = new.session
        and (r.assessment_stage <> 'exam' or r.exam is null)
    ) then
      raise exception 'All subject Examination scores must be completed before the report is submitted.';
    end if;
  end if;

  -- A browser-authenticated user may publish only when that user is the Principal.
  if lower(coalesce(new.status,'')) = 'published'
     and lower(coalesce(old.status,'')) is distinct from 'published'
     and auth.uid() is not null then

    if not exists (
      select 1 from public."Teachers" t
      where t.auth_user_id = auth.uid()
        and t.role = 'principal'
        and lower(coalesce(t.portal_status,'active')) = 'active'
    ) then
      raise exception 'Final publication requires Principal approval.';
    end if;

    if nullif(trim(coalesce(new.principal_remark,'')),'') is null then
      raise exception 'Principal remark is required before publication.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pacsa_validate_report_status_transition on public.student_reports;
create trigger trg_pacsa_validate_report_status_transition
before update on public.student_reports
for each row execute function public.pacsa_validate_report_status_transition();

commit;
