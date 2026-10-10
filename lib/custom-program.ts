/**
 * Programs a client builds for themselves.
 *
 * These live in the SAME tables as the 68 AJM Fit programs, flagged by
 * `source = 'custom'` and owned via `created_by`. That is the whole point of
 * the design: `loadAssignedProgram` reads a custom program without knowing it
 * is custom, so logging, previous performance, progression targets, demos,
 * cues, the rest timer, substitutions, records and the rotation all work with
 * no changes at all.
 *
 * Writes go through RLS rather than a service-role endpoint. The builder
 * writes on every edit, and routing each one through a server route would mean
 * every route re-implementing "is this really your program" in application
 * code. The policies answer it once, in the database.
 */

import { supabase } from '@/lib/supabase'
import { fetchAssignmentStart } from '@/lib/programs'
import { renamesFor, planRenameOps, type Rename } from '@/lib/day-renames'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/** How many programs one client may keep. A shelf, not a drawer. */
export const MAX_CUSTOM_PROGRAMS = 5

export interface CustomProgramRow {
  id: string
  name: string
  days_per_week: number | null
  created_at: string
  created_by: string
}

export interface BuilderExercise {
  /** Canonical name from the exercise library. Never free text. */
  exerciseName: string
  sets: number
  /** A RANGE, e.g. "8-12". Double progression needs one. */
  reps: string
  restSeconds: number
  notes?: string | null
}

export interface BuilderDay {
  name: string
  exercises: BuilderExercise[]
  /**
   * Stable identity for a day that already exists in the database.
   *
   * Without it a rename is indistinguishable from deleting a day and adding
   * another, which matters because one of those should carry workout history
   * across and the other must not. Set only when EDITING a saved program —
   * a copy has no history of its own to carry.
   */
  key?: string
}

export interface BuilderProgram {
  name: string
  days: BuilderDay[]
}

export interface LibraryProgram {
  id: string
  name: string
  days_per_week: number | null
  split: string | null
}

/**
 * The AJM Fit programs, as starting points.
 *
 * Every signed-in client can read these — the policy rewrite in the custom
 * programs migration kept that deliberately, because copying one is the whole
 * point. Their own custom programs are excluded: those are reachable from My
 * programs, and listing them here would offer "copy" where "edit" is meant.
 */
export async function fetchLibraryPrograms(): Promise<LibraryProgram[]> {
  // eq('blueprint') rather than neq('custom'): a NULL source would slip
  // through a <> comparison in Postgres, and the ownership constraint added
  // with the custom-programs migration treats NULL source as not-custom.
  const { data } = await db
    .from('programs')
    .select('id, name, days_per_week, split')
    .eq('source', 'blueprint')
    .order('days_per_week', { ascending: true })
    .order('name', { ascending: true })
  return (data ?? []) as LibraryProgram[]
}

/** The client's own programs, newest first. */
export async function fetchMyCustomPrograms(userId: string): Promise<CustomProgramRow[]> {
  const { data } = await db
    .from('programs')
    .select('id, name, days_per_week, created_at, created_by')
    .eq('created_by', userId)
    .eq('source', 'custom')
    .order('created_at', { ascending: false })
  return (data ?? []) as CustomProgramRow[]
}

/**
 * Read a program into the builder's shape.
 *
 * Works on ANY program the client can see — their own, or one of the 68 AJM
 * Fit ones. That is what makes "customise this program" the same code path as
 * "edit my program".
 *
 * `keepKeys` marks each day with its database id, which is what lets a later
 * save tell a rename from a delete-and-add. Pass it when EDITING a saved
 * program; leave it off when copying one, because a copy shares its day names
 * with the original and migrating history on those names would rewrite the
 * past of a program the client is not even editing.
 */
