-- PACSA Digital Learning: additive schema. No existing table is modified.
create table if not exists public.learning_lessons (
 id uuid primary key default gen_random_uuid(),
 teacher_user_id uuid not null references auth.users(id),
 class_name text not null,
 subject text not null,
 title text not null check (length(trim(title)) between 3 and 160),
 body text not null default '',
 video_url text,
 status text not null default 'draft' check (status in ('draft','published','archived')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.learning_quizzes (
 id uuid primary key default gen_random_uuid(),
 lesson_id uuid references public.learning_lessons(id) on delete cascade,
 teacher_user_id uuid not null references auth.users(id),
 class_name text not null,
 subject text not null,
 title text not null,
 kind text not null default 'practice' check(kind in ('practice','graded')),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_at timestamptz not null default now()
);
create table if not exists public.learning_questions (
 id uuid primary key default gen_random_uuid(),
 quiz_id uuid not null references public.learning_quizzes(id) on delete cascade,
 prompt text not null,
 options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 6),
 position integer not null default 0
);
create table if not exists public.learning_answer_keys (
 question_id uuid primary key references public.learning_questions(id) on delete cascade,
 correct_index integer not null check(correct_index between 0 and 5)
);
create table if not exists public.learning_attempts (
 id uuid primary key default gen_random_uuid(),
 quiz_id uuid not null references public.learning_quizzes(id),
 student_user_id uuid not null references auth.users(id),
 answers jsonb not null default '{}'::jsonb,
 score integer not null,
 total integer not null,
 submitted_at timestamptz not null default now()
);
create index if not exists learning_lessons_class_subject_idx on public.learning_lessons(class_name,subject,status);
create index if not exists learning_quizzes_class_subject_idx on public.learning_quizzes(class_name,subject,status);
create index if not exists learning_attempts_student_idx on public.learning_attempts(student_user_id,submitted_at desc);
create or replace function public.learning_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admins a where a.auth_user_id=auth.uid() and lower(a.status)='active')
 or exists(select 1 from public."Teachers" t where t.auth_user_id=auth.uid() and lower(t.portal_status)='active' and lower(t.role)='principal');
