/**
 * The Blueprint split catalogue: goals, locations, and which splits exist at
 * each day count.
 *
 * Pure data, pulled out of lib/blueprint.ts so that reading it does not drag
 * in a Supabase client. The custom builder needs this table to name a
 * from-scratch week, and a table of day counts has no business requiring
 * database credentials to import -- which is exactly what it did, until a
 * verifier tried.
 *
 * lib/blueprint.ts re-exports all of it, so existing callers are unchanged.
 */

export type BlueprintGoal = 'muscle' | 'strength' | 'lean_out'
export type BlueprintLocation = 'gym' | 'home'

export const GOAL_LABELS: Record<BlueprintGoal, string> = {
  muscle: 'Build Muscle',
  strength: 'Build Strength',
  lean_out: 'Lean Out',
}

export const LOCATION_LABELS: Record<BlueprintLocation, string> = {
  gym: 'At a gym',
  home: 'At home',
}

export interface SplitOption {
  /** Matches programs.split_key. */
  key: string
  label: string
  sub: string
  /**
   * Hybrid tracks carry sprinting, jumping and running. Those belong to people
   * already training consistently, not to someone picking their first program,
   * so the beginner flow does not offer them.
   */
  advanced?: boolean
  /** Goals this split is seeded for; omitted means all three. */
  goals?: BlueprintGoal[]
}

/**
 * Every split available at each day count, recommended one first.
 *
 * Two days used to map to the 3-day full-body program — a 2-day client was
 * handed a 3-day plan and left to work out which sessions to skip. Four and
 * six days offered exactly one split each.
 */
export const SPLIT_OPTIONS: Record<number, SplitOption[]> = {
  2: [{ key: '2day_fullbody', label: 'Full Body', sub: 'Two sessions, whole body each time.' }],
  3: [{ key: '3day_fullbody', label: 'Full Body', sub: 'Three sessions, whole body each time.' }],
  4: [
    { key: '4day_ul', label: 'Upper / Lower', sub: 'Two upper days, two lower days. Everything twice a week.' },
    { key: '4day_torso_limbs', label: 'Torso / Limbs', sub: 'Chest, back and delts together; legs and arms together.' },
    { key: 'hybrid_athletic', label: 'Athletic Performance', sub: 'Sprints, jumps and change of direction before the strength work.', advanced: true, goals: ['strength', 'muscle'] },
  ],
  5: [
    { key: '5day_ulppl', label: 'Upper / Lower / Push / Pull / Legs', sub: 'Balanced. Most muscles twice a week, varied stimulus.' },
    { key: '5day_bro', label: 'Bodybuilding Split', sub: 'One muscle group per day. Higher volume, once a week each.' },
    { key: 'hybrid_hyper_cond', label: 'Muscle + Conditioning', sub: 'Four lifting days plus low-impact conditioning.', goals: ['muscle', 'lean_out'] },
    { key: 'hybrid_strength_endurance', label: 'Strength + Endurance', sub: 'Three lifting days and two long easy sessions.', advanced: true, goals: ['strength', 'muscle'] },
  ],
  6: [
    { key: '6day_ppl', label: 'Push / Pull / Legs ×2', sub: 'The classic. Each rotation twice a week with different lifts.' },
    { key: '6day_ppl_arnold', label: 'Arnold-Style Split', sub: 'Split horizontal and vertical pulls, two lower days, two push days.' },
    { key: 'hybrid_strength_run', label: 'Strength + Running', sub: 'Three lifting days and three runs, kept off each other.', advanced: true, goals: ['strength', 'muscle'] },
    { key: 'hybrid_complete', label: 'Complete Athlete', sub: 'Speed, power, strength and conditioning in one week.', advanced: true, goals: ['strength', 'muscle'] },
  ],
}

/** Splits available at this day count for this goal, hiding advanced tracks from beginners. */
export function splitsFor(days: number, goal: BlueprintGoal | null, beginner: boolean): SplitOption[] {
  return (SPLIT_OPTIONS[days] ?? []).filter(
    (o) => !(beginner && o.advanced) && (!o.goals || !goal || o.goals.includes(goal))
  )
}

/** Days/week → the recommended split key (matches seeded programs.split_key). */
export const DAYS_TO_SPLIT: Record<number, string> = Object.fromEntries(
  Object.entries(SPLIT_OPTIONS).map(([days, opts]) => [Number(days), opts[0].key])
)

/** Is this split key a legitimate choice for that day count and goal? */
export function isValidSplitForDays(days: number, splitKey: string, goal?: BlueprintGoal): boolean {
  return (SPLIT_OPTIONS[days] ?? []).some(
    (o) => o.key === splitKey && (!o.goals || !goal || o.goals.includes(goal))
  )
}
