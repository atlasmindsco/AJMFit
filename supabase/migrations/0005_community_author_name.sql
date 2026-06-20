-- Denormalize the author's display name onto community posts/comments so members
-- can see who posted without read access to each other's users rows (RLS keeps
-- the users table private).
begin;
alter table public.posts add column if not exists author_name text;
alter table public.post_comments add column if not exists author_name text;
commit;
