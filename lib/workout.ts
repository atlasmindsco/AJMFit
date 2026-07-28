import { supabase } from '@/lib/supabase'

export type IntensityTechnique = 'dropset' | 'restpause' | 'partial'

/* Supabase's generic type inference chokes on our Database type for writes.
 * We type the payloads explicitly on our side and cast on the wire. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface StartWorkoutInput {
  userId: string
  dayName: string
  programName?: string
  programPhase?: string
}

export async function startWorkout(input: StartWorkoutInput): Promise<string> {
  const { data, error } = await db
    .from('workouts')
    .insert({
      user_id: input.userId,
      day_name: input.dayName,
      program_name: input.programName ?? null,
      program_phase: input.programPhase ?? null,
    })
    .select('id')
    .single()

  if (error || !data) throw error ?? new Error('Failed to start workout')
  return data.id as string
}

// No real training session runs longer than this; caps runaway timers that
// kept counting while the app was closed (which produced 100+ hour durations).
const MAX_WORKOUT_SECONDS = 4 * 60 * 60

export async function endWorkout(workoutId: string, durationSeconds: number) {
  const dur = Math.max(0, Math.min(Math.round(durationSeconds || 0), MAX_WORKOUT_SECONDS))
  const { error } = await db
    .from('workouts')
    .update({ ended_at: new Date().toISOString(), duration_seconds: dur })
    .eq('id', workoutId)
  if (error) throw error
}

/**
 * Close out any workout left open from a previous day. Without this, an
 * un-ended session stays "active" and its timer accumulates for days. We stamp
 * a modest estimated duration so it shows up as a completed workout in history.
 */
export async function autoCloseStaleWorkouts(userId: string): Promise<void> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data: stale } = await db
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .is('ended_at', null)
    .lt('started_at', todayStart.toISOString())
  for (const w of (stale ?? []) as { id: string }[]) {
    await db
      .from('workouts')
      .update({ ended_at: new Date().toISOString(), duration_seconds: 45 * 60 })
      .eq('id', w.id)
  }
}

export interface WorkoutHistoryRow {
  id: string
  date: string
  day_name: string
  program_name: string | null
  duration_seconds: number | null
  ended_at: string | null
  set_count: number
}

