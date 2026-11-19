-- ============================================================================
-- AJM FIT — Where a client is starting from
--
-- WHY. lib/progression.ts scales load increments by training age: a beginner
-- adds 5 lb upper and 10 lb lower and earns it after one good session, an
-- advanced lifter adds 2.5 and 5 and has to do it twice. Sensible rules, and
-- every client in the app has been getting the beginner ones.
--
-- `experienceFrom` reads `onboarding.answers.experience`, and Blueprint
-- clients do not fill in onboarding — that table has no rows in it. The
-- function falls back to 'beginner' when it knows nothing, which is the safe
-- default for load increments and the wrong answer for somebody two years in
-- being told to put another 10 lb on their squat after a single session.
--
-- The picker now asks the question directly. This is where the answer lives,
-- rather than overloading the coach's intake form with a field that means
-- something different: onboarding is the pre-call questionnaire, and a
-- half-written row in it would read as a half-finished intake.
-- ============================================================================

begin;

alter table public.users
  add column if not exists training_experience text;

alter table public.users drop constraint if exists users_training_experience;
alter table public.users add constraint users_training_experience
  check (
    training_experience is null
    or training_experience in ('new', 'returning', 'consistent')
  );

comment on column public.users.training_experience is
  'Where the client said they are starting from, asked in the program picker. new = never trained, returning = trained before and been away, consistent = training regularly. Null = never asked.';

commit;
