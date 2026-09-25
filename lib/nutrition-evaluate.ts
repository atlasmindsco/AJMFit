import { decideAdjustment, type AdjustmentInputs, type AdjustmentResult } from '@/lib/nutrition-adjustment'
import { calculateBMR, maintenanceFor, type FitnessGoal, type NutritionGoalSetup, type Sex } from '@/lib/nutrition-goals'
import { recordTargetChange } from '@/lib/nutrition-history'
import { isCoached } from '@/lib/tiers'

/**
 * Gathers what the adjustment engine needs, runs it, and records the outcome.
 *
 * The engine itself is pure and lives in nutrition-adjustment.ts. This file is
 * the part that touches the database, kept separate so the decision rules can
 * be tested exhaustively without a database and so the rules are readable on
 * their own -- they are the part a coach would want to check.
 */

const DAY = 86400000
const iso = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Which tier each of these clients is actually on.
 *
 * There is no users.tier column. Live billing state is subscriptions.tier;
 * applications.tier is only what someone asked for when they signed up, which
 * can differ from what they are paying for now. Billing wins, and a client
 * with neither is treated as Blueprint -- the tier that gets adjustments
 * applied automatically rather than waiting on a coach who was never assigned.
 */
export async function resolveTiers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userIds: string[]
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  if (userIds.length === 0) return out

  const { data: apps } = await admin
    .from('applications')
    .select('user_id, tier, created_at')
    .in('user_id', userIds)
    .order('created_at', { ascending: true })
  for (const a of apps ?? []) out.set(a.user_id, a.tier)

  const { data: subs } = await admin
    .from('subscriptions')
    .select('user_id, tier, status')
    .in('user_id', userIds)
    .in('status', ['trialing', 'active', 'past_due'])
  for (const s of subs ?? []) if (s.tier) out.set(s.user_id, s.tier)

  return out
}

interface WeightRow {
  recorded_on: string
  weight_lb: number | null
  waist_in: number | null
}

/** Mean of the weigh-ins inside a window, and how many there were. */
function windowMean(rows: WeightRow[], from: string, to: string) {
  const inWindow = rows.filter(
    (r) => r.weight_lb !== null && r.recorded_on >= from && r.recorded_on <= to
  )
  if (inWindow.length === 0) return { mean: null as number | null, count: 0 }
  const mean = inWindow.reduce((s, r) => s + Number(r.weight_lb), 0) / inWindow.length
  return { mean, count: inWindow.length }
}

export interface EvaluationOutcome {
  userId: string
  name: string
  result: AdjustmentResult
  applied: boolean
  skipped: string | null
}

/**
 * Evaluate one client. Returns the decision and whether it was applied.
 *
 * `dryRun` computes and returns everything without writing, so the job can be
 * inspected against real data before it is ever allowed to change a target.
 */
