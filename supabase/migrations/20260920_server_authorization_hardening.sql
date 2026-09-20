-- PACSA server authorization hardening.
-- Defense-in-depth: privileged RPCs may only be called by authenticated JWTs.
-- Each RPC still performs its own auth.uid()/role check internally.
-- Public account-bootstrap helpers are intentionally excluded.

begin;

do $$
declare
  signature text;
  protected_functions text[] := array[
    'public.pacsa_get_my_admin_role()',
    'public.pacsa_get_my_teacher_role()',
    'public.pacsa_get_my_student()',
    'public.pacsa_get_my_teacher()',
    'public.pacsa_update_student_photo(text)',
    'public.pacsa_superadmin_set_teacher_role(text,text)',
    'public.pacsa_superadmin_set_assessment_stage(text,text,text)',
    'public.pacsa_principal_get_reports()',
    'public.pacsa_principal_get_report_results(text,text,text,text)',
    'public.pacsa_principal_publish_report(text,text,text,text,text)',
    'public.pacsa_principal_return_report(text,text,text,text,text)',
    'public.pacsa_class_teacher_submit_report(text,text,text,text,text)',
    'public.pacsa_teacher_delete_result(uuid)',
    'public.pacsa_teacher_delete_result(bigint)',
    'public.pacsa_update_my_teacher_signature(text)',
    'public.pacsa_get_my_teacher_notifications(integer)',
    'public.pacsa_mark_my_teacher_notifications_read()',
    'public.pacsa_get_my_ca_results()',
    'public.pacsa_get_my_published_reports()',
    'public.pacsa_get_my_published_report_results(text,text,text)',
    'public.pacsa_get_my_midterm_report()',
    'public.pacsa_get_my_final_report_rows(text,text,text)',
    'public.pacsa_get_my_report_meta(text,text,text)'
  ];
begin
  foreach signature in array protected_functions loop
    if to_regprocedure(signature) is not null then
      execute format('revoke all on function %s from public, anon', signature);
      execute format('grant execute on function %s to authenticated', signature);
    end if;
  end loop;

  -- Internal helper: callers should use the purpose-built RPCs above.
  if to_regprocedure('public.pacsa_actor_role()') is not null then
    revoke all on function public.pacsa_actor_role() from public, anon, authenticated;
  end if;

  -- Password reset no longer needs a public account-existence probe.
  if to_regprocedure('public.pacsa_student_reset_check(text)') is not null then
    revoke all on function public.pacsa_student_reset_check(text) from public, anon, authenticated;
  end if;
end $$;

commit;
