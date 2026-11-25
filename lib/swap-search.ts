/**
 * Searching the whole library for something to swap in.
 *
 * WHAT WAS WRONG. The swap sheet offered recommendations and nothing else.
 * The recommendations are good — they match on primary muscle, force,
 * mechanic and category, so a cable crossover never stands in for a bench
 * press — but a list of six is a dead end when the thing you want is the
 * seventh. The rack is busy, the machine is taken, and the only answer the
 * app had was a list you had already read.
 *
 * So: recommendations first, unchanged, and a search over all 873 behind a
 * second tab. The taxonomy is the one the program builder already uses —
 * MUSCLE_GROUPS and EQUIPMENT_FILTERS in lib/builder-rules.ts, six groups
 * over seventeen real muscle names and five equipment filters collapsed from
 * the library's twelve values. Nothing new was invented, and the two cannot
 * drift because there is only one of them.
 *
 * This module is the part that is specific to swapping: where to open the
 * search, and what order to show results in. Pure, so both can be checked.
 */

import { MUSCLE_GROUPS, type LibraryExercise } from '@/lib/builder-rules'

/**
 * Which filter chip to open on, given the exercise being replaced.
 *
 * Opening on "all 873, unsorted" makes the client do the app's job. Opening
 * on the group the original belongs to puts the plausible answers on screen
 * before they type anything — and it is one tap to clear, so it guides
 * without trapping.
 */
export function groupForMuscle(primaryMuscle: string | null | undefined): string | null {
  if (!primaryMuscle) return null
  const m = primaryMuscle.trim().toLowerCase()
  const hit = MUSCLE_GROUPS.find((g) => g.muscles.includes(m))
  return hit ? hit.key : null
}

/** What makes one result a closer stand-in than another. */
export interface SwapContext {
  equipment?: string | null
  mechanic?: string | null
  primaryMuscle?: string | null
  /** The name being replaced, so it never offers itself. */
  excludeName?: string | null
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

/**
 * Order search results by how well they stand in for the original.
 *
 * SORTS, NEVER FILTERS. This is the rule the whole tab depends on: a client
 * who searches "curl" while replacing a squat is doing something deliberate,
 * and an app that decides they cannot have it has stopped being useful. The
 * only thing removed is the exercise being replaced, because offering it is
 * just noise.
 *
 * THE MUSCLE OUTRANKS THE EQUIPMENT, and the first version of this had it
 * the other way round on the reasoning that people swap because a piece of
 * kit is unavailable. That is true about WHY they are here and wrong about
 * what to show them: scoring equipment highest offered a Barbell Curl as the
 * top substitute for a Barbell Bench Press, because both are barbells. The
 * verifier caught it on the first run.
 *
 * What has to stay constant in a substitute is the muscle and the movement
 * pattern. Equipment is the thing they are trying to CHANGE — it earns a
 * point as a mild tiebreak between two otherwise equal options, and no more.
 */
export function rankForSwap<T extends LibraryExercise>(results: T[], ctx: SwapContext): T[] {
  const equip = norm(ctx.equipment)
  const mech = norm(ctx.mechanic)
  const muscle = norm(ctx.primaryMuscle)
  const exclude = norm(ctx.excludeName)

  const score = (e: T): number => {
    let s = 0
    if (muscle && e.primaryMuscles.some((m) => norm(m) === muscle)) s += 4
    if (mech && norm(e.mechanic) === mech) s += 2
    if (equip && norm(e.equipment) === equip) s += 1
    return s
  }

  return results
    .filter((e) => !exclude || norm(e.name) !== exclude)
    .map((e, i) => ({ e, i, s: score(e) }))
    // The index keeps it stable: two exercises that score the same stay in
    // the order the library gave them, rather than shuffling between renders.
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.e)
}

/**
 * What the sheet says above the results.
 *
 * Named separately because the distinction matters and has to be said out
 * loud: Recommended is the engine's opinion, All is the library. A client who
 * cannot tell which one they are looking at does not know whether the app
 * has vetted what it is showing them.
 */
export function resultsHeading(count: number, searching: boolean): string {
  if (count === 0) return searching ? 'Nothing matches that' : 'Nothing here'
  if (searching) return `${count} ${count === 1 ? 'match' : 'matches'}`
  return `${count} ${count === 1 ? 'exercise' : 'exercises'}`
}
