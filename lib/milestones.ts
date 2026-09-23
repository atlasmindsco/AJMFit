import type { BodyMetric } from '@/lib/body-metrics'
import type { PRRow } from '@/lib/workout'

/**
 * Milestones worth telling a client about.
 *
 * Derived from what they have actually done rather than stored, so there is
 * nothing to keep in sync and no way for the two to disagree.
 *
 * Deliberately not gamified. No points, no badges, no streak that punishes a
 * rest day — every one of these marks a real training outcome, because a
 * reward for something that did not matter teaches the client that none of
 * the rewards mean anything.
 */
export interface Milestone {
  key: string
  label: string
  detail: string
  /** Most recently earned first. */
  achievedAt: string | null
}

export interface MilestoneInput {
  workoutCount: number
  firstWorkoutAt: string | null
  prs: PRRow[]
  weekStreak: number
  metrics: BodyMetric[]
}

const WORKOUT_TIERS = [10, 25, 50, 100, 200]

export function milestones({
  workoutCount,
  firstWorkoutAt,
  prs,
  weekStreak,
  metrics,
}: MilestoneInput): Milestone[] {
  const out: Milestone[] = []

  if (workoutCount > 0 && firstWorkoutAt) {
    out.push({
      key: 'first-workout',
      label: 'First session logged',
      detail: 'The hardest one to start.',
      achievedAt: firstWorkoutAt,
    })
  }

  for (const n of WORKOUT_TIERS) {
    if (workoutCount >= n) {
      out.push({
        key: `workouts-${n}`,
        label: `${n} sessions`,
        detail: n >= 100 ? 'That is a training habit, not a phase.' : 'Consistency is the whole game.',
        achievedAt: null,
      })
    }
  }

  // Beating a previous best, not simply the first time an exercise was logged.
  const realPRs = prs.filter((p) => p.previous_weight != null)
  if (realPRs.length > 0) {
    const latest = [...realPRs].sort((a, b) => +new Date(b.set_at) - +new Date(a.set_at))[0]
    out.push({
      key: 'first-pr',
      label: realPRs.length === 1 ? 'First personal record' : `${realPRs.length} personal records`,
      detail: `Most recent: ${latest.exercise_name} at ${Number(latest.weight)} lbs.`,
      achievedAt: latest.set_at,
    })
  }

  if (weekStreak >= 4) {
    out.push({
      key: `streak-${weekStreak}`,
      label: `${weekStreak} weeks straight`,
      detail: 'Turning up every week is what actually moves things.',
      achievedAt: null,
    })
  }

  // Weight movement in either direction — the goal decides which is good, and
  // the app should not assume.
  const weighed = metrics.filter((m) => m.weight_lb != null)
  if (weighed.length >= 2) {
    const newest = Number(weighed[0].weight_lb)
    const oldest = Number(weighed[weighed.length - 1].weight_lb)
    const delta = Math.abs(newest - oldest)
    for (const n of [5, 10, 20, 30]) {
      if (delta >= n) {
        out.push({
          key: `weight-${n}`,
          label: `${n} lbs ${newest < oldest ? 'down' : 'up'}`,
          detail: `Since your first weigh-in on ${new Date(
            weighed[weighed.length - 1].recorded_on + 'T00:00:00'
          ).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`,
          achievedAt: weighed[0].recorded_on,
        })
      }
    }
  }

  return out
}
