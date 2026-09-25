import {
  calorieFloorFor,
  deriveMacros,
  type FitnessGoal,
  type Sex,
} from '@/lib/nutrition-goals'

/**
 * Progress-based adjustment: decide whether a client's targets should move,
 * and by how much.
 *
 * Deliberately pure. It takes a snapshot of numbers and returns a decision,
 * with no database access and no clock, so that every branch below can be
 * tested directly rather than inferred from behaviour in production. The job
 * that gathers the data and writes the result lives elsewhere.
 *
 * Two rules shape the whole thing:
 *
 *   1. Never act on a single weigh-in. Daily weight moves several pounds on
 *      water, sodium, stress and menstrual cycle; a fortnight of averaged data
 *      carries signal, one morning does not.
 *
 *   2. Adherence is a gate, not a factor. If someone is not eating their
 *      current target, the target is not the problem and lowering it makes
 *      things worse. Most automated nutrition systems get this backwards and
 *      drive people into a spiral of ever-smaller numbers they hit ever less
 *      often.
 */

export type Verdict =
  | 'insufficient_data'
  | 'hold'
  | 'adherence_first'
  | 'decrease'
  | 'increase'
  | 'diet_break'
  | 'escalate'

export type EscalationCode =
  | 'rapid_loss'
  | 'stalled_despite_adherence'
  | 'adherence_collapse'
  | 'hunger_energy'
  | 'gaining_in_deficit'
  | 'medication_flag'
  | 'performance_drop'

export interface AdjustmentInputs {
  /** Rolling 7-day mean weight for the most recent window. */
  currentAvgWeight: number | null
  /** Rolling 7-day mean weight roughly a fortnight earlier. */
  priorAvgWeight: number | null
  /** Days between the midpoints of those two windows. */
  daysBetween: number
  /** How many separate days contributed weight to each window. */
  weighInsInWindow: number
  priorWeighInsInWindow: number

  currentCalories: number
  maintenanceCalories: number
  bmr: number
  sex: Sex
  goal: FitnessGoal
  currentWeight: number
  goalWeight: number
  /** Signed percent of bodyweight per week we are aiming for. */
  targetRatePctPerWeek: number

  /** All 1 to 5, or null when the client did not answer. */
  adherence: number | null
  hunger: number | null
  energy: number | null
  sleep: number | null
  trainingPerformance: number | null
  /** Negative means the waist came down. */
  waistChangeIn: number | null

  daysSinceLastChange: number | null
  /** How many consecutive prior periods already came back slow. */
  priorSlowPeriods: number
  /** Consecutive prior periods where hunger or energy was flagged. */
  priorStrainPeriods: number
  weeksInDeficit: number

  /** A weight-affecting medication was declared at screening. */
  medicationFlag: boolean
  /** Accelerator or Full Experience: propose rather than apply. */
  coached: boolean
}

export interface AdjustmentResult {
  verdict: Verdict
  /** Null when nothing should change. */
  newCalories: number | null
  newProtein: number | null
  newCarbs: number | null
  newFats: number | null
  /** Plain language, shown to the client. */
  reason: string
  /** For Anthony. Says what the engine saw, not what it decided. */
  coachNote: string
  escalation: EscalationCode | null
  /** True when a human must confirm before this takes effect. */
  requiresApproval: boolean
  evidence: Record<string, unknown>
}

/** Minimum data before any decision. Two weeks, and enough weigh-ins to mean it. */
const MIN_DAYS = 13
/**
 * Two weigh-ins per window, not three.
 *
 * The first version asked for three inside a seven-day window, which quietly
 * meant the engine could only ever fire for someone weighing in most days on
 * the Progress page. The weekly check-in -- the thing clients are actually
 * asked to do, and which already writes its weight into body_metrics --
 * produces one per week, so a diligent client checking in every week would
 * have been told "not enough data" forever.
 *
 * The windows are now a fortnight wide each, so a weekly check-in gives two
 * per window and a daily weigher gives a dozen. Two is still enough to honour
 * the rule that matters: never act on a single weigh-in.
 */
