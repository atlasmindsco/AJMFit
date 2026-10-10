import { supabase } from '@/lib/supabase'
import { localDate, localWeekStart } from '@/lib/dates'
import type { TrainedDay } from '@/lib/rotation'

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
  // Resume an open session for this same day rather than opening a second one.
  //
  // A client mid-workout tapped away to another tab, came back, ended the
  // session and started it again to keep going. Because this function always
  // inserted, that produced TWO workout rows for one session on 24 Sep 2026:
  // 65 minutes with 39 sets, then 12 minutes with 52 — 38 of which repeated
  // slots from the first and 24 of which were byte-identical. His history
  // showed two sessions and roughly double the volume he actually lifted.
  //
  // Starting a workout that is already open should hand back the one already
  // running. It cannot lose data, and it removes the only way a single session
  // could ever split in two.
  const { data: open } = await db
    .from('workouts')
    .select('id')
    .eq('user_id', input.userId)
    .eq('day_name', input.dayName)
    .eq('date', localDate())
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (open?.id) return open.id as string

  const { data, error } = await db
    .from('workouts')
    .insert({
      user_id: input.userId,
      day_name: input.dayName,
      program_name: input.programName ?? null,
      program_phase: input.programPhase ?? null,
      // Same reason as food logs: the column default is UTC current_date, so
      // an evening session was recorded as tomorrow's workout.
      date: localDate(),
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
      // Duration stays NULL rather than being invented.
      //
      // This used to stamp 45 * 60 on every session it closed, so a workout
      // nobody timed came back as a confident "45 min". Jamel's two sessions
      // on 17 Sep 2026 both read exactly 45 minutes for that reason: neither
      // number was measured. The history row already renders the duration only
      // when there is one, so null simply shows no time, which is the truth.
      .update({ ended_at: new Date().toISOString(), duration_seconds: null })
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

/**
 * Every finished, actually-logged session, for working out where the client is
 * in their rotation.
 *
 * Deliberately not `fetchWorkoutHistory`: that one is capped at 12 rows for a
 * display list, and a 6-day program needs more than 12 to find a lap boundary.
 * This fetches names and timestamps only, so it stays cheap.
 *
 * `since` is the current program's assignment time, and it is what stops a
 * previous program's history closing out this program's lap. The rotation
 * matches sessions to days by NAME, and day names repeat across programs:
 * "Upper A" appears in eleven of the sixty-eight. One client has seventeen
 * sessions logged under a Lean Out program they left in September, three of
 * whose day names their current program also uses.
 *
 * It changes no client's answer today — simulated against all nine with an
 * open assignment — but it closes the hole that renaming a day would open: a
 * client who names a day after one they trained months ago on something else
 * would otherwise inherit its sessions as already done.
 */
export async function fetchTrainedDays(
  userId: string,
  limit = 60,
  since?: string | null
): Promise<TrainedDay[]> {
  let query = db
    .from('workouts')
    .select('id, day_name, ended_at')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .not('day_name', 'is', null)
  // started_at, not ended_at: a session begun under this program and finished
  // after midnight still belongs to it.
  if (since) query = query.gte('started_at', since)
  const { data: workouts } = await query
    .order('ended_at', { ascending: false })
    .limit(limit)
  const rows = (workouts ?? []) as Array<{ id: string; day_name: string; ended_at: string }>
  if (rows.length === 0) return []

  // A session with no sets was opened and abandoned — 7 of 41 in production.
  // Counting those would skip the client past a day they never trained.
  const { data: sets } = await db
    .from('workout_sets')
    .select('workout_id')
    .in('workout_id', rows.map((w) => w.id))
  const logged = new Set((sets ?? []).map((s: { workout_id: string }) => s.workout_id))

  return rows
    .filter((w) => logged.has(w.id))
    .map((w) => ({ dayName: w.day_name, at: w.ended_at }))
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
  /** Reps left in reserve. Optional; null means the client did not say. */
  rir?: number | null
  /** Timed work: a run, a row, an interval. Null for anything counted in reps. */
  durationSeconds?: number | null
  distanceMi?: number | null
}

export async function saveSet(input: SaveSetInput) {
  // One atomic upsert, not a lookup followed by an insert.
  //
  // The old version SELECTed to see whether the set existed and then INSERTed
  // if it did not. Two statements, no atomicity, and it runs on every
  // keystroke: typing "165" fires three saves whose lookups all complete
  // before any of their inserts land, so all three insert. That produced 952
  // rows for 340 real sets across the database, and training volume that read
  // roughly three times what clients had actually lifted.
  //
  // onConflict targets the workout_sets_one_per_slot unique index, so a lost
  // race is now a harmless update of the same row rather than another copy of
  // it. The index is the guarantee; this is just the well-behaved path to it.
  const { data, error } = await db
    .from('workout_sets')
    .upsert(
      {
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
        rir: input.rir ?? null,
        duration_seconds: input.durationSeconds ?? null,
        distance_mi: input.distanceMi ?? null,
        logged_at: new Date().toISOString(),
      },
      { onConflict: 'workout_id,exercise_name,set_number,is_intensity_set' }
    )
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
  const startStr = localWeekStart()
  const { count, error } = await db
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('date', startStr)
  if (error) throw error
  return count ?? 0
}

export type SwapReason = 'busy' | 'missing' | 'hurts'

export async function saveSwap(
  userId: string,
  originalName: string,
  swappedName: string,
  reason?: SwapReason | null
) {
  const { error } = await db
    .from('exercise_swaps')
    .upsert(
      {
        user_id: userId,
        original_exercise_name: originalName,
        swapped_exercise_name: swappedName,
        // The swap sheet already asks why and used to throw the answer away.
        // "hurts" is the earliest and cheapest injury signal in the app.
        reason: reason ?? null,
      },
      { onConflict: 'user_id,original_exercise_name' }
    )
  if (error) throw error
}

/**
 * Swaps a client made because something hurt.
 *
 * Read by the coach dashboard. This is the only true interrupt in the whole
 * intervention model: everything else can wait for the daily digest, and pain
 * cannot.
 */
export async function fetchPainSwaps(sinceDays = 30): Promise<Array<{ user_id: string; original_exercise_name: string; created_at: string }>> {
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString()
  const { data } = await db
    .from('exercise_swaps')
    .select('user_id, original_exercise_name, created_at')
    .eq('reason', 'hurts')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
  return (data ?? []) as Array<{ user_id: string; original_exercise_name: string; created_at: string }>
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

export interface LastSet {
  weight: number | null
  reps: number | null
  rir?: number | null
}

/** One past session on one exercise, summarised. */
export interface ExerciseSession {
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  /** Heaviest working set that session. */
  topWeight: number
  /** Reps achieved on the heaviest set. */
  topReps: number
  /** Lowest rep count across the working sets — where the set actually failed. */
  lowestReps: number
  sets: number
  /** Lowest reported RIR that session, or null if nobody said. */
  rir: number | null
}

/**
 * The last several sessions on every exercise, newest first.
 *
 * fetchLastSets returns a single session, which is enough to say "beat this"
 * and not enough to say anything else. One session cannot tell a first stall
 * from a fourth, cannot see a lift sliding backwards, and cannot tell whether
 * a bad day is a bad day or a trend — which is why seven exercises across the
 * client base went down over weeks with nothing noticing.
 *
 * Six sessions is the window: long enough for a stall to be real, short enough
 * that a block from two months ago does not drag the verdict around.
 */
/** Past timed bouts per exercise, newest first, for the conditioning models. */
export async function fetchTimedHistory(
  userId: string,
  perExercise = 6
): Promise<Record<string, Array<{ date: string; durationSeconds: number | null; distanceMi: number | null }>>> {
  const { data, error } = await db
    .from('workout_sets')
    .select('exercise_name, duration_seconds, distance_mi, workouts!inner(date)')
    .eq('user_id', userId)
    .eq('completed', true)
    .not('duration_seconds', 'is', null)
    .order('logged_at', { ascending: false })
    .limit(400)
  if (error) return {}

  const out: Record<string, Array<{ date: string; durationSeconds: number | null; distanceMi: number | null }>> = {}
  for (const row of (data ?? []) as Array<{
    exercise_name: string
    duration_seconds: number | null
    distance_mi: number | null
    workouts: { date: string } | { date: string }[] | null
  }>) {
    const w = Array.isArray(row.workouts) ? row.workouts[0] : row.workouts
    if (!w?.date) continue
    const list = (out[row.exercise_name] ??= [])
    if (list.length < perExercise) {
      list.push({
        date: w.date,
        durationSeconds: row.duration_seconds,
        distanceMi: row.distance_mi == null ? null : Number(row.distance_mi),
      })
    }
  }
  return out
}

export async function fetchExerciseHistory(
  userId: string,
  sessionsPerExercise = 6
): Promise<Record<string, ExerciseSession[]>> {
  const { data, error } = await db
    .from('workout_sets')
    .select('exercise_name, weight, reps, rir, workout_id, workouts!inner(date)')
    .eq('user_id', userId)
    .eq('completed', true)
    .eq('is_intensity_set', false)
    .order('logged_at', { ascending: false })
    .limit(2000)
  if (error) return {}

  type Row = {
    exercise_name: string
    weight: number | null
    reps: number | null
    rir: number | null
    workout_id: string
    workouts: { date: string } | { date: string }[] | null
  }

  // Group by exercise, then by the workout the set belonged to. Grouping on
  // workout_id rather than date keeps two sessions on the same calendar day
  // apart, which matters for anyone who trains twice.
  const byExercise = new Map<string, Map<string, { date: string; rows: Row[] }>>()
  for (const row of (data ?? []) as Row[]) {
    if (row.weight == null || row.reps == null) continue
    const w = Array.isArray(row.workouts) ? row.workouts[0] : row.workouts
    const date = w?.date ?? ''
    if (!date) continue
    let sessions = byExercise.get(row.exercise_name)
    if (!sessions) {
      sessions = new Map()
      byExercise.set(row.exercise_name, sessions)
    }
    const s = sessions.get(row.workout_id)
    if (s) s.rows.push(row)
    else sessions.set(row.workout_id, { date, rows: [row] })
  }

  const out: Record<string, ExerciseSession[]> = {}
  for (const [name, sessions] of Array.from(byExercise.entries())) {
    const summarised = Array.from(sessions.values())
      .map(({ date, rows }) => {
        const top = rows.reduce((a, b) => (Number(b.weight) > Number(a.weight) ? b : a))
        const reps = rows.map((r) => Number(r.reps) || 0)
        const rirs = rows.map((r) => r.rir).filter((r): r is number => r != null)
        return {
          date,
          topWeight: Number(top.weight) || 0,
          topReps: Number(top.reps) || 0,
          lowestReps: reps.length ? Math.min(...reps) : 0,
          sets: rows.length,
          rir: rirs.length ? Math.min(...rirs) : null,
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, sessionsPerExercise)
    out[name] = summarised
  }
  return out
}

/**
 * The sets this client logged the last time they trained each exercise, keyed
 * by exercise name. Used to show what they did last session while they are
 * logging the next one, so the numbers are in front of them instead of in
 * their memory.
 *
 * Only completed, non-intensity sets count — an abandoned or partial set is
 * not what they want to beat.
 */
export async function fetchLastSets(userId: string): Promise<Record<string, LastSet[]>> {
  const { data, error } = await db
    .from('workout_sets')
    .select('exercise_name, set_number, weight, reps, workout_id, logged_at')
    .eq('user_id', userId)
    .eq('completed', true)
    .eq('is_intensity_set', false)
    .order('logged_at', { ascending: false })
    .limit(600)
  if (error) return {}

  const out: Record<string, LastSet[]> = {}
  // Rows arrive newest-first, so the first workout_id seen for an exercise is
  // that exercise's most recent session; later workouts for it are ignored.
  const mostRecentWorkout: Record<string, string> = {}
  for (const row of (data ?? []) as Array<{
    exercise_name: string
    set_number: number
    weight: number | null
    reps: number | null
    workout_id: string
  }>) {
    const name = row.exercise_name
    if (!(name in mostRecentWorkout)) mostRecentWorkout[name] = row.workout_id
    if (row.workout_id !== mostRecentWorkout[name]) continue
    if (!out[name]) out[name] = []
    const idx = Math.max(0, row.set_number - 1)
    out[name][idx] = { weight: row.weight, reps: row.reps }
  }
  return out
}

/**
 * Consecutive weeks in which this client logged at least one workout.
 *
 * Weeks rather than days on purpose: programs here run 2-6 days a week, so a
 * day streak would break on a scheduled rest day and punish people for
 * following their own plan. A week is the unit the training actually uses.
 *
 * The current week counts only if it already has a workout; if it does not,
 * the streak is measured to last week and stays alive until the week ends,
 * so nobody watches it reset on a Monday morning.
 */
export async function fetchWeekStreak(userId: string): Promise<number> {
  const { data, error } = await db
    .from('workouts')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(400)
  if (error || !data?.length) return 0

  // Monday-start week index, so all dates in one week share a key.
  const weekKey = (d: Date) => {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    const day = (t.getUTCDay() + 6) % 7
    t.setUTCDate(t.getUTCDate() - day)
    return Math.floor(t.getTime() / 604800000)
  }

  const trained = new Set<number>()
  for (const row of data as Array<{ date: string }>) {
    trained.add(weekKey(new Date(row.date + 'T00:00:00Z')))
  }

  const thisWeek = weekKey(new Date())
  let cursor = trained.has(thisWeek) ? thisWeek : thisWeek - 1
  let streak = 0
  while (trained.has(cursor)) {
    streak++
    cursor--
  }
  return streak
}
