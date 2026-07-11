-- ============================================
-- AJM FIT — Onboarding form (pre-call questionnaire)
-- ============================================
-- One row per client, answers as jsonb (flexible; the AI program builder
-- reads this later). Client fills it in the studio after approval; the coach
-- reviews it before the onboarding call.

begin;

create table if not exists public.onboarding_forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_onboarding_forms_user on public.onboarding_forms(user_id);

alter table public.onboarding_forms enable row level security;

drop policy if exists onboarding_forms_select on public.onboarding_forms;
drop policy if exists onboarding_forms_write on public.onboarding_forms;

create policy onboarding_forms_select on public.onboarding_forms
  for select using (public.current_user_id() = user_id or public.is_trainer());

create policy onboarding_forms_write on public.onboarding_forms
  for all
  using (public.current_user_id() = user_id or public.is_trainer())
  with check (public.current_user_id() = user_id or public.is_trainer());

commit;
