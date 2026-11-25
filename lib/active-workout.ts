/**
 * A workout that is still running, and how to describe it from anywhere.
 *
 * WHY THIS MODULE EXISTS. Resuming worked and was invisible. Every set is
 * written to the database as it is logged, and the programs page rehydrates
 * the whole session on mount — but nothing on Today, Food, Coach, Profile or
 * Check-in ever mentioned that a workout was open. Leave the screen and the
 * session is gone as far as the client can tell, which is the same thing as
 * losing it.
 *
 * Pure on purpose, with no database import, so every rule below can be
 * checked directly. The queries live in lib/workout.ts.
 */

/**
 * How long an unfinished workout stays resumable.
 *
 * It has to be ONE number. Resume used to look for sessions started since
 * local midnight while the auto-close swept anything started before it, so an
 * 11:30pm session was unresumable at 12:01am and then closed the next time
 * the client opened the page: two thresholds, and a gap between them where a
 * workout is alive in the table and dead on the screen.
 *
 * 18 hours covers a session that runs past midnight and an evening session
 * picked up the following morning, and still closes anything from yesterday
 * before tonight's training starts.
 */
export const STALE_AFTER_HOURS = 18

export interface ActiveWorkout {
  id: string
  /** The day as it was named when the workout started. May no longer exist. */
  dayName: string
  programName: string | null
  /** ISO timestamp. */
  startedAt: string
  /** Distinct exercises with at least one logged set, in the order logged. */
  exercisesTouched: string[]
  loggedSets: number
}

/** A day of the plan, reduced to what resuming needs. */
export interface PlanShape {
  name: string
  exercises: string[]
}

const msSince = (startedAt: string, now: number): number | null => {
  const t = Date.parse(startedAt)
  if (isNaN(t)) return null
  // Clock skew between the phone and the server is normal and must not
  // produce a negative clock.
  return Math.max(0, now - t)
}

/** True once the session has been open long enough to be abandoned rather than paused. */
export function isStale(startedAt: string, now: number = Date.now()): boolean {
  const ms = msSince(startedAt, now)
  // An unparseable timestamp is stale: it cannot be resumed meaningfully and
  // leaving it open is how rows accumulate.
  if (ms === null) return true
  return ms >= STALE_AFTER_HOURS * 3600_000
}

/**
 * The running clock, as the resume bar shows it.
 *
 * Returns null rather than "0:00" when there is nothing to show, so the bar
 * can leave the slot out instead of displaying a stopped clock.
 */
export function elapsedLabel(startedAt: string, now: number = Date.now()): string | null {
  const ms = msSince(startedAt, now)
  if (ms === null) return null
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/**
 * What the bar says this workout is.
 *
 * Counted in EXERCISES rather than sets, because "4 of 7" is a position in
 * the session and "11 of 23 sets" is a statistic. The client wants to know
 * how much is left, not how much they have done.
 */
export function progressLine(workout: ActiveWorkout, totalExercises: number): string {
  const name = workout.dayName.trim() || 'Workout'
  const done = workout.exercisesTouched.length
  // A day whose shape we cannot see — a renamed day, a deleted program —
  // still has a name worth showing. Inventing "0 of 0" would not help.
  if (totalExercises <= 0) return name
  // Touching more exercises than the day holds means the plan changed under
  // the session. Clamp rather than print "9 of 7".
  return `${name} · ${Math.min(done, totalExercises)} of ${totalExercises} exercises`
}

/** What the Abandon prompt has to say before anything is thrown away. */
export function abandonWarning(workout: ActiveWorkout): string {
  const n = workout.loggedSets
  if (n <= 0) return 'Nothing has been logged in this session yet.'
  return `${n} logged ${n === 1 ? 'set' : 'sets'} will stay in your history, and the session will be closed.`
}

/**
 * Which day of the current plan a workout should resume into.
 *
 * This used to be `findIndex(d => d.name === workout.day_name)` and a bare
 * `return` on -1: no error, no log, no UI, and a workout still open in the
 * database with nothing on screen. A client on a customised program — "Gym
 * (my version)" — only has to rename a day between starting and coming back.
 *
 * So the name is the first try and not the only one. What a session really
 * is, is the exercises that were logged in it, and those identify the day
 * even after it has been renamed.
 *
 * Returns -1 only when there is genuinely nothing to match, which the caller
 * must still handle — by showing the workout rather than discarding it.
 */
export function pickDay(dayName: string, plan: PlanShape[], exercisesTouched: string[]): number {
  if (plan.length === 0) return -1

  const exact = plan.findIndex((d) => d.name === dayName)
  if (exact !== -1) return exact

  const norm = (s: string) => s.trim().toLowerCase()
  const caseless = plan.findIndex((d) => norm(d.name) === norm(dayName))
  if (caseless !== -1) return caseless

  if (exercisesTouched.length === 0) return -1

  const logged = new Set(exercisesTouched.map(norm))
  let bestIdx = -1
  let bestHits = 0
  for (let i = 0; i < plan.length; i++) {
    let hits = 0
    for (const ex of plan[i].exercises) if (logged.has(norm(ex))) hits++
    // Strictly greater, so the earliest day wins a tie. Two days sharing a
    // squat should not send somebody to the later one on a coin toss.
    if (hits > bestHits) {
      bestHits = hits
      bestIdx = i
    }
  }
  return bestHits > 0 ? bestIdx : -1
}
