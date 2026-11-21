-- ============================================================================
-- AJM FIT — Does the client have a bench?
--
-- WHY. The exercise library holds one equipment value per exercise. It says
-- `dumbbell` for Dumbbell Bench Press and `body only` for Pullups, so the two
-- things a home client is most likely not to own — a bench and a pull-up bar —
-- are invisible to every filter and every health check in the app.
--
-- Measured against the live library: all 34 home programs need a bench or an
-- elevated surface and 31 of 34 need a pull-up bar. Not one is doable with
-- dumbbells and a floor. A client with only dumbbells loses an average of 25%
-- of every home program, worst case 33%.
--
-- The pull-up bar is a stated requirement for home programs rather than a
-- question, because Chin-Up and Pullups have no honest substitute: the only
-- four exercises tagged `lats` a dumbbells-only client can do are all
-- stretches, and the library holds no band exercises for the back at all. So
-- there is no column for it — a requirement is said, not stored.
--
-- The bench IS a question, because a sturdy chair, a sofa arm or a step does
-- the job and six exercises have named substitutes. This is where that answer
-- lives.
--
-- NULL IS NOT FALSE. Null means never asked, and lib/equipment.ts reads it as
-- "has a bench" on purpose. Every client on the platform today has a null
-- here, and reading it the other way would substitute exercises into 34
-- programs overnight for people who never asked for it. verify-equipment.ts
-- pins that default as its first check.
-- ============================================================================

begin;

alter table public.users
  add column if not exists has_bench boolean;

comment on column public.users.has_bench is
  'Whether the client says they have a bench, sturdy chair or step at home, asked in the program picker. Null = never asked, which lib/equipment.ts treats as YES so that existing programs never change under anyone. False is the only value that substitutes anything.';

commit;
