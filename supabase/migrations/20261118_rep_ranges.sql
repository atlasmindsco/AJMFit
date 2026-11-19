-- ============================================================================
-- AJM FIT — Rep ranges and effort targets on a prescription
--
-- WHY. `lib/progression.ts` runs double progression: work to the top of a rep
-- range on every set, then add load and start again at the bottom. It reads
-- the range out of the `reps` text with `parseRepRange`.
--
-- Four prescriptions in five are a single number — "8", not "8-12". The parser
-- handles that by setting min and max to the same value, and the engine then
-- degenerates into session-by-session linear progression: hit all 8 once, add
-- weight, every single session, with no buffer. That is right for a novice in
-- their first months and too aggressive for anybody else, and it is what every
-- client in the app is currently training under.
--
-- These columns give a prescription a real range and an effort target. They
-- are nullable and nothing reads them yet: the backfill fills them, a verifier
-- checks what landed, and only then does anything depend on them.
--
-- `reps` stays the display and parsing field. The backfill writes "8-12" there
-- alongside rep_min=8 and rep_max=12, so the engine benefits with no code
-- change and these columns become the structured source the generator and the
-- validators can rely on. The verifier asserts the two never disagree.
-- ============================================================================

begin;

alter table public.program_exercises
  add column if not exists rep_min smallint,
  add column if not exists rep_max smallint,
  -- Reps in reserve: how many more the client should have had at the end of a
  -- working set. 0 is to failure. Null means "no target set", which is the
  -- state every row starts in and stays in until a coach decides otherwise.
  add column if not exists target_rir smallint;

comment on column public.program_exercises.rep_min is
  'Bottom of the prescribed rep range. Null for timed or distance work.';
comment on column public.program_exercises.rep_max is
  'Top of the range. Reaching it on every set is what earns a load increase.';
comment on column public.program_exercises.target_rir is
  'Reps in reserve to leave on a working set. 0 is failure. Null = not set.';

-- A range has to be a range. Both ends or neither, and the top cannot be below
-- the bottom. Without this a half-finished backfill could leave rep_min set
-- and rep_max null, which would read as "no range" and silently fall back to
-- the linear behaviour this migration exists to end.
alter table public.program_exercises drop constraint if exists program_exercises_rep_range;
alter table public.program_exercises add constraint program_exercises_rep_range
  check (
    (rep_min is null and rep_max is null)
    or (rep_min is not null and rep_max is not null and rep_min >= 1 and rep_max >= rep_min)
  );

-- RIR above about 5 is not a working set, and negative is not a thing.
alter table public.program_exercises drop constraint if exists program_exercises_target_rir;
alter table public.program_exercises add constraint program_exercises_target_rir
  check (target_rir is null or (target_rir >= 0 and target_rir <= 5));

commit;
