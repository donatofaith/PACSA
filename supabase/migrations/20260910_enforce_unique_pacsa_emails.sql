-- PACSA GLOBAL EMAIL UNIQUENESS GUARD
-- Run this once in Supabase SQL Editor.
-- Rule: one email can belong to only one PACSA identity/account.

create or replace function public.pacsa_normalize_email(value text)
returns text
language sql
immutable
as $$
  select lower(trim(coalesce(value, '')));
$$;


create or replace function public.pacsa_email_conflict_message()
returns text
language sql
immutable
as $$
  select 'This email is already registered in PACSA. Please use another email or contact the school.';
$$;


create or replace function public.pacsa_prevent_duplicate_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  email_value text;
  current_application_id uuid;
  current_student_id text;
  current_teacher_id text;
  current_admin_id uuid;
  current_auth_user_id uuid;
begin
  email_value := public.pacsa_normalize_email(new.email);

  if email_value = '' then
    return new;
  end if;

  if tg_table_name = 'applications' then
    current_application_id := new.id;
  elsif tg_table_name = 'students' then
    current_student_id := new.student_id;
    current_auth_user_id := new.auth_user_id;
  elsif tg_table_name = 'Teachers' then
    current_teacher_id := new.teacher_id;
    current_auth_user_id := new.auth_user_id;
  elsif tg_table_name = 'admins' then
    current_admin_id := new.id;
    current_auth_user_id := new.auth_user_id;
  end if;

  if exists (
    select 1
    from public.applications a
    where public.pacsa_normalize_email(a.email) = email_value
      and (
        tg_table_name <> 'applications'
        or current_application_id is null
        or a.id is distinct from current_application_id
      )
  ) then
    raise exception '%', public.pacsa_email_conflict_message()
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.students s
    where public.pacsa_normalize_email(s.email) = email_value
      and (
        tg_table_name <> 'students'
        or current_student_id is null
        or s.student_id is distinct from current_student_id
      )
  ) then
    raise exception '%', public.pacsa_email_conflict_message()
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public."Teachers" t
    where public.pacsa_normalize_email(t.email) = email_value
      and (
        tg_table_name <> 'Teachers'
        or current_teacher_id is null
        or t.teacher_id is distinct from current_teacher_id
      )
  ) then
    raise exception '%', public.pacsa_email_conflict_message()
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.admins ad
    where public.pacsa_normalize_email(ad.email) = email_value
      and (
        tg_table_name <> 'admins'
        or current_admin_id is null
        or ad.id is distinct from current_admin_id
      )
  ) then
    raise exception '%', public.pacsa_email_conflict_message()
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from auth.users u
    where public.pacsa_normalize_email(u.email) = email_value
      and (
        current_auth_user_id is null
        or u.id is distinct from current_auth_user_id
      )
  ) then
    raise exception '%', public.pacsa_email_conflict_message()
      using errcode = '23505';
  end if;

  return new;
end;
$$;


drop trigger if exists pacsa_applications_unique_email on public.applications;
create trigger pacsa_applications_unique_email
before insert or update of email on public.applications
for each row
execute function public.pacsa_prevent_duplicate_email();


drop trigger if exists pacsa_students_unique_email on public.students;
create trigger pacsa_students_unique_email
before insert or update of email on public.students
for each row
execute function public.pacsa_prevent_duplicate_email();


drop trigger if exists pacsa_teachers_unique_email on public."Teachers";
create trigger pacsa_teachers_unique_email
before insert or update of email on public."Teachers"
for each row
execute function public.pacsa_prevent_duplicate_email();


drop trigger if exists pacsa_admins_unique_email on public.admins;
create trigger pacsa_admins_unique_email
before insert or update of email on public.admins
for each row
execute function public.pacsa_prevent_duplicate_email();


-- Keep student activation strictly student-only.
-- This does not create accounts. It only confirms that the Student ID and email belong to the same active student record.
create or replace function public.pacsa_student_activation_check(
  p_student_id text,
  p_email text
)
returns table (
  student_id text,
  email text,
  student_status text,
  portal_status text
)
language sql
security definer
set search_path = public
as $$
  select
    s.student_id,
    s.email,
    s.status as student_status,
    s.portal_status
  from public.students s
  where upper(trim(s.student_id)) = upper(trim(coalesce(p_student_id, '')))
    and public.pacsa_normalize_email(s.email) = public.pacsa_normalize_email(p_email)
  limit 1;
$$;

grant execute on function public.pacsa_student_activation_check(text, text) to anon, authenticated;
