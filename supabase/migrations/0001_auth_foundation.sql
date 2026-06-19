-- ============================================================================
-- AJM FIT — Auth Foundation migration
-- Adds the auth.users <-> public.users link, helper functions, an auto-link
-- trigger, and Row Level Security on every client-data table.
--
-- Safe to run more than once (idempotent). Run in the Supabase SQL Editor for
-- project xsmxenpynyusmiihtuex, or via a direct DB connection.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Link public.users to auth.users
-- ----------------------------------------------------------------------------
alter table public.users
  add column if not exists auth_id uuid references auth.users(id) on delete set null;

create unique index if not exists users_auth_id_key on public.users(auth_id);
create index if not exists users_email_lower_idx on public.users (lower(email));

-- ----------------------------------------------------------------------------
-- 2. Helper functions (SECURITY DEFINER → run as owner, bypassing RLS so they
--    can be referenced inside policies without recursion)
-- ----------------------------------------------------------------------------

-- True when the current request's JWT carries app_metadata.role = 'trainer'.
create or replace function public.is_trainer()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'trainer', false);
$$;

-- The public.users.id owned by the current auth user (NULL if none linked yet).
create or replace function public.current_user_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.users where auth_id = auth.uid() limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 3. Auto-link: when an auth user is created (e.g. invite accepted), attach it
--    to the matching pending public.users row by email.
-- ----------------------------------------------------------------------------
create or replace function public.link_auth_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.users
     set auth_id = new.id,
         updated_at = now()
   where auth_id is null
     and lower(email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_auth_user();

-- ----------------------------------------------------------------------------
-- 4. Row Level Security
--    Model: a row is visible/editable to its owner (the auth user linked to the
--    public.users row referenced by user_id) or to the trainer. Writes that
--    happen before an auth identity exists (the public application) go through
--    a server route using the service-role key, which bypasses RLS — so anon
--    needs no policies here.
-- ----------------------------------------------------------------------------

-- users (owner row keyed by auth_id directly)
alter table public.users enable row level security;
drop policy if exists users_select on public.users;
drop policy if exists users_update on public.users;
create policy users_select on public.users
  for select using (auth_id = auth.uid() or public.is_trainer());
create policy users_update on public.users
  for update using (auth_id = auth.uid() or public.is_trainer())
           with check (auth_id = auth.uid() or public.is_trainer());

-- applications (read by owner/trainer; status edits by trainer; inserts via server)
alter table public.applications enable row level security;
drop policy if exists applications_select on public.applications;
drop policy if exists applications_update on public.applications;
create policy applications_select on public.applications
  for select using (public.current_user_id() = user_id or public.is_trainer());
create policy applications_update on public.applications
  for update using (public.is_trainer()) with check (public.is_trainer());

-- Child tables keyed by user_id: full CRUD for owner or trainer.
do $$
declare t text;
begin
  foreach t in array array[
    'meals','food_logs','daily_logs','workouts',
    'workout_sets','exercise_prs','exercise_swaps'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_owner_all', t);
    execute format($p$
      create policy %I on public.%I
        for all
        using (public.current_user_id() = user_id or public.is_trainer())
        with check (public.current_user_id() = user_id or public.is_trainer());
    $p$, t || '_owner_all', t);
  end loop;
end $$;

commit;
