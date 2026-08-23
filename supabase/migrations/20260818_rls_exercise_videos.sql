-- exercise_videos shipped with row level security disabled while anon and
-- authenticated held full grants, so Supabase flagged it as
-- rls_disabled_in_public: the publishable anon key was enough to read, insert,
-- or delete rows. The table is reference data (exercise name, video URL,
-- instructions) and was empty when this ran, so nothing leaked.
--
-- Policies match the programs / program_exercises pattern: any signed-in user
-- can read, only a trainer can write.

alter table public.exercise_videos enable row level security;

drop policy if exists exercise_videos_select on public.exercise_videos;
create policy exercise_videos_select on public.exercise_videos
  for select using (auth.uid() is not null);

drop policy if exists exercise_videos_write on public.exercise_videos;
create policy exercise_videos_write on public.exercise_videos
  for all using (is_trainer());
