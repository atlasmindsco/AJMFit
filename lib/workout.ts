import { supabase } from '@/lib/supabase'
import { localDate, localWeekStart } from '@/lib/dates'
import type { TrainedDay } from '@/lib/rotation'
import type { SessionPoint } from '@/lib/progress-lines'
import { STALE_AFTER_HOURS, type ActiveWorkout } from '@/lib/active-workout'

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
 * Close out any workout left open past the resume window. Without this, an
 * un-ended session stays "active" and its timer accumulates for days.
 *
 * Swept on the same constant that decides whether a session can still be
 * resumed, so there is no band where a workout is too old to offer back and
 * too young to close.
 *
 * NOTE ON WHO CALLS THIS. It runs when the client opens their programs page,
 * which means it never runs for the clients it was written for. Arun's only
 * session has been open since 8 November and Alexandro's since 10 October,
 * because neither of them came back — and coming back is the trigger. The
 * server-side sweep in /api/cron/close-workouts is what actually reaches
 * them; this stays because closing a client's own stale session the moment
 * they return is still the right thing to do, and it needs no cron to work.
 */
export async function autoCloseStaleWorkouts(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 3600_000)
  const { data: stale } = await db
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .is('ended_at', null)
    .lt('started_at', cutoff.toISOString())
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
  /**
   * Pounds moved in that session, by the same rule as the completion screen:
   * weight × reps for every logged set, bodyweight work contributing nothing.
   * See sessionTotals in lib/session-summary.ts — the definition lives there
   * and a second one here would eventually disagree with it, which is how a
   * client ends up with a history row that contradicts the screen they saw
   * on the day.
   */
  volume: number
}

