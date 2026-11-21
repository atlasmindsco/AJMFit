-- ============================================================================
-- AJM FIT — A photo on your profile
--
-- The avatar in the top right has always been two letters cut from the
-- client's name. This lets them put a face there instead, if they want one.
--
-- PRIVATE, like progress photos, and for a weaker but still sufficient
-- reason. A progress photo is the most sensitive thing this app holds; a
-- profile photo is just a face, but a permanent public URL to a paying
-- client's face is not something to create by default when the signed-URL
-- path already exists and costs nothing. Meal images are public because they
-- are photographs of food that Anthony publishes on purpose.
--
-- Objects are keyed {users.id}/avatar.{ext}, and the first path segment is
-- what the policies check — the same shape as progress-photos, so there is
-- one rule to understand rather than two. One file per client, overwritten on
-- upsert, so nobody accumulates a folder of old avatars.
--
-- The trainer can READ every avatar, because /luffy lists clients and a face
-- beside a name is the entire point. The trainer cannot WRITE one: a coach
-- silently setting a client's profile picture is not a thing that should be
-- possible.
-- ============================================================================

begin;

alter table public.users
  add column if not exists avatar_path text;

comment on column public.users.avatar_path is
  'Storage path of the client''s profile photo in the private `profile-photos` bucket, keyed {users.id}/avatar.{ext}. Null means no photo, and the UI falls back to their initials. A path, never a URL — reads go through a short-lived signed URL.';

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', false)
on conflict (id) do nothing;

-- Client reads their own; trainer reads all, for the client list in /luffy.
drop policy if exists "profile_photos_select" on storage.objects;
create policy "profile_photos_select" on storage.objects
  for select using (
    bucket_id = 'profile-photos'
    and (
      (storage.foldername(name))[1] = public.current_user_id()::text
      or public.is_trainer()
    )
  );

-- Only the owner uploads, and only into their own folder. No trainer clause:
-- a coach setting someone's profile picture is not a thing.
drop policy if exists "profile_photos_insert" on storage.objects;
create policy "profile_photos_insert" on storage.objects
  for insert with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );

-- Needed as well as insert: the upload is an upsert, so replacing a photo is
-- an update rather than a second insert.
drop policy if exists "profile_photos_update" on storage.objects;
create policy "profile_photos_update" on storage.objects
  for update using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );

-- Removing your own photo should never require asking anyone.
drop policy if exists "profile_photos_delete" on storage.objects;
create policy "profile_photos_delete" on storage.objects
  for delete using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );

commit;
