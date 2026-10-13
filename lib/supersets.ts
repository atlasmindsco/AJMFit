/**
 * Supersets: two or three exercises done back to back, resting only at the end.
 *
 * THE RENDERING ALREADY EXISTED. The execution view has grouped exercises by
 * series letter since long before the builder did — `groupBySeries` reads
 * "A1"/"A2" as one superset and shows the badge and the prefixes — and not one
 * of the 1,517 exercise rows in production has ever carried a superset_group.
 * It was finished UI wired to nothing. This module is the missing half.
 *
 * What was NOT already handled is rest, which is the whole point of a
 * superset. The two logging paths start the prescribed rest after every set of
 * every exercise, so pairing two movements without this would give you the
 * badge, the prefixes, and a 90-second countdown between the two things you
 * were supposed to do back to back.
 */

export interface SupersetMember {
  /** Shared id for everything in one superset; null when the exercise stands alone. */
  supersetGroup?: string | null
}

/**
 * Series letters for a day, in order: A, B, C for standalone exercises and
 * A1, A2 for a pair.
 *
 * The format is not a choice — it is what `groupBySeries` in the execution
 * view already parses, stripping the digits to find the group. Produce
 * anything else and the badge never appears.
 *
 * A group whose members are not adjacent still gets one letter. The builder
 * keeps them together, but a program edited into that state should render as
 * the client intended rather than silently splitting.
 */
export function seriesLabels(exercises: SupersetMember[]): string[] {
  const letterOf = new Map<string, string>()
  const countIn = new Map<string, number>()
  let next = 0

  // First pass: hand out a letter per distinct group, in first-appearance
  // order, and count how many exercises share it.
  for (const ex of exercises) {
    const key = ex.supersetGroup || null
    if (!key) {
      next++
      continue
    }
    if (!letterOf.has(key)) {
      letterOf.set(key, String.fromCharCode(65 + next))
      next++
    }
    countIn.set(key, (countIn.get(key) ?? 0) + 1)
  }

  // Second pass: standalone exercises take the next free letter in order.
  const used = new Set(letterOf.values())
  const freeLetters: string[] = []
  for (let i = 0; i < 26 && freeLetters.length < exercises.length; i++) {
    const letter = String.fromCharCode(65 + i)
    if (!used.has(letter)) freeLetters.push(letter)
  }

  const position = new Map<string, number>()
  let freeIndex = 0
  return exercises.map((ex) => {
    const key = ex.supersetGroup || null
    if (!key) return freeLetters[freeIndex++] ?? 'Z'
    const letter = letterOf.get(key)!
    // A "group" of one is not a superset; it reads as a plain letter.
    if ((countIn.get(key) ?? 0) < 2) return letter
    const n = (position.get(key) ?? 0) + 1
    position.set(key, n)
    return `${letter}${n}`
  })
}

/**
 * How long to rest after logging a set.
 *
 * Zero between superset partners: that is what makes it a superset rather than
 * two exercises with a badge. The prescribed rest comes after the last member,
 * because that is where the round actually ends.
 */
export function restSecondsAfterSet(input: {
  /** The exercise's own rest, in seconds. */
  prescribed: number
  /** True when this exercise is paired with at least one other. */
  isSuperset: boolean
  /** True when this is the last exercise in its superset. */
  isLastInGroup: boolean
}): number {
  if (!input.isSuperset) return input.prescribed
  return input.isLastInGroup ? input.prescribed : 0
}

/**
 * Whether a set of exercises can be paired.
 *
 * Three is the ceiling — past that it is circuit training, which the rest
 * timer and the set-by-set logging flow do not express. Pairing an exercise
 * with itself is not a thing.
 */
export const MAX_SUPERSET_SIZE = 3

export function canPair(groupSize: number): boolean {
  return groupSize < MAX_SUPERSET_SIZE
}

/** A stable id for a new superset. Short, because it is only unique per day. */
export function newSupersetId(existing: Array<string | null | undefined>): string {
  const used = new Set(existing.filter(Boolean) as string[])
  for (let i = 1; i < 100; i++) {
    const id = `ss${i}`
    if (!used.has(id)) return id
  }
  return `ss${Date.now()}`
}
