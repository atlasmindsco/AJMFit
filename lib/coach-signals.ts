/**
 * The coaching signals the app works out and then keeps to itself.
 *
 * The progression engine decides, every time a client opens an exercise,
 * whether that lift is climbing, flat or going backwards. Two of its verdicts
 * are the moments a coach earns their fee:
 *
 *   cut_back        — this lift has gone backwards three sessions running
 *   change_exercise — stuck at the same weight for several sessions AND
 *                     reporting nothing left in the tank, which is the
 *                     difference between an effort problem and a real plateau
 *
 * Both are computed. Both produce a sentence for the client. Neither has ever
 * reached Anthony, so the one client who turns up reliably and gets nowhere is
 * also the one client no surface in the app flags — every obvious number about
 * them looks fine.
 *
 * This runs the same engine over the same history, server-side, so the verdicts
 * can be ranked on the coach dashboard.
 */

import { nextTarget, type ExperienceLevel, type ProgressionGoal } from '@/lib/progression'
import type { ExerciseSession } from '@/lib/workout'

export interface StalledLift {
  exerciseName: string
  /** 'cut_back' | 'change_exercise' */
  verdict: string
  /** The engine's own sentence, so the coach reads what the client read. */
  text: string
  /** Most recent top set, for context in a list. */
  lastWeight: number
  lastReps: number
  /** Days since that session. */
  daysSince: number
}

/** Only these two verdicts are worth a coach's attention. */
const COACH_VERDICTS = new Set(['cut_back', 'change_exercise'])

export interface StallInput {
  /** Exercise name to its sessions, newest first. */
  history: Record<string, ExerciseSession[]>
  /** The rep range each exercise is prescribed at, when known. */
  prescriptions?: Record<string, string>
  level?: ExperienceLevel
  goal?: ProgressionGoal
  bodyWeightLb?: number | null
}

/**
 * Lifts that need a decision, worst first.
 *
 * A lift nobody has touched in a fortnight is not a stall, it is part of a
 * quiet client, and that is already a separate and louder signal.
 *
 * Thirteen days rather than a rounder number because the progression engine
 * treats a 14-day gap as a layoff and returns `returning` for anything older,
 * which can never be `cut_back` or `change_exercise`. Setting this any higher
 * would silently filter to nothing. Tested, because the first version used 21
 * and found no stalls at all between days 14 and 21.
 */
const STALE_AFTER_DAYS = 13

export function stalledLifts(input: StallInput): StalledLift[] {
  const { history, prescriptions = {}, level = 'beginner', goal = 'muscle', bodyWeightLb = null } = input
  const out: StalledLift[] = []

  for (const [exerciseName, sessions] of Object.entries(history)) {
    const latest = sessions[0]
    if (!latest) continue

    const daysSince = Math.max(
      0,
      Math.round((Date.now() - Date.parse(latest.date + 'T00:00:00')) / 86400000)
    )
    if (daysSince > STALE_AFTER_DAYS) continue

    // Without the real prescription the engine cannot tell "topped the range"
    // from "still climbing", so the two verdicts we want would never fire
    // correctly. 8-10 is the most common range in the library and the least
    // wrong default.
    const reps = prescriptions[exerciseName] ?? '8-10'

    const t = nextTarget(
      exerciseName,
      reps,
      { goal, level, daysSinceLast: daysSince, bodyWeightLb },
      sessions
    )
    if (!t || !COACH_VERDICTS.has(t.verdict)) continue

    out.push({
      exerciseName,
      verdict: t.verdict,
      text: t.text,
      lastWeight: latest.topWeight,
      lastReps: latest.topReps,
      daysSince,
    })
  }

  // A lift going backwards outranks one that is merely stuck, and within each,
  // the one trained most recently is the one still happening.
  const rank = (v: string) => (v === 'cut_back' ? 0 : 1)
  return out.sort((a, b) => rank(a.verdict) - rank(b.verdict) || a.daysSince - b.daysSince)
}

/**
 * Group raw set rows into per-client, per-exercise session histories.
 *
 * Shaped the same way the progression engine already expects, so the coach side
 * and the client side read the identical thing. Intensity sets are excluded for
 * the same reason the engine excludes them: a drop set is not a working set and
 * reading it as one makes every exercise look like it went backwards.
 */
export function historyFromSets(
  rows: Array<{
    user_id: string
    exercise_name: string
    weight: number | string | null
    reps: number | string | null
    rir: number | null
    workout_id: string
    is_intensity_set?: boolean | null
  }>,
  dateOfWorkout: Record<string, string>
): Record<string, Record<string, ExerciseSession[]>> {
  const byUser: Record<string, Record<string, Record<string, Array<{ w: number; r: number; rir: number | null }>>>> = {}

  for (const row of rows) {
    if (row.is_intensity_set) continue
    const w = Number(row.weight)
    const r = Number(row.reps)
    if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) continue
    const date = dateOfWorkout[row.workout_id]
    if (!date) continue
    const byExercise = (byUser[row.user_id] ??= {})
    const byDate = (byExercise[row.exercise_name] ??= {})
    ;(byDate[date] ??= []).push({ w, r, rir: row.rir })
  }

  const out: Record<string, Record<string, ExerciseSession[]>> = {}
  for (const [userId, byExercise] of Object.entries(byUser)) {
    const perExercise: Record<string, ExerciseSession[]> = {}
    for (const [exercise, byDate] of Object.entries(byExercise)) {
      perExercise[exercise] = Object.entries(byDate)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, sets]) => {
          const top = sets.reduce((best, s) => (s.w > best.w ? s : best))
          return {
            date,
            topWeight: top.w,
            topReps: top.r,
            lowestReps: Math.min(...sets.map((s) => s.r)),
            rir: top.rir,
          } as ExerciseSession
        })
    }
    out[userId] = perExercise
  }
  return out
}

/** One line for the dashboard, naming the lift rather than the verdict. */
export function stallSummary(lifts: StalledLift[]): string | null {
  if (lifts.length === 0) return null
  const first = lifts[0]
  const what = first.verdict === 'cut_back' ? 'going backwards' : 'stuck'
  if (lifts.length === 1) return `${first.exerciseName} ${what} at ${first.lastWeight} lb`
  return `${first.exerciseName} ${what}, +${lifts.length - 1} more`
}
