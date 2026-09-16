-- PACSA targeted RLS/security hardening
-- Run after 20260916_security_notifications_audit.sql.

begin;

-- Admission no longer accepts document uploads. Remove anonymous uploads to the
-- private document bucket, and allow future manual document uploads only by Admins.
drop policy if exists "PACSA public document uploads" on storage.objects;
drop policy if exists "PACSA authenticated document uploads" on storage.objects;
drop policy if exists "PACSA admins can upload documents" on storage.objects;

create policy "PACSA admins can upload documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'pacsa-documents'
  and exists (
    select 1
    from public.admins a
    where a.auth_user_id = auth.uid()
      and lower(coalesce(a.status,'active')) = 'active'
  )
);

-- Admin identities are sensitive. Clients can only read their own Admin row;
-- Super Admin can read all Admin rows. Creation/deletion/status changes use the
-- create-admin-user Edge Function (service role) rather than direct table writes.
alter table public.admins enable row level security;

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='public' and tablename='admins'
  loop
    execute format('drop policy if exists %I on public.admins',p.policyname);
  end loop;
end $$;

create policy "Admins can read permitted admin records"
on public.admins
for select
to authenticated
using (
  auth_user_id = auth.uid()
  or exists (
    select 1
    from public.admins sa
    where sa.auth_user_id = auth.uid()
      and sa.role = 'super_admin'
      and lower(coalesce(sa.status,'active')) = 'active'
  )
);

-- No direct INSERT/UPDATE/DELETE policy is intentionally created for authenticated users.
-- Service-role Edge Functions and SECURITY DEFINER RPCs remain able to perform controlled changes.

-- Internal helper should not be callable directly from the public API.
revoke all on function public.pacsa_actor_role() from public, anon, authenticated;

-- Privileged report functions are authenticated-only and perform their own role checks.
revoke all on function public.pacsa_principal_get_reports() from public;
revoke all on function public.pacsa_principal_get_report_results(text,text,text,text) from public;
revoke all on function public.pacsa_principal_publish_report(text,text,text,text,text) from public;
revoke all on function public.pacsa_principal_return_report(text,text,text,text,text) from public;
grant execute on function public.pacsa_principal_get_reports() to authenticated;
grant execute on function public.pacsa_principal_get_report_results(text,text,text,text) to authenticated;
grant execute on function public.pacsa_principal_publish_report(text,text,text,text,text) to authenticated;
grant execute on function public.pacsa_principal_return_report(text,text,text,text,text) to authenticated;

commit;
