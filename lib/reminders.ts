/**
 * Which reminder, if any, a client is due today.
 *
 * Pure: takes a snapshot of one client and returns at most one reminder. No
 * database, no clock beyond the `today` passed in, no sending. The cron does
 * the fetching and the sending; everything that decides WHETHER to speak lives
 * here so it can be tested against the cases that matter.
 *
 * The governing rule is that silence is the default and the common output. Of
 * eleven live clients, a correct day's run should be quiet for most of them.
 */

export type ReminderKind = 'quiet_4d' | 'quiet_7d' | 'check_in_due'

export interface ReminderPrefs {
  training: boolean
  check_ins: boolean
  progress: boolean
  send_hour: number
}

export const DEFAULT_PREFS: ReminderPrefs = {
  training: true,
  check_ins: true,
  progress: true,
  send_hour: 18,
}

export interface ClientSnapshot {
  userId: string
  /** Coached tiers are expected to check in; Blueprint clients are not. */
  coached: boolean
  /** YYYY-MM-DD of the last logged workout, or null if they never have. */
  lastWorkoutDate: string | null
  /** ISO timestamp of signup. */
  signedUpAt: string | null
  /** Monday-keyed weeks this client has already checked in for. */
  checkInWeeks: string[]
  prefs: ReminderPrefs
}

export interface DueReminder {
  userId: string
  kind: ReminderKind
  /**
   * Groups this send into one occurrence, so the database can refuse a repeat.
   *
   * For the quiet ladder it is the last workout date: the day-4 nudge then
   * fires once per spell of inactivity rather than every day from day four
   * onward, and a client who trains and later goes quiet again correctly gets
   * a fresh one.
   */
  occurrenceKey: string
  /** Days since the last workout, for the message body. */
  daysQuiet: number
}

const DAY = 86400000

/** Whole days between two calendar dates, ignoring time of day. */
export function daysBetween(fromDate: string, toDate: string): number {
  const a = Date.parse(`${fromDate}T00:00:00Z`)
  const b = Date.parse(`${toDate}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.round((b - a) / DAY)
}

/**
 * The quiet ladder.
 *
 * Nothing for the first three days — life happens and a rotation absorbs it.
 * A nudge on day 4, a fuller message on day 7, and then nothing: by day 10 the
 * client is flagged to the coach, and past three weeks an automated message is
 * an app shouting into an empty room. That last silence is deliberate and is
 * the rung most systems get wrong.
 */
const QUIET_RUNGS: Array<{ day: number; kind: ReminderKind }> = [
  { day: 4, kind: 'quiet_4d' },
  { day: 7, kind: 'quiet_7d' },
]

/** Past this, automated encouragement stops and it becomes the coach's call. */
export const QUIET_CEILING_DAYS = 10

/**
 * Consecutive unanswered weeks before the app stops asking for a check-in.
 *
 * The same reasoning as the quiet ceiling. After three ignored asks the answer
 * is not a fourth ask — the client is flagged `at_risk` to the coach after two
 * missed check-ins, and a human message or nothing is the honest choice from
 * there.
 */
export const CHECK_IN_GIVE_UP_WEEKS = 3

/** Has this client ignored the ask for too many weeks running? */
function tooManyMissed(client: ClientSnapshot, today: string): boolean {
  const weeks = new Set(client.checkInWeeks)
  let missed = 0
  // Walk back from the week that just ended.
  const cursor = new Date(`${mondayOf(today)}T00:00:00Z`)
  for (let i = 0; i < CHECK_IN_GIVE_UP_WEEKS; i++) {
    const key = cursor.toISOString().slice(0, 10)
    if (weeks.has(key)) return false
    missed++
    cursor.setUTCDate(cursor.getUTCDate() - 7)
  }
  return missed >= CHECK_IN_GIVE_UP_WEEKS
}

/**
 * Work out the one reminder this client is due, or null.
 *
 * `today` is a YYYY-MM-DD in the CLIENT's timezone, not the server's, so a
 * nudge lands on the right day for someone five hours off.
 */
export function dueReminder(client: ClientSnapshot, today: string): DueReminder | null {
  const { prefs } = client

  // --- The quiet ladder ----------------------------------------------------
  //
  // A client who has never trained is deliberately NOT handled here. There is
  // no "last time you trained" to refer to and the problem is almost always
  // setup rather than motivation, so it belongs to the coach — who is already
  // told on day 3 by the never_started status.
  if (prefs.training && client.lastWorkoutDate) {
    const quiet = daysBetween(client.lastWorkoutDate, today)
    if (quiet < QUIET_CEILING_DAYS) {
      const rung = QUIET_RUNGS.find((r) => r.day === quiet)
      if (rung) {
        return {
          userId: client.userId,
          kind: rung.kind,
          occurrenceKey: client.lastWorkoutDate,
          daysQuiet: quiet,
        }
      }
    }
  }

  // --- The weekly check-in -------------------------------------------------
  //
  // Only coached clients, because nothing asks a Blueprint client to check in
  // and reminding them to do something the product does not offer them is
  // worse than saying nothing.
  //
  // And only clients who have actually trained. Asking someone who has never
  // logged a session how their training week went is a question with no
  // answer, and simulating this against the live roster showed it firing twice
  // a week forever at a client 168 days into an Accelerator subscription with
  // no sessions at all. He needs a person, and the coach is already told.
  if (prefs.check_ins && client.coached && client.lastWorkoutDate && !tooManyMissed(client, today)) {
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay() // 0 = Sunday
    const isSunday = weekday === 0
    const isMonday = weekday === 1
    if (isSunday || isMonday) {
      const week = mondayOf(today)
      if (!client.checkInWeeks.includes(week)) {
        return {
          userId: client.userId,
          kind: 'check_in_due',
          // Keyed by week AND by which of the two attempts this is, so Sunday
          // asks and Monday follows up — and neither can repeat.
          occurrenceKey: `${week}:${isSunday ? 'ask' : 'followup'}`,
          daysQuiet: 0,
        }
      }
    }
  }

  return null
}

/**
 * The Monday that owns a date, matching `weekOf()` in check-ins.
 *
 * On a Sunday the check-in being asked for is the week that is ENDING, not the
 * one about to start — which is the Monday six days back, not tomorrow.
 */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  const offset = (d.getUTCDay() + 6) % 7 // Monday = 0
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString().slice(0, 10)
}

/** Today's date in a client's own timezone, falling back to the server's. */
export function localDateFor(timezone: string | null, now: Date = new Date()): string {
  if (!timezone) return now.toISOString().slice(0, 10)
  try {
    // en-CA gives YYYY-MM-DD, which is what every day-keyed table here uses.
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

/** The local hour for a client, so a reminder lands when they asked for it. */
export function localHourFor(timezone: string | null, now: Date = new Date()): number {
  if (!timezone) return now.getUTCHours()
  try {
    const h = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    }).format(now)
    const n = Number(h)
    return Number.isFinite(n) ? n % 24 : now.getUTCHours()
  } catch {
    return now.getUTCHours()
  }
}
