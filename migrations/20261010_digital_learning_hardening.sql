-- Apply AFTER 20261010_digital_learning.sql; review in PACSA staging process.
-- These changes touch ONLY learning_* objects.
create unique index if not exists learning_graded_one_attempt_idx
 on public.learning_attempts(quiz_id,student_user_id);
-- Graded attempts are immutable. Practice attempts can be repeated through RPC,
-- so the unique index above is intentionally NOT valid for practice quizzes.
drop index if exists public.learning_graded_one_attempt_idx;
create or replace function public.learning_enforce_quiz_integrity()
returns trigger language plpgsql security definer set search_path='' as $$
declare count_active integer;
begin
 if tg_op='UPDATE' then
  if old.status <> 'draft' and (
    new.title is distinct from old.title or
    new.kind is distinct from old.kind or
    new.class_name is distinct from old.class_name or
    new.subject is distinct from old.subject or
    new.teacher_user_id is distinct from old.teacher_user_id or
    new.lesson_id is distinct from old.lesson_id
  ) then raise exception 'Published quiz content is locked'; end if;
  if old.status='published' and new.status='draft' then
   raise exception 'Published quizzes cannot return to draft'; end if;
 end if;
 if new.status='published' and (tg_op='INSERT' or old.status is distinct from new.status) then
  if not exists (
   select 1 from public.learning_questions x
   join public.learning_answer_keys k on k.question_id=x.id
   where x.quiz_id=new.id
  ) then raise exception 'Quiz must contain a question and answer key'; end if;
  if new.kind='graded' then
   perform pg_advisory_xact_lock(hashtext(lower(new.class_name)));
   select count(*) into count_active from public.learning_quizzes q
   where lower(q.class_name)=lower(new.class_name)
     and q.kind='graded' and q.status='published' and q.id<>new.id;
   if count_active>=2 then raise exception 'This class already has two active graded assessments'; end if;
  end if;
 end if;
 return new;
end;$$;
drop trigger if exists learning_quiz_integrity on public.learning_quizzes;
create trigger learning_quiz_integrity before insert or update on public.learning_quizzes
for each row execute function public.learning_enforce_quiz_integrity();
create or replace function public.learning_lock_published_questions()
returns trigger language plpgsql security definer set search_path='' as $$
declare quiz_status text;
begin
 select q.status into quiz_status from public.learning_quizzes q
 join public.learning_questions x on x.quiz_id=q.id
 where x.id=case when tg_op='DELETE' then old.id else new.id end;
 if tg_op='INSERT' then
  select status into quiz_status from public.learning_quizzes where id=new.quiz_id;
 end if;
 if quiz_status <> 'draft' then raise exception 'Published quiz questions cannot be changed'; end if;
 return case when tg_op='DELETE' then old else new end;
end;$$;
drop trigger if exists learning_questions_lock on public.learning_questions;
create trigger learning_questions_lock before insert or update or delete on public.learning_questions
for each row execute function public.learning_lock_published_questions();
create or replace function public.learning_lock_answer_keys()
returns trigger language plpgsql security definer set search_path='' as $$
declare quiz_status text;
begin
 select q.status into quiz_status from public.learning_questions x
 join public.learning_quizzes q on q.id=x.quiz_id
 where x.id=case when tg_op='DELETE' then old.question_id else new.question_id end;
 if quiz_status <> 'draft' then raise exception 'Published quiz answer keys cannot be changed'; end if;
 return case when tg_op='DELETE' then old else new end;
end;$$;
drop trigger if exists learning_answer_keys_lock on public.learning_answer_keys;
create trigger learning_answer_keys_lock before insert or update or delete on public.learning_answer_keys
for each row execute function public.learning_lock_answer_keys();
-- Explicitly prohibit teacher reassignment through UPDATE; existing UPDATE policy
-- otherwise permits switching teacher_user_id for principals.
create or replace function public.learning_enforce_owner()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.teacher_user_id is distinct from old.teacher_user_id then
  raise exception 'Owner cannot be changed';
 end if;
 return new;
end;$$;
drop trigger if exists learning_lesson_owner on public.learning_lessons;
create trigger learning_lesson_owner before update on public.learning_lessons
for each row execute function public.learning_enforce_owner();
drop trigger if exists learning_quiz_owner on public.learning_quizzes;
create trigger learning_quiz_owner before update on public.learning_quizzes
for each row execute function public.learning_enforce_owner();
-- Attempts are never client-writable; grading is done by the server-side RPC.
revoke insert,update,delete on public.learning_attempts from authenticated;
revoke all on function public.learning_enforce_quiz_integrity() from public;
revoke all on function public.learning_lock_published_questions() from public;
revoke all on function public.learning_lock_answer_keys() from public;
revoke all on function public.learning_enforce_owner() from public;