/** The client's recent workouts (most recent first), with a set count each. */
export async function fetchWorkoutHistory(userId: string, limit = 12): Promise<WorkoutHistoryRow[]> {
  const { data: workouts, error } = await db
    .from('workouts')
    .select('id, date, day_name, program_name, duration_seconds, ended_at, started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const rows = (workouts ?? []) as Array<WorkoutHistoryRow & { started_at: string }>
  if (rows.length === 0) return []

  const ids = rows.map((w) => w.id)
  const { data: sets } = await db.from('workout_sets').select('workout_id').in('workout_id', ids)
  const counts = new Map<string, number>()
  for (const s of (sets ?? []) as { workout_id: string }[]) {
    counts.set(s.workout_id, (counts.get(s.workout_id) ?? 0) + 1)
  }
  return rows.map((w) => ({
    id: w.id,
    date: w.date,
    day_name: w.day_name,
    program_name: w.program_name,
    duration_seconds: w.duration_seconds,
    ended_at: w.ended_at,
    set_count: counts.get(w.id) ?? 0,
  }))
}

export interface SaveSetInput {
  workoutId: string
  userId: string
  exerciseName: string
  originalExerciseName?: string | null
  setNumber: number
  weight: number | null
  reps: number | null
  isIntensitySet?: boolean
  intensityTechnique?: IntensityTechnique | null
  completed?: boolean
}

export async function saveSet(input: SaveSetInput) {
  const { data: existing } = await db
    .from('workout_sets')
    .select('id')
    .eq('workout_id', input.workoutId)
    .eq('exercise_name', input.exerciseName)
    .eq('set_number', input.setNumber)
    .eq('is_intensity_set', input.isIntensitySet ?? false)
    .maybeSingle()

  if (existing) {
    const { error } = await db
      .from('workout_sets')
      .update({
        weight: input.weight,
        reps: input.reps,
        completed: input.completed ?? false,
        intensity_technique: input.intensityTechnique ?? null,
      })
      .eq('id', existing.id)
    if (error) throw error
    return existing.id as string
  }

  const { data, error } = await db
    .from('workout_sets')
    .insert({
      workout_id: input.workoutId,
      user_id: input.userId,
      exercise_name: input.exerciseName,
      original_exercise_name: input.originalExerciseName ?? null,
      set_number: input.setNumber,
      weight: input.weight,
      reps: input.reps,
      is_intensity_set: input.isIntensitySet ?? false,
      intensity_technique: input.intensityTechnique ?? null,
      completed: input.completed ?? false,
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('Failed to save set')
  return data.id as string
}

export interface UpsertPRInput {
  userId: string
  exerciseName: string
  weight: number
  reps: number
  workoutId?: string
}

export async function upsertPR(input: UpsertPRInput) {
  const { data: existing } = await db
    .from('exercise_prs')
    .select('id, weight')
    .eq('user_id', input.userId)
    .eq('exercise_name', input.exerciseName)
    .maybeSingle()

  if (existing && Number(existing.weight) >= input.weight) return

  if (existing) {
    const { error } = await db
      .from('exercise_prs')
      .update({
        weight: input.weight,
        reps: input.reps,
        previous_weight: existing.weight,
        set_at: new Date().toISOString(),
        workout_id: input.workoutId ?? null,
      })
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await db.from('exercise_prs').insert({
    user_id: input.userId,
    exercise_name: input.exerciseName,
    weight: input.weight,
    reps: input.reps,
    workout_id: input.workoutId ?? null,
  })
  if (error) throw error
}

export interface PRRow {
  exercise_name: string
  weight: number
  reps: number
  previous_weight: number | null
  set_at: string
}

export async function fetchPRs(userId: string): Promise<PRRow[]> {
  const { data, error } = await db
    .from('exercise_prs')
    .select('exercise_name, weight, reps, previous_weight, set_at')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []) as PRRow[]
}

/** Count of workouts logged since the start of the current week (Mon). */
export async function fetchWorkoutsThisWeek(userId: string): Promise<number> {
  const now = new Date()
  const diffToMonday = (now.getDay() + 6) % 7 // days since Monday
  const monday = new Date(now)
  monday.setDate(now.getDate() - diffToMonday)
  const startStr = monday.toISOString().slice(0, 10)
  const { count, error } = await db
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('date', startStr)
  if (error) throw error
  return count ?? 0
}

export async function saveSwap(userId: string, originalName: string, swappedName: string) {
  const { error } = await db
    .from('exercise_swaps')
    .upsert(
      {
        user_id: userId,
        original_exercise_name: originalName,
        swapped_exercise_name: swappedName,
      },
      { onConflict: 'user_id,original_exercise_name' }
    )
  if (error) throw error
}

export async function removeSwap(userId: string, originalName: string) {
  const { error } = await db
    .from('exercise_swaps')
    .delete()
    .eq('user_id', userId)
    .eq('original_exercise_name', originalName)
  if (error) throw error
}

export interface InProgressWorkoutRow {
  id: string
  day_name: string
  program_name: string | null
  program_phase: string | null
  started_at: string
}

export interface WorkoutSetRow {
  exercise_name: string
  original_exercise_name: string | null
  set_number: number
  weight: number | null
  reps: number | null
  is_intensity_set: boolean
  intensity_technique: IntensityTechnique | null
  completed: boolean
}

/**
 * Returns the most recent workout for this user that hasn't been ended, or null.
 * Includes all sets already logged for that workout.
 */
export async function fetchInProgressWorkout(
  userId: string
): Promise<{ workout: InProgressWorkoutRow; sets: WorkoutSetRow[] } | null> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data: workout, error: wErr } = await db
    .from('workouts')
    .select('id, day_name, program_name, program_phase, started_at')
    .eq('user_id', userId)
    .is('ended_at', null)
    .gte('started_at', todayStart.toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (wErr) throw wErr
  if (!workout) return null

  const { data: sets, error: sErr } = await db
    .from('workout_sets')
    .select('exercise_name, original_exercise_name, set_number, weight, reps, is_intensity_set, intensity_technique, completed')
    .eq('workout_id', workout.id)
    .order('set_number', { ascending: true })

  if (sErr) throw sErr

  return {
    workout: workout as InProgressWorkoutRow,
    sets: (sets ?? []) as WorkoutSetRow[],
  }
}

export interface SwapRow {
  original_exercise_name: string
  swapped_exercise_name: string
}

export async function fetchSwaps(userId: string): Promise<SwapRow[]> {
  const { data, error } = await db
    .from('exercise_swaps')
    .select('original_exercise_name, swapped_exercise_name')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []) as SwapRow[]
}
