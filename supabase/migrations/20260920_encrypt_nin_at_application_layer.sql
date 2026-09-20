-- PACSA application-level protection for NIN.
-- Apply this migration BEFORE deploying the secure-pii Edge Function.
-- Existing plaintext NIN values are migrated by the authenticated secure-pii
-- action "migrate_legacy_nin" because the encryption key never lives in SQL.

begin;

alter table public.applications
  add column if not exists nin_encrypted text,
  add column if not exists nin_last4 text;

alter table public.students
  add column if not exists nin_encrypted text,
  add column if not exists nin_last4 text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'applications_nin_last4_check'
  ) then
    alter table public.applications
      add constraint applications_nin_last4_check
      check (nin_last4 is null or nin_last4 = '' or nin_last4 ~ '^[0-9]{4}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'students_nin_last4_check'
  ) then
    alter table public.students
      add constraint students_nin_last4_check
      check (nin_last4 is null or nin_last4 = '' or nin_last4 ~ '^[0-9]{4}$');
  end if;
end $$;

create or replace function public.pacsa_reject_plaintext_nin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.nin, '')), '') is not null then
    raise exception 'Plaintext NIN storage is disabled. Use the secure PII service.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists pacsa_applications_no_plaintext_nin on public.applications;
create trigger pacsa_applications_no_plaintext_nin
before insert or update of nin on public.applications
for each row execute function public.pacsa_reject_plaintext_nin();

drop trigger if exists pacsa_students_no_plaintext_nin on public.students;
create trigger pacsa_students_no_plaintext_nin
before insert or update of nin on public.students
for each row execute function public.pacsa_reject_plaintext_nin();

create or replace function public.pacsa_copy_application_documents_to_student()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.status, '')) = 'approved' then
    update public.students s
    set
      nin = null,
      nin_encrypted = coalesce(nullif(s.nin_encrypted, ''), nullif(new.nin_encrypted, '')),
      nin_last4 = coalesce(nullif(s.nin_last4, ''), nullif(new.nin_last4, '')),
      birth_certificate_path = coalesce(
        nullif(s.birth_certificate_path, ''),
        nullif(new.birth_certificate_path, '')
      ),
      school_leaving_certificate_path = coalesce(
        nullif(s.school_leaving_certificate_path, ''),
        nullif(new.school_leaving_certificate_path, '')
      )
    where public.pacsa_normalize_email(s.email) = public.pacsa_normalize_email(new.email);
  end if;
  return new;
end;
$$;

revoke all on function public.pacsa_reject_plaintext_nin() from public, anon, authenticated;

commit;
