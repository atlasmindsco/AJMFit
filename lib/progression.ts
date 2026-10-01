import type { ExerciseSession } from '@/lib/workout'

/**
 * Progression rules for the Blueprint program library.
 *
 * The model is double progression, chosen because it needs no training max, no
 * percentage tables and no testing session — a self-guided client can follow it
 * unsupervised, which is the constraint that matters for this tier.
 *
 * What changed in October 2026: the engine used to see exactly one past session
 * per exercise. That is enough to say "beat this" and nothing else. It could
 * not tell a first stall from a fourth, could not see a lift sliding backwards,
 * and had no answer except "stay and push reps" for everything that went wrong.
 *
 * The consequence was measurable rather than theoretical. Across every exercise
 * any client had repeated, seven had gone DOWN over weeks and nothing noticed —
 * one main lift fell from 90 lb to 60 lb across nine sessions while the app
 * kept printing the same encouraging sentence.
 *
 * It now reads the last six sessions and can say: repeat it, cut back and
 * rebuild, change the exercise, or take a day. Every threshold is deliberately
 * slow. Crying plateau at someone who slept badly is how a client learns to
 * ignore the app.
 */

export type ProgressionGoal = 'strength' | 'muscle' | 'lean_out'

/** Training age. Changes how fast load moves and how long before a stall counts. */
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'

export interface GoalProgression {
  /** One line the client sees on their program. */
  rule: string
  /** How hard to push a working set. */
  effort: string
}

export const PROGRESSION: Record<ProgressionGoal, GoalProgression> = {
  strength: {
    rule: 'Hit every prescribed rep on all sets, then add weight next session.',
    effort: 'Leave 1–2 reps in reserve on working sets. Never grind to failure on the main lifts.',
  },
  muscle: {
    rule: 'Work to the top of the rep range on every set, then add weight and start again at the bottom.',
    effort: 'Take working sets to 1–3 reps in reserve. The last rep should be hard, not a grind.',
  },
  lean_out: {
    rule: 'Hold the weight and beat your reps or your rest time before you add load.',
    effort: 'Stop 2–3 reps short of failure. The goal is quality work you can repeat.',
  },
}

/**
 * How experience changes the numbers.
 *
 * Three levers only: how big a jump, how many good sessions before it, and how
 * many flat sessions before we call it. An advanced lifter adding 5 lb a week
 * to their bench for a year would be benching 400 — when their progress slows,
 * that is the sport working correctly, not a problem to solve.
 */
interface LevelRules {
  upperIncrementLb: number
  lowerIncrementLb: number
  /** Sessions at the top of the range before load goes up. */
  sessionsAtTopToAdd: number
  /** Flat or declining sessions before we call it a stall. */
  stallAfter: number
}

const LEVELS: Record<ExperienceLevel, LevelRules> = {
  beginner: { upperIncrementLb: 5, lowerIncrementLb: 10, sessionsAtTopToAdd: 1, stallAfter: 3 },
  intermediate: { upperIncrementLb: 5, lowerIncrementLb: 10, sessionsAtTopToAdd: 1, stallAfter: 4 },
  advanced: { upperIncrementLb: 2.5, lowerIncrementLb: 5, sessionsAtTopToAdd: 2, stallAfter: 6 },
}

/** Consecutive declining sessions before we cut the load and rebuild. */
const DECLINE_BEFORE_CUTBACK = 3
/** How much to take off when rebuilding. */
const CUTBACK_FRACTION = 0.1
/** A layoff longer than this softens the next session's targets. */
const LAYOFF_DAYS = 14
const LONG_LAYOFF_DAYS = 28

/** Map whatever onboarding collected onto a training age. */
export function experienceFrom(
  experience: string | undefined | null,
  yearsTraining: string | number | undefined | null
): ExperienceLevel {
  const years = Number(yearsTraining)
  if (Number.isFinite(years)) {
    if (years >= 2) return 'advanced'
    if (years >= 0.5) return 'intermediate'
    if (years > 0) return 'beginner'
  }
  if (experience === 'consistent') return 'intermediate'
  if (experience === 'returning') return 'beginner'
  return 'beginner'
}

