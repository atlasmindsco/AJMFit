-- ============================================================================
-- AJM FIT — One row per screen a client opens
--
-- WHY. Five audits have now reasoned about what clients look at and the app
-- records nothing. Not one screen view has ever been captured, so every
-- statement about attention in those documents — including mine — is
-- structural inference dressed as a finding.
--
-- Concretely: the weekly check-in has zero submissions, eleven of fifteen
-- clients are dormant, and nobody can say whether those clients open the app
-- and leave or never open it at all. Those are different problems with
-- different fixes and the data cannot currently tell them apart.
--
-- DELIBERATELY THE SMALLEST THING THAT ANSWERS THAT. Who, which path, when.
-- No event taxonomy, no funnels, no properties bag, no third-party script, no
-- cookie, no device fingerprint, nothing that leaves this database. A client's
-- training data is already far more sensitive than the fact that they opened
-- Food on Tuesday; this adds no new category of information about anyone.
--
-- A row is written on navigation, not on render, and the client never waits
-- for it: a failed insert is dropped silently. Measurement must never be able
-- to break a workout.
-- ============================================================================

begin;

create table if not exists public.screen_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- The route, never the full URL: a query string can carry an exercise name
  -- and there is no reason to store one here.
  path text not null,
  viewed_at timestamptz not null default now()
);

create index if not exists screen_views_user_idx on public.screen_views (user_id, viewed_at desc);
create index if not exists screen_views_path_idx on public.screen_views (path, viewed_at desc);

comment on table public.screen_views is
  'One row each time a signed-in client opens a studio screen. Path only, never the query string. Written fire-and-forget; a failure is dropped rather than surfaced. Exists because every claim this project has made about what clients look at was inference.';

alter table public.screen_views enable row level security;

-- A client writes their own rows and reads nothing. There is no screen that
-- shows a client their own view history, and inventing one would be the
-- feature creeping before the question is answered.
drop policy if exists screen_views_insert on public.screen_views;
create policy screen_views_insert on public.screen_views
  for insert with check (user_id = public.current_user_id());

-- Only the coach reads them, and only in aggregate in practice.
drop policy if exists screen_views_select on public.screen_views;
create policy screen_views_select on public.screen_views
  for select using (public.is_trainer());

commit;
