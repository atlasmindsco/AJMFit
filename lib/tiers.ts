import type { Tier } from '@/lib/stripe/catalog'

/**
 * EVERY LINE HERE IS SHOWN TO A PAYING CLIENT, SO EVERY LINE HAS TO BE TRUE.
 *
 * Three of the Full Experience bullets were not. They described behaviour
 * nothing in the codebase implemented, and an audit found each of their flags
 * with zero consumers:
 *
 *   "rebuilt every four weeks"      block_weeks defaults to 8 and nothing
 *                                   sets it per tier. The library's programs
 *                                   are designed as eight-week blocks — the
 *                                   promise contradicted the product rather
 *                                   than outrunning it, so the copy was the
 *                                   thing that was wrong.
 *
 *   "plus a mid-week pulse"         Nothing sent one. The midWeekPulse flag
 *                                   is gone rather than left sitting there
 *                                   looking implemented.
 *
 *   "monthly written progress       Nothing produced one, and no screen
 *    review"                        showed one.
 *
 * What stayed, and why it is honest: the response windows are enforced — a
 * client past them is flagged overdue on the coach dashboard. "Anthony
 * reaches out when something slips" is carried by the daily digest, which
 * names who has gone quiet, and by the never_started and at_risk statuses.
 * The calls are real Calendly quotas. Program review is a commitment Anthony
 * keeps rather than something the app does, and it is written that way.
 *
 * IF FULL EXPERIENCE IS SOLD, these are the three things to build before
 * promising them again: a shorter block for that tier, a mid-week prompt in
 * the reminders cron, and something that actually generates a monthly review.
 * There are no clients on that tier today, which is the only reason this is a
 * copy change rather than a feature.
 *
 * The public pricing page is a separate matter and deliberately untouched: it
 * sells a coaching service Anthony delivers in person. This file describes
 * what the PRODUCT does for someone already paying.
 *
 * What each tier actually commits to.
 *
 * Nothing in the app previously distinguished Accelerator from Full
 * Experience: every tier check in the codebase was `=== 'blueprint'` or
 * `!== 'blueprint'`, and the only real difference lived in the Calendly quota.
 * A $300/month gap was expressed entirely as two extra bookable calls.
 *
 * The difference should be cadence, depth and who moves first — not a longer
 * feature list. These values are the single source for what the client is
 * promised and what the coach is held to.
 */
export interface TierExperience {
  /** Shown to the client so the deal is explicit. */
  headline: string
  /**
   * Hours the coach commits to replying within. Null = best effort.
   * Enforced: lib/client-status.ts flags a client overdue on the coach
   * dashboard once this is exceeded.
   */
  responseHours: number | null
  /** Does this tier check in weekly? Drives the prompt on the home screen. */
  weeklyCheckIn: boolean
  /**
   * Coach reaches out on a flag rather than waiting to be messaged.
   * Realised by the daily digest, which names who has gone quiet, plus the
   * never_started / at_risk statuses on the dashboard.
   */
  coachInitiates: boolean
  /** How often the program is revisited. A commitment Anthony keeps, not automation. */
  programReview: string
  /** Bullets for the client's own "what your plan includes" panel. */
  includes: string[]
}

export const TIER_EXPERIENCE: Record<Tier, TierExperience> = {
  blueprint: {
    headline: 'Self-guided training with the full app.',
    responseHours: null,
    weeklyCheckIn: false,
    coachInitiates: false,
    programReview: 'Change your program yourself, any time',
    includes: [
      'Pick any program in the library, or build your own',
      'Workout logging, nutrition tracking and progress',
      'Message Anthony Monday to Friday',
    ],
  },
  accelerator: {
    headline: 'A program built for you, and someone who notices whether you do it.',
    responseHours: 48,
    weeklyCheckIn: true,
    coachInitiates: false,
    programReview: 'Reviewed at every check-in, and at the end of each block',
    includes: [
      'Anthony assigns and adjusts your program',
      'Weekly check-in with a written reply within 48 hours',
      'Welcome call and a weekly call',
      'Nutrition targets set and adjusted for you',
    ],
  },
  'full-experience': {
    headline: 'Anthony moves first, and your program changes as you do.',
    responseHours: 24,
    weeklyCheckIn: true,
    coachInitiates: true,
    programReview: 'Reviewed at every check-in, and rebuilt at the end of each block',
    includes: [
      'A program built for you, reviewed every week against what you logged',
      'Weekly check-in with a written reply within 24 hours',
      'Anthony reaches out when something slips — you do not have to ask',
      'Welcome call, weekly call and two live training sessions',
      'Nutrition targets reviewed weekly against your actual weight trend',
    ],
  },
}

export function isCoached(tier: Tier | null | undefined): boolean {
  return tier === 'accelerator' || tier === 'full-experience'
}