export async function loadIntoBuilder(
  programId: string,
  opts: { keepKeys?: boolean } = {}
): Promise<BuilderProgram | null> {
  const { data: prog } = await db
    .from('programs')
    .select('id, name')
    .eq('id', programId)
    .maybeSingle()
  if (!prog) return null

  const { data: days } = await db
    .from('program_days')
    .select('id, day_index, name')
    .eq('program_id', programId)
    .order('day_index', { ascending: true })
  const dayRows = (days ?? []) as Array<{ id: string; name: string }>
  if (dayRows.length === 0) return { name: prog.name as string, days: [] }

  const { data: exs } = await db
    .from('program_exercises')
    .select('program_day_id, order_index, exercise_name, sets, reps, rest_seconds, notes')
    .in('program_day_id', dayRows.map((d) => d.id))
    .order('order_index', { ascending: true })

  const byDay = new Map<string, BuilderExercise[]>()
  for (const e of (exs ?? []) as Array<{
    program_day_id: string
    exercise_name: string
    sets: number | null
    reps: string | null
    rest_seconds: number | null
    notes: string | null
  }>) {
    const list = byDay.get(e.program_day_id) ?? []
    list.push({
      exerciseName: e.exercise_name,
      sets: e.sets ?? 3,
      reps: e.reps ?? '8-12',
      restSeconds: e.rest_seconds ?? 60,
      notes: e.notes,
    })
    byDay.set(e.program_day_id, list)
  }

  return {
    name: prog.name as string,
    days: dayRows.map((d) => ({
      name: shortDayName(d.name),
      exercises: byDay.get(d.id) ?? [],
      ...(opts.keepKeys ? { key: d.id } : {}),
    })),
  }
}

/**
 * Carry workout history across a renamed day.
 *
 * Workout rows store the day's name, not its id, and the rotation matches on
 * that name — so a rename with no migration silently orphans every session
 * logged under the old one. The green ticks vanish, the lap restarts, and
 * "today" goes back to day one. Which is the whole reason renaming an active
 * program needed deciding before it could be allowed.
 *
 * Bounded to sessions from this program's first assignment onward. A client
 * who trained a Blueprint program with an "Upper A" day, then built their own
 * with an "Upper A" day, then renamed it, must not have the Blueprint sessions
 * relabelled — that would be rewriting the record of a program they are no
 * longer on. In production one client has exactly that shape: seven "Upper A"
 * sessions under a Lean Out program they left in September.
 *
 * Deliberately NOT bounded by `workouts.program_name`. That column holds a
 * display string snapshotted at log time, and it has already drifted in
 * production: one client's rows carry two different program names for a single
 * uninterrupted assignment. It cannot identify a program.
 */
export async function migrateDayNames(input: {
  userId: string
  programId: string
  renames: Rename[]
}): Promise<number> {
  const { userId, programId, renames } = input
  if (renames.length === 0) return 0

  // The earliest time this program was ever the client's. No assignment means
  // it was never trained, so there is no history to carry. Shared with the
  // rotation, which uses the same boundary for the same reason.
  const since = await fetchAssignmentStart(userId, programId)
  if (!since) return 0

  const touched = new Set<string>()
  for (const { from, to } of planRenameOps(renames)) {
    const { data, error } = await db
      .from('workouts')
      .update({ day_name: to })
      .eq('user_id', userId)
      .eq('day_name', from)
      .gte('started_at', since)
      .select('id')
    if (error) throw error
    // Counted as rows, not as updates: a sentinel hop touches the same row
    // twice and would otherwise be reported as two sessions moved.
    for (const row of (data ?? []) as Array<{ id: string }>) touched.add(row.id)
  }
  return touched.size
}

/**
 * Strip the "Day 1 — " prefix the library uses.
 *
 * Matches `shortName` in lib/blueprint.ts, because the name stored here is the
 * one the rotation will match workouts against. If the two disagreed, a copied
 * program would start with no history.
 */
function shortDayName(name: string): string {
  return name.replace(/^day\s*\d+\s*[—–-]\s*/i, '').trim() || name
}

/**
 * Write a builder program to the database, replacing its content.
 *
 * Content is deleted and re-inserted rather than diffed. A program is at most
 * six days of a handful of exercises, the delete cascades, and a diff would be
 * a lot of machinery to avoid writing forty small rows. Crucially this does
 * NOT touch workout history, which keys on exercise name rather than on these
 * rows.
 */
