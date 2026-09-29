-- ============================================================================
-- AJM FIT — Training blocks
--
-- A program has no length, so it has no end. There is a weekly template that
-- repeats until the client gets bored of it. No week is counted anywhere, and
-- clients have been sitting on one assignment for between 9 and 41 days
-- without ever being asked how it is going.
--
-- The dead end asked about is therefore not at the end of a program: it is the
-- whole program. A client never reaches week 12 because nothing tells them
-- there is one.
--
-- These three columns turn an open-ended assignment into a block with a
-- finish line, a review at that line, and a decision about what comes next.
--
--   block_weeks   how long this block runs. 8 is right for this library:
--                 long enough for double progression to show something, short
--                 enough that a client is never more than two months from a
--                 fresh look at their goal.
--   completed_at  when the block was actually finished and reviewed. Distinct
--                 from ended_at, which already means "switched away from",
--                 because abandoning a block and completing one are different
--                 events and the review should only ever follow the second.
--   review        the results summary, frozen at completion. Stored rather than
--                 recomputed so that what a client was told in November still
--                 reads the same in March, whatever has happened to their data
--                 since.
-- ============================================================================

begin;

alter table public.program_assignments
  add column if not exists block_weeks smallint not null default 8,
  add column if not exists completed_at timestamptz,
  add column if not exists review jsonb;

alter table public.program_assignments drop constraint if exists program_assignments_block_weeks;
alter table public.program_assignments add constraint program_assignments_block_weeks
  check (block_weeks between 1 and 26);

comment on column public.program_assignments.block_weeks is
  'Length of this training block in weeks. Default 8.';
comment on column public.program_assignments.completed_at is
  'Set when the block reached its end and was reviewed. Null while running, and stays null on a block that was abandoned rather than finished.';
comment on column public.program_assignments.review is
  'The end-of-block results summary, frozen at completion so it does not drift as later data arrives.';

-- Finding the block a client is currently in is the single hottest read in
-- this feature: it runs on every visit to the program screen.
create index if not exists idx_assignments_active
  on public.program_assignments (user_id, assigned_at desc)
  where ended_at is null;

commit;
