-- PACSA teacher self-profile update guard: allow profile photo + signature
-- Run once in Supabase SQL Editor.
-- This removes the older guard that only allowed profile_photo_path.

begin;

-- Remove only the legacy Teachers trigger whose function contains the old
-- "profile photo only" restriction. This avoids guessing its trigger name.
do $$
declare
  r record;
begin
  for r in
    select
      t.tgname,
      p.oid as function_oid
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public."Teachers"'::regclass
      and not t.tgisinternal
      and (
        lower(pg_get_functiondef(p.oid)) like '%teachers may only update their profile photo%'
        or (
          lower(pg_get_functiondef(p.oid)) like '%profile_photo_path%'
          and lower(pg_get_functiondef(p.oid)) like '%raise exception%'
        )
      )
  loop
    execute format('drop trigger if exists %I on public."Teachers"', r.tgname);
  end loop;
end
$$;

create or replace function public.pacsa_guard_teacher_self_profile_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- This guard is only for a teacher modifying their own row.
  -- Admin/service-role operations continue to rely on their existing access rules.
  if auth.uid() is not null
     and old.auth_user_id = auth.uid() then

    if (
      to_jsonb(new)
        - 'profile_photo_path'
        - 'signature_path'
        - 'updated_at'
    ) is distinct from (
      to_jsonb(old)
        - 'profile_photo_path'
        - 'signature_path'
        - 'updated_at'
    ) then
      raise exception
        'Teachers may only update their profile photo and signature.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists pacsa_guard_teacher_self_profile_update on public."Teachers";
create trigger pacsa_guard_teacher_self_profile_update
before update on public."Teachers"
for each row
execute function public.pacsa_guard_teacher_self_profile_update();

-- Keep the signature write behind the authenticated RPC.
create or replace function public.pacsa_update_my_teacher_signature(p_path text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if p_path is null
     or position(auth.uid()::text || '/' in p_path) <> 1 then
    raise exception 'Invalid signature path.';
  end if;

  update public."Teachers"
  set signature_path = p_path
  where auth_user_id = auth.uid()
    and lower(coalesce(portal_status,'active')) = 'active';

  return found;
end;
$$;

revoke all on function public.pacsa_update_my_teacher_signature(text) from public, anon;
grant execute on function public.pacsa_update_my_teacher_signature(text) to authenticated;

commit;
