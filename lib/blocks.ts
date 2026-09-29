import type { ExerciseSession } from '@/lib/workout'

/**
 * Training blocks: giving a program a finish line.
 *
 * Before this, an assignment ran until the client chose something else. No
 * week was counted, nothing ended, and nobody was ever asked how it went —
 * clients sat on one template for between nine and forty-one days without a
 * single check on whether it was working.
 *
 * A block is eight weeks. Long enough for double progression to show
 * something, short enough that nobody is ever more than two months away from a
 * fresh look at their goal.
 *
 * Everything here is pure: dates and numbers in, a verdict out. The database
 * work lives in lib/programs.ts so these rules can be tested without one.
 */

const DAY = 86400000

export interface BlockProgress {
  /** 1-based. Week 1 is the first seven days. */
  week: number
  totalWeeks: number
  /** 0-1, clamped. */
  fraction: number
  daysIn: number
  daysLeft: number
  /** Past the final day: time for the review. */
  isComplete: boolean
  /** Final week, so a coach can be queued before it ends rather than after. */
  isFinalWeek: boolean
  /** YYYY-MM-DD the block finishes. */
  endsOn: string
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

export function blockProgress(
  assignedAt: string | Date,
  blockWeeks = 8,
  now: Date = new Date()
): BlockProgress {
  const start = new Date(assignedAt)
  const totalDays = blockWeeks * 7
  // Whole days elapsed. Day 0 is the assignment day itself, which is week 1.
  const daysIn = Math.max(0, Math.floor((now.getTime() - start.getTime()) / DAY))
  const week = Math.min(blockWeeks, Math.floor(daysIn / 7) + 1)
  const end = new Date(start.getTime() + totalDays * DAY)
  return {
    week,
    totalWeeks: blockWeeks,
    fraction: Math.max(0, Math.min(1, daysIn / totalDays)),
    daysIn,
    daysLeft: Math.max(0, totalDays - daysIn),
    isComplete: daysIn >= totalDays,
    isFinalWeek: week === blockWeeks && daysIn < totalDays,
    endsOn: iso(end),
  }
}

/* -------------------------------------------------------------------------- */

export interface LiftChange {
  exercise: string
  first: number
  last: number
  /** Signed pounds. */
  change: number
  sessions: number
}

export interface BlockReview {
  weeks: number
  sessions: number
  /** Sessions per week, to one decimal. */
  perWeek: number
  lifts: LiftChange[]
  improved: number
  held: number
  declined: number
  /** Signed pounds, or null when there is no weight history either side. */
  weightChangeLb: number | null
  /** Plain-language summary the client reads first. */
  headline: string
}

/**
 * Build the end-of-block review from data already stored.
 *
 * Nothing here is new information — every number comes from sets the client
 * logged and weigh-ins they entered. The value is entirely in putting eight
 * weeks of it in one place, which is the moment the product earns its keep.
 */
export function buildReview(input: {
  blockWeeks: number
  sessionCount: number
  /** Per-exercise session history, newest first, as fetchExerciseHistory returns. */
  history: Record<string, ExerciseSession[]>
  /** Only sessions inside the block should be passed in. */
  startWeightLb?: number | null
  endWeightLb?: number | null
}): BlockReview {
  const lifts: LiftChange[] = []

  for (const [exercise, sessions] of Object.entries(input.history)) {
    const usable = sessions.filter((s) => s.topWeight > 0)
    if (usable.length < 2) continue
    // history arrives newest-first
    const last = usable[0]
    const first = usable[usable.length - 1]
    lifts.push({
      exercise,
      first: first.topWeight,
      last: last.topWeight,
      change: Math.round((last.topWeight - first.topWeight) * 10) / 10,
      sessions: usable.length,
    })
  }

  lifts.sort((a, b) => b.change - a.change)
  const improved = lifts.filter((l) => l.change > 0).length
  const declined = lifts.filter((l) => l.change < 0).length
  const held = lifts.length - improved - declined

  const perWeek =
    input.blockWeeks > 0 ? Math.round((input.sessionCount / input.blockWeeks) * 10) / 10 : 0

  const weightChangeLb =
    input.startWeightLb != null && input.endWeightLb != null
      ? Math.round((input.endWeightLb - input.startWeightLb) * 10) / 10
      : null

  return {
    weeks: input.blockWeeks,
    sessions: input.sessionCount,
    perWeek,
    lifts,
    improved,
    held,
    declined,
    weightChangeLb,
    headline: headlineFor({ sessions: input.sessionCount, perWeek, improved, held, declined, lifts }),
  }
}

function headlineFor(x: {
  sessions: number
  perWeek: number
  improved: number
  held: number
  declined: number
  lifts: LiftChange[]
}): string {
  if (x.sessions === 0) {
    return 'This block did not really get going. No sessions logged, so there is nothing to measure — and that is worth a conversation rather than another program.'
  }
  if (x.perWeek < 1.5) {
    return `You trained ${x.sessions} times across the block, which is under twice a week. The programming was not the limiting factor here; getting in the door was.`
  }
  const best = x.lifts[0]
  if (x.improved > 0 && x.improved >= x.declined * 2 && best) {
    return `Good block. ${x.improved} of your ${x.lifts.length} lifts went up, led by ${best.exercise} at +${best.change} lbs, across ${x.sessions} sessions.`
  }
  if (x.declined > x.improved) {
    return `More lifts went down than up this block. That usually means recovery, food or life rather than the program — worth looking at before changing the training.`
  }
  return `A steady block: ${x.sessions} sessions, ${x.improved} lifts up and ${x.held} holding. Progress at this stage is measured in months, not weeks.`
}

/* -------------------------------------------------------------------------- */

export type NextBlockAction =
  | 'repeat_same'
  | 'progress_harder'
  | 'change_stimulus'
  | 'reduce_days'
  | 'reassess_goal'

export interface NextBlockSuggestion {
  action: NextBlockAction
  title: string
  detail: string
}

/**
 * What to do after the block, from how the block actually went.
 *
 * Attendance is read before performance, always. A client who trained six
 * times in eight weeks does not have a programming problem, and offering them
 * a cleverer split is answering a question they did not ask.
 */
export function recommendNextBlock(review: BlockReview): NextBlockSuggestion {
  if (review.perWeek < 1.5) {
    return {
      action: 'reduce_days',
      title: 'Try fewer days',
      detail:
        'A three-day block you finish beats a five-day block you abandon. Same goal, fewer sessions, and we build from there.',
    }
  }

  if (review.lifts.length === 0) {
    return {
      action: 'repeat_same',
      title: 'Run it again',
      detail:
        'Not enough repeated lifts to judge the block yet. Another eight weeks on the same program will give us something to read.',
    }
  }

  if (review.declined > review.improved) {
    return {
      action: 'reassess_goal',
      title: 'Let us look at this together',
      detail:
        'More lifts went down than up. That is usually recovery, food or stress rather than the training, so changing the program is probably the wrong lever.',
    }
  }

  if (review.improved >= review.lifts.length * 0.6) {
    return {
      action: 'progress_harder',
      title: 'Step it up',
      detail:
        'Most of your lifts moved and you showed up. You can handle more: another block on this, or an extra day if you want it.',
    }
  }

  if (review.held >= review.improved) {
    return {
      action: 'change_stimulus',
      title: 'Change the stimulus',
      detail:
        'Plenty of lifts held their ground rather than moving. Same goal, different split — a fresh set of movements usually restarts progress faster than grinding the same ones.',
    }
  }

  return {
    action: 'repeat_same',
    title: 'One more block',
    detail:
      'This is working. Same goal, same program, eight more weeks — expect progress to come slower this time, which is normal rather than a problem.',
  }
}
