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
}

export interface BuilderProgram {
  name: string
  days: BuilderDay[]
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
 */
export async function loadIntoBuilder(programId: string): Promise<BuilderProgram | null> {
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
    days: dayRows.map((d) => ({ name: shortDayName(d.name), exercises: byDay.get(d.id) ?? [] })),
  }
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
}): Promise<string> {
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

  if (program.days.length === 0) return programId

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

  return programId
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
