-- ============================================================================
-- AJM FIT — Which days of the week a client trains
--
-- A program here is a ROTATION, not a calendar: Upper A, Lower A, Upper B,
-- Lower B, repeat, on whatever days the client manages. That is the right
-- model and it is why the rotation engine works. But it means the app has
-- never known WHICH DAYS someone intends to train, and without that a workout
-- reminder is a guess — a client who trains Tuesday, Thursday and Saturday
-- would get it wrong four days a week until they muted it.
--
-- Asked at program selection, which is the moment the client is already
-- choosing between a 4-day and a 5-day split, so the question is in context
-- and the answer is one more tap.
--
-- Null means "we never asked", which is every existing client, and the
-- reminder stays silent for them rather than guessing. An empty array means
-- "asked, and they declined to say" — a different thing, and also silent.
-- ============================================================================

begin;

alter table public.program_assignments
  add column if not exists training_days smallint[];

comment on column public.program_assignments.training_days is
  'Days of the week the client intends to train: 0=Sunday .. 6=Saturday. Null = never asked, so no workout reminder is sent.';

-- Guard the contents rather than trusting the writer: a stray 7 or -1 would
-- silently never match a real weekday and the reminder would go quiet with no
-- visible cause.
alter table public.program_assignments drop constraint if exists program_assignments_training_days_range;
alter table public.program_assignments add constraint program_assignments_training_days_range
  check (
    training_days is null
    or (
      array_length(training_days, 1) is null
      or (
        array_length(training_days, 1) <= 7
        and training_days <@ array[0,1,2,3,4,5,6]::smallint[]
      )
    )
  );

commit;
