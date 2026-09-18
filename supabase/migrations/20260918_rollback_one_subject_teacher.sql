-- PACSA rollback: allow teachers to have multiple subject assignments again.
-- Safe to run even if the restriction was never applied.

begin;

drop trigger if exists pacsa_one_subject_per_teacher on public.teacher_assignments;
drop function if exists public.pacsa_enforce_one_subject_per_teacher();

commit;
