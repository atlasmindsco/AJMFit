-- ============================================================================
-- AJM FIT — Notification preferences
--
-- Four switches and a time. Deliberately not per-event toggles: nobody wants to
-- decide about "missed workout, day 4" separately from "missed workout, day 7",
-- and a settings screen with twelve rows is one nobody reads before giving up
-- and silencing the app at the operating system.
--
-- COACH MESSAGES CANNOT BE SWITCHED OFF, and there is no column for it. If
-- someone is paying for coaching, a message from their coach is not a
-- notification, it is the product -- letting them mute it means they pay for
-- replies they never see and conclude their coach is not responsive. Anyone who
-- genuinely wants silence can mute the app at the OS, which is their right and
-- does not need a switch here.
--
-- Everything defaults ON. The app currently sends clients nothing at all, so
-- defaulting off would ship a feature that is dark for everyone, and the first
-- messages people receive are the ones they most need: four of eleven clients
-- have never logged a workout and have never heard from the app.
-- ============================================================================

begin;

create table if not exists public.notification_prefs (
  user_id uuid primary key references public.users(id) on delete cascade,

  -- Workout reminders and the missed-workout ladder.
  training boolean not null default true,
  -- Weekly check-in due, and its single follow-up. Coached tiers only in
  -- practice, since nothing asks a Blueprint client to check in.
  check_ins boolean not null default true,
  -- Personal records, block completion, weekly summary.
  progress boolean not null default true,

  -- Local hour to send at, 0-23. A reminder at 6am to someone who trains at
  -- 7pm is worse than no reminder, and this is the single control that most
  -- decides whether the rest of it is welcome.
  send_hour smallint not null default 18,

  updated_at timestamptz not null default now()
);

alter table public.notification_prefs drop constraint if exists notification_prefs_hour_range;
alter table public.notification_prefs add constraint notification_prefs_hour_range
  check (send_hour between 0 and 23);

alter table public.notification_prefs enable row level security;

-- A client reads and writes only their own row.
drop policy if exists "own notification prefs" on public.notification_prefs;
create policy "own notification prefs" on public.notification_prefs
  for all
  using (user_id in (select id from public.users where auth_id = auth.uid()))
  with check (user_id in (select id from public.users where auth_id = auth.uid()));

comment on table public.notification_prefs is
  'Four switches and a send hour. No row means every default: all on, 18:00 local.';

commit;
