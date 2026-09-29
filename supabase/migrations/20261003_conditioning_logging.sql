-- ============================================================================
-- AJM FIT — Somewhere to record a run
--
-- Hybrid programs prescribe "1 x 20 min" of jogging and "1 x 45 min" of trail
-- running. The logging screen offers a weight box and a reps box. There is no
-- field a duration can go in, and unsurprisingly not one running, cycling,
-- rowing, skipping or sprint-drill entry exists anywhere in the database.
--
-- That is the real reason half of every hybrid program never progresses. The
-- progression model was missing too, but a model reading data that cannot be
-- entered would have been the roof on a house with no walls.
--
--   duration_seconds  how long the bout lasted. Seconds rather than minutes so
--                     a 90-second interval and a 45-minute run share one column
--                     without anyone storing 1.5.
--   distance_mi       optional. A run is progressed by time OR distance and
--                     clients think in whichever their watch shows them.
--
-- Both nullable and both ignored by lifting, which keeps using weight and reps.
-- ============================================================================

begin;

alter table public.workout_sets
  add column if not exists duration_seconds integer,
  add column if not exists distance_mi numeric(6, 2);

alter table public.workout_sets drop constraint if exists workout_sets_duration_sane;
alter table public.workout_sets add constraint workout_sets_duration_sane
  check (duration_seconds is null or duration_seconds between 0 and 86400);

alter table public.workout_sets drop constraint if exists workout_sets_distance_sane;
alter table public.workout_sets add constraint workout_sets_distance_sane
  check (distance_mi is null or distance_mi between 0 and 200);

comment on column public.workout_sets.duration_seconds is
  'Length of a timed bout: a run, a row, a plank, an interval. Null for anything counted in reps.';
comment on column public.workout_sets.distance_mi is
  'Optional distance for a run or ride. Clients progress by time or distance, not always both.';

commit;
