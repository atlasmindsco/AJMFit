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

/**
 * A jump this big, as a share of what they are lifting, earns extra patience.
 *
 * The increments above are flat pounds, and a flat pound is a different
 * exercise depending on the bar. Measured against the 1,371 sets clients have
 * actually logged: +5 on a 125 lb bench is 4%, and +5 on a 20 lb lateral
 * raise is 25%. Thirty-two of the sixty exercises clients log would get a
 * jump worth more than a tenth of the weight in their hands.
 *
 * So the LIFT decides the patience, not the lifter. A client cannot answer
 * "how experienced are you" in a way the app can trust — three features have
 * already broken on self-reported fields nobody fills in — but "how big is
 * this jump for you" is measured from what they just lifted.
 */
const BIG_JUMP = 0.1
const MODERATE_JUMP = 0.05

/**
 * Dumbbells come in fives, per hand.
 *
 * A 10 lb jump on a dumbbell lift is not a jump, it is skipping a rung: the
 * next pair up IS +5 each. Dumbbell Lunges sit at a 25 lb median in the logs,
 * so the old +10 was a 40% overload in one step — the largest single error in
 * this file.
 *
 * Read off the name rather than the library's equipment field, which this
 * module cannot reach. Unlike a bench, which is implicit and invisible, an
 * exercise called "Dumbbell Lunges" is telling you what is in the client's
 * hands.
 */
// Just the word. A "|db" alternative was meant to carry a word boundary and
// the escape turned into a literal control character on its way into the
// file, which is its own argument for keeping this simple.
const DUMBBELL = /dumbbell/i

/** Consecutive declining sessions before we cut the load and rebuild. */
const DECLINE_BEFORE_CUTBACK = 3
/** How much to take off when rebuilding. */
const CUTBACK_FRACTION = 0.1
/** A layoff longer than this softens the next session's targets. */
/**
 * Extra flat sessions required before calling a stall when nobody said how
 * hard it felt.
 *
 * The stall branch required `rir <= 1` — proof they were working hard. RIR is
 * recorded on 56 of 1,371 sets, four per cent, so in practice the branch
 * never fired and a client grinding the same weight for two months was told
 * to keep pushing toward the top of the range forever. The fifth feature
 * gated on a field nobody fills in.
 *
 * Without the rating we cannot tell a stall from coasting, so we wait longer
 * rather than not at all. Six flat sessions at the same weight is a stall
 * whatever the effort was.
 */
const STALL_PATIENCE_WITHOUT_RIR = 2

const LAYOFF_DAYS = 14
const LONG_LAYOFF_DAYS = 28

/**
 * Did onboarding actually tell us anything about training age?
 *
 * `experienceFrom` falls back to 'beginner' when it knows nothing, which is the
 * right call for load increments — guessing small is safe. It is the wrong call
 * for hiding features, and that distinction got lost: gating the intensity
 * panel on `level !== 'beginner'` hid drop sets, rest-pause and partials from
 * every client on the platform, because all nine have null experience answers.
 *
 * Absence of evidence is not evidence. Anything that takes a tool AWAY asks
 * this first.
 */
