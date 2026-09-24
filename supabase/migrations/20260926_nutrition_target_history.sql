-- ============================================================================
-- AJM FIT — Nutrition target history
--
-- Targets live as four mutable columns on public.users. Every change
-- overwrites the last one, so there is no record of what a client used to be
-- eating, when it changed, who changed it, or why.
--
-- That gap blocks three things at once: a client cannot be shown why their
-- number moved, Anthony cannot review his own past decisions, and the
-- progress-based adjustment engine has nothing to reason over — it cannot
-- tell a target that has held for six weeks from one set yesterday.
--
-- This table is append-only by convention: a change writes a new row, it never
-- updates an old one. users still holds the current values, so nothing that
-- reads targets today has to change.
-- ============================================================================

begin;

create table if not exists public.nutrition_target_history (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,

  -- The targets as they stood AFTER this change.
  cal_target     numeric(6,2),
  protein_target numeric(6,2),
  carb_target    numeric(6,2),
  fat_target     numeric(6,2),

  -- Why it changed. 'setup' and 'client_edit' come from the client,
  -- 'coach' from an override, 'auto' from the adjustment engine,
  -- 'diet_break' from a planned maintenance phase.
  source         text not null check (source in ('setup','client_edit','coach','auto','diet_break')),

  -- Free-text rationale shown to the client, e.g. "Weight held for two weeks
  -- at 85% adherence, so calories come down 5%."
  reason         text,

  -- Which guardrail bound, if any, at the moment this target was set.
  clamp          text,

  -- The data the decision was made on, kept so a past call can be audited
  -- rather than re-guessed: avg weight, rate, adherence, and so on.
  evidence       jsonb,

  -- Null for automated and client-driven changes; set when Anthony acts.
  changed_by     uuid references public.users(id) on delete set null,

  created_at     timestamptz not null default now()
);

comment on table public.nutrition_target_history is
  'Append-only log of every nutrition target a client has held. Never updated in place.';

create index if not exists idx_nth_user_created
  on public.nutrition_target_history (user_id, created_at desc);

alter table public.nutrition_target_history enable row level security;

-- A client reads their own history and writes nothing: every row is created
-- server-side by the service role, so there is no client insert policy at all.
drop policy if exists nth_select_own on public.nutrition_target_history;
create policy nth_select_own
  on public.nutrition_target_history
  for select
  using (
    user_id in (select id from public.users where auth_id = auth.uid())
  );

-- No insert, update or delete policy. Only the service role writes here, and
-- the service role bypasses RLS. Revoking the write grants makes that explicit
-- rather than relying on the absence of a policy.
revoke insert, update, delete on public.nutrition_target_history from anon, authenticated;

commit;
