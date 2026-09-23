import { weekOf, previousWeekOf, type CheckIn } from '@/lib/check-ins'

/**
 * Triage for the coach dashboard.
 *
 * The dashboard previously showed active clients, pending applications and
 * revenue — business numbers, not coaching ones. Finding out who was struggling
 * meant opening every client in turn, which does not survive a growing roster.
 *
 * Order matters: a client can be several of these at once, and the status shown
 * is the one that most needs the coach to do something.
 */
export type ClientStatus = 'review_needed' | 'at_risk' | 'needs_attention' | 'check_in_due' | 'on_track'

export const STATUS_META: Record<ClientStatus, { label: string; tone: string; dot: string }> = {
  review_needed: { label: 'Review needed', tone: 'text-brand-blue', dot: 'bg-brand-blue' },
  at_risk: { label: 'At risk', tone: 'text-state-danger', dot: 'bg-state-danger' },
  needs_attention: { label: 'Needs attention', tone: 'text-state-warning', dot: 'bg-state-warning' },
  check_in_due: { label: 'Check-in due', tone: 'text-white/60', dot: 'bg-white/40' },
  on_track: { label: 'On track', tone: 'text-state-success', dot: 'bg-state-success' },
}

export interface StatusInput {
  /** Users on a coached tier are expected to check in; Blueprint clients are not. */
  coached: boolean
  lastWorkoutAt: string | null
  checkIns: CheckIn[]
}

export interface StatusResult {
  status: ClientStatus
  /** One line naming the actual trigger, so the coach knows why without digging. */
  reason: string
}

const daysSince = (iso: string | null): number | null =>
  iso == null ? null : Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)

export function clientStatus({ coached, lastWorkoutAt, checkIns }: StatusInput): StatusResult {
  const sorted = [...checkIns].sort((a, b) => b.week_of.localeCompare(a.week_of))
  const thisWeek = weekOf()
  const lastWeek = previousWeekOf(thisWeek)
  const sinceWorkout = daysSince(lastWorkoutAt)

  // 1. Waiting on the coach beats everything — this is the coach's own backlog.
  const awaiting = sorted.find((c) => !c.coach_response)
  if (awaiting) {
    const d = daysSince(awaiting.submitted_at) ?? 0
    return {
      status: 'review_needed',
      reason: d <= 0 ? 'Checked in today' : `Checked in ${d}d ago, no reply yet`,
    }
  }

  // 2. Gone quiet. Ten days covers a missed week plus grace on any split.
  if (sinceWorkout == null) {
    return { status: 'at_risk', reason: 'Has never logged a workout' }
  }
  if (sinceWorkout >= 10) {
    return { status: 'at_risk', reason: `No workout logged in ${sinceWorkout} days` }
  }
  if (coached && !sorted.some((c) => c.week_of === lastWeek || c.week_of === thisWeek)) {
    return { status: 'at_risk', reason: 'Missed the last two check-ins' }
  }

  // 3. Training, but something in the last check-in needs a response.
  const latest = sorted[0]
  if (latest) {
    if (latest.energy != null && latest.energy <= 2) {
      return { status: 'needs_attention', reason: `Energy ${latest.energy}/5 at last check-in` }
    }
    if (latest.nutrition_adherence != null && latest.nutrition_adherence <= 2) {
      return { status: 'needs_attention', reason: `Nutrition ${latest.nutrition_adherence}/5 at last check-in` }
    }
    // Three consecutive weeks within a pound is a stall worth a conversation,
    // whichever direction they were aiming for.
    const weights = sorted.slice(0, 3).map((c) => c.weight_lb).filter((w): w is number => w != null)
    if (weights.length === 3 && Math.abs(Number(weights[0]) - Number(weights[2])) < 1) {
      return { status: 'needs_attention', reason: 'Weight flat for three weeks' }
    }
  }
  if (sinceWorkout >= 5) {
    return { status: 'needs_attention', reason: `Last workout ${sinceWorkout} days ago` }
  }

  // 4. Nothing wrong, but this week's check-in has not arrived yet.
  if (coached && !sorted.some((c) => c.week_of === thisWeek)) {
    return { status: 'check_in_due', reason: 'No check-in for this week yet' }
  }

  return { status: 'on_track', reason: 'Training and checking in' }
}

/** Sort key so the dashboard leads with whatever needs the coach first. */
export const STATUS_ORDER: ClientStatus[] = [
  'review_needed',
  'at_risk',
  'needs_attention',
  'check_in_due',
  'on_track',
]
