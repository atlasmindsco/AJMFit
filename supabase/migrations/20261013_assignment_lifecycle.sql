-- A client may end their own program and finish their own block.
--
-- TWO SILENT FAILURES, ONE CAUSE
--
-- Nothing has ever let a client UPDATE program_assignments. The table had a
-- trainer-write policy and a read policy, and that was all. Two code paths
-- have been quietly writing nothing ever since:
--
--   activateCustomProgram  ends the open assignment, then inserts the new one.
--                          The end matched zero rows, so starting a custom
--                          program left the old one open. Two clients are
--                          sitting on two open programs right now.
--
--   completeBlock          writes completed_at and the review when a block
--                          finishes. It has never once succeeded, which is
--                          why all twenty assignments in production show
--                          completed_at as null and nobody has ever been
--                          offered a next program.
--
-- Neither raised an error. PostgREST reports an RLS-filtered update as a
-- successful update of zero rows, so both paths returned cleanly and did
-- nothing. The custom-programs migration made the first case worse rather
-- than causing it: its policy admits writes only to rows whose program is
-- source = 'custom', and the row that needs ending is a Blueprint one.
--
-- WHAT THIS ALLOWS, AND WHAT IT DELIBERATELY DOES NOT
--
-- A client may update their own assignment rows. The with_check pins user_id
-- to themselves, so they cannot move a row onto another client, and the using
-- clause means they never see or touch anyone else's.
--
-- It does not restrict WHICH columns they may write, so in principle a client
-- could set their own block_weeks or write their own review. That is
-- self-affecting, reachable only by hand-crafting an API call, and bounded to
-- their own row. The alternative — revoking table UPDATE and granting only
-- (ended_at, completed_at, review) — was rejected because grants are per
-- ROLE, and the coach writes ended_at from the browser as `authenticated`
-- too: any future coach screen that edited block_weeks would then fail
-- exactly as silently as the two paths above. If column-level control is ever
-- wanted, a BEFORE UPDATE trigger that compares OLD and NEW is the tool,
-- because it raises instead of filtering.

begin;

drop policy if exists program_assignments_own_lifecycle on public.program_assignments;

create policy program_assignments_own_lifecycle on public.program_assignments
  for update
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

commit;