$$;
create or replace function public.learning_teacher_assigned(p_class text,p_subject text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public."Teachers" t join public.teacher_assignments a on a.teacher_id=t.teacher_id where t.auth_user_id=auth.uid() and lower(t.portal_status)='active' and lower(a.class)=lower(p_class) and lower(a.subject)=lower(p_subject));
$$;
create or replace function public.learning_student_in_class(p_class text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.students s where s.auth_user_id=auth.uid() and lower(s.class)=lower(p_class) and lower(s.status)='active' and lower(s.portal_status)='active');
$$;
alter table public.learning_lessons enable row level security;
alter table public.learning_quizzes enable row level security;
alter table public.learning_questions enable row level security;
alter table public.learning_answer_keys enable row level security;
alter table public.learning_attempts enable row level security;
create policy "learning_lessons_read" on public.learning_lessons for select to authenticated using (public.learning_is_admin() or (teacher_user_id=auth.uid() and public.learning_teacher_assigned(class_name,subject)) or (status='published' and public.learning_student_in_class(class_name)));
create policy "learning_lessons_insert" on public.learning_lessons for insert to authenticated with check (teacher_user_id=auth.uid() and public.learning_teacher_assigned(class_name,subject));
create policy "learning_lessons_update" on public.learning_lessons for update to authenticated using ((teacher_user_id=auth.uid() and public.learning_teacher_assigned(class_name,subject)) or public.learning_is_admin()) with check ((teacher_user_id=auth.uid() and public.learning_teacher_assigned(class_name,subject)) or public.learning_is_admin());
create policy "learning_quizzes_read" on public.learning_quizzes for select to authenticated using (public.learning_is_admin() or (teacher_user_id=auth.uid() and public.learning_teacher_assigned(class_name,subject)) or (status='published' and public.learning_student_in_class(class_name)));
create policy "learning_quizzes_insert" on public.learning_quizzes for insert to authenticated with check (teacher_user_id=auth.uid() and public.learning_teacher_assigned(class_name,subject));
create policy "learning_quizzes_update" on public.learning_quizzes for update to authenticated using ((teacher_user_id=auth.uid() and public.learning_teacher_assigned(class_name,subject)) or public.learning_is_admin()) with check ((teacher_user_id=auth.uid() and public.learning_teacher_assigned(class_name,subject)) or public.learning_is_admin());
create policy "learning_questions_read" on public.learning_questions for select to authenticated using (exists(select 1 from public.learning_quizzes q where q.id=quiz_id and (public.learning_is_admin() or (q.teacher_user_id=auth.uid() and public.learning_teacher_assigned(q.class_name,q.subject)) or (q.status='published' and public.learning_student_in_class(q.class_name)))));
create policy "learning_questions_insert" on public.learning_questions for insert to authenticated with check (exists(select 1 from public.learning_quizzes q where q.id=quiz_id and q.status='draft' and q.teacher_user_id=auth.uid() and public.learning_teacher_assigned(q.class_name,q.subject)));
create policy "learning_questions_update" on public.learning_questions for update to authenticated using (exists(select 1 from public.learning_quizzes q where q.id=quiz_id and q.status='draft' and q.teacher_user_id=auth.uid() and public.learning_teacher_assigned(q.class_name,q.subject)));
create policy "learning_questions_delete" on public.learning_questions for delete to authenticated using (exists(select 1 from public.learning_quizzes q where q.id=quiz_id and q.status='draft' and q.teacher_user_id=auth.uid() and public.learning_teacher_assigned(q.class_name,q.subject)));
create policy "learning_keys_read" on public.learning_answer_keys for select to authenticated using (exists(select 1 from public.learning_questions x join public.learning_quizzes q on q.id=x.quiz_id where x.id=question_id and (public.learning_is_admin() or (q.teacher_user_id=auth.uid() and public.learning_teacher_assigned(q.class_name,q.subject)))));
create policy "learning_keys_insert" on public.learning_answer_keys for insert to authenticated with check (exists(select 1 from public.learning_questions x join public.learning_quizzes q on q.id=x.quiz_id where x.id=question_id and q.status='draft' and q.teacher_user_id=auth.uid() and public.learning_teacher_assigned(q.class_name,q.subject)));
create policy "learning_keys_update" on public.learning_answer_keys for update to authenticated using (exists(select 1 from public.learning_questions x join public.learning_quizzes q on q.id=x.quiz_id where x.id=question_id and q.status='draft' and q.teacher_user_id=auth.uid() and public.learning_teacher_assigned(q.class_name,q.subject)));
create policy "learning_attempts_read" on public.learning_attempts for select to authenticated using (student_user_id=auth.uid() or public.learning_is_admin() or exists(select 1 from public.learning_quizzes q where q.id=quiz_id and q.teacher_user_id=auth.uid() and public.learning_teacher_assigned(q.class_name,q.subject)));
-- Attempts are submitted through a controlled grading function, never directly by clients.
create or replace function public.learning_submit_attempt(p_quiz_id uuid,p_answers jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare q record; total_count integer; earned integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into q from public.learning_quizzes where id=p_quiz_id and status='published';
 if not found or not public.learning_student_in_class(q.class_name) then raise exception 'Quiz unavailable'; end if;
 if jsonb_typeof(p_answers) <> 'object' or length(p_answers::text)>16000 then raise exception 'Invalid answers'; end if;
 if q.kind='graded' and exists(select 1 from public.learning_attempts where quiz_id=p_quiz_id and student_user_id=auth.uid()) then raise exception 'Graded quiz already submitted'; end if;
 select count(*),count(*) filter(where p_answers->>x.id::text = k.correct_index::text)
 into total_count,earned from public.learning_questions x join public.learning_answer_keys k on k.question_id=x.id where x.quiz_id=p_quiz_id;
 if total_count=0 then raise exception 'Quiz has no questions'; end if;
 insert into public.learning_attempts(quiz_id,student_user_id,answers,score,total) values(p_quiz_id,auth.uid(),p_answers,earned,total_count);
 return jsonb_build_object('score',earned,'total',total_count);
end;$$;
revoke all on function public.learning_submit_attempt(uuid,jsonb) from public;
grant execute on function public.learning_submit_attempt(uuid,jsonb) to authenticated;
revoke all on function public.learning_is_admin() from public;
revoke all on function public.learning_teacher_assigned(text,text) from public;
revoke all on function public.learning_student_in_class(text) from public;
grant execute on function public.learning_is_admin() to authenticated;
grant execute on function public.learning_teacher_assigned(text,text) to authenticated;
grant execute on function public.learning_student_in_class(text) to authenticated;
grant select,insert,update on public.learning_lessons,public.learning_quizzes to authenticated;
grant select,insert,update,delete on public.learning_questions to authenticated;
grant select,insert,update on public.learning_answer_keys to authenticated;
grant select on public.learning_attempts to authenticated;
