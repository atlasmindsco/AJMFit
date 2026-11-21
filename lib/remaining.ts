/**
 * What is left today, which is the question a client is actually asking.
 *
 * The Food screen led with `1,320 / 2,500 kcal`. Standing in a kitchen
 * holding something, a client wants to know whether they can eat it — and to
 * find out they had to subtract 1,320 from 2,500 in their head. The app did
 * the harder calculation and left them the easy one.
 *
 * Both numbers were already on the screen: the remainder was printed under
 * the bar, 12px and grey. Nothing here is new arithmetic. It is which of two
 * existing numbers gets to be the big one.
 *
 * Over target is the case worth being careful about. A bar pinned at 100% and
 * a cheerful "0 left" is a lie; so is a negative number. It says "340 over"
 * and it says it in the warning colour.
 */

export interface Remaining {
  /** How many units are left, never negative. 0 once the target is passed. */
  left: number
  /** How far past the target, 0 when still under. */
  over: number
  /** True once the target has been passed. */
  isOver: boolean
  /** "1,180 left" or "340 over". */
  label: string
}

/**
 * `null` or a nonsense target means there is nothing to count down from, and
 * the caller should show the plain eaten figure rather than invent a goal.
 */
export function remaining(eaten: number, target: number | null | undefined): Remaining | null {
  const goal = Number(target)
  if (!Number.isFinite(goal) || goal <= 0) return null

  const had = Number.isFinite(Number(eaten)) ? Math.max(0, Number(eaten)) : 0
  const diff = Math.round(goal - had)

  if (diff < 0) {
    const over = Math.abs(diff)
    return { left: 0, over, isOver: true, label: `${over.toLocaleString()} over` }
  }
  return { left: diff, over: 0, isOver: false, label: `${diff.toLocaleString()} left` }
}

/**
 * The quiet line underneath: everything the old headline used to say.
 *
 * Kept deliberately. "Nothing is removed" is the whole deal with this change
 * — a client who wants the running total still has it, one line down.
 */
export function eatenLine(eaten: number, target: number, unit = ''): string {
  const had = Math.round(Number(eaten) || 0)
  return `of ${Math.round(target).toLocaleString()}${unit} · ${had.toLocaleString()}${unit} eaten`
}
