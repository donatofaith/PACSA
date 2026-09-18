-- PACSA applicant first/last name support
-- Run once in Supabase SQL Editor.

begin;

alter table public.applications
  add column if not exists first_name text,
  add column if not exists last_name text;

-- Backfill older applications that only have full_name.
update public.applications
set
  first_name = coalesce(
    nullif(first_name,''),
    nullif(split_part(trim(coalesce(full_name,'')), ' ', 1),'')
  ),
  last_name = coalesce(
    nullif(last_name,''),
    nullif(
      trim(
        regexp_replace(
          trim(coalesce(full_name,'')),
          '^\\S+\\s*',
          ''
        )
      ),
      ''
    )
  )
where coalesce(first_name,'') = ''
   or coalesce(last_name,'') = '';

commit;
