-- ============================================================================
-- AJM FIT — App completion: coach settings, scheduling, community, programs.
-- Uses existing helpers public.is_trainer() and public.current_user_id().
-- ============================================================================

begin;

-- ---------------------------------------------------------------- coach settings
create table if not exists public.coach_settings (
  auth_id uuid primary key references auth.users(id) on delete cascade,
  full_name text, email text, phone text, bio text, timezone text,
  business_name text, website text, instagram text,
  notify_new_application boolean not null default true,
  notify_new_message boolean not null default true,
  notify_payment boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.coach_settings enable row level security;
drop policy if exists coach_settings_all on public.coach_settings;
create policy coach_settings_all on public.coach_settings
  for all using (public.is_trainer()) with check (public.is_trainer());

-- ---------------------------------------------------------------- scheduling
create table if not exists public.scheduled_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  starts_at timestamptz not null,
  duration_min int not null default 45,
  type text,
  notes text,
  status text not null default 'scheduled', -- scheduled | completed | cancelled
  created_at timestamptz not null default now()
);
create index if not exists scheduled_sessions_starts_idx on public.scheduled_sessions(starts_at);
alter table public.scheduled_sessions enable row level security;
drop policy if exists scheduled_sessions_select on public.scheduled_sessions;
drop policy if exists scheduled_sessions_write on public.scheduled_sessions;
create policy scheduled_sessions_select on public.scheduled_sessions
  for select using (public.current_user_id() = user_id or public.is_trainer());
create policy scheduled_sessions_write on public.scheduled_sessions
  for all using (public.is_trainer()) with check (public.is_trainer());

-- ---------------------------------------------------------------- community
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category text not null default 'General',
  title text not null,
  body text not null default '',
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts(created_at desc);
alter table public.posts enable row level security;
drop policy if exists posts_select on public.posts;
drop policy if exists posts_insert on public.posts;
drop policy if exists posts_modify on public.posts;
create policy posts_select on public.posts for select using (auth.uid() is not null);
create policy posts_insert on public.posts for insert
  with check (public.current_user_id() = user_id or public.is_trainer());
create policy posts_modify on public.posts for all
  using (public.current_user_id() = user_id or public.is_trainer())
  with check (public.current_user_id() = user_id or public.is_trainer());

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments(post_id, created_at);
alter table public.post_comments enable row level security;
drop policy if exists post_comments_select on public.post_comments;
drop policy if exists post_comments_insert on public.post_comments;
create policy post_comments_select on public.post_comments for select using (auth.uid() is not null);
create policy post_comments_insert on public.post_comments for insert
  with check (public.current_user_id() = user_id or public.is_trainer());

create table if not exists public.community_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text,
  starts_at timestamptz not null,
  description text,
  created_at timestamptz not null default now()
);
alter table public.community_events enable row level security;
drop policy if exists community_events_select on public.community_events;
drop policy if exists community_events_write on public.community_events;
create policy community_events_select on public.community_events for select using (auth.uid() is not null);
create policy community_events_write on public.community_events for all
  using (public.is_trainer()) with check (public.is_trainer());

-- ---------------------------------------------------------------- program library
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  level text,            -- Beginner | Intermediate | Advanced
  days_per_week int,
  split text,            -- e.g. "Push / Pull / Legs"
  created_at timestamptz not null default now()
);
alter table public.programs enable row level security;
drop policy if exists programs_select on public.programs;
drop policy if exists programs_write on public.programs;
create policy programs_select on public.programs for select using (auth.uid() is not null);
create policy programs_write on public.programs for all
  using (public.is_trainer()) with check (public.is_trainer());

create table if not exists public.program_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists program_assignments_user_idx on public.program_assignments(user_id);
alter table public.program_assignments enable row level security;
drop policy if exists program_assignments_select on public.program_assignments;
drop policy if exists program_assignments_write on public.program_assignments;
create policy program_assignments_select on public.program_assignments
  for select using (public.current_user_id() = user_id or public.is_trainer());
create policy program_assignments_write on public.program_assignments for all
  using (public.is_trainer()) with check (public.is_trainer());

commit;
