-- ============================================================================
-- AJM FIT — Private notes the coach writes about a client
--
-- WHY. Nothing in the app lets Anthony write "right shoulder, watch overhead
-- work" or "travelling 25-30 Nov" against a client. The only `coachNote` in
-- the codebase belongs to a nutrition proposal and the CLIENT sees it, so
-- there has never been a private place to put the things a coach remembers.
--
-- DELIBERATELY SMALL. Dated notes, newest first, one pinnable. No tasks, no
-- due dates, no follow-up reminders — those are the first step into a CRM,
-- and a reminder nobody actions becomes another thing to dismiss. A pinned
-- note at the top of the client is already in front of the coach at the only
-- moment it matters.
--
-- THE CLIENT MUST NEVER SEE THESE. There is no select policy for the owner:
-- only a trainer can read, write or delete, and the client's own id appears
-- here solely as the subject. That asymmetry is the entire point of the
-- table and is worth stating rather than inferring from the policies below.
-- ============================================================================

begin;

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  -- Who the note is ABOUT. Never who wrote it: this is a single-coach
  -- business and adding an author column now would imply a multi-coach model
  -- that does not exist yet.
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  -- At most one pinned note per client in practice, enforced in the UI rather
  -- than the schema: a partial unique index would make "pin this one instead"
  -- a two-step write for no real gain.
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_notes_user_idx
  on public.coach_notes (user_id, pinned desc, created_at desc);

comment on table public.coach_notes is
  'Private notes the coach keeps about a client. Trainer-only in every direction: the client has no policy granting them read access and must never be shown these.';

alter table public.coach_notes enable row level security;

-- Trainer only, all four verbs. No owner policy on purpose.
drop policy if exists coach_notes_select on public.coach_notes;
create policy coach_notes_select on public.coach_notes
  for select using (public.is_trainer());

drop policy if exists coach_notes_insert on public.coach_notes;
create policy coach_notes_insert on public.coach_notes
  for insert with check (public.is_trainer());

drop policy if exists coach_notes_update on public.coach_notes;
create policy coach_notes_update on public.coach_notes
  for update using (public.is_trainer());

drop policy if exists coach_notes_delete on public.coach_notes;
create policy coach_notes_delete on public.coach_notes
  for delete using (public.is_trainer());

commit;
