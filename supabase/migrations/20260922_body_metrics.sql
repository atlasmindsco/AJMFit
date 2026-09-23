-- ============================================================================
-- AJM FIT — Body metrics history
--
-- Weight previously lived on users.current_weight as a single column with a
-- last_weight_update timestamp, so recording a new weight destroyed the
-- previous one. No trend could be drawn, which is the first thing a coached
-- client wants to see and the first thing a coach needs to make a decision.
-- There was no home for measurements or progress photos at all.
--
-- One row per client per day. Every field is nullable: a client who only ever
-- logs bodyweight is a normal case, and photos in particular must stay
-- optional — a mandatory upload is where onboarding stops dead for a lot of
-- people.
-- ============================================================================

begin;

create table if not exists public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  recorded_on date not null default current_date,

  weight_lb numeric(6,2),

  -- Inches. Waist is the highest-signal of these; the rest are optional.
  waist_in numeric(5,2),
  hips_in numeric(5,2),
  chest_in numeric(5,2),
  arm_in numeric(5,2),
  thigh_in numeric(5,2),

  photo_front_url text,
  photo_side_url text,
  photo_back_url text,

  notes text,
  created_at timestamptz not null default now(),

  unique (user_id, recorded_on)
);

create index if not exists idx_body_metrics_user_date
  on public.body_metrics(user_id, recorded_on desc);

alter table public.body_metrics enable row level security;

-- Clients own their own rows; the trainer sees everyone's.
do $$
begin
  if not exists (select 1 from pg_policy where polrelid = 'public.body_metrics'::regclass and polname = 'body_metrics_select') then
    create policy body_metrics_select on public.body_metrics
      for select using (public.current_user_id() = user_id or public.is_trainer());
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.body_metrics'::regclass and polname = 'body_metrics_insert') then
    create policy body_metrics_insert on public.body_metrics
      for insert with check (public.current_user_id() = user_id or public.is_trainer());
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.body_metrics'::regclass and polname = 'body_metrics_update') then
    create policy body_metrics_update on public.body_metrics
      for update using (public.current_user_id() = user_id or public.is_trainer())
               with check (public.current_user_id() = user_id or public.is_trainer());
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.body_metrics'::regclass and polname = 'body_metrics_delete') then
    create policy body_metrics_delete on public.body_metrics
      for delete using (public.current_user_id() = user_id or public.is_trainer());
  end if;
end $$;

commit;
