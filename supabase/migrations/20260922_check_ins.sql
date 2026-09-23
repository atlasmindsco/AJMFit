-- ============================================================================
-- AJM FIT — Weekly check-ins
--
-- There was no check-in system of any kind. "Check-in" existed only as the name
-- of a Calendly event, so the central accountability mechanism of both paid
-- tiers captured nothing: no record of what was asked, what was answered, or
-- what the coach said back.
--
-- Six questions, one row per client per week. Deliberately short — a check-in
-- that takes longer than about ninety seconds gets skipped by week three, and a
-- skipped check-in is worse than a brief one because it reads to the client as
-- failure.
-- ============================================================================

begin;

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,

  -- Monday of the week being reported on, so a week has exactly one check-in.
  week_of date not null,

  weight_lb numeric(6,2),
  workouts_completed integer,
  -- 1-5 self-ratings. Self-rated adherence is far more sustainable than asking
  -- someone to log every meal, and for coaching decisions it is enough.
  nutrition_adherence integer check (nutrition_adherence between 1 and 5),
  energy integer check (energy between 1 and 5),

  win text,
  obstacle text,

  submitted_at timestamptz not null default now(),

  -- The coach's reply. Null while the check-in is awaiting review, which is
  -- what drives the "Review Needed" status on the coach dashboard.
  coach_response text,
  coach_responded_at timestamptz,

  unique (user_id, week_of)
);

create index if not exists idx_check_ins_user_week
  on public.check_ins(user_id, week_of desc);
-- Partial index: the coach's default view is everything still awaiting a reply.
create index if not exists idx_check_ins_awaiting
  on public.check_ins(submitted_at desc) where coach_response is null;

alter table public.check_ins enable row level security;

do $$
begin
  if not exists (select 1 from pg_policy where polrelid = 'public.check_ins'::regclass and polname = 'check_ins_select') then
    create policy check_ins_select on public.check_ins
      for select using (public.current_user_id() = user_id or public.is_trainer());
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.check_ins'::regclass and polname = 'check_ins_insert') then
    create policy check_ins_insert on public.check_ins
      for insert with check (public.current_user_id() = user_id or public.is_trainer());
  end if;
  -- Clients may correct their own entry; only the trainer writes the response,
  -- which is enforced in the API route that sets it.
  if not exists (select 1 from pg_policy where polrelid = 'public.check_ins'::regclass and polname = 'check_ins_update') then
    create policy check_ins_update on public.check_ins
      for update using (public.current_user_id() = user_id or public.is_trainer())
               with check (public.current_user_id() = user_id or public.is_trainer());
  end if;
end $$;

commit;
