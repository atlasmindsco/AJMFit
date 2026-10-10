/**
 * Skeletons for the from-scratch path: a week with its days named, empty.
 *
 * A blank week is the worst screen in a builder. "Day 1" through "Day 5" tells
 * a client nothing about what goes in them, and naming the week is exactly the
 * decision someone building their first program is least equipped to make —
 * it is the one part of programming that needs a convention, not a preference.
 *
 * So the day names here are not invented. They are the names the 68 seeded
 * programs actually use at each day count, read out of production:
 *
 *   2day_fullbody  Full Body A | Full Body B
 *   6day_ppl       Push A | Pull A | Legs A | Push B | Pull B | Legs B
 *
 * A client who starts from scratch therefore ends up with the same vocabulary
 * as a client who copied a program, which matters because day names are what
 * workout history keys on. They can rename any of them.
 */

import { SPLIT_OPTIONS } from '@/lib/splits'

export interface BuilderTemplate {
  /** The seeded programs' split_key. Kept identical so the two cannot drift. */
  key: string
  label: string
  sub: string
  dayNames: string[]
}

/**
 * Day names per split, verbatim from the seeded programs.
 *
 * The hybrid tracks are deliberately absent. They carry sprinting, running and
 * conditioning prescriptions that the builder cannot express — it has sets,
 * reps and rest, not intervals and distances — so offering "Long Easy" as an
 * empty day would invite a client to fill it with something it is not.
 */
const DAY_NAMES: Record<string, string[]> = {
  '2day_fullbody': ['Full Body A', 'Full Body B'],
  '3day_fullbody': ['Full Body A', 'Full Body B', 'Full Body C'],
  '4day_ul': ['Upper A', 'Lower A', 'Upper B', 'Lower B'],
  '4day_torso_limbs': ['Torso A', 'Limbs A', 'Torso B', 'Limbs B'],
  '5day_ulppl': ['Upper', 'Lower', 'Push', 'Pull', 'Legs'],
  '5day_bro': ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'],
  '6day_ppl': ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'],
  '6day_ppl_arnold': [
    'Lower (Quad focus)',
    'Horizontal Pull',
    'Push A',
    'Lower (Hamstring & Glute focus)',
    'Vertical Pull',
    'Push B',
  ],
}

export const DAY_COUNT_CHOICES = [2, 3, 4, 5, 6]

/**
 * The skeletons on offer at a day count.
 *
 * Labels and ordering come from SPLIT_OPTIONS — the same table the Blueprint
 * picker reads — so a split added there shows up here as soon as it has day
 * names, and one removed disappears from both.
 */
export function templatesFor(days: number): BuilderTemplate[] {
  return (SPLIT_OPTIONS[days] ?? [])
    .filter((o) => DAY_NAMES[o.key])
    .map((o) => ({ key: o.key, label: o.label, sub: o.sub, dayNames: DAY_NAMES[o.key] }))
}

/** A named, empty week. The client fills it. */
export function emptyWeek(template: BuilderTemplate): Array<{ name: string; exercises: never[] }> {
  return template.dayNames.map((name) => ({ name, exercises: [] }))
}

/**
 * The fallback when a day count offers no named split.
 *
 * Never reached today — every count from 2 to 6 has one — but a count added to
 * SPLIT_OPTIONS without day names must still produce a usable week rather than
 * an empty screen.
 */
export function genericWeek(days: number): Array<{ name: string; exercises: never[] }> {
  return Array.from({ length: days }, (_, i) => ({ name: `Day ${i + 1}`, exercises: [] as never[] }))
}
