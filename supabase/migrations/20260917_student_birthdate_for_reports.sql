-- Store date of birth on student records so official report sheets can show age.
begin;
alter table public.students add column if not exists date_of_birth date;
commit;
