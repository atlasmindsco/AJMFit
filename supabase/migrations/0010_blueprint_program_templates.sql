-- ============================================================================
-- AJM FIT — Blueprint self-serve program templates
--
-- The Blueprint tier has no coaching, so its clients pick a pre-made program by
-- three selectors: GOAL + DAYS/WEEK (via split) + LOCATION. This tags rows in
-- the existing `programs` table so the picker can resolve exactly one template
-- from those selectors. Program *content* (days + exercises) still lives in
-- program_days / program_exercises (added in 0009); this only adds the tags.
--
-- Content is authored in program-library/blueprint-library.json and loaded by
-- tools/ops/seed-blueprint-programs.mjs. `source = 'blueprint'` (column added in
-- 0009) marks these as templates, distinct from 'ai' / hand-built programs.
--
-- Idempotent — safe to run more than once.
-- ============================================================================

begin;

alter table public.programs add column if not exists goal text;        -- 'strength' | 'muscle' | 'lean_out'
alter table public.programs add column if not exists location text;    -- 'gym' | 'home'
alter table public.programs add column if not exists split_key text;    -- e.g. '5day_ulppl'
alter table public.programs add column if not exists recommended boolean not null default false;

comment on column public.programs.goal is 'Blueprint templates: training goal selector (strength|muscle|lean_out)';
comment on column public.programs.location is 'Blueprint templates: gym | home (dumbbell-only) selector';
comment on column public.programs.split_key is 'Blueprint templates: which split — drives days/week';
comment on column public.programs.recommended is 'Blueprint templates: highlight as the recommended pick for that day-count';

-- Exactly one template per (goal, split, location) so the seed upserts cleanly
-- and the picker resolves a single program from the three selectors.
create unique index if not exists programs_blueprint_key
  on public.programs (goal, split_key, location)
  where source = 'blueprint';

commit;