const MIN_WEIGH_INS = 2
/** Wait this long after a change before judging it. */
const COOLDOWN_DAYS = 13
/** Rate within this much of target counts as on track. */
const RATE_TOLERANCE = 0.25
/** How hard we move calories in one step. */
const STEP = 0.05
/** Never move more than this in one step. */
const MAX_STEP = 0.1
/** Faster than this needs a human, whatever the target says. */
const RAPID_LOSS_PCT = 1.5
/** Adherence at or below this is a behaviour problem, not a maths problem. */
const ADHERENCE_GATE = 3
const ADHERENCE_COLLAPSE = 2
/** Weeks in a deficit before a maintenance phase is offered. */
const DIET_BREAK_WEEKS = 12

const nothing = (
  verdict: Verdict,
  reason: string,
  coachNote: string,
  evidence: Record<string, unknown>,
  escalation: EscalationCode | null = null
): AdjustmentResult => ({
  verdict,
  newCalories: null,
  newProtein: null,
  newCarbs: null,
  newFats: null,
  reason,
  coachNote,
  escalation,
  // An escalation always wants a human, even when no number changes.
  requiresApproval: escalation !== null,
  evidence,
})

export function decideAdjustment(i: AdjustmentInputs): AdjustmentResult {
  const weeks = i.daysBetween / 7
  const lbsChange =
    i.currentAvgWeight !== null && i.priorAvgWeight !== null
      ? i.currentAvgWeight - i.priorAvgWeight
      : null
  const actualRatePct =
    lbsChange !== null && weeks > 0 && i.currentAvgWeight
      ? (lbsChange / weeks / i.currentAvgWeight) * 100
      : null

  const evidence: Record<string, unknown> = {
    currentAvgWeight: i.currentAvgWeight,
    priorAvgWeight: i.priorAvgWeight,
    daysBetween: i.daysBetween,
    weighInsInWindow: i.weighInsInWindow,
    priorWeighInsInWindow: i.priorWeighInsInWindow,
    lbsChange: lbsChange === null ? null : Math.round(lbsChange * 100) / 100,
    actualRatePct: actualRatePct === null ? null : Math.round(actualRatePct * 100) / 100,
    targetRatePct: i.targetRatePctPerWeek,
    adherence: i.adherence,
    hunger: i.hunger,
    energy: i.energy,
    sleep: i.sleep,
    trainingPerformance: i.trainingPerformance,
    waistChangeIn: i.waistChangeIn,
    weeksInDeficit: i.weeksInDeficit,
    currentCalories: i.currentCalories,
  }

  // --- Nothing to reason about yet ---
  if (i.daysBetween < MIN_DAYS || actualRatePct === null) {
    return nothing(
      'insufficient_data',
      'Not enough data yet. Keep weighing in and we will look again shortly.',
      `Needs ${MIN_DAYS}+ days between averages; has ${i.daysBetween}.`,
      evidence
    )
  }
  if (i.weighInsInWindow < MIN_WEIGH_INS || i.priorWeighInsInWindow < MIN_WEIGH_INS) {
    return nothing(
      'insufficient_data',
      'We need another weigh-in or two before changing anything. Your weekly check-in counts.',
      `Weigh-ins: ${i.weighInsInWindow} recent, ${i.priorWeighInsInWindow} prior. Needs ${MIN_WEIGH_INS} in each.`,
      evidence
    )
  }

  // --- A declared medication makes weight signals mean something else ---
  if (i.medicationFlag) {
    return nothing(
      'escalate',
      'Anthony is reviewing your targets personally.',
      'Weight-affecting medication declared at screening. The engine will not adjust this client automatically.',
      evidence,
      'medication_flag'
    )
  }

  const losing = lbsChange !== null && lbsChange < 0
  const cutting = i.targetRatePctPerWeek < 0

  // --- Escalations that outrank everything, including adherence ---
  if (cutting && actualRatePct < -RAPID_LOSS_PCT) {
    return nothing(
      'escalate',
      'You are losing faster than we want. Anthony will get in touch.',
      `Losing ${Math.abs(actualRatePct).toFixed(2)}% of bodyweight a week, past the ${RAPID_LOSS_PCT}% ceiling.`,
      evidence,
      'rapid_loss'
    )
  }

  if (cutting && !losing && (i.adherence ?? 0) >= 4 && lbsChange !== null && lbsChange > 0) {
    return nothing(
      'escalate',
      'Your weight is up despite sticking to the plan. Anthony will look at this with you.',
      'Gaining in a deficit with adherence 4+. Consider measurement error, water retention, stress, sleep, or a thyroid/medication cause.',
      evidence,
      'gaining_in_deficit'
    )
  }

  const strained = (i.hunger !== null && i.hunger >= 5) || (i.energy !== null && i.energy <= 1)
  if (strained && i.priorStrainPeriods >= 1) {
    return nothing(
      'escalate',
      'You have flagged hunger or low energy two check-ins running. Anthony will look at this before anything changes.',
      `Hunger ${i.hunger ?? '-'}/5, energy ${i.energy ?? '-'}/5, second consecutive period.`,
      evidence,
      'hunger_energy'
    )
  }

  if (i.adherence !== null && i.adherence <= ADHERENCE_COLLAPSE && i.priorSlowPeriods >= 1) {
    return nothing(
      'escalate',
      'Anthony will reach out, this looks like the plan needs changing rather than the numbers.',
      `Adherence ${i.adherence}/5 across consecutive periods. Lowering calories here would make it worse.`,
      evidence,
      'adherence_collapse'
    )
  }

  if (cutting && i.trainingPerformance !== null && i.trainingPerformance <= 2) {
    return nothing(
      'escalate',
      'Your training has been feeling harder. Anthony will check whether the deficit is too steep.',
      `Training performance ${i.trainingPerformance}/5 while cutting. Usually means the deficit is too aggressive.`,
      evidence,
      'performance_drop'
    )
  }

  // --- Adherence gate. The target is not the problem if it is not being eaten ---
  if (i.adherence !== null && i.adherence <= ADHERENCE_GATE) {
    return nothing(
      'adherence_first',
      'We are leaving your targets where they are. Hitting the current number consistently comes before changing it.',
      `Adherence ${i.adherence}/5. Holding calories deliberately; a lower target would be hit less often, not more.`,
      evidence
    )
  }

  // --- A long deficit earns a break ---
  if (cutting && i.weeksInDeficit >= DIET_BREAK_WEEKS) {
    const target = Math.min(i.maintenanceCalories, Math.round((i.currentCalories * 1.15) / 25) * 25)
    const m = deriveMacros(target, i.currentWeight, i.goalWeight, i.goal)
    return {
      verdict: 'diet_break',
      newCalories: target,
      newProtein: m.proteinGrams,
      newCarbs: m.carbGrams,
      newFats: m.fatGrams,
      reason: `You have been in a deficit for ${i.weeksInDeficit} weeks. We are moving you to maintenance for a week or two. This is part of the plan, not a setback, and it makes the next block work better.`,
      coachNote: `${i.weeksInDeficit} weeks in a deficit. Proposing a maintenance phase at ${target} cal.`,
      escalation: null,
      requiresApproval: i.coached,
      evidence,
    }
  }

  // --- Cooldown: judge a change only after it has had time to show ---
  if (i.daysSinceLastChange !== null && i.daysSinceLastChange < COOLDOWN_DAYS) {
    return nothing(
      'hold',
      'Your targets changed recently. We are giving them time to show before touching them again.',
      `Last change ${i.daysSinceLastChange} days ago, under the ${COOLDOWN_DAYS}-day cooldown.`,
      evidence
    )
  }

  // --- Recomposition: the scale can sit still while the waist comes down ---
  const flat = Math.abs(actualRatePct) < RATE_TOLERANCE
  if (cutting && flat && i.waistChangeIn !== null && i.waistChangeIn <= -0.25) {
    return nothing(
      'hold',
      `Your weight is level but your waist is down ${Math.abs(i.waistChangeIn)} inches. That is fat loss the scale cannot see. Nothing needs changing.`,
      'Scale flat, waist down. Recomposition, not a stall. Do not cut calories here.',
      evidence
    )
  }

  const gap = actualRatePct - i.targetRatePctPerWeek

  // --- On track ---
  if (Math.abs(gap) <= RATE_TOLERANCE) {
    return nothing(
      'hold',
      'You are moving at about the rate we planned. Nothing to change.',
      `Actual ${actualRatePct.toFixed(2)}%/wk against target ${i.targetRatePctPerWeek.toFixed(2)}%/wk.`,
      evidence
    )
  }

  // "Faster than planned" means different signs for a cut and a bulk, so the
  // label and the calorie direction are derived separately.
  //
  // The direction is the simpler of the two and holds for both goals: a gap
  // above target always means eat less (losing too slowly, or gaining too
  // fast) and a gap below target always means eat more. Deriving it from the
  // "too fast" label instead inverted every bulking client -- someone gaining
  // faster than planned was handed MORE calories.
  const tooFast = cutting ? gap < 0 : gap > 0
  const direction = gap > 0 ? -1 : 1

  // --- Third slow period in a row is a coaching problem, not another 5% ---
  if (!tooFast && i.priorSlowPeriods >= 2) {
    return nothing(
      'escalate',
      'Progress has been slower than planned for a while now despite good adherence. Anthony will work through this with you rather than just cutting further.',
      `Third consecutive slow period at adherence ${i.adherence ?? '-'}/5. Repeated 5% cuts are the wrong answer; check activity, tracking accuracy, sleep and stress.`,
      evidence,
      'stalled_despite_adherence'
    )
  }

  // --- Move the number ---
  const raw = i.currentCalories * (1 + direction * STEP)
  const maxMove = i.currentCalories * MAX_STEP
  const bounded =
    Math.abs(raw - i.currentCalories) > maxMove
      ? i.currentCalories + direction * maxMove
      : raw

  const floor = calorieFloorFor(i.sex, i.bmr)
  let target = Math.round(bounded / 25) * 25
  let hitFloor = false
  if (target < floor) {
    target = Math.ceil(floor / 25) * 25
    hitFloor = true
  }

  if (target === i.currentCalories) {
    return nothing(
      'hold',
      hitFloor
        ? 'Your calories are already at the lowest level we will set. Anthony will look at other options with you.'
        : 'No change needed this fortnight.',
      hitFloor
        ? 'Wanted to cut but the client is already at the floor. Needs a non-calorie answer: activity, adherence, or a diet break.'
        : 'Rounding produced no change.',
      { ...evidence, hitFloor },
      hitFloor ? 'stalled_despite_adherence' : null
    )
  }

  const m = deriveMacros(target, i.currentWeight, i.goalWeight, i.goal)
  const delta = target - i.currentCalories
  const added = delta > 0

  const pace = tooFast
    ? `You have been ${cutting ? 'losing' : 'gaining'} faster than planned`
    : 'Your weight has been moving slower than planned and you have been consistent'
  const move = added
    ? `so we are adding ${Math.abs(delta)} calories a day`
    : `so we are taking ${Math.abs(delta)} calories a day off`
  const tail = tooFast
    ? 'Faster is not better: it costs muscle and makes this harder to keep up.'
    : 'Small change, on purpose.'

  return {
    // Named for what happens to the calories, not to the rate.
    verdict: added ? 'increase' : 'decrease',
    newCalories: target,
    newProtein: m.proteinGrams,
    newCarbs: m.carbGrams,
    newFats: m.fatGrams,
    reason: `${pace}, ${move}. ${tail}${
      hitFloor ? ' This is the lowest level we will set for you.' : ''
    }`,
    coachNote: `Actual ${actualRatePct.toFixed(2)}%/wk vs target ${i.targetRatePctPerWeek.toFixed(2)}%/wk at adherence ${i.adherence ?? '-'}/5. ${delta > 0 ? '+' : ''}${delta} cal.${hitFloor ? ' NOW AT THE FLOOR: further progress needs activity or a diet break, not fewer calories.' : ''}`,
    // Reaching the floor is worth telling Anthony about the moment it happens,
    // not a fortnight later when the next period has nowhere left to go.
    escalation: hitFloor ? 'stalled_despite_adherence' : null,
    requiresApproval: i.coached || hitFloor,
    evidence: { ...evidence, hitFloor, delta },
  }
}
