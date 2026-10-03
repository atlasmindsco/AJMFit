-- ============================================================================
-- AJM FIT — Communication signals
--
-- Three small additions, all of them plumbing between parts that already work.
--
-- 1. WHY a client swapped an exercise. The swap sheet already asks -- busy, not
--    available, doesn't feel right -- and then throws the answer away. The
--    third of those is the earliest and cheapest injury signal the app has,
--    and it currently evaporates the moment the sheet closes.
--
-- 2. A record of what has been sent to whom. Without it, any "you have been
--    quiet for four days" message fires again every single day from day four
--    onward, which is how a helpful nudge becomes the reason someone turns
--    notifications off. Nothing in this migration sends anything; it is the
--    ledger the sending will need.
--
-- 3. A heartbeat for the scheduled jobs. The daily digest is the only thing in
--    the system that reaches the coach without him choosing to look, and there
--    is currently no way to tell whether it ran. Two client messages are
--    sitting unread; either the digest has been reporting them and they were
--    missed, or it has not been running. Those need different fixes and
--    nothing distinguishes them.
-- ============================================================================

begin;

-- --- 1. Why an exercise was swapped -----------------------------------------
--
-- Nullable, because every swap made before today has no recorded reason and
-- inventing one would be worse than leaving it blank.

alter table public.exercise_swaps
  add column if not exists reason text,
  add column if not exists session_only boolean not null default false;

alter table public.exercise_swaps drop constraint if exists exercise_swaps_reason_check;
alter table public.exercise_swaps add constraint exercise_swaps_reason_check
  check (reason is null or reason in ('busy', 'missing', 'hurts'));

comment on column public.exercise_swaps.reason is
  'Why the client swapped: busy equipment, equipment unavailable, or it hurt. "hurts" is a coaching signal, not a UI preference.';

-- --- 2. What has already been sent ------------------------------------------

create table if not exists public.notifications_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- 'quiet_4d', 'quiet_7d', 'check_in_due', 'coach_reply', ...
  kind text not null,
  channel text not null check (channel in ('email', 'push', 'in_app')),
  sent_at timestamptz not null default now(),
  -- Groups a repeating notification into one occurrence, so the same nudge can
  -- fire again on a LATER spell of inactivity but never twice on this one.
  -- For the quiet ladder this is the date of the last logged workout.
  occurrence_key text
);

create index if not exists idx_notifications_sent_user
  on public.notifications_sent(user_id, kind, sent_at desc);

-- One send per client, per kind, per occurrence. The database refuses the
-- duplicate rather than the application remembering to check, because the
-- application will eventually forget.
create unique index if not exists notifications_sent_once
  on public.notifications_sent(user_id, kind, occurrence_key)
  where occurrence_key is not null;

alter table public.notifications_sent enable row level security;

-- Service role only. A client has no reason to read this, and no reason to be
-- able to delete the record of a nudge so it fires again.
drop policy if exists "notifications_sent service only" on public.notifications_sent;

-- --- 3. Did the scheduled jobs run? -----------------------------------------

create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  ran_at timestamptz not null default now(),
  -- Free-form, small: what it found and what it did.
  summary text,
  ok boolean not null default true
);

create index if not exists idx_cron_runs_job on public.cron_runs(job, ran_at desc);

alter table public.cron_runs enable row level security;
drop policy if exists "cron_runs service only" on public.cron_runs;

commit;
