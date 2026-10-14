-- AJM Recommends: a coach's shortlist, not a shop.
--
-- One table of products Anthony recommends, each pointing at an external
-- store. No cart, no orders, no prices — prices live at the merchant, change
-- without warning, and a stale price in the app is both a support problem and
-- one step closer to being a storefront.
--
-- WHY EVERY FIELD IS A ROW RATHER THAN CODE
--
-- Anthony must never need a developer to change a link. MyShop URLs move,
-- products get discontinued, and a dead link that takes a deploy to fix is a
-- dead link for a week. Merchant is a column for the same reason: today it is
-- Amway, and a second store later should cost nothing.
--
-- WHAT IS DELIBERATELY ABSENT
--
-- No price, no stock, no rating, no review. Each would make this an inventory
-- system and the whole design rests on it reading as advice.
--
-- No health or condition fields. The app must never recommend on the basis of
-- a medical condition, and the surest way to guarantee that is to give it
-- nowhere to store one.

begin;

create table if not exists public.product_recommendations (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  -- Free text rather than an enum: a new category should not need a migration.
  category text not null,

  -- Pasted, not uploaded. The only storage bucket here is private and
  -- signed-URL based for progress photos; a second bucket, an upload widget
  -- and a public-read policy is real work to solve what a URL already solves.
  image_url text,

  -- The one line on the card, in Anthony's voice. This is the whole card.
  why_recommended text,

  -- The detail sheet. All optional: a product with nothing to say shows a
  -- card and no sheet rather than four empty headings.
  what_it_is text,
  who_it_suits text,
  how_used text,
  worth_knowing text,

  -- Where it opens. Never hard-coded anywhere in the application.
  external_url text not null,
  merchant text not null default 'Amway',

  sort_order smallint not null default 0,
  -- New products are invisible until explicitly published, so drafting does
  -- not put a half-written recommendation in front of a client.
  is_active boolean not null default false,
  is_featured boolean not null default false,

  -- Per-product override when something needs its own wording. The standing
  -- disclosure is in lib/recommendations.ts and shows regardless.
  disclosure_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_recommendations_active
  on public.product_recommendations (is_active, category, sort_order);

alter table public.product_recommendations enable row level security;

-- Any signed-in client may read what is published. Only a trainer may write.
drop policy if exists product_recommendations_read on public.product_recommendations;
create policy product_recommendations_read on public.product_recommendations
  for select using (is_active or public.is_trainer());

drop policy if exists product_recommendations_write on public.product_recommendations;
create policy product_recommendations_write on public.product_recommendations
  for all using (public.is_trainer()) with check (public.is_trainer());

-- How often a product is opened, and nothing else.
--
-- No user_id, deliberately. "Which products do people open" is the question
-- worth answering and an aggregate answers it. Attaching a client's name to
-- which supplements they browsed is a different kind of data with a different
-- duty of care, and it buys nothing the coach needs.
create table if not exists public.product_clicks (
  id bigserial primary key,
  product_id uuid not null references public.product_recommendations(id) on delete cascade,
  clicked_at timestamptz not null default now()
);

create index if not exists idx_product_clicks_product
  on public.product_clicks (product_id, clicked_at desc);

alter table public.product_clicks enable row level security;

-- Anyone signed in may record a click; only the trainer may read the counts.
-- Insert-only for clients: there is nothing in here to read back, and a client
-- being able to query the table would turn an aggregate into a browsing log.
drop policy if exists product_clicks_insert on public.product_clicks;
create policy product_clicks_insert on public.product_clicks
  for insert with check (true);

drop policy if exists product_clicks_read on public.product_clicks;
create policy product_clicks_read on public.product_clicks
  for select using (public.is_trainer());

commit;
