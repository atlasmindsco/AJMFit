-- ============================================================================
-- AJM FIT — Structured food preferences
--
-- Onboarding collected allergies as one free-text box ("Allergies or foods you
-- will not eat", placeholder "No shellfish"). It was stored, labelled for the
-- coach, and read by nothing. A client who wrote "no shellfish" got no
-- protection anywhere in the product.
--
-- Free text cannot filter a meal library. These columns can. The original
-- free-text answer is kept in onboarding_forms and is not migrated
-- automatically: parsing prose into allergen flags is exactly the kind of
-- guess that ends with someone being shown a dish they cannot eat. Existing
-- clients are asked once, in the app.
--
-- allergens is a fixed vocabulary because it has to be matchable against meal
-- tags. allergen_notes carries anything that vocabulary misses, and is shown
-- to Anthony rather than used for filtering -- an unparsed note must never
-- read as "no restrictions".
-- ============================================================================

begin;

alter table public.users
  add column if not exists eating_pattern text,
  add column if not exists allergens text[],
  add column if not exists allergen_notes text,
  add column if not exists food_dislikes text,
  add column if not exists food_prefs_set_at timestamptz;

comment on column public.users.eating_pattern is
  'none | vegetarian | vegan | pescatarian | halal | kosher. Null = never asked.';

comment on column public.users.allergens is
  'Fixed vocabulary, matched against meal tags: dairy, eggs, fish, shellfish, tree_nuts, peanuts, wheat_gluten, soy, sesame.';

comment on column public.users.allergen_notes is
  'Free text for anything the vocabulary misses. Shown to Anthony. NEVER used to decide whether a meal is safe.';

comment on column public.users.food_dislikes is
  'Foods the client would rather not eat. Soft filter, not a safety one.';

comment on column public.users.food_prefs_set_at is
  'When preferences were last confirmed. Null = never, so ask.';

alter table public.users
  drop constraint if exists users_eating_pattern_valid;
alter table public.users
  add constraint users_eating_pattern_valid
  check (
    eating_pattern is null
    or eating_pattern in ('none','vegetarian','vegan','pescatarian','halal','kosher')
  );

commit;
