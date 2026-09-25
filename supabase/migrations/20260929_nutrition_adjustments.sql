-- ============================================================================
-- AJM FIT — Progress-based nutrition adjustments
--
-- The Accelerator tier has been sold as "nutrition targets set and adjusted
-- for you" with nothing implementing the second half. Targets were calculated
-- once at setup and never moved again, which is the mechanism behind most
-- stalls: a client who has lost 30 lb is still eating for their starting body.
--
-- Two parts.
--
-- 1. Three fields on the weekly check-in. Hunger, sleep and training
--    performance are the signals that distinguish "this deficit is working"
--    from "this deficit is about to fail", and they turn up in that order --
--    hunger and sleep degrade well before the weight trend does. Without them
--    the engine can only see weight and adherence, and would keep cutting a
--    client who is quietly falling apart.
--
-- 2. A proposals table. Adjustments for coached clients are PROPOSED and wait
--    for Anthony; for Blueprint they apply directly. Either way the decision,
--    the evidence behind it and who confirmed it are recorded, so a past call
--    can be reviewed rather than re-guessed.
--
-- Clients have no access to this table. They see the outcome through
-- nutrition_target_history, which carries the plain-language reason. Showing
-- someone a pending proposal to change their food, before their coach has
-- agreed to it, would be worse than showing them nothing.
-- ============================================================================

begin;

-- --- 1. Check-in signals -----------------------------------------------------

alter table public.check_ins
  add column if not exists hunger integer,
  add column if not exists sleep_quality integer,
  add column if not exists training_performance integer;

alter table public.check_ins drop constraint if exists check_ins_hunger_range;
alter table public.check_ins add constraint check_ins_hunger_range
  check (hunger is null or hunger between 1 and 5);

alter table public.check_ins drop constraint if exists check_ins_sleep_range;
alter table public.check_ins add constraint check_ins_sleep_range
  check (sleep_quality is null or sleep_quality between 1 and 5);

alter table public.check_ins drop constraint if exists check_ins_performance_range;
alter table public.check_ins add constraint check_ins_performance_range
  check (training_performance is null or training_performance between 1 and 5);

comment on column public.check_ins.hunger is
  '1 = comfortable, 5 = hungry all the time. High hunger predicts a failed deficit before weight does.';
comment on column public.check_ins.sleep_quality is
  '1 = poor, 5 = excellent. Poor sleep stalls fat loss and confounds the weight trend.';
comment on column public.check_ins.training_performance is
  '1 = much worse, 5 = much better. Falling performance in a deficit means it is too steep.';

-- --- 2. Adjustment proposals -------------------------------------------------

create table if not exists public.nutrition_adjustments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,

  -- What the engine concluded.
  verdict      text not null check (verdict in (
                 'insufficient_data','hold','adherence_first',
                 'decrease','increase','diet_break','escalate')),
  escalation   text,

  -- Targets before, so a proposal reviewed later still makes sense even if the
  -- client's current numbers have since moved.
  prev_cal     numeric(6,2),
  prev_protein numeric(6,2),
  prev_carbs   numeric(6,2),
  prev_fats    numeric(6,2),

  -- Null for hold / escalate / insufficient_data: nothing to apply.
  new_cal      numeric(6,2),
  new_protein  numeric(6,2),
  new_carbs    numeric(6,2),
  new_fats     numeric(6,2),

  reason       text not null,
  coach_note   text,
  -- Weight averages, rate, adherence and the rest, as the engine saw them.
  evidence     jsonb,

  status       text not null default 'pending'
                 check (status in ('pending','approved','rejected','auto_applied','superseded')),
  decided_by   uuid references public.users(id) on delete set null,
  decided_at   timestamptz,
  -- Set when Anthony changed the numbers before approving.
  coach_edited boolean not null default false,

  created_at   timestamptz not null default now()
);

comment on table public.nutrition_adjustments is
  'Engine decisions about a client''s nutrition targets. Coached tiers wait for approval; Blueprint auto-applies.';

create index if not exists idx_nutadj_pending
  on public.nutrition_adjustments (created_at desc)
  where status = 'pending';

create index if not exists idx_nutadj_user
  on public.nutrition_adjustments (user_id, created_at desc);

-- Only one live proposal per client: a newer evaluation supersedes the last.
create unique index if not exists idx_nutadj_one_pending
  on public.nutrition_adjustments (user_id)
  where status = 'pending';

alter table public.nutrition_adjustments enable row level security;

-- No policies at all: every read and write goes through the service role.
-- Clients see outcomes via nutrition_target_history; Anthony's views are
-- server-rendered. Revoking the grants makes that explicit rather than
-- leaving it implied by the absence of a policy.
revoke all on public.nutrition_adjustments from anon, authenticated;

commit;
