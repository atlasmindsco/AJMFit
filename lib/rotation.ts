/**
 * Which day of the program is today.
 *
 * The app has never been able to answer this. `completed` was hardcoded false
 * on every day of every program, so the green ticks never appeared, the
 * overview tile read "0 / N" forever, and `todayIndex` — the first day that is
 * not complete — was always Day 1. A client who trained Upper A yesterday
 * opened the app and was offered Upper A again.
 *
 * A program is a ROTATION, not a calendar. A 4-day upper/lower runs
 * A-B-C-D-A-B-C-D regardless of which weekdays those land on, and clients skip
 * days, double up, and take a week off. So "today" is not a date lookup: it is
 * the first day of the rotation that has not been trained in the current pass.
 *
 * The current pass is found by walking backwards through history until a day
 * name repeats. That repeat is where the previous lap ended, and everything
 * after it is this lap. It needs no cycle-start column, survives skipped days,
 * and a client who trains out of order still gets the first thing they have
 * not done.
 */

export interface TrainedDay {
  /** The program day's short name, as stored on the workout row. */
  dayName: string
  /** ISO timestamp. Most recent first is NOT assumed; this module sorts. */
  at: string
}

export interface RotationState {
  /** Program-day names completed in the current pass. */
  completed: Set<string>
  /** Index into the day list of the session to offer, or -1 if there are none. */
  todayIndex: number
}

/**
 * Work out the current pass and the next session.
 *
 * `dayNames` is the program's days in order, rest days included — their names
 * simply never appear in history, so they are skipped when choosing today.
 * `trainable` marks which of those days actually have exercises.
 */
export function rotationState(
  dayNames: string[],
  trainable: boolean[],
  history: TrainedDay[]
): RotationState {
  const indexOf = new Map(dayNames.map((n, i) => [n, i]))
  // Only sessions belonging to THIS program count. A client who switched
  // programs carries history under day names that no longer exist, and letting
  // those close out a lap would mark the new program half-done on day one.
  const mine = history
    .filter((h) => indexOf.has(h.dayName))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

  const firstTrainable = dayNames.findIndex((_, i) => trainable[i])
  if (mine.length === 0 || firstTrainable === -1) {
    return { completed: new Set(), todayIndex: firstTrainable }
  }

  // Walk backwards while each older session sits EARLIER in the program than
  // the one after it. The moment that stops being true, the rotation wrapped,
  // and everything older belongs to the previous lap.
  //
  // Counting distinct names instead was the obvious version and it is wrong:
  // after a full lap plus one session, the most recent N names span the lap
  // boundary, so a client who had just started lap two was told lap one was
  // still running and sent back to day one.
  const completed = new Set<string>()
  let prev = Infinity
  for (const h of mine) {
    const i = indexOf.get(h.dayName)!
    if (i >= prev) break
    completed.add(h.dayName)
    prev = i
  }

  // Look forward from the most recent session, wrapping. Rotation order is
  // what a client expects, and the wrap picks up any day they skipped on the
  // way round rather than letting it go missing for good.
  const from = indexOf.get(mine[0].dayName)!
  for (let step = 1; step <= dayNames.length; step++) {
    const i = (from + step) % dayNames.length
    if (trainable[i] && !completed.has(dayNames[i])) {
      return { completed, todayIndex: i }
    }
  }

  // Every trainable day is done. The lap closed on the most recent session, so
  // the next one opens on the day after it.
  for (let step = 1; step <= dayNames.length; step++) {
    const i = (from + step) % dayNames.length
    if (trainable[i]) return { completed, todayIndex: i }
  }
  return { completed, todayIndex: firstTrainable }
}

/**
 * A workout counts towards the rotation only if it was both finished and
 * actually logged against.
 *
 * 7 of 41 sessions in production were started and then abandoned with zero
 * sets. Treating those as "done" would skip the client past a session they
 * never trained, which is worse than offering it twice.
 */
export function countsAsTrained(row: {
  day_name: string | null
  ended_at: string | null
  set_count: number
}): boolean {
  return Boolean(row.day_name) && Boolean(row.ended_at) && row.set_count > 0
}
