-- Zoom meeting fields for scheduled sessions.
-- When a remote session is booked, we create a Zoom meeting and store its
-- join URL + numeric meeting id (the id lets us delete/update the meeting later).

alter table public.scheduled_sessions add column if not exists join_url text;
alter table public.scheduled_sessions add column if not exists zoom_meeting_id text;
