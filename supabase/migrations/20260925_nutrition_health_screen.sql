-- ============================================================================
-- AJM FIT — Nutrition health screening
--
-- Before this, nutrition setup screened for nothing. Anyone who filled in the
-- form got an automated calorie deficit, including a 13-year-old (validation
-- explicitly allowed age 13 and up), someone pregnant, or someone with kidney
-- disease — for whom the high protein targets this product generates are the
-- single most directly contraindicated output it produces.
--
-- The screen is a gate, not a warning. A positive answer on a blocking
-- question ends the setup flow before any number is calculated, and routes the
-- client to Anthony.
--
-- Two columns rather than one, because they answer different questions:
--   health_screen       what the client actually told us, kept so Anthony can
--                       see it and so we are not re-asking on every edit
--   nutrition_block_code why targets are withheld, or null if they are not
--
-- The raw answers are health information. They are readable by the client
-- themselves and by the service role (Anthony's admin views), and by nobody
-- else — the existing users-table RLS already enforces that, so this migration
-- adds columns only and changes no policy.
-- ============================================================================

begin;

alter table public.users
  add column if not exists health_screen jsonb,
  add column if not exists nutrition_block_code text,
  add column if not exists health_screened_at timestamptz;

comment on column public.users.health_screen is
  'Answers to the nutrition health screen, as submitted. Null = never screened.';

comment on column public.users.nutrition_block_code is
  'Why automated nutrition targets are withheld: kidney, pregnancy, ed_history, diabetes, clinical, existing_care. Null = not blocked. The code medication is a flag, not a block, and is not stored here.';

comment on column public.users.health_screened_at is
  'When the screen was last completed. Used to re-ask after a long gap.';

-- Anthony needs to find blocked and flagged clients quickly from the coach
-- dashboard. Partial index: the overwhelming majority of rows are null.
create index if not exists idx_users_nutrition_block
  on public.users (nutrition_block_code)
  where nutrition_block_code is not null;

commit;