export async function saveCustomProgram(input: {
  userId: string
  program: BuilderProgram
  /** Omit to create; pass to overwrite an existing custom program. */
  programId?: string
  /**
   * The draft as it was loaded, so renamed days can carry their history.
   * Omit when creating — a new program has none.
   */
  original?: BuilderProgram
}): Promise<{ programId: string; sessionsMoved: number }> {
  const { userId, program } = input
  const trainable = program.days.filter((d) => d.exercises.length > 0).length

  let programId = input.programId
  if (programId) {
    const { error } = await db
      .from('programs')
      .update({ name: program.name, days_per_week: trainable })
      .eq('id', programId)
    if (error) throw error
    // Replace the content wholesale.
    const { data: oldDays } = await db.from('program_days').select('id').eq('program_id', programId)
    const ids = ((oldDays ?? []) as Array<{ id: string }>).map((d) => d.id)
    if (ids.length) await db.from('program_exercises').delete().in('program_day_id', ids)
    await db.from('program_days').delete().eq('program_id', programId)
  } else {
    const { data, error } = await db
      .from('programs')
      .insert({
        name: program.name,
        source: 'custom',
        created_by: userId,
        days_per_week: trainable,
        level: 'All Levels',
        split: 'Custom',
      })
      .select('id')
      .single()
    if (error || !data) throw error ?? new Error('Could not create program')
    programId = data.id as string
  }

  // History moves only after the program content is safely written. A rename
  // that succeeded against a save that then failed would leave history under a
  // name the program no longer has — the exact orphaning this exists to stop.
  const renames = input.original ? renamesFor(input.original.days, program.days) : []

  if (program.days.length === 0) {
    const sessionsMoved = await migrateDayNames({ userId, programId, renames })
    return { programId, sessionsMoved }
  }

  const { data: dayRows, error: dErr } = await db
    .from('program_days')
    .insert(
      program.days.map((d, i) => ({
        program_id: programId,
        day_index: i + 1,
        name: d.name,
        focus: null,
      }))
    )
    .select('id, day_index')
  if (dErr) throw dErr

  const idByIndex = new Map(
    ((dayRows ?? []) as Array<{ id: string; day_index: number }>).map((d) => [d.day_index, d.id])
  )

  const exerciseRows = program.days.flatMap((d, i) =>
    d.exercises.map((e, j) => ({
      program_day_id: idByIndex.get(i + 1),
      order_index: j + 1,
      exercise_name: e.exerciseName,
      sets: e.sets,
      reps: e.reps,
      rest_seconds: e.restSeconds,
      notes: e.notes ?? null,
    }))
  )
  if (exerciseRows.length) {
    const { error: eErr } = await db.from('program_exercises').insert(exerciseRows)
    if (eErr) throw eErr
  }

  const sessionsMoved = await migrateDayNames({ userId, programId, renames })
  return { programId, sessionsMoved }
}

/**
 * Make a program the one the client is training on.
 *
 * Ends any open assignment first, which is how `program_assignments` has
 * always expressed "one active program".
 */
export async function activateCustomProgram(userId: string, programId: string): Promise<void> {
  await db
    .from('program_assignments')
    .update({ ended_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('ended_at', null)

  const { error } = await db
    .from('program_assignments')
    .insert({ user_id: userId, program_id: programId })
  if (error) throw error
}

/**
 * Delete a custom program.
 *
 * Workout history is untouched: it keys on exercise name and day name, not on
 * these rows, so a client who deletes a program keeps every session they ever
 * logged against it.
 */
export async function deleteCustomProgram(programId: string): Promise<void> {
  const { error } = await db.from('programs').delete().eq('id', programId)
  if (error) throw error
}

export async function renameCustomProgram(programId: string, name: string): Promise<void> {
  const { error } = await db.from('programs').update({ name }).eq('id', programId)
  if (error) throw error
}
