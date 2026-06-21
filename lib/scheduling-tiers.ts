import type { Tier } from '@/lib/stripe/catalog'

/**
 * Calendly scheduling config per plan tier — mirrors what the signup page
 * (components/sections/Pricing.tsx) advertises:
 *
 *   blueprint        ($19.97) — self-guided, NO calls (app + messaging only)
 *   accelerator      ($397)   — welcome call + 1 weekly 30-45min check-in
 *   full-experience  ($697)   — welcome call + 1 weekly check-in + 2 live 45min training sessions
 *
 * Calendly event types are created in the Calendly dashboard (the API can't
 * create them). Each `slug` below must match the tail of an event type URL,
 * e.g. https://calendly.com/anthony-ajmfit/weekly-checkin -> 'weekly-checkin'.
 * `matchType` is used to count how many of that call a client has booked this
 * week, by testing it against the session's `type` (the Calendly event name).
 */
export const CALENDLY_BASE = 'https://calendly.com/anthony-ajmfit'

export interface WeeklyCall {
  key: string
  /** UI heading, e.g. "Weekly check-in". */
  label: string
  /** Calendly event slug. */
  slug: string
  /** Max bookings allowed per week. */
  quota: number
  /** Matches scheduled_sessions.type (the Calendly event name) to count usage. */
  matchType: RegExp
}

export interface TierScheduling {
  /** One-time welcome/onboarding call slug (null = tier has none). */
  onboardingSlug: string | null
  /** Recurring weekly calls this tier may book. */
  weekly: WeeklyCall[]
}

const CHECKIN: WeeklyCall = {
  key: 'checkin',
  label: 'Weekly check-in',
  // Calendly event "Weekly Check-In" (45min). Shared by Accelerator + Full.
  slug: 'weekly-accelerator',
  quota: 1,
  matchType: /check.?in/i,
}

const TRAINING: WeeklyCall = {
  key: 'training',
  label: 'Live training session',
  // Calendly event "Live Training" (currently 30min in Calendly).
  slug: 'live-training',
  quota: 2,
  matchType: /training/i,
}

export const TIER_SCHEDULING: Record<Tier, TierScheduling> = {
  blueprint: {
    onboardingSlug: null,
    weekly: [],
  },
  accelerator: {
    // Calendly event "Onboarding Call" (default slug '30min').
    onboardingSlug: '30min',
    weekly: [CHECKIN],
  },
  'full-experience': {
    onboardingSlug: '30min',
    weekly: [CHECKIN, TRAINING],
  },
}

/** Matches a session's type to the one-time welcome/onboarding call. */
export const ONBOARDING_MATCH = /welcome|onboarding/i

/** Full Calendly URL for an event slug. */
export function calendlyUrl(slug: string): string {
  return `${CALENDLY_BASE}/${slug}`
}
