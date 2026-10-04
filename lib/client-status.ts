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
export type ClientStatus =
  | 'review_needed'
  | 'never_started'
  | 'at_risk'
  | 'needs_attention'
  | 'check_in_due'
  | 'on_track'

export const STATUS_META: Record<ClientStatus, { label: string; tone: string; dot: string }> = {
  review_needed: { label: 'Review needed', tone: 'text-brand-blue', dot: 'bg-brand-blue' },
  never_started: { label: 'Never started', tone: 'text-state-danger', dot: 'bg-state-danger' },
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
  /**
   * Days until this client's training block ends, when one is running.
   *
   * Surfaced BEFORE the block finishes rather than after, so the next one is
   * ready on the day. A coached client who reaches their final session and
   * then waits a week for their coach to decide what is next has been handed
   * the dead end this whole feature exists to remove.
   */
  blockEndsInDays?: number | null
  /**
   * When this client signed up, so a brand-new account is not confused with
   * someone who paid and then never came back.
   */
  signedUpAt?: string | null
  /**
   * Lifts the progression engine has called stuck or declining.
   *
   * The engine works this out every time a client opens the exercise and has
   * never told the coach. It is the only signal here that catches a client who
   * turns up reliably and gets nowhere — every other number about them looks
   * fine, which is exactly why they quit without warning.
   */
  stalledLifts?: Array<{ exerciseName: string; verdict: string }>
  /**
   * Hours this client's tier promised a reply within, from TIER_EXPERIENCE.
   * Null for Blueprint, which promises best effort.
   */
  responseHours?: number | null
}

export interface StatusResult {
  status: ClientStatus
  /** One line naming the actual trigger, so the coach knows why without digging. */
  reason: string
}

const hoursSince = (iso: string | null): number | null =>
  iso == null ? null : Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)

const daysSince = (iso: string | null): number | null =>
  iso == null ? null : Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)

/**
 * A new account gets this long to log its first session before it is a problem.
 *
 * Shorter than the 10-day quiet rule on purpose. Someone who has trained for
 * two months and then stopped has a motivation or life problem and the program
 * is waiting for them. Someone who has never started usually has a SETUP
 * problem — they could not find it, the program was not assigned, the first
 * session did not make sense — and every day that goes unanswered makes it
 * less likely they ever begin. The fix is also completely different, which is
 * why the two share a severity but not a status.
 */
const NEVER_STARTED_GRACE_DAYS = 3

export function clientStatus({
  coached,
  lastWorkoutAt,
  checkIns,
  blockEndsInDays,
  signedUpAt,
  stalledLifts,
  responseHours,
}: StatusInput): StatusResult {
  const sorted = [...checkIns].sort((a, b) => b.week_of.localeCompare(a.week_of))
  const thisWeek = weekOf()
  const lastWeek = previousWeekOf(thisWeek)
  const sinceWorkout = daysSince(lastWorkoutAt)

  // 1. Waiting on the coach beats everything — this is the coach's own backlog.
  //
  // Measured against what the TIER promised, not a flat number. Accelerator
  // sells a reply within 48 hours and Full Experience within 24; both are
  // displayed to the client and neither was ever checked, so the promise could
  // be broken with nothing anywhere saying so.
  const awaiting = sorted.find((c) => !c.coach_response)
  if (awaiting) {
    const d = daysSince(awaiting.submitted_at) ?? 0
    const hrs = hoursSince(awaiting.submitted_at)
    const overdue = responseHours != null && hrs != null && hrs > responseHours
    return {
      status: 'review_needed',
      reason: overdue
        ? `Checked in ${d}d ago — past the ${responseHours}h promised`
        : d <= 0
          ? 'Checked in today'
          : `Checked in ${d}d ago, no reply yet`,
    }
  }

  // 2. Never began. Distinct from going quiet because the conversation is
  // different: "did you get stuck setting up" rather than "how's it going".
  if (sinceWorkout == null) {
    const age = daysSince(signedUpAt ?? null)
    if (age != null && age < NEVER_STARTED_GRACE_DAYS) {
      return { status: 'on_track', reason: `Joined ${age === 0 ? 'today' : `${age}d ago`}, not started yet` }
    }
    return {
      status: 'never_started',
      reason: age == null ? 'Has never logged a workout' : `Joined ${age} days ago, never trained`,
    }
  }
  if (sinceWorkout >= 10) {
    return { status: 'at_risk', reason: `No workout logged in ${sinceWorkout} days` }
  }
  if (coached && !sorted.some((c) => c.week_of === lastWeek || c.week_of === thisWeek)) {
    return { status: 'at_risk', reason: 'Missed the last two check-ins' }
  }

  // 3. A coached client's block is about to end and needs a decision.
  //
  // Sits above the check-in signals because it has a deadline the others do
  // not: those can be answered tomorrow, and this one stops being useful the
  // moment the client finishes their last session.
  if (coached && blockEndsInDays != null && blockEndsInDays >= 0 && blockEndsInDays <= 7) {
    return {
      status: 'needs_attention',
      reason:
        blockEndsInDays === 0
          ? 'Training block ends today — next block needed'
          : `Training block ends in ${blockEndsInDays} days — decide what is next`,
    }
  }

  // 4. Training, but something in the last check-in needs a response.
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

  // 5. Training hard and going nowhere.
  //
  // Below the check-in signals because those carry a client's own words, which
  // outrank an inference. Above the "quiet 5 days" nudge because this one does
  // not resolve itself: a client who is turning up is not going to notice the
  // plateau, and will quit over it without ever mentioning it.
  const declining = (stalledLifts ?? []).filter((l) => l.verdict === 'cut_back')
  if (declining.length > 0) {
    return {
      status: 'needs_attention',
      reason:
        declining.length === 1
          ? `${declining[0].exerciseName} going backwards`
          : `${declining.length} lifts going backwards`,
    }
  }
  const stuck = (stalledLifts ?? []).filter((l) => l.verdict === 'change_exercise')
  if (stuck.length > 0) {
    return {
      status: 'needs_attention',
      reason: stuck.length === 1 ? `${stuck[0].exerciseName} stalled` : `${stuck.length} lifts stalled`,
    }
  }

  if (sinceWorkout >= 5) {
    return { status: 'needs_attention', reason: `Last workout ${sinceWorkout} days ago` }
  }

  // 6. Nothing wrong, but this week's check-in has not arrived yet.
  if (coached && !sorted.some((c) => c.week_of === thisWeek)) {
    return { status: 'check_in_due', reason: 'No check-in for this week yet' }
  }

  return { status: 'on_track', reason: 'Training and checking in' }
}

/** Sort key so the dashboard leads with whatever needs the coach first. */
export const STATUS_ORDER: ClientStatus[] = [
  'review_needed',
  'never_started',
  'at_risk',
  'needs_attention',
  'check_in_due',
  'on_track',
]
