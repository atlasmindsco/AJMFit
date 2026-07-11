-- ============================================
-- AJM FIT — Base tables (disaster-recovery snapshot)
-- ============================================
-- Consolidates the original untracked pre-auth migrations (001, 002, 003)
-- WITHOUT their later-revoked permissive anon policies (old 004/005; replaced
-- by owner/trainer policies in 0001_auth_foundation.sql). This makes the
-- tracked 0000..0008 set self-contained: 0001+ alter and add policies to
-- tables that otherwise only existed in untracked files.
--
-- Idempotent (IF NOT EXISTS everywhere): a no-op on the live database, which
-- already has all of these. Run order on a fresh DB: 0000 -> 0001 -> ... 0008.

begin;

-- 1. Users (macro targets live directly on the row; NOT NULL defaults mean a
--    brand-new client always has working targets)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  daily_cal_target integer not null default 2000,
  protein_target integer not null default 150,
  carb_target integer not null default 250,
  fat_target integer not null default 70,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.users
  add column if not exists phone text,
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'active', 'paused', 'cancelled'));

-- 2. Meals (template meals per user)
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  scheduled_time time,
  meal_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 3. Food logs
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  meal_id uuid references public.meals(id) on delete set null,
  date date not null default current_date,
  food_name text not null,
  calories integer not null default 0,
  protein numeric(6,1) not null default 0,
  carbs numeric(6,1) not null default 0,
  fats numeric(6,1) not null default 0,
  serving_size text,
  source text,
  created_at timestamptz not null default now()
);

-- 4. Daily logs (hydration/notes; UNIQUE(user_id,date) backs the water upsert)
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null default current_date,
  water_oz numeric(5,1) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, date)
);

-- 5. Workouts
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null default current_date,
  day_name text not null,
  program_name text,
  program_phase text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  notes text,
  created_at timestamptz not null default now()
);

-- 6. Workout sets
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  exercise_name text not null,
  original_exercise_name text,
  set_number integer not null,
  weight numeric(7,2),
  reps integer,
  is_intensity_set boolean not null default false,
  intensity_technique text,
  completed boolean not null default false,
  logged_at timestamptz not null default now(),
  constraint valid_technique check (
    intensity_technique is null or intensity_technique in ('dropset', 'restpause', 'partial')
  )
);

-- 7. Exercise PRs (UNIQUE(user_id,exercise_name) backs the PR upsert)
create table if not exists public.exercise_prs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  exercise_name text not null,
  weight numeric(7,2) not null,
  reps integer not null,
  previous_weight numeric(7,2),
  set_at timestamptz not null default now(),
  workout_id uuid references public.workouts(id) on delete set null,
  unique(user_id, exercise_name)
);

-- 8. Exercise swaps (UNIQUE(user_id,original_exercise_name) backs the swap upsert)
create table if not exists public.exercise_swaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  original_exercise_name text not null,
  swapped_exercise_name text not null,
  created_at timestamptz not null default now(),
  unique(user_id, original_exercise_name)
);

-- 9. Applications (intake form snapshot)
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  goals text not null,
  equipment text[] not null default '{}',
  health_limitations text,
  availability text not null,
  tier text not null check (tier in ('blueprint', 'accelerator', 'full-experience')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'weekly')),
  referral text,
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'accepted', 'declined')),
  reviewed_at timestamptz,
  reviewed_by text,
  notes text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_food_logs_user_date on public.food_logs(user_id, date);
create index if not exists idx_food_logs_meal on public.food_logs(meal_id);
create index if not exists idx_meals_user on public.meals(user_id);
create index if not exists idx_daily_logs_user_date on public.daily_logs(user_id, date);
create index if not exists idx_workouts_user_date on public.workouts(user_id, date desc);
create index if not exists idx_workout_sets_workout on public.workout_sets(workout_id);
create index if not exists idx_workout_sets_user_exercise on public.workout_sets(user_id, exercise_name, logged_at desc);
create index if not exists idx_exercise_prs_user on public.exercise_prs(user_id);
create index if not exists idx_exercise_swaps_user on public.exercise_swaps(user_id);
create index if not exists idx_applications_user on public.applications(user_id);
create index if not exists idx_applications_status on public.applications(status, created_at desc);
create index if not exists idx_users_status on public.users(status);

-- RLS on (policies come from 0001_auth_foundation.sql; deliberately NO
-- permissive anon policies here)
alter table public.users enable row level security;
alter table public.meals enable row level security;
alter table public.food_logs enable row level security;
alter table public.daily_logs enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.exercise_prs enable row level security;
alter table public.exercise_swaps enable row level security;
alter table public.applications enable row level security;

commit;
