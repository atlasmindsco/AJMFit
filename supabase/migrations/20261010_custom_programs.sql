-- ============================================================================
-- AJM FIT — Client-built programs
--
-- Blueprint clients can now build or customise their own program. The content
-- lives in the EXISTING programs / program_days / program_exercises tables,
-- because they already store everything a builder needs: day order, exercise
-- order, sets, reps, rest, tempo, supersets and notes. No new content tables.
--
-- Two things were in the way.
--
-- 1. OWNERSHIP. `programs` had no owner column. Null means the program belongs
--    to AJM Fit (all 68 existing rows); non-null means a client built it.
--
-- 2. PERMISSIONS, which blocked this entirely. All three tables were
--    trainer-write and readable by EVERY signed-in user. So a client could not
--    save their own program, and had they been able to, every other client
--    would have been able to read it.
--
-- The `with check (source = 'custom')` clause below is the load-bearing one:
-- without it a client could insert a row claiming to be a Blueprint template,
-- and the self-serve picker would then offer their program to everyone.
-- ============================================================================

begin;

-- --- 1. Ownership -----------------------------------------------------------

alter table public.programs
  add column if not exists created_by uuid references public.users(id) on delete cascade;

comment on column public.programs.created_by is
  'The client who built this program. Null = an AJM Fit program, owned by nobody.';

create index if not exists programs_created_by_idx
  on public.programs(created_by) where created_by is not null;

-- A client program must declare itself custom, and an AJM Fit program must not
-- claim an owner. Enforced here so neither the application nor a policy has to
-- be the only thing standing between the two.
alter table public.programs drop constraint if exists programs_custom_ownership;
alter table public.programs add constraint programs_custom_ownership
  check (
    (created_by is null and coalesce(source, '') <> 'custom')
    or (created_by is not null and source = 'custom')
  );

-- --- 2. Read policies -------------------------------------------------------
--
-- AJM Fit programs stay readable by every member — that is how the picker and
-- the "start from a program" step work. A client's own program is readable by
-- them and by the trainer, and by nobody else.

drop policy if exists programs_select on public.programs;
create policy programs_select on public.programs for select using (
  auth.uid() is not null
  and (
    created_by is null
    or created_by = public.current_user_id()
    or public.is_trainer()
  )
);

drop policy if exists program_days_select on public.program_days;
create policy program_days_select on public.program_days for select using (
  auth.uid() is not null
  and exists (
    select 1 from public.programs p
    where p.id = program_days.program_id
      and (p.created_by is null or p.created_by = public.current_user_id() or public.is_trainer())
  )
);

drop policy if exists program_exercises_select on public.program_exercises;
create policy program_exercises_select on public.program_exercises for select using (
  auth.uid() is not null
  and exists (
    select 1
    from public.program_days d
    join public.programs p on p.id = d.program_id
    where d.id = program_exercises.program_day_id
      and (p.created_by is null or p.created_by = public.current_user_id() or public.is_trainer())
  )
);

-- --- 3. Write policies ------------------------------------------------------
--
-- The trainer keeps full write access (programs_write, unchanged). These are
-- additive: a client may write their OWN custom program and nothing else.
--
-- Writing through policies rather than a service-role endpoint is deliberate.
-- The builder writes on every edit — add an exercise, change a rep range, drag
-- a row — and routing all of that through server routes would mean every one
-- of them re-implementing "is this really your program" in application code.

drop policy if exists programs_own_write on public.programs;
create policy programs_own_write on public.programs for all
  using (created_by is not null and created_by = public.current_user_id())
  with check (
    created_by is not null
    and created_by = public.current_user_id()
    and source = 'custom'
  );

drop policy if exists program_days_own_write on public.program_days;
create policy program_days_own_write on public.program_days for all
  using (
    exists (
      select 1 from public.programs p
      where p.id = program_days.program_id
        and p.created_by = public.current_user_id()
        and p.source = 'custom'
    )
  )
  with check (
    exists (
      select 1 from public.programs p
      where p.id = program_days.program_id
        and p.created_by = public.current_user_id()
        and p.source = 'custom'
    )
  );

drop policy if exists program_exercises_own_write on public.program_exercises;
create policy program_exercises_own_write on public.program_exercises for all
  using (
    exists (
      select 1
      from public.program_days d
      join public.programs p on p.id = d.program_id
      where d.id = program_exercises.program_day_id
        and p.created_by = public.current_user_id()
        and p.source = 'custom'
    )
  )
  with check (
    exists (
      select 1
      from public.program_days d
      join public.programs p on p.id = d.program_id
      where d.id = program_exercises.program_day_id
        and p.created_by = public.current_user_id()
        and p.source = 'custom'
    )
  );

-- --- 4. Assigning your own program ------------------------------------------
--
-- Activating a custom program means writing a program_assignments row, which
-- was trainer-only. A client may now assign THEIR OWN custom program to
-- THEMSELVES, and nothing else: not someone else's program, not an AJM Fit
-- program (those still go through the server route that validates the
-- Blueprint selectors), and not to another user.

drop policy if exists program_assignments_own_custom on public.program_assignments;
create policy program_assignments_own_custom on public.program_assignments for all
  using (
    user_id = public.current_user_id()
    and exists (
      select 1 from public.programs p
      where p.id = program_assignments.program_id
        and p.created_by = public.current_user_id()
        and p.source = 'custom'
    )
  )
  with check (
    user_id = public.current_user_id()
    and exists (
      select 1 from public.programs p
      where p.id = program_assignments.program_id
        and p.created_by = public.current_user_id()
        and p.source = 'custom'
    )
  );

commit;
