-- ============================================================================
-- AJM FIT — Operations action log (retroactive definition + grant hardening)
--
-- IMPORTANT: this table was NOT created by this migration. It has existed in
-- the live database since ~2026-07-12, created by an earlier ops toolkit whose
-- scripts were never committed to the repo (the same work that wrote
-- tools/ops/seed-blueprint-programs.mjs but not its ./_lib.mjs dependency).
-- Its oldest rows record that toolkit seeding the Blueprint templates, creating
-- the ZEROOUT promo code, and resetting the trainer password.
--
-- This migration therefore does two things:
--   1. Records the table's real shape so a fresh database matches production.
--      The definition below is transcribed FROM production — note that `summary`
--      is nullable and `actor` defaults to 'cowork', which is what the existing
--      rows use.
--   2. Hardens the grants so "append-only" is actually enforced rather than
--      merely intended. RLS does not restrict TRUNCATE, so TRUNCATE must be
--      revoked explicitly or any role holding it can erase the whole log.
--
-- Idempotent — safe to run more than once.
-- ============================================================================

begin;

create table if not exists public.ops_action_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null default 'cowork',              -- which agent/script ran it
  action text not null,                              -- e.g. 'approve-application'
  target text,                                       -- who/what it acted on
  summary text,                                      -- one line, human-readable
  detail jsonb,                                      -- structured payload
  created_at timestamptz not null default now()
);

create index if not exists idx_ops_action_log_created
  on public.ops_action_log(created_at desc);
create index if not exists idx_ops_action_log_action
  on public.ops_action_log(action, created_at desc);

alter table public.ops_action_log enable row level security;

-- The trainer reads the log in-app; nobody else sees it. This policy already
-- exists in production — recreated here only so a fresh database matches.
do $$
begin
  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.ops_action_log'::regclass
      and polname = 'ops_action_log_select'
  ) then
    create policy ops_action_log_select on public.ops_action_log
      for select using (is_trainer());
  end if;
end $$;

-- Append-only, enforced at the grant level. UPDATE and DELETE are revoked from
-- every role including service_role, so the toolkit cannot rewrite its own
-- audit trail. TRUNCATE is revoked for the same reason and matters more: it
-- bypasses RLS entirely, so leaving it granted would let a single statement
-- erase the log regardless of any policy.
revoke update, delete, truncate on public.ops_action_log from anon, authenticated, service_role;

-- Public roles have no business touching an internal audit log at all. Reads by
-- the trainer go through the policy above, which service_role does not need.
revoke insert on public.ops_action_log from anon, authenticated;

commit;
