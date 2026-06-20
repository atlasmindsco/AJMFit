-- ============================================================================
-- AJM FIT — Beta enablement: a beta flag (free access) + in-app feedback.
-- ============================================================================

begin;

-- Beta members get full studio access without paying.
alter table public.users add column if not exists is_beta boolean not null default false;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  name text,
  page text,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback(created_at desc);

alter table public.feedback enable row level security;
drop policy if exists feedback_insert on public.feedback;
drop policy if exists feedback_select on public.feedback;
-- Any signed-in member may submit feedback for themselves; only the trainer reads it.
create policy feedback_insert on public.feedback
  for insert with check (public.current_user_id() = user_id or public.is_trainer());
create policy feedback_select on public.feedback
  for select using (public.is_trainer());

commit;
