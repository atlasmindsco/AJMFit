-- ============================================================================
-- AJM FIT — One row per logical set
--
-- saveSet looked up whether a set already existed and then inserted if it did
-- not. Two statements, no atomicity, called on EVERY KEYSTROKE. Typing "165"
-- fired three saves whose lookups all ran before any of their inserts landed,
-- so all three inserted. A single set became one row per character typed.
--
-- Before this migration: 952 rows for 340 real sets. 64% of the table was
-- keystroke debris, and every client's training volume read about three times
-- what they had actually lifted. Chance London's 19 Aug session alone was 98
-- rows for 17 sets, 45,831 lbs of volume against a true 13,490.
--
-- The duplicates were removed by tools/ops/dedupe-workout-sets.mjs, with full
-- copies of every deleted row in ops_action_log. This constraint is what stops
-- them coming back: the database now refuses a second row for the same set,
-- so the application cannot recreate the problem however it races.
--
-- saveSet is changed in the same commit to upsert on this constraint, which
-- turns a lost race into a harmless update instead of an error.
-- ============================================================================

begin;

-- Safety net: refuse to create the constraint if duplicates somehow remain,
-- with a message that says what to run, rather than failing on a raw index
-- violation that reads like a database problem.
do $$
declare dupes int;
begin
  select count(*) into dupes from (
    select 1 from public.workout_sets
    group by workout_id, exercise_name, set_number, is_intensity_set
    having count(*) > 1
  ) x;
  if dupes > 0 then
    raise exception
      'workout_sets still has % duplicated set slots. Run tools/ops/dedupe-workout-sets.mjs --confirm first.', dupes;
  end if;
end $$;

create unique index if not exists workout_sets_one_per_slot
  on public.workout_sets (workout_id, exercise_name, set_number, is_intensity_set);

comment on index public.workout_sets_one_per_slot is
  'One row per logical set. Makes the keystroke race in saveSet impossible rather than merely unlikely.';

commit;
