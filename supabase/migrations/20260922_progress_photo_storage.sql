-- ============================================================================
-- AJM FIT — Progress photo storage access
--
-- Bucket `progress-photos` is private. Photos of someone's body are the most
-- sensitive thing this app will ever hold, so nothing here is served from a
-- public URL — reads go through short-lived signed URLs generated per request.
--
-- Objects are keyed as {users.id}/{filename}, and the first path segment is
-- what these policies check. A client can only ever touch their own folder;
-- the trainer can read every folder but cannot write to one, because a coach
-- uploading a photo on a client's behalf is not a thing that should happen
-- silently.
-- ============================================================================

begin;

-- Client reads their own photos; trainer reads all.
drop policy if exists "progress_photos_select" on storage.objects;
create policy "progress_photos_select" on storage.objects
  for select using (
    bucket_id = 'progress-photos'
    and (
      (storage.foldername(name))[1] = public.current_user_id()::text
      or public.is_trainer()
    )
  );

-- Only the owner uploads, and only into their own folder.
drop policy if exists "progress_photos_insert" on storage.objects;
create policy "progress_photos_insert" on storage.objects
  for insert with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );

drop policy if exists "progress_photos_update" on storage.objects;
create policy "progress_photos_update" on storage.objects
  for update using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );

-- A client can delete their own photos. This matters: someone who wants a
-- photo gone should not have to ask anyone.
drop policy if exists "progress_photos_delete" on storage.objects;
create policy "progress_photos_delete" on storage.objects
  for delete using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );

commit;
