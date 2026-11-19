/**
 * Turning a single prescribed rep number into a range.
 *
 * WHY THIS IS NEEDED. Double progression — the method the whole progression
 * engine is built on — works by having a bottom and a top: you climb the reps
 * at one weight until you hit the top on every set, then add load and drop
 * back to the bottom. Four prescriptions in five say "8", so min and max are
 * the same number, there is no climbing to do, and the engine adds weight the
 * first session a client hits the prescribed reps. Every session. With no
 * buffer. That is correct for a true novice and too fast for anyone else.
 *
 * THE RULE: THE PRESCRIBED NUMBER BECOMES THE FLOOR. A program that said
 * "4 x 8" now says "4 x 8-12". Nobody trains lighter or does less work than
 * they did yesterday — the only change is that there is now somewhere to
 * climb to before the weight goes up.
 *
 * The ranges are the conventional ones rather than a formula. A lifter reads
 * "8-12" and knows what it means; "8-11" would be arithmetically tidy and
 * would look like a mistake. Where a tidy formula and a familiar range
 * disagree, the familiar range wins.
 *
 * THESE ARE A STARTING POINT, NOT A VERDICT. Which range suits which exercise
 * in which program is a coaching decision. This maps the numbers that are
 * already in the catalog to sensible defaults so a coach can correct the ones
 * they disagree with, rather than writing 240 of them from nothing.
 */

export interface RepRange {
  min: number
  max: number
}

/**
 * Keyed by the prescribed number. Every value in the catalog is covered.
 *
 * A prescribed single stays a single: one rep is a maximal attempt, and
 * "1-3" would change what the exercise is for.
 */
const RANGES: Record<number, RepRange | null> = {
  1: null, //            a single is a single
  3: { min: 3, max: 5 },
  5: { min: 5, max: 7 },
  6: { min: 6, max: 8 },
  8: { min: 8, max: 12 },
  10: { min: 10, max: 12 },
  12: { min: 12, max: 15 },
  15: { min: 15, max: 20 },
  20: { min: 20, max: 25 },
}

/** Nearest mapped number at or below, so an unmapped 9 or 11 still resolves. */
function nearestKey(n: number): number | null {
  const keys = Object.keys(RANGES)
    .map(Number)
    .sort((a, b) => a - b)
  let found: number | null = null
  for (const k of keys) {
    if (k <= n) found = k
    else break
  }
  return found
}

/**
 * Heavy work stays a fixed prescription.
 *
 * Five sets of five at three minutes' rest is a linear strength protocol: the
 * reps are deliberately fixed and the load is what progresses. Widening it to
 * 5-7 turns it into something else — a lifter climbing to seven reps on a
 * heavy triple-rest lift is doing a different exercise from the one the
 * program prescribed.
 *
 * Rest is what separates a heavy five from any other five. Nothing in the
 * catalog prescribes five reps on a short rest, and if something did, it
 * would not be this.
 */
const HEAVY_MAX_REPS = 5
const HEAVY_MIN_REST = 150

/**
 * The range for a prescription, or null to leave it exactly as it is.
 *
 * Null for timed and distance work ("45 sec", "10 min", "1 mile"), for an
 * existing range, for a single, and for heavy low-rep work. Those are not
 * single numbers waiting to be widened; they are already saying what they
 * mean.
 *
 * `restSeconds` is optional, and leaving it out means the heavy rule cannot
 * fire — which is the safe direction, because a caller that does not know the
 * rest does not know enough to call something a strength prescription.
 */
export function rangeFor(reps: string, restSeconds?: number | null): RepRange | null {
  const raw = String(reps ?? '').trim()
  if (raw === '') return null
  // Anything carrying a unit is a hold, a carry or a run.
  if (/[a-z]/i.test(raw)) return null
  // Already a range.
  if (/[-–]/.test(raw)) return null

  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return null

  if (n <= HEAVY_MAX_REPS && (restSeconds ?? 0) >= HEAVY_MIN_REST) return null

  if (n in RANGES) return RANGES[n]
  const key = nearestKey(n)
  if (key === null) return null
  const base = RANGES[key]
  if (!base) return null
  // Shift the mapped spread up to sit on the actual number, so 11 becomes
  // 11-13 off the 10-12 rule rather than silently being treated as 10.
  return { min: n, max: n + (base.max - base.min) }
}

/** How a range is written in the `reps` field the app reads and displays. */
export function formatRange(r: RepRange): string {
  return r.min === r.max ? String(r.min) : `${r.min}-${r.max}`
}

/**
 * Reps left in reserve on a working set, by training goal.
 *
 * Taken from the per-goal guidance already in `lib/progression.ts`, which
 * tells strength clients to leave 1-2 reps, muscle clients 1-3, and lean-out
 * clients 2-3. One number per prescription rather than a range, because this
 * is a target to log against, and "leave about 2" is actionable in a way that
 * "leave 1 to 3" is not.
 */
export function targetRirFor(goal: string | null | undefined): number {
  switch (goal) {
    case 'strength':
      return 2
    case 'muscle':
      return 2
    case 'lean_out':
      return 3
    default:
      // A client-built program has no goal. Two is the middle of the three
      // and the safest thing to suggest to somebody we know nothing about.
      return 2
  }
}
