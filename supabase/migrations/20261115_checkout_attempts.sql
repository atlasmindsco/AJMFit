-- Make the Blueprint funnel measurable.
--
-- 185 Stripe Checkout Sessions have been created and 15 were paid. The other
-- 170 cannot be explained from any data that exists: Stripe writes nothing to
-- an abandoned session (no email, no customer, no partial details), and AJM
-- FIT records nothing at all when someone clicks Start Now. So "92% abandon"
-- is a number with no story attached, and every explanation for it --
-- price, friction, bots, accidental clicks -- is currently a guess.
--
-- This logs the click itself. One row per hit on the checkout route, written
-- before the redirect, carrying only what distinguishes a person from a
-- crawler: the user agent, the page they came from, and the Stripe session the
-- hit produced. Joining those ids back to Stripe later turns the question into
-- arithmetic.
--
-- Deliberately NOT collected: IP address, and anything identifying. The
-- question is "was this a human, and where did they come from", which a user
-- agent and a referer answer without knowing who anyone is.

begin;

create table if not exists public.checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  -- The Stripe session this hit created, so outcomes can be joined later.
  -- Null when session creation itself failed, which is worth seeing.
  stripe_session_id text,
  -- Which product was being bought, for when there is more than one.
  flow text not null default 'blueprint_direct',
  user_agent text,
  referer text,
  -- Decided at write time from the user agent. Stored rather than computed on
  -- read so a later change to the bot list cannot silently rewrite history.
  looks_like_bot boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists checkout_attempts_created_idx
  on public.checkout_attempts (created_at desc);
create index if not exists checkout_attempts_session_idx
  on public.checkout_attempts (stripe_session_id);

alter table public.checkout_attempts enable row level security;

-- Nobody reads this through the API. The route writes with the service role,
-- and the report runs with it too; a visitor must never be able to read how
-- many people are abandoning checkout, and has no reason to.
drop policy if exists checkout_attempts_trainer_read on public.checkout_attempts;
create policy checkout_attempts_trainer_read on public.checkout_attempts
  for select using (public.is_trainer());

commit;