/** "12-15" -> {min:12,max:15}; "8" -> {min:8,max:8}. */
export function parseRepRange(reps: string): { min: number; max: number } | null {
  const m = String(reps ?? '').match(/(\d+)\s*(?:[-–]\s*(\d+))?/)
  if (!m) return null
  const min = parseInt(m[1], 10)
  const max = m[2] ? parseInt(m[2], 10) : min
  if (!Number.isFinite(min)) return null
  return { min, max }
}

/** Upper-body lifts take smaller jumps than lower-body ones. */
function isLowerBody(exerciseName: string): boolean {
  return /squat|deadlift|lunge|leg press|hip thrust|calf|leg curl|leg extension|glute|split squat|step.?up/i.test(
    exerciseName
  )
}

/**
 * Movements loaded by the body rather than by a bar.
 *
 * Used to catch a client typing their bodyweight into a load field, which has
 * already happened: an Inverted Row logged at 160 lb and a Floor Glute-Ham
 * Raise at 158 lb, both of them the client's own weight, now sitting in their
 * personal-record history.
 */
export function isBodyweightMovement(exerciseName: string): boolean {
  return /pull.?up|chin.?up|push.?up|dip\b|inverted row|glute.?ham|bridge|plank|sit.?up|crunch|air squat|burpee|mountain climber|hanging|bodyweight/i.test(
    exerciseName
  )
}

export type Verdict =
  | 'first_time'
  | 'add_load'
  | 'push_reps'
  | 'repeat'
  | 'cut_back'
  | 'change_exercise'
  | 'returning'

export interface NextTarget {
  verdict: Verdict
  /** Short instruction for this exercise today. */
  text: string
  /** True when last session earned a load increase. Drives the highlight. */
  addLoad: boolean
  /** True when this needs the client's attention rather than congratulation. */
  attention: boolean
  /** Suggested working load, when there is one. */
  suggestedWeight: number | null
  /**
   * Suggested reps for the first working set.
   *
   * Exists so the set row can arrive filled in. The advice sentence has always
   * carried this number in words — "go up to 185 and start again at 8" — and
   * the client then typed 185 and 8 by hand into two boxes. Saying it twice,
   * once in prose and once in the field, costs nothing; making them transcribe
   * it costs four taps a set.
   */
  suggestedReps: number | null
}

export interface TargetContext {
  goal: ProgressionGoal
  level: ExperienceLevel
  /** Days since this exercise was last trained. */
  daysSinceLast?: number
  /** Used to spot a bodyweight figure sitting in a load field. */
  bodyWeightLb?: number | null
}

/**
 * Whether a recorded load on a bodyweight movement is really the client's own
 * weight rather than added plates.
 *
 * Checked when READING history, not only when typing. luis has an Inverted Row
 * and a Floor Glute-Ham Raise recorded at roughly his bodyweight, and without
 * this the engine reads those as loads and cheerfully says "go up to 165 lbs"
 * on a movement with no bar. Guarding the input stops new bad rows; this stops
 * the rows already there from producing nonsense advice.
 */
function loadIsActuallyBodyweight(
  exerciseName: string,
  weight: number,
  bodyWeightLb: number | null | undefined
): boolean {
  if (!bodyWeightLb || !isBodyweightMovement(exerciseName)) return false
  return Math.abs(weight - bodyWeightLb) <= 12
}

/**
 * What this client should aim for on this exercise today.
 *
 * `history` is newest-first. Returns null only for work that has no load to
 * progress — conditioning and mobility are prescribed in minutes and are
 * handled by their own model, not this one.
 */
