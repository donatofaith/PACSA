-- Store date of birth on student records so official report sheets can show age.
begin;

alter table public.students add column if not exists date_of_birth date;

create or replace function public.pacsa_copy_application_birthdate_to_student()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if lower(coalesce(new.status,''))='approved' and new.date_of_birth is not null then
    update public.students s
    set date_of_birth=coalesce(s.date_of_birth,new.date_of_birth)
    where public.pacsa_normalize_email(s.email)=public.pacsa_normalize_email(new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists pacsa_copy_application_birthdate_to_student on public.applications;
create trigger pacsa_copy_application_birthdate_to_student
after update of status on public.applications
for each row execute function public.pacsa_copy_application_birthdate_to_student();

commit;
