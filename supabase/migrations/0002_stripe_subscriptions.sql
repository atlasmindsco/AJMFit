-- ============================================================================
-- AJM FIT — Stripe subscriptions
-- Adds a Stripe customer id to users and a subscriptions table that the webhook
-- keeps in sync. Idempotent.
-- ============================================================================

begin;

-- Stripe customer per user.
alter table public.users
  add column if not exists stripe_customer_id text;
create index if not exists users_stripe_customer_id_idx on public.users(stripe_customer_id);

-- Subscription state, mirrored from Stripe by the webhook (service role writes).
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  tier text,                 -- blueprint | accelerator | full-experience
  billing_cycle text,        -- monthly | weekly
  status text,               -- trialing | active | past_due | canceled | incomplete | unpaid
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);

-- RLS: a client reads their own subscription; the trainer reads all. All writes
-- go through the webhook using the service-role key, which bypasses RLS.
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select using (public.current_user_id() = user_id or public.is_trainer());

commit;