/**
 * The client's recent workouts (most recent first), with a set count and the
 * volume of each.
 *
 * PAGINATION IS NOT OPTIONAL HERE. PostgREST returns at most 1000 rows per
 * request and says nothing about having stopped. The progress page calls this
 * with limit 300, and 300 sessions is several thousand sets, so the single
 * unpaged query this used to run silently dropped everything past the first
 * thousand — which read as a zero set count on the oldest sessions rather
 * than as an error. Volume would have been wrong the same way, and a wrong
 * volume is worse than a missing one: it is a number the client will compare
 * against next month's.
 */
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
  const counts = new Map<string, number>()
  const volumes = new Map<string, number>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data: page } = await db
      .from('workout_sets')
      .select('workout_id, weight, reps')
      .in('workout_id', ids)
      .range(from, from + PAGE - 1)
    const batch = (page ?? []) as Array<{ workout_id: string; weight: number | null; reps: number | null }>
    for (const s of batch) {
      counts.set(s.workout_id, (counts.get(s.workout_id) ?? 0) + 1)
      const w = Number(s.weight)
      const r = Number(s.reps)
      // Same guards as sessionTotals: a bodyweight set has no load to count,
      // and a null in either column must not turn into a NaN total.
      if (Number.isFinite(w) && w > 0 && Number.isFinite(r) && r > 0) {
        volumes.set(s.workout_id, (volumes.get(s.workout_id) ?? 0) + w * r)
      }
    }
    if (batch.length < PAGE) break
  }
  return rows.map((w) => ({
    id: w.id,
    date: w.date,
    day_name: w.day_name,
    program_name: w.program_name,
    duration_seconds: w.duration_seconds,
    ended_at: w.ended_at,
    set_count: counts.get(w.id) ?? 0,
    volume: Math.round(volumes.get(w.id) ?? 0),
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
  reason?: SwapReason | null,
  /**
   * True for "just today", false for "every time from now on".
   *
   * This column has existed since the swap-reason migration and until now
   * nothing wrote it, so every stored swap read back as permanent — including
   * the ones stored ONLY because the client said something hurt, which the UI
   * had told them was for that session. The next day the app silently kept
   * giving them the substitute for a movement they never asked to replace.
   */
  sessionOnly = false
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
        session_only: sessionOnly,
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
 *
 * The window is STALE_AFTER_HOURS and not "since local midnight", which is
 * what it used to be. Midnight made a session started at 11:30pm
 * unresumable at 12:01am — and `autoCloseStaleWorkouts` swept on the same
 * boundary, so the row was then closed with the client never offered it
 * back. Two thresholds either side of one line is how a workout ends up
 * alive in the table and dead on the screen. Both now read the same constant.
 */
export async function fetchInProgressWorkout(
  userId: string
): Promise<{ workout: InProgressWorkoutRow; sets: WorkoutSetRow[] } | null> {
  const since = new Date(Date.now() - STALE_AFTER_HOURS * 3600_000)
  const { data: workout, error: wErr } = await db
    .from('workouts')
    .select('id, day_name, program_name, program_phase, started_at')
    .eq('user_id', userId)
    .is('ended_at', null)
    .gte('started_at', since.toISOString())
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

/**
 * The swaps that should still be in force when a client opens their program.
 *
 * Only the permanent ones. A "just today" swap is stored when the reason was
 * pain, because the coach must see that, but it is not a change to the
 * program and must not come back tomorrow. `fetchPainSwaps` deliberately does
 * not filter on this — the coach's view wants every pain report, whether or
 * not the client meant to keep the substitute.
 */
export async function fetchSwaps(userId: string): Promise<SwapRow[]> {
  const { data, error } = await db
    .from('exercise_swaps')
    .select('original_exercise_name, swapped_exercise_name')
    .eq('user_id', userId)
    .eq('session_only', false)
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

/**
 * Every session of every loaded exercise, for one client.
 *
 * NOT lib/workout.ts's `fetchExerciseHistory`, which caps at six sessions per
 * exercise. Six is the right window for "is this lift stalling" — the question
 * that function exists to answer — and the wrong one here: capped at six, the
 * FIRST session we can see is the sixth-most-recent, so a client eight
 * sessions in gets told their deadlift started at a weight they were already
 * lifting, in a month after the one they started.
 *
 * Paginated. PostgREST caps a page at 1,000 rows whatever limit you ask for,
 * and a silent truncation here means a client's earliest sessions quietly
 * vanish and the sentence understates them — which is worse than no sentence,
 * because it is wrong rather than absent.
 */
export async function fetchLiftHistory(userId: string): Promise<Record<string, SessionPoint[]>> {
  const rows: Array<{
    exercise_name: string
    weight: number | null
    workout_id: string
    workouts: { date: string } | { date: string }[] | null
  }> = []

  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('workout_sets')
      .select('exercise_name, weight, workout_id, workouts!inner(date)')
      .eq('user_id', userId)
      .eq('completed', true)
      .eq('is_intensity_set', false)
      .order('logged_at', { ascending: false })
      .range(from, from + 999)
    if (error) return {}
    const page = (data ?? []) as typeof rows
    rows.push(...page)
    if (page.length < 1000) break
  }

  // Heaviest working set per exercise per WORKOUT, not per set. Three sets of
  // a lift is one session, and counting each set would let one hard day clear
  // the four-session floor on its own.
  const byExercise: Record<string, Record<string, SessionPoint>> = {}
  for (const row of rows) {
    const weight = Number(row.weight) || 0
    if (weight <= 0) continue
    const joined = row.workouts
    const date = Array.isArray(joined) ? joined[0]?.date : joined?.date
    if (!date) continue

    const perWorkout = (byExercise[row.exercise_name] ??= {})
    const seen = perWorkout[row.workout_id]
    if (!seen || weight > seen.topWeight) {
      perWorkout[row.workout_id] = { date, topWeight: weight }
    }
  }

  const out: Record<string, SessionPoint[]> = {}
  for (const name of Object.keys(byExercise)) {
    const perWorkout = byExercise[name]
    out[name] = Object.keys(perWorkout).map((id) => perWorkout[id])
  }
  return out
}

/**
 * The running session, reduced to what a bar on another screen needs.
 *
 * Built on fetchInProgressWorkout rather than a second query of its own, so
 * the two can never disagree about what counts as still running.
 */
export async function fetchActiveWorkout(userId: string): Promise<ActiveWorkout | null> {
  const found = await fetchInProgressWorkout(userId)
  if (!found) return null
  const { workout, sets } = found

  // Distinct exercises, in the order they were first logged. Intensity sets
  // are part of an exercise the client has already reached, so they count
  // toward neither the position nor a new name.
  const touched: string[] = []
  const seen = new Set<string>()
  let logged = 0
  for (const s of sets) {
    if (!s.completed) continue
    logged++
    if (s.is_intensity_set) continue
    if (seen.has(s.exercise_name)) continue
    seen.add(s.exercise_name)
    touched.push(s.exercise_name)
  }

  return {
    id: workout.id,
    dayName: workout.day_name ?? '',
    programName: workout.program_name,
    startedAt: workout.started_at,
    exercisesTouched: touched,
    loggedSets: logged,
  }
}

/**
 * Close a session the client has decided not to finish.
 *
 * Deliberately NOT a delete. The sets they logged are things they actually
 * did and they stay in their history; what ends is the session. Duration is
 * left null rather than invented, the same reasoning as the stale sweep —
 * a workout nobody timed should show no time, not a confident guess.
 *
 * There was no way to do this at all before. "Until they finish it or
 * explicitly abandon it" had only one of those two.
 */
export async function abandonWorkout(workoutId: string): Promise<void> {
  const { error } = await db
    .from('workouts')
    .update({ ended_at: new Date().toISOString(), duration_seconds: null })
    .eq('id', workoutId)
  if (error) throw error
}
