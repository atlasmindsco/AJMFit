/**
 * Progression for the half of a hybrid program that is not a barbell.
 *
 * Strength, running, intervals, sprinting and plyometrics cannot share one
 * model. The lifting engine progresses load; applied to a 20-minute jog it
 * returns nothing at all, which is why a Strength + Running client ran exactly
 * the same twenty minutes in week 12 as in week 1, and the same 45-minute long
 * run three months apart.
 *
 * Each component here progresses on the variable that is actually safe to move
 * for it, and two of them do not progress automatically at all.
 */

/** Roles the library uses for non-lifting work. */
export type TimedRole = 'conditioning' | 'endurance' | 'mobility' | 'sprint' | 'power'

export interface TimedSession {
  /** YYYY-MM-DD */
  date: string
  durationSeconds: number | null
  distanceMi: number | null
}

export interface TimedTarget {
  /** What the client should do today, in one sentence. */
  text: string
  /** Suggested duration in seconds, when there is one. */
  suggestSeconds: number | null
  /** True when this is a step up rather than a repeat. */
  isProgression: boolean
  /** True when only a coach should change this. */
  coachOnly: boolean
}

/** Easy running tops out on time, then works on pace instead of getting longer. */
const EASY_RUN_CEILING_MIN = 45
/** Weekly bump for easy aerobic work. */
const EASY_RUN_STEP_MIN = 3
/** The long run grows by a fraction, not a fixed slab. */
const LONG_RUN_STEP = 0.1
/** Every fourth week the long run comes back down rather than climbing again. */
const LONG_RUN_CUTBACK_EVERY = 4
const LONG_RUN_CUTBACK = 0.7

const mins = (s: number) => Math.round(s / 60)
const secs = (m: number) => Math.round(m * 60)

/** Parse "20 min", "45 min", "2 mile" out of a prescription. */
export function parsePrescribedDuration(reps: string): number | null {
  const m = String(reps ?? '').match(/(\d+(?:\.\d+)?)\s*(min|sec|hour|hr)/i)
  if (!m) return null
  const n = parseFloat(m[1])
  const unit = m[2].toLowerCase()
  if (unit.startsWith('sec')) return Math.round(n)
  if (unit.startsWith('h')) return Math.round(n * 3600)
  return Math.round(n * 60)
}

export function isTimedPrescription(reps: string): boolean {
  return /min|sec|hour|hr|km|mile/i.test(String(reps ?? ''))
}

/**
 * Work out which timed role a slot is, from its prescription.
 *
 * The library knows the role, but a program is stored as name, sets, reps and
 * rest — the role is dropped on the way into the database. Rather than widen
 * the schema for one field, it is inferred from the duration, which the library
 * makes unambiguous: mobility is 10 minutes, conditioning 20, endurance 45.
 */
export function inferTimedRole(prescribedSeconds: number | null, exerciseName = ''): TimedRole {
  if (/stretch|mobility|foam|carioca|wall drill|warm/i.test(exerciseName)) return 'mobility'
  const m = prescribedSeconds == null ? 20 : prescribedSeconds / 60
  if (m >= 35) return 'endurance'
  if (m <= 12) return 'mobility'
  return 'conditioning'
}

/**
 * Sprints, jumps and throws, which are prescribed in REPS and therefore reach
 * the lifting engine rather than this one.
 *
 * Left alone, double progression would happily tell a client to add five
 * pounds to a box jump the moment they logged a weight against it. Adding reps
 * or load to explosive work is how people tear things, and the upside of
 * automating it is nil.
 */
export function isExplosiveMovement(exerciseName: string): boolean {
  return /sprint|box jump|bound|hop|plyo|throw|multiple response|broad jump|depth jump/i.test(
    exerciseName
  )
}

/** What to tell a client on an explosive slot, since nothing auto-progresses it. */
export function explosiveGuidance(exerciseName: string): string {
  return /sprint|hop/i.test(exerciseName)
    ? 'Same number of efforts, full recovery between them. If they start slowing down, that is the session finished — quality is the whole point here.'
    : 'Same number of jumps, every one as clean as the first. Land softly. Height before reps, and never chase both at once.'
}

/**
 * What to do on a timed slot today.
 *
 * `weekInBlock` drives the long run's cutback cycle. `canProgress` is the
 * interference gate: on a week where something else is going up, everything
 * else holds.
 */
