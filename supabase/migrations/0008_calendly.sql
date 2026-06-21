-- Calendly booking sync.
-- When a client self-books via Calendly, a webhook writes the session here so the
-- trainer portal (/luffy) and client studio see it alongside trainer-created ones.
-- We store the Calendly URIs so a later cancel/reschedule webhook can find the row.

alter table public.scheduled_sessions add column if not exists calendly_event_uri text;
alter table public.scheduled_sessions add column if not exists calendly_invitee_uri text;

-- One invitee URI == one row; lets the webhook upsert idempotently (Calendly retries).
create unique index if not exists scheduled_sessions_calendly_invitee_uidx
  on public.scheduled_sessions(calendly_invitee_uri)
  where calendly_invitee_uri is not null;