export function nextTarget(
  exerciseName: string,
  reps: string,
  ctx: TargetContext,
  history: ExerciseSession[] | undefined
): NextTarget | null {
  if (/min|sec|hour|km|mile/i.test(String(reps ?? ''))) return null
  const range = parseRepRange(reps)
  if (!range) return null

  const sessions = (history ?? []).filter((s) => s && s.topWeight > 0 && s.topReps > 0)
  const rules = LEVELS[ctx.level]
  const jump = isLowerBody(exerciseName) ? rules.lowerIncrementLb : rules.upperIncrementLb

  if (sessions.length === 0) {
    return {
      verdict: 'first_time',
      addLoad: false,
      attention: false,
      suggestedWeight: null,
      suggestedReps: range.min,
      text: `First time on this one. Pick a weight you could do about ${range.max + 2} reps with, and we'll build from there.`,
    }
  }

  const last = sessions[0]

  // --- Coming back from a layoff outranks everything else -------------------
  //
  // Handing someone the same targets they left on, a month later, is how a
  // comeback session becomes an injury. Strength holds up for a couple of
  // weeks; past that it does not.
  const away = ctx.daysSinceLast ?? 0
  if (away >= LAYOFF_DAYS) {
    const off = away >= LONG_LAYOFF_DAYS ? 0.15 : 0.1
    const target = roundLoad(last.topWeight * (1 - off))
    return {
      verdict: 'returning',
      addLoad: false,
      attention: false,
      suggestedWeight: target,
      suggestedReps: range.min,
      text: `Welcome back — it's been ${Math.round(away / 7)} weeks. Start around ${target} lbs today and build back up. It'll come back faster than you think.`,
    }
  }

  // --- Going backwards, repeatedly ------------------------------------------
  const declining = consecutiveDeclines(sessions)
  if (declining >= DECLINE_BEFORE_CUTBACK) {
    const target = roundLoad(last.topWeight * (1 - CUTBACK_FRACTION))
    return {
      verdict: 'cut_back',
      addLoad: false,
      attention: true,
      suggestedWeight: target,
      suggestedReps: range.min,
      text: `This one's slipped ${declining} sessions running. Drop to ${target} lbs and build back up — that clears it faster than grinding the same weight.`,
    }
  }

  // --- Genuinely stuck, and working hard for it -----------------------------
  const flat = flatSessions(sessions)
  const workingHard = last.rir != null && last.rir <= 1
  if (flat >= rules.stallAfter && workingHard) {
    return {
      verdict: 'change_exercise',
      addLoad: false,
      attention: true,
      suggestedWeight: last.topWeight,
      suggestedReps: last.topReps,
      text: `${flat} sessions at ${last.topWeight} lbs and you're giving it everything. Time to swap this for something similar — a fresh movement usually gets things moving again.`,
    }
  }

  // --- Earned the increase --------------------------------------------------
  const atTop = sessionsAtTopOfRange(sessions, range.max)

  // On a movement the body loads, with the body's weight in the load field,
  // "add 5 lbs" is meaningless. Progress the reps instead and say so plainly.
  if (atTop >= rules.sessionsAtTopToAdd && loadIsActuallyBodyweight(exerciseName, last.topWeight, ctx.bodyWeightLb)) {
    return {
      verdict: 'push_reps',
      addLoad: false,
      attention: false,
      suggestedWeight: null,
      suggestedReps: Math.min(range.max, last.topReps + 1),
      text: `Strong — you're on top of this one. Add a rep or two rather than weight, and leave the weight box at 0 unless you're holding a plate.`,
    }
  }

  if (atTop >= rules.sessionsAtTopToAdd) {
    const target = roundLoad(last.topWeight + jump)
    return {
      verdict: 'add_load',
      addLoad: true,
      attention: false,
      suggestedWeight: target,
      suggestedReps: range.min,
      text:
        range.min === range.max
          ? `You hit all ${range.max}s last time — go up to ${target} lbs.`
          : `You topped the range last time — go up to ${target} lbs and start again at ${range.min}.`,
    }
  }

  // --- Sliding, but not far enough to act on --------------------------------
  //
  // One or two sessions down is not a stall and gets no alarm, but telling
  // someone to "push toward 12" while they are going backwards ignores what is
  // actually in front of them. Run the same weight back instead.
  if (declining >= 1) {
    return {
      verdict: 'repeat',
      addLoad: false,
      attention: false,
      suggestedWeight: last.topWeight,
      suggestedReps: last.topReps,
      text:
        declining === 1
          ? `Last time was a bit down on the one before. Run ${last.topWeight} lbs back — everyone has an off day.`
          : `${last.topWeight} lbs again today. Two sessions have come in under, so let's match it before pushing on.`,
    }
  }

  // --- Still climbing -------------------------------------------------------
  return {
    verdict: 'push_reps',
    addLoad: false,
    attention: false,
    suggestedWeight: last.topWeight,
    suggestedReps: Math.min(range.max, last.topReps + 1),
    text:
      range.min === range.max
        ? `Stay at ${last.topWeight} lbs and get all ${range.max}s. Lowest set last time was ${last.lowestReps}.`
        : `Stay at ${last.topWeight} lbs and push toward ${range.max}. Lowest set last time was ${last.lowestReps}.`,
  }
}

