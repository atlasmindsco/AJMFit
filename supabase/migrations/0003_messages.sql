-- ============================================================================
-- AJM FIT — Client ↔ Coach messaging
-- One thread per client. `from_trainer` marks direction (the trainer has no
-- public.users row, so we don't reference a sender user id for the coach side).
-- ============================================================================

begin;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade, -- the client's thread
  from_trainer boolean not null default false,                          -- true = coach→client
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_user_created_idx on public.messages(user_id, created_at);

alter table public.messages enable row level security;

drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_update on public.messages;

-- Read: a client sees their own thread; the trainer sees all.
create policy messages_select on public.messages
  for select using (public.current_user_id() = user_id or public.is_trainer());

-- Insert: a client may post to their own thread as the client; the trainer may
-- post to any thread as the coach.
create policy messages_insert on public.messages
  for insert with check (
    (public.current_user_id() = user_id and from_trainer = false)
    or (public.is_trainer() and from_trainer = true)
  );

-- Update: mark-as-read by either side on their visible rows.
create policy messages_update on public.messages
  for update using (public.current_user_id() = user_id or public.is_trainer())
           with check (public.current_user_id() = user_id or public.is_trainer());

commit;
