-- ============================================================================
-- AJM FIT — Operations action log
--
-- Append-only record of every write the ops toolkit (tools/ops/*) makes, so
-- there is an audit trail of what ran against production and when. Required by
-- the safety model in AGENTS.md §2 and the Cowork ops design spec.
--
-- Append-only is enforced at the grant level, not by convention: UPDATE and
-- DELETE are revoked from every role including service_role, so a logged
-- action cannot be rewritten or erased by the same toolkit that wrote it.
--
-- Idempotent — safe to run more than once.
-- ============================================================================

begin;

create table if not exists public.ops_action_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,                              -- e.g. 'approve-application'
  target text,                                       -- who/what it acted on
  summary text not null,                             -- one line, human-readable
  detail jsonb,                                      -- structured payload
  actor text not null default 'ops-toolkit',         -- which agent/script ran it
  created_at timestamptz not null default now()
);

create index if not exists idx_ops_action_log_created
  on public.ops_action_log(created_at desc);
create index if not exists idx_ops_action_log_action
  on public.ops_action_log(action, created_at desc);

-- No policies: clients must never read this. The service role bypasses RLS.
alter table public.ops_action_log enable row level security;

revoke update, delete on public.ops_action_log from anon, authenticated, service_role;

commit;
