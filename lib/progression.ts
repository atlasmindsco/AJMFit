import type { LastSet } from '@/lib/workout'

/**
 * Progression rules for the Blueprint program library.
 *
 * The library previously had none: no percentages, no RPE or RIR target, no
 * week-to-week rule and no deload. It prescribed sets and reps and left the
 * client to guess what to do in week four that they had not done in week one,
 * which is the difference between a program and a list of workouts.
 *
 * The model is double progression, chosen because it needs no training max,
 * no percentage tables and no testing session — a self-guided client can
 * follow it unsupervised, which is the constraint that matters for this tier.
 */

export type ProgressionGoal = 'strength' | 'muscle' | 'lean_out'

export interface GoalProgression {
  /** One line the client sees on their program. */
  rule: string
  /** How hard to push a working set. */
  effort: string
  /** Fatigue management. */
  deload: string
  /** Typical jump once the top of the range is earned, in lbs. */
  upperIncrementLb: number
  lowerIncrementLb: number
}

export const PROGRESSION: Record<ProgressionGoal, GoalProgression> = {
  strength: {
    rule: 'Hit every prescribed rep on all sets, then add weight next session.',
    effort: 'Leave 1–2 reps in reserve on working sets. Never grind to failure on the main lifts.',
    deload: 'Every 5th week, cut to 2 sets per exercise at the same weight.',
    upperIncrementLb: 5,
    lowerIncrementLb: 10,
  },
  muscle: {
    rule: 'Work to the top of the rep range on every set, then add weight and start again at the bottom.',
    effort: 'Take working sets to 1–3 reps in reserve. The last rep should be hard, not a grind.',
    deload: 'Every 6th week, cut your sets roughly in half and keep the weight the same.',
    upperIncrementLb: 5,
    lowerIncrementLb: 10,
  },
  lean_out: {
    rule: 'Hold the weight and beat your reps or your rest time before you add load.',
    effort: 'Stop 2–3 reps short of failure. The goal is quality work you can repeat.',
    deload: 'Every 6th week, drop to 2 sets per exercise and keep moving.',
    upperIncrementLb: 5,
    lowerIncrementLb: 10,
  },
}

/** "12-15" -> {min:12,max:15}; "8" -> {min:8,max:8}. */
export function parseRepRange(reps: string): { min: number; max: number } | null {
  const m = String(reps ?? '').match(/(\d+)\s*(?:[-–]\s*(\d+))?/)
  if (!m) return null
  const min = parseInt(m[1], 10)
  const max = m[2] ? parseInt(m[2], 10) : min
  if (!Number.isFinite(min)) return null
  return { min, max }
}

/** Upper-body lifts take smaller jumps than lower-body ones. */
function isLowerBody(exerciseName: string): boolean {
  return /squat|deadlift|lunge|leg press|hip thrust|calf|leg curl|leg extension|glute|split squat|step.?up/i.test(
    exerciseName
  )
}

export interface NextTarget {
  /** Short instruction for this exercise today. */
  text: string
  /** True when last session earned a load increase. */
  addLoad: boolean
}

/**
 * What this client should aim for on this exercise today, based on what they
 * did last time. Returns null when there is no history to compare against —
 * the first session on a lift is just about establishing a working weight.
 */
export function nextTarget(
  exerciseName: string,
  reps: string,
  goal: ProgressionGoal,
  lastSets: LastSet[] | undefined
): NextTarget | null {
  const range = parseRepRange(reps)
  const done = (lastSets ?? []).filter((s) => s && s.reps != null && s.weight != null)
  if (!range || done.length === 0) return null

  const cfg = PROGRESSION[goal]
  const jump = isLowerBody(exerciseName) ? cfg.lowerIncrementLb : cfg.upperIncrementLb
  const topWeight = Math.max(...done.map((s) => Number(s.weight) || 0))
  const hitTopOnEverySet = done.every((s) => (Number(s.reps) || 0) >= range.max)

  if (hitTopOnEverySet && topWeight > 0) {
    const target = topWeight + jump
    return {
      addLoad: true,
      text:
        range.min === range.max
          ? `You hit all ${range.max}s last time — go up to ${target} lbs.`
          : `You topped the range last time — go up to ${target} lbs and start again at ${range.min}.`,
    }
  }

  const weakest = Math.min(...done.map((s) => Number(s.reps) || 0))
  return {
    addLoad: false,
    text:
      range.min === range.max
        ? `Stay at ${topWeight} lbs and get all ${range.max}s. Lowest set last time was ${weakest}.`
        : `Stay at ${topWeight} lbs and push toward ${range.max}. Lowest set last time was ${weakest}.`,
  }
}
