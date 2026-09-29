-- ============================================================================
-- AJM FIT — Reps in reserve
--
-- The program tells every client to leave 1-3 reps in reserve and then never
-- asks whether they did. That single missing number is why a stall cannot be
-- diagnosed: a client stuck at 135 x 9 with 3 reps left in the tank has an
-- effort or technique problem, and one stuck at 135 x 9 with nothing left has
-- a genuine plateau. Those need opposite responses and today they are
-- indistinguishable in the data.
--
-- Deliberately optional and per-exercise rather than per-set. A required field
-- is a field people start lying to, and asking after every single set would
-- turn a workout into a survey. One tap at the end of an exercise is enough to
-- tell a hard session from an easy one.
--
-- Stored on the set rather than the workout so it travels with the exercise:
-- the last set of a lift is the one whose difficulty actually means something,
-- and a client can be flat out on rows while cruising on curls.
-- ============================================================================

begin;

alter table public.workout_sets
  add column if not exists rir smallint;

alter table public.workout_sets drop constraint if exists workout_sets_rir_range;
alter table public.workout_sets add constraint workout_sets_rir_range
  check (rir is null or rir between 0 and 5);

comment on column public.workout_sets.rir is
  'Reps left in reserve on this set. 0 = failure, 5 = very easy. Null = not reported, which is the common case and must never be read as zero.';

commit;
