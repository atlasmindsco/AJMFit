export type Tier = 'blueprint' | 'accelerator' | 'full-experience'
export type Cycle = 'monthly' | 'weekly'

/** Stripe price lookup_key for a tier + billing cycle (set in scripts/setup-stripe.mjs). */
export function priceLookupKey(tier: Tier, cycle: Cycle): string {
  return `${tier}_${cycle}`
}

export const TIER_LABELS: Record<Tier, string> = {
  blueprint: 'The Blueprint',
  accelerator: 'The Accelerator',
  'full-experience': 'The Full Experience',
}

export const TRIAL_DAYS = 7