export function experienceKnown(
  experience: string | undefined | null,
  yearsTraining: string | number | undefined | null
): boolean {
  const years = Number(yearsTraining)
  if (yearsTraining != null && yearsTraining !== '' && Number.isFinite(years) && years > 0) return true
  return experience === 'consistent' || experience === 'returning' || experience === 'new'
}

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
  // A lower-body DUMBBELL lift takes the upper-body increment, because five
  // pounds a hand is the smallest step the rack allows. See DUMBBELL above.
  const jump =
    isLowerBody(exerciseName) && !DUMBBELL.test(exerciseName)
      ? rules.lowerIncrementLb
      : rules.upperIncrementLb
  // Dumbbells round to fives for the same reason; a barbell to 2.5.
  const loadStep = DUMBBELL.test(exerciseName) ? 5 : 2.5

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
  // Stuck means no more weight AND no more reps. Flat weight on its own is
  // what double progression looks like while it is working.
  const flat = stalledSessions(sessions)
  const workingHard = last.rir != null && last.rir <= 1
  // Nobody said how hard it felt, which is the normal case. Wait longer
  // rather than never calling it at all.
  const stallAt = workingHard ? rules.stallAfter : rules.stallAfter + STALL_PATIENCE_WITHOUT_RIR
  if (flat >= stallAt) {
    return {
      verdict: 'change_exercise',
      addLoad: false,
      attention: true,
      suggestedWeight: last.topWeight,
      suggestedReps: last.topReps,
      // Only claim they were working hard if they actually said so. With no
      // rating on record the honest sentence is about the weight, not the
      // effort — the app does not know how hard it felt.
      text: workingHard
        ? `${flat} sessions at ${last.topWeight} lbs and you're giving it everything. Time to swap this for something similar — a fresh movement usually gets things moving again.`
        : `${flat} sessions stuck at ${last.topWeight} lbs. Swap this for something similar — a fresh movement usually gets things moving again.`,
    }
  }

  // --- Earned the increase --------------------------------------------------
  const atTop = sessionsAtTopOfRange(sessions, range.max)
  const needed = sessionsBeforeAdding(rules.sessionsAtTopToAdd, jump, last.topWeight)

  // On a movement the body loads, with the body's weight in the load field,
  // "add 5 lbs" is meaningless. Progress the reps instead and say so plainly.
  if (atTop >= needed && loadIsActuallyBodyweight(exerciseName, last.topWeight, ctx.bodyWeightLb)) {
    return {
      verdict: 'push_reps',
      addLoad: false,
      attention: false,
      suggestedWeight: null,
      suggestedReps: Math.min(range.max, last.topReps + 1),
      text: `Strong — you're on top of this one. Add a rep or two rather than weight, and leave the weight box at 0 unless you're holding a plate.`,
    }
  }

  if (atTop >= needed) {
    const target = roundLoad(last.topWeight + jump, loadStep)
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
function roundLoad(lb: number, step = 2.5): number {
  return Math.round(lb / step) * step
}

/**
 * How many sessions at the top of the range before the load moves.
 *
 * The experience table sets a floor; the size of the jump relative to the
 * weight in their hands can only raise it. A 4% jump on a bench goes up after
 * one good session exactly as it always did. A 25% jump on a lateral raise
 * waits for three.
 */
function sessionsBeforeAdding(base: number, jump: number, currentLoad: number): number {
  if (currentLoad <= 0) return base
  const share = jump / currentLoad
  if (share > BIG_JUMP) return Math.max(base, 3)
  if (share > MODERATE_JUMP) return Math.max(base, 2)
  return base
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

/**
 * How many recent sessions made NO progress at all — not in weight, not in
 * reps.
 *
 * `flatSessions` compares the top weight only, which is the right measure for
 * "have they been at this load a while" and the wrong one for "are they
 * stuck". Double progression — the thing rep ranges exist to make possible —
 * looks exactly like a flat weight: 20 lb for eight reps, then ten, then
 * twelve, is a client getting stronger every single session.
 *
 * Gating the stall on flat WEIGHT alone would have told nine clients in the
 * live data to swap an exercise they were steadily improving at. Caught by
 * replaying all 1,371 logged sets through both versions before shipping.
 */
function stalledSessions(sessions: ExerciseSession[]): number {
  let n = 0
  for (let i = 0; i < sessions.length - 1; i++) {
    const now = sessions[i]
    const before = sessions[i + 1]
    const heavier = now.topWeight > before.topWeight
    const moreReps = now.topWeight === before.topWeight && now.topReps > before.topReps
    if (heavier || moreReps) break
    n++
  }
  // The loop counts gaps between sessions; the one at the near end is stuck
  // too, so a run of two gaps is three stuck sessions.
  return n === 0 ? 0 : n + 1
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
