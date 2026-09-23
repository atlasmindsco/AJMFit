import type { Tier } from '@/lib/stripe/catalog'

/**
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
  /** Hours the coach commits to replying within. Null = best effort. */
  responseHours: number | null
  /** Does this tier check in weekly? */
  weeklyCheckIn: boolean
  /** A short mid-week nudge on top of the weekly check-in. */
  midWeekPulse: boolean
  /** Coach reaches out on a flag rather than waiting to be messaged. */
  coachInitiates: boolean
  /** How often the program is revisited. */
  programReview: string
  /** Bullets for the client's own "what your plan includes" panel. */
  includes: string[]
}

export const TIER_EXPERIENCE: Record<Tier, TierExperience> = {
  blueprint: {
    headline: 'Self-guided training with the full app.',
    responseHours: null,
    weeklyCheckIn: false,
    midWeekPulse: false,
    coachInitiates: false,
    programReview: 'Change your program yourself, any time',
    includes: [
      'Pick from the full program library',
      'Workout logging, nutrition tracking and progress',
      'Message Anthony Monday to Friday',
    ],
  },
  accelerator: {
    headline: 'A program built for you, and someone who notices whether you do it.',
    responseHours: 48,
    weeklyCheckIn: true,
    midWeekPulse: false,
    coachInitiates: false,
    programReview: 'Reviewed monthly, or sooner if a check-in calls for it',
    includes: [
      'Anthony assigns and adjusts your program',
      'Weekly check-in with a written reply within 48 hours',
      'Welcome call and a weekly call',
      'Nutrition targets set and adjusted for you',
    ],
  },
  'full-experience': {
    headline: 'Your program is rebuilt around you as you change, and Anthony moves first.',
    responseHours: 24,
    weeklyCheckIn: true,
    midWeekPulse: true,
    coachInitiates: true,
    programReview: 'Rebuilt every four weeks',
    includes: [
      'A program built for you and rebuilt every four weeks',
      'Weekly check-in plus a mid-week pulse',
      'Written reply within 24 hours',
      'Anthony reaches out when something slips — you do not have to ask',
      'Welcome call, weekly call and two live training sessions',
      'Monthly written progress review',
    ],
  },
}

export function isCoached(tier: Tier | null | undefined): boolean {
  return tier === 'accelerator' || tier === 'full-experience'
}
