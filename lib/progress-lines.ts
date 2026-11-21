/**
 * One true sentence about a client's training, for the home screen.
 *
 * NOT a progress page. Progress as a destination is the screen nobody opens,
 * and a chart invites study — this is a sentence you read on the way past.
 *
 * The obvious version of this feature is garbage and I checked before
 * building it. Run "your X is up N lbs" against the live workout_sets table
 * with no filtering and the top three results are:
 *
 *     Inverted Row          up 145 lbs
 *     Butt Lift (Bridge)    up 130 lbs
 *     Decline Push-Up       up 120 lbs
 *
 * All three are bodyweight movements. Nothing improved. The client started
 * typing 0 in the weight box and later started typing their bodyweight, and
 * the app would have congratulated them on a 145 lb gain on a row they do
 * hanging under a bar. Ship that once and every number in the app stops
 * meaning anything.
 *
 * So: loaded movements only, four sessions minimum, absolute pounds, and the
 * line is simply not shown when nothing qualifies. An empty slot is better
 * than a padded one.
 *
 * No database client in this file, deliberately. The reading lives in
 * lib/workout.ts with every other query; importing supabase here made the
 * whole module unloadable outside a browser, which meant the rules above
 * could not be checked by a verifier — and these rules are the entire reason
 * the file exists.
 */
import { isBodyweightMovement } from '@/lib/progression'

/** One session of one exercise. Matches ExerciseSession in lib/workout.ts. */
export interface SessionPoint {
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  /** Heaviest working set that session. */
  topWeight: number
}

export interface LiftProgress {
  exerciseName: string
  /** Heaviest working set the first time they did it. */
  fromLb: number
  /** Heaviest working set the last time they did it. */
  toLb: number
  /** The month they started, e.g. "September". */
  sinceMonth: string
  /** How many sessions sit behind the claim. */
  sessions: number
}

/**
 * Four. Three is a fortnight and a good week.
 *
 * A single heavy day should never be able to carry a claim on its own, and at
 * two or three sessions "20 to 80 lbs" is usually somebody working out what
 * the movement feels like rather than getting stronger.
 */
export const MIN_SESSIONS = 4

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** The month name from a YYYY-MM-DD string, read off the string itself. */
function monthOf(date: string): string | null {
  const m = Number(String(date ?? '').slice(5, 7))
  if (!Number.isInteger(m) || m < 1 || m > 12) return null
  // .at() rather than [m - 1]: a computed index is the kind of thing that
  // returns undefined and prints "undefined" in front of a client.
  return MONTHS.at(m - 1) ?? null
}

/**
 * The single lift worth mentioning, or null.
 *
 * `history` is keyed by exercise name, each an array of sessions in ANY order
 * — lib/workout.ts hands them back newest first and sorting here means the
 * caller cannot get it wrong.
 *
 * Picks the largest absolute gain. Not the largest percentage: a first
 * session is calibration, not a baseline, so 20 to 80 lbs is "400% stronger"
 * only if you believe 20 was ever a real attempt. Absolute pounds are a true
 * statement either way, and a percentage is the number that gets screenshotted.
 */
export function bestLift(history: Record<string, SessionPoint[]>): LiftProgress | null {
  let best: LiftProgress | null = null

  for (const exerciseName of Object.keys(history)) {
    // The weight box means something different on these. See the comment at
    // the top of the file for what happens without this line.
    if (isBodyweightMovement(exerciseName)) continue

    const sessions = (history[exerciseName] ?? [])
      .filter((s) => s && s.topWeight > 0 && typeof s.date === 'string' && s.date.length >= 10)
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

    if (sessions.length < MIN_SESSIONS) continue

    const first = sessions[0]
    const last = sessions[sessions.length - 1]
    // Only a gain is worth a sentence. A lift that went down is real
    // information, but it belongs in the progression engine's advice during
    // the session, not as a greeting on the home screen.
    if (last.topWeight <= first.topWeight) continue

    const sinceMonth = monthOf(first.date)
    if (!sinceMonth) continue

    const gain = last.topWeight - first.topWeight
    if (best === null || gain > best.toLb - best.fromLb) {
      best = {
        exerciseName,
        fromLb: first.topWeight,
        toLb: last.topWeight,
        sinceMonth,
        sessions: sessions.length,
      }
    }
  }

  return best
}

/**
 * The sentence, or null.
 *
 * Deliberately flat. No "amazing", no exclamation mark, no emoji: the numbers
 * are the praise, and a coaching app that cheers at you is one a serious
 * client stops believing.
 */
export function liftLine(p: LiftProgress | null): string | null {
  if (!p) return null
  return `${p.exerciseName}: ${p.fromLb} to ${p.toLb} lbs since ${p.sinceMonth}`
}