export async function evaluateClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any,
  opts: { dryRun?: boolean; today?: Date } = {}
): Promise<EvaluationOutcome> {
  const today = opts.today ?? new Date()
  const base = { userId: user.id, name: user.name ?? user.email ?? user.id }

  if (!user.nutrition_goal_setup_complete || !user.daily_cal_target) {
    return { ...base, result: null as never, applied: false, skipped: 'no nutrition setup' }
  }
  if (user.nutrition_block_code) {
    return { ...base, result: null as never, applied: false, skipped: `health block: ${user.nutrition_block_code}` }
  }

  // --- Weight windows: the last fortnight against the fortnight before it ---
  //
  // Two 14-day windows rather than two 7-day ones, because the weekly check-in
  // is the input most clients will actually use and it produces one weigh-in a
  // week. Seven-day windows needing three weigh-ins each meant the engine
  // could only ever fire for someone weighing in most days on the Progress
  // page, and would tell a diligent weekly client "not enough data" forever.
  //
  // The midpoints are still 14 days apart, so the rate maths is unchanged.
  const { data: weights } = await admin
    .from('body_metrics')
    .select('recorded_on, weight_lb, waist_in')
    .eq('user_id', user.id)
    .gte('recorded_on', iso(new Date(today.getTime() - 35 * DAY)))
    .order('recorded_on', { ascending: false })

  const rows = (weights ?? []) as WeightRow[]
  const recent = windowMean(rows, iso(new Date(today.getTime() - 13 * DAY)), iso(today))
  const prior = windowMean(
    rows,
    iso(new Date(today.getTime() - 27 * DAY)),
    iso(new Date(today.getTime() - 14 * DAY))
  )

  // Waist over the same span. The scale can sit still while the waist comes
  // down, and cutting calories on a client who is actually succeeding is the
  // worst mistake this engine could make.
  const waists = rows.filter((r) => r.waist_in !== null)
  const waistChangeIn =
    waists.length >= 2 ? Number(waists[0].waist_in) - Number(waists[waists.length - 1].waist_in) : null

  // --- Most recent check-in ---
  const { data: checkIns } = await admin
    .from('check_ins')
    .select('nutrition_adherence, energy, hunger, sleep_quality, training_performance, week_of')
    .eq('user_id', user.id)
    .order('week_of', { ascending: false })
    .limit(3)
  const latest = (checkIns ?? [])[0] ?? {}
  const previous = (checkIns ?? [])[1] ?? {}

  // --- History ---
  const { data: history } = await admin
    .from('nutrition_target_history')
    .select('created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
  const lastChange = (history ?? [])[0]?.created_at
  const daysSinceLastChange = lastChange
    ? Math.floor((today.getTime() - new Date(lastChange).getTime()) / DAY)
    : null

  const { data: firstHistory } = await admin
    .from('nutrition_target_history')
    .select('created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
  const startedAt = (firstHistory ?? [])[0]?.created_at
  const weeksInDeficit =
    user.nutrition_goal === 'lose_fat' && startedAt
      ? Math.floor((today.getTime() - new Date(startedAt).getTime()) / (7 * DAY))
      : 0

  const { data: priorAdj } = await admin
    .from('nutrition_adjustments')
    .select('verdict, evidence')
    .eq('user_id', user.id)
    .in('status', ['approved', 'auto_applied', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(4)

  // Trailing runs, newest first, stopping at the first period that broke the run.
  let priorSlowPeriods = 0
  for (const a of priorAdj ?? []) {
    if (a.verdict === 'decrease') priorSlowPeriods++
    else break
  }
  let priorStrainPeriods = 0
  for (const a of priorAdj ?? []) {
    const e = a.evidence ?? {}
    if ((e.hunger != null && e.hunger >= 5) || (e.energy != null && e.energy <= 1)) priorStrainPeriods++
    else break
  }

  // --- Reconstruct maintenance the same way setup did ---
  const setup: NutritionGoalSetup = {
    currentWeight: Number(user.current_weight),
    goalWeight: Number(user.goal_weight),
    height: Number(user.height),
    age: Number(user.age),
    sex: user.sex as Sex,
    activityLevel: user.activity_level,
    goal: user.nutrition_goal as FitnessGoal,
    jobActivity: user.job_activity ?? undefined,
    trainingDaysPerWeek: user.training_days_per_week ?? undefined,
  }
  const bmr = calculateBMR(setup.currentWeight, setup.height, setup.age, setup.sex)
  const maintenance = maintenanceFor(bmr, setup)

  // The rate we are aiming for, taken from the target actually in force rather
  // than recomputed, so a coach's hand-set number is respected.
  const currentCalories = Number(user.custom_cal_target ?? user.daily_cal_target)
  const targetRatePctPerWeek =
    setup.currentWeight > 0
      ? (((currentCalories - maintenance) * 7) / 3500 / setup.currentWeight) * 100
      : 0

  const screen = user.health_screen ?? {}

  const inputs: AdjustmentInputs = {
    currentAvgWeight: recent.mean,
    priorAvgWeight: prior.mean,
    daysBetween: recent.mean !== null && prior.mean !== null ? 14 : 0,
    weighInsInWindow: recent.count,
    priorWeighInsInWindow: prior.count,
    currentCalories,
    maintenanceCalories: maintenance,
    bmr,
    sex: setup.sex,
    goal: setup.goal,
    currentWeight: recent.mean ?? setup.currentWeight,
    goalWeight: setup.goalWeight,
    targetRatePctPerWeek: Math.round(targetRatePctPerWeek * 100) / 100,
    adherence: latest.nutrition_adherence ?? null,
    hunger: latest.hunger ?? null,
    energy: latest.energy ?? null,
    sleep: latest.sleep_quality ?? null,
    trainingPerformance: latest.training_performance ?? null,
    waistChangeIn,
    daysSinceLastChange,
    priorSlowPeriods,
    priorStrainPeriods,
    weeksInDeficit,
    medicationFlag: screen.weightAffectingMedication === true,
    coached: isCoached(user.tier),
  }
  void previous

  const result = decideAdjustment(inputs)

  if (opts.dryRun) return { ...base, result, applied: false, skipped: null }

  // Nothing worth recording for a routine no-op. A proposals table full of
  // "not enough data yet" is a proposals table nobody reads.
  if (result.verdict === 'insufficient_data' || (result.verdict === 'hold' && !result.escalation)) {
    return { ...base, result, applied: false, skipped: null }
  }

  // A newer evaluation replaces any proposal still waiting: the partial unique
  // index allows only one pending row per client, and stale advice is worse
  // than none.
  await admin
    .from('nutrition_adjustments')
    .update({ status: 'superseded' })
    .eq('user_id', user.id)
    .eq('status', 'pending')

  const autoApply = !result.requiresApproval && result.newCalories !== null

  const { data: inserted } = await admin
    .from('nutrition_adjustments')
    .insert({
      user_id: user.id,
      verdict: result.verdict,
      escalation: result.escalation,
      prev_cal: currentCalories,
      prev_protein: user.custom_protein_target ?? user.protein_target,
      prev_carbs: user.custom_carb_target ?? user.carb_target,
      prev_fats: user.custom_fat_target ?? user.fat_target,
      new_cal: result.newCalories,
      new_protein: result.newProtein,
      new_carbs: result.newCarbs,
      new_fats: result.newFats,
      reason: result.reason,
      coach_note: result.coachNote,
      evidence: result.evidence,
      status: autoApply ? 'auto_applied' : 'pending',
      decided_at: autoApply ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (!autoApply) return { ...base, result, applied: false, skipped: null }

  await applyAdjustment(admin, user.id, result, 'auto')
  void inserted
  return { ...base, result, applied: true, skipped: null }
}

/**
 * Write an approved or automatic adjustment to the client's live targets.
 *
 * Deliberately writes the calculated columns, not the custom_* overrides: an
 * override is Anthony's hand-set number and the engine does not get to
 * overwrite it silently. Where an override is in force it stays in force, and
 * the history row says the change is not what the client is eating.
 */
export async function applyAdjustment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
  result: Pick<AdjustmentResult, 'newCalories' | 'newProtein' | 'newCarbs' | 'newFats' | 'reason' | 'evidence' | 'verdict'>,
  source: 'auto' | 'coach',
  changedBy?: string
): Promise<void> {
  if (result.newCalories === null) return

  const { data: before } = await admin
    .from('users')
    .select('custom_cal_target')
    .eq('id', userId)
    .maybeSingle()
  const overridden = before?.custom_cal_target !== null && before?.custom_cal_target !== undefined

  await admin
    .from('users')
    .update({
      daily_cal_target: result.newCalories,
      protein_target: result.newProtein,
      carb_target: result.newCarbs,
      fat_target: result.newFats,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  await recordTargetChange(admin, {
    userId,
    calories: result.newCalories,
    protein: result.newProtein,
    carbs: result.newCarbs,
    fats: result.newFats,
    source: result.verdict === 'diet_break' ? 'diet_break' : source === 'auto' ? 'auto' : 'coach',
    reason: overridden
      ? `${result.reason} (Anthony has set your targets by hand, so this is recorded but not in force.)`
      : result.reason,
    evidence: { ...result.evidence, supersededByCoachOverride: overridden },
    changedBy: changedBy ?? null,
  })
}
