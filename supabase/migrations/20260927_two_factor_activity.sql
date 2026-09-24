-- ============================================================================
-- AJM FIT — Two-factor activity
--
-- Maintenance was estimated from one self-reported dropdown that asked the
-- client to blend how much they move at work with how often they train, and
-- then guess which of five bands that lands in. Onboarding already collects
-- both facts separately (jobActivity, daysPerWeek), and the assigned program
-- already defines training frequency, so the blending was both redundant and
-- the least reliable step in the calculation.
--
-- These columns store the two inputs so the figure can be recomputed later --
-- by the progress-based adjustment engine, or by Anthony reviewing a target --
-- without going back to the onboarding JSON blob and re-deriving it.
--
-- activity_level is kept and still written. It remains the fallback for any
-- client who set up before this existed, and nothing that reads it had to
-- change.
-- ============================================================================

begin;

alter table public.users
  add column if not exists job_activity text,
  add column if not exists training_days_per_week smallint;

comment on column public.users.job_activity is
  'sedentary | on-my-feet | physical. Null = fall back to activity_level.';

comment on column public.users.training_days_per_week is
  'Planned training days, 0-7. Null = fall back to activity_level.';

alter table public.users
  drop constraint if exists users_training_days_range;
alter table public.users
  add constraint users_training_days_range
  check (training_days_per_week is null or training_days_per_week between 0 and 7);

alter table public.users
  drop constraint if exists users_job_activity_valid;
alter table public.users
  add constraint users_job_activity_valid
  check (job_activity is null or job_activity in ('sedentary','on-my-feet','physical'));

commit;
