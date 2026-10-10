/**
 * What stands in a set's number boxes, and what gets logged when you tick it.
 *
 * Three rules that have to agree, and did not: the box shows what you typed,
 * the PLACEHOLDER shows the suggestion, and ticking commits whichever of the
 * two is real. Getting this wrong is not subtle in use — it was a real
 * complaint on a real session.
 *
 * The suggestion used to be the input's `value`. It read correctly and logged
 * correctly, and it made the box miserable to type in: tapping put the caret
 * inside "115", so typing gave you "1115" and you had to select the number
 * before you could replace it. Every set, every exercise.
 *
 * As a placeholder the box is empty underneath, so a tap leaves you ready to
 * type, while `toLog` still returns the suggestion for anyone who just wants
 * to tick it and move on.
 */

export interface SetEntry {
  /** Exactly what the client typed. Empty string means they have not. */
  typed: string
  /** What the engine proposes, or '' when there is nothing to go on. */
  suggestion: string
}

/** What belongs in the input's `value`. Never the suggestion. */
export function boxValue(e: SetEntry): string {
  return e.typed
}

/**
 * What belongs in the input's `placeholder`.
 *
 * The suggestion first, then last session's number, then a word. A number
 * here is a real proposal — `toLog` will commit it — so it is drawn brighter
 * than a placeholder normally would be.
 */
export function boxPlaceholder(e: SetEntry, previous: string | null, fallback: string): string {
  return e.suggestion || previous || fallback
}

/** What ticking the set actually records. */
export function toLog(e: SetEntry): string {
  return e.typed !== '' ? e.typed : e.suggestion
}

/**
 * Whether the set can be logged at all.
 *
 * A first-ever exercise has no suggestion and no history, so there is nothing
 * to commit until the client types something.
 */
export function canLogSet(weight: SetEntry | null, reps: SetEntry): boolean {
  if (weight && toLog(weight) === '') return false
  return toLog(reps) !== ''
}