/**
 * Round to something a client can actually load: 2.5 lb, a pair of 1.25s.
 *
 * This used to round to the nearest 5 above 100 lb, which silently destroyed
 * the whole advanced tier — a 2.5 lb jump from 100 rounded straight back to
 * 105, so an advanced lifter got the beginner's increment anyway. Any rounding
 * step coarser than the smallest increment eats that increment.
 */
function roundLoad(lb: number): number {
  return Math.round(lb / 2.5) * 2.5
}

/**
 * How many sessions in a row got worse, walking back from the most recent.
 *
 * Worse means less total work, not just less weight: dropping from 135x10 to
 * 135x7 is a decline even though the load is unchanged.
 */
function consecutiveDeclines(sessions: ExerciseSession[]): number {
  let n = 0
  for (let i = 0; i < sessions.length - 1; i++) {
    const now = sessions[i].topWeight * sessions[i].topReps
    const before = sessions[i + 1].topWeight * sessions[i + 1].topReps
    if (now < before) n++
    else break
  }
  return n
}

/** How many recent sessions sat at the same top weight without beating it. */
function flatSessions(sessions: ExerciseSession[]): number {
  if (sessions.length === 0) return 0
  const w = sessions[0].topWeight
  let n = 0
  for (const s of sessions) {
    if (s.topWeight === w) n++
    else break
  }
  return n
}

/** How many of the most recent sessions hit the top of the rep range. */
function sessionsAtTopOfRange(sessions: ExerciseSession[], max: number): number {
  let n = 0
  for (const s of sessions) {
    if (s.lowestReps >= max) n++
    else break
  }
  return n
}

/* -------------------------------------------------------------------------- */

export interface FatigueSignal {
  /** Exercises that went backwards in the session just finished. */
  downCount: number
  text: string | null
}

/**
 * Whether the session just finished looks like a recovery problem rather than
 * a programming one.
 *
 * A single lift going backwards is noise. Several going backwards on the same
 * day is the body saying something, and it is visible in data already being
 * collected — the app simply never looked across exercises before.
 */
export function sessionFatigue(
  todayByExercise: Record<string, { topWeight: number; topReps: number }>,
  history: Record<string, ExerciseSession[]>
): FatigueSignal {
  let down = 0
  let compared = 0
  for (const [name, today] of Object.entries(todayByExercise)) {
    const prev = (history[name] ?? [])[0]
    if (!prev || !today.topWeight || !today.topReps) continue
    compared++
    if (today.topWeight * today.topReps < prev.topWeight * prev.topReps) down++
  }
  if (compared < 3 || down < 3) return { downCount: down, text: null }
  return {
    downCount: down,
    text: `${down} lifts came in under last time today. That's usually sleep, stress or food rather than training — worth an easy day before the next one.`,
  }
}