export function timedTarget(input: {
  role: TimedRole
  exerciseName: string
  prescribedSeconds: number | null
  history: TimedSession[]
  weekInBlock: number
  canProgress: boolean
}): TimedTarget {
  const { role, prescribedSeconds, history, weekInBlock, canProgress } = input
  const done = history.filter((h) => h.durationSeconds != null && h.durationSeconds > 0)
  const last = done[0]

  // --- Never automated -----------------------------------------------------
  //
  // Adding reps or height to sprint and jump work is how people tear things.
  // The gain from automating it is small and the downside is an injury, so
  // these move on Anthony's say-so or not at all.
  if (role === 'sprint' || role === 'power') {
    return {
      coachOnly: true,
      isProgression: false,
      suggestSeconds: null,
      text:
        role === 'sprint'
          ? 'Same number of efforts, full recovery between them. Quality beats quantity here — if they are slowing down, stop the session.'
          : 'Same number of jumps, maximum quality on each. Land softly. More height before more reps, and never both.',
    }
  }

  // --- Mobility is a dose, not a lift --------------------------------------
  if (role === 'mobility') {
    return {
      coachOnly: false,
      isProgression: false,
      suggestSeconds: prescribedSeconds,
      text: prescribedSeconds
        ? `${mins(prescribedSeconds)} minutes, easy. This one does not need to get harder.`
        : 'Easy movement. This one does not need to get harder.',
    }
  }

  // Nothing to beat yet.
  //
  // Falling back to the prescription here told a client on their very first run
  // to do "23 minutes, up from 20" — up from a number they had never actually
  // run. The first session of anything establishes the baseline; it does not
  // improve on one.
  if (done.length === 0) {
    return {
      coachOnly: false,
      isProgression: false,
      suggestSeconds: prescribedSeconds,
      text: prescribedSeconds
        ? `Aim for about ${mins(prescribedSeconds)} minutes and log what you actually do — that becomes the number we build from.`
        : 'First one of these. Log the time you actually do and we will build from it.',
    }
  }
  const baseline = last!.durationSeconds as number

  if (!canProgress) {
    return {
      coachOnly: false,
      isProgression: false,
      suggestSeconds: baseline,
      text: `Hold at ${mins(baseline)} minutes this week — your lifting is going up, and pushing both at once is how hybrid training stalls in both directions.`,
    }
  }

  // --- The long run: percentage growth with a regular cutback --------------
  if (role === 'endurance') {
    const isCutback = weekInBlock > 0 && weekInBlock % LONG_RUN_CUTBACK_EVERY === 0
    if (isCutback) {
      const target = secs(Math.round(mins(baseline) * LONG_RUN_CUTBACK))
      return {
        coachOnly: false,
        isProgression: false,
        suggestSeconds: target,
        text: `Cutback week: ${mins(target)} minutes instead of ${mins(baseline)}. Backing off every fourth week is what lets the other three keep climbing.`,
      }
    }
    const target = secs(Math.round(mins(baseline) * (1 + LONG_RUN_STEP)))
    return {
      coachOnly: false,
      isProgression: true,
      suggestSeconds: target,
      text: `Go to ${mins(target)} minutes this week, up from ${mins(baseline)}. Ten percent at a time — the limit here is your joints, not your lungs.`,
    }
  }

  // --- Easy running and conditioning: time to a ceiling, then pace ---------
  const baselineMin = mins(baseline)
  if (baselineMin >= EASY_RUN_CEILING_MIN) {
    return {
      coachOnly: false,
      isProgression: true,
      suggestSeconds: baseline,
      text: `Stay at ${baselineMin} minutes — that is long enough for this slot. Cover more ground in the same time instead, or hold the pace with less effort.`,
    }
  }

  const target = secs(Math.min(EASY_RUN_CEILING_MIN, baselineMin + EASY_RUN_STEP_MIN))
  return {
    coachOnly: false,
    isProgression: true,
    suggestSeconds: target,
    text: `${mins(target)} minutes today, up from ${baselineMin}. Easy enough to hold a conversation the whole way.`,
  }
}

/* -------------------------------------------------------------------------- */

export type Component = 'lifting' | 'running'

/**
 * Which half of a hybrid week is allowed to go up.
 *
 * Progressing everything at once is how hybrid clients get hurt or stall in
 * both directions: lower-body lifting and hard running compete for the same
 * recovery. The library already spaces them within a week — the hard run never
 * lands on a lower-body day — and this extends that care across weeks.
 *
 * Alternating by week is deliberately the dumbest rule that works. The client
 * never sees it; they just get one thing to beat.
 */
export function progressingThisWeek(weekInBlock: number): Component {
  return weekInBlock % 2 === 1 ? 'lifting' : 'running'
}

export function canComponentProgress(component: Component, weekInBlock: number): boolean {
  return progressingThisWeek(weekInBlock) === component
}
