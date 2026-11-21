/**
 * What a home program actually needs, and what to do when a client lacks it.
 *
 * The library records ONE equipment value per exercise. It says `dumbbell`
 * for Dumbbell Bench Press and `body only` for Pullups, so the bench and the
 * bar — the two things a home client is most likely not to own — are invisible
 * to every filter, every health check and every substitution path in the app.
 *
 * Measured against the live library: all 34 home programs need a bench or an
 * elevated surface, and 31 of 34 need a pull-up bar. Not one of them is
 * doable with dumbbells and a floor. A client with only dumbbells loses an
 * average of 25% of every home program, worst case 33% — four of twelve
 * exercises in the 2-day Full Body.
 *
 * This is the fourth feature to break on a field that does not contain what
 * the code assumed, after the onboarding form, the progression training age
 * and the bodyweight guard. The fix is the same one that worked for movement
 * patterns: an explicit table for everything the 68 programs prescribe, and
 * no heuristic standing in for it.
 *
 * TWO KINDS OF MISSING EQUIPMENT, and they are handled differently.
 *
 * A pull-up bar is REQUIRED and said so up front. Chin-Up and Pullups have no
 * honest substitute here: the only four exercises tagged `lats` that a
 * dumbbells-only client can do are all stretches, and the library holds no
 * band exercises for the back at all. Rather than quietly hand someone a row
 * and call it a vertical pull, home programs state the bar as a requirement
 * before anybody signs up. A doorway bar is about $25. Anthony's call.
 *
 * A bench is ASKED, because a sturdy chair, a sofa arm or a step does the job
 * and most people have one of those. When a client says they have nothing,
 * six exercises get named substitutes.
 */

/** Things a home program can need that the library's one field cannot record. */
export type Kit = 'bench' | 'pullup_bar'

/** What a home client is told they need before they start. */
export const REQUIRED_AT_HOME: Kit[] = ['pullup_bar']

/** What a home client is asked about, because a substitute exists. */
export const ASKED_AT_HOME: Kit[] = ['bench']

export const KIT_LABELS: Record<Kit, string> = {
  bench: 'A bench, sturdy chair or step',
  pullup_bar: 'A doorway pull-up bar',
}

/**
 * Every prescribed exercise that needs something beyond dumbbells and a floor.
 *
 * Explicit, and only eight rows long, because that is the whole problem across
 * all 34 home programs. Written out rather than matched on names: a regex over
 * exercise names is how I measured this in the first place and it is a floor,
 * not an answer — `Inverted Row` is tagged `body only`, needs a bar or a table
 * edge, and no name pattern catches it.
 */
export const NEEDS: Record<string, Kit> = {
  'Chin-Up': 'pullup_bar',
  Pullups: 'pullup_bar',
  'Inverted Row': 'pullup_bar',
  'Dumbbell Bench Press': 'bench',
  'Incline Dumbbell Press': 'bench',
  'Dumbbell Incline Row': 'bench',
  'Decline Push-Up': 'bench',
  'Decline Dumbbell Triceps Extension': 'bench',
  'Bent Over Dumbbell Rear Delt Raise With Head On Bench': 'bench',
}

/**
 * What to do instead, for the bench exercises only.
 *
 * Every name on the right is a real library exercise, checked against
 * public/exercises/exercises.json. Each keeps the movement rather than the
 * muscle where it can: a bench press becomes a floor press, an incline row
 * becomes a one-arm row, a decline extension becomes a lying one.
 *
 * Incline Dumbbell Press is the honest compromise. Nothing on a floor presses
 * at an incline, so it becomes a standing shoulder press — the same push, a
 * different angle. Better than dropping the slot, and the client is told what
 * was changed and why rather than finding a different exercise there.
 */
export const INSTEAD: Record<string, string> = {
  'Dumbbell Bench Press': 'Dumbbell Floor Press',
  'Incline Dumbbell Press': 'Dumbbell Shoulder Press',
  'Dumbbell Incline Row': 'One-Arm Dumbbell Row',
  'Decline Push-Up': 'Pushups',
  'Decline Dumbbell Triceps Extension': 'Lying Dumbbell Tricep Extension',
  'Bent Over Dumbbell Rear Delt Raise With Head On Bench': 'Dumbbell Lying Rear Lateral Raise',
}

/** What this exercise needs beyond dumbbells and a floor, or null. */
export function needs(exerciseName: string): Kit | null {
  return NEEDS[exerciseName] ?? null
}

export interface Swap {
  /** The exercise to show instead. */
  name: string
  /** Why, in the words a client reads. */
  because: string
}

/**
 * The exercise a client should see, given what they own.
 *
 * `has` is the kit they told us about. **An unanswered question means they
 * have it.** That default is deliberate and it is the single most dangerous
 * line in this file: read the other way, every existing client would wake up
 * to a substituted program they never asked for, on 34 programs at once.
 *
 * Returns null when nothing should change, which is the common case.
 */
export function swapFor(exerciseName: string, has: Partial<Record<Kit, boolean>>): Swap | null {
  const kit = needs(exerciseName)
  if (!kit) return null
  // Absent means yes. Only an explicit false substitutes anything.
  if (has[kit] !== false) return null

  const instead = INSTEAD[exerciseName]
  if (!instead) return null
  return { name: instead, because: `you said no ${kit === 'bench' ? 'bench' : 'pull-up bar'}` }
}
