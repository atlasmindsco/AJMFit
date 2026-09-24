-- ============================================================================
-- AJM FIT — Client timezone
--
-- Day-keyed tables (food_logs, workouts, daily_logs) are now written and read
-- using the client's own calendar date, taken from their device. That already
-- handles a client in any timezone without configuration.
--
-- This column is the override for the cases the device cannot answer: someone
-- travelling who wants their day boundary to stay on home time, a device with
-- the wrong timezone set, and anything server-side — the digest, the coach's
-- views — that needs to know when a given client's day actually starts.
--
-- Null means "use whatever the device reports", which is the right default.
-- ============================================================================

begin;

alter table public.users
  add column if not exists timezone text;

comment on column public.users.timezone is
  'IANA timezone, e.g. America/New_York. Null = follow the device.';

commit;
