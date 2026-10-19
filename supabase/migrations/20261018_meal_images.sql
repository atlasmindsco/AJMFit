-- Somewhere to put 44 meal photographs.
--
-- The meal library is a code file, so anything stored alongside it would need
-- a developer every time a picture changed. That is the thing the supplements
-- admin exists to avoid, and meals deserve the same: Anthony generates the
-- images, drops them in, and nobody deploys anything.
--
-- A PUBLIC bucket, unlike progress-photos.
--
-- Progress photos are private and served through short-lived signed URLs
-- because they are pictures of a client's body. A photograph of chicken and
-- rice is not sensitive, and making it private would mean a signed URL per
-- card per load — 44 round trips to show a list that is meant to feel fast,
-- and images that expire in the middle of someone reading.
--
-- The filename IS the meal id, so no table is needed: meal b1 lives at
-- b1.jpg. Listing the bucket says which meals have a picture, which is the
-- only question the app asks.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meal-images',
  'meal-images',
  true,
  3145728, -- 3 MB. A card renders these about 300px wide; anything larger is
           -- data a client pays for and never sees.
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may look at a picture of food, signed in or not.
drop policy if exists meal_images_read on storage.objects;
create policy meal_images_read on storage.objects
  for select using (bucket_id = 'meal-images');

-- Only the coach puts them there, replaces them, or removes them.
drop policy if exists meal_images_write on storage.objects;
create policy meal_images_write on storage.objects
  for insert with check (bucket_id = 'meal-images' and public.is_trainer());

drop policy if exists meal_images_update on storage.objects;
create policy meal_images_update on storage.objects
  for update using (bucket_id = 'meal-images' and public.is_trainer());

drop policy if exists meal_images_delete on storage.objects;
create policy meal_images_delete on storage.objects
  for delete using (bucket_id = 'meal-images' and public.is_trainer());

commit;
