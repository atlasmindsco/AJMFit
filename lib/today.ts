/**
 * What today is, for the home screen.
 *
 * A program here is a rotation, not a calendar: the app knows your days in
 * order, not which dates they fall on. That is the right model for training —
 * miss Tuesday and Tuesday's session is simply next, rather than lost — but it
 * meant the home screen could never say "rest day". It offered the next
 * session every single day, which quietly implies you are behind whenever you
 * are not training, and that is the opposite of what a rest day is.
 *
 * Training days are now answerable (the schedule screen asks), so for anyone
 * who has set them the app can finally tell the difference between "your next
 * session" and "your session today".
 */

const FULL_DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export interface TodayShape {
  /** True when today is not one of their training days. */
  rest: boolean
  /** "tomorrow", "Thursday", or null when we cannot say. */
  nextLabel: string | null
}

/**
 * Null training days means they have never said, so nothing is a rest day and
 * the next session is always on offer — which is how the app behaved for
 * everybody before this existed.
 */
export function todayShape(trainingDays: number[] | null, now: Date = new Date()): TodayShape {
  if (!trainingDays || trainingDays.length === 0 || trainingDays.length >= 7) {
    return { rest: false, nextLabel: null }
  }

  const dow = now.getDay()
  if (trainingDays.indexOf(dow) !== -1) return { rest: false, nextLabel: null }

  // Walk forward to the next training day. Bounded at 7, so a bad array can
  // never spin, and guaranteed to find one because an empty or full week was
  // handled above.
  for (let step = 1; step <= 7; step++) {
    const d = (dow + step) % 7
    if (trainingDays.indexOf(d) !== -1) {
      return { rest: true, nextLabel: step === 1 ? 'tomorrow' : FULL_DAYS[d] }
    }
  }

  // Nothing in the week matched, which means the stored days are not real
  // weekdays. Do not claim a rest day on that: a client would be told to rest
  // every day of their life, with no session ever offered. If we cannot name
  // the next training day we do not know enough to call today a rest day.
  return { rest: false, nextLabel: null }
}

/**
 * How many sessions this week is meant to hold.
 *
 * Their own answer first. Someone running a four-day program on three days a
 * week is not failing at four — they told us three, and counting them against
 * the template would be the app arguing with them.
 */
export function weeklyTarget(
  trainingDays: number[] | null,
  daysPerWeek: number | null
): number | null {
  if (trainingDays && trainingDays.length > 0) return trainingDays.length
  if (daysPerWeek && daysPerWeek > 0) return daysPerWeek
  return null
}

/**
 * The one line about this week.
 *
 * Deliberately has no praise and no warning in it. "2 of 4 this week" is a
 * fact a person can act on; "only 2 of 4!" is the app having an opinion about
 * someone's week it knows nothing about.
 */
export function weekLine(done: number, target: number | null): string | null {
  if (target === null) return null
  if (done >= target) {
    return target === 1 ? 'Session done this week' : `All ${target} sessions done this week`
  }
  return `${done} of ${target} sessions this week`
}
