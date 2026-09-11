-- PACSA STUDENT / ADMISSION DOCUMENT COLLECTION
-- Run this once in Supabase SQL Editor.
-- Adds NIN + document image paths for applications and students.

alter table public.applications
  add column if not exists nin text,
  add column if not exists birth_certificate_path text,
  add column if not exists school_leaving_certificate_path text;

alter table public.students
  add column if not exists nin text,
  add column if not exists birth_certificate_path text,
  add column if not exists school_leaving_certificate_path text;


-- Optional format checks. Empty/null is allowed for admin-created legacy records.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_nin_digits_check'
  ) then
    alter table public.applications
      add constraint applications_nin_digits_check
      check (nin is null or nin = '' or nin ~ '^\d{11}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_nin_digits_check'
  ) then
    alter table public.students
      add constraint students_nin_digits_check
      check (nin is null or nin = '' or nin ~ '^\d{11}$');
  end if;
end $$;


-- Private storage bucket for sensitive student/admission documents.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'pacsa-documents',
  'pacsa-documents',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];


-- Recreate policies safely.
drop policy if exists "PACSA public document uploads" on storage.objects;
drop policy if exists "PACSA authenticated document uploads" on storage.objects;
drop policy if exists "PACSA admins can read documents" on storage.objects;
drop policy if exists "PACSA admins can update documents" on storage.objects;
drop policy if exists "PACSA admins can delete documents" on storage.objects;

-- Applicants are anonymous before admission, so they need insert-only access.
create policy "PACSA public document uploads"
on storage.objects
for insert
to anon
with check (bucket_id = 'pacsa-documents');

-- Logged-in Admins can upload documents for students created manually.
create policy "PACSA authenticated document uploads"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'pacsa-documents');

-- Keep documents private. Only active Admin accounts can read them.
create policy "PACSA admins can read documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'pacsa-documents'
  and exists (
    select 1
    from public.admins a
    where a.auth_user_id = auth.uid()
      and lower(coalesce(a.status, 'active')) = 'active'
  )
);

create policy "PACSA admins can update documents"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'pacsa-documents'
  and exists (
    select 1
    from public.admins a
    where a.auth_user_id = auth.uid()
      and lower(coalesce(a.status, 'active')) = 'active'
  )
)
with check (bucket_id = 'pacsa-documents');

create policy "PACSA admins can delete documents"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'pacsa-documents'
  and exists (
    select 1
    from public.admins a
    where a.auth_user_id = auth.uid()
      and lower(coalesce(a.status, 'active')) = 'active'
  )
);


-- When an application is approved, copy its document fields to the student record.
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
      nin = coalesce(nullif(s.nin, ''), nullif(new.nin, '')),
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

drop trigger if exists pacsa_copy_application_documents_to_student on public.applications;
create trigger pacsa_copy_application_documents_to_student
after update of status on public.applications
for each row
execute function public.pacsa_copy_application_documents_to_student();
