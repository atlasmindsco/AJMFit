/**
 * Nutrition goal calculation engine.
 *
 * Maintenance is estimated with Mifflin-St Jeor, which is the best-validated
 * simple equation available without a metabolic cart. Everything downstream of
 * that changed in September 2026 after an audit found the previous version
 * could prescribe 941 calories a day to a small, older, sedentary woman with no
 * floor and no coach review.
 *
 * Two design decisions carry most of the safety:
 *
 *   1. Targets are anchored to a RATE of change (percent of bodyweight per
 *      week), not to a percentage of maintenance. A flat 20% cut gives a large
 *      person a small relative deficit and a small person a dangerous absolute
 *      intake. Rate is also the thing the client actually cares about and the
 *      thing that makes the number explainable.
 *
 *   2. Every target passes through clamps that cannot be configured away, and
 *      the calculation reports WHICH clamp bound so the caller can tell the
 *      client the truth and flag the case for Anthony.
 *
 * The output of this file is a starting estimate from a population equation,
 * not a measurement of one person. It is expected to be revised from real
 * weight-trend data. Callers should present it that way.
 */

export type FitnessGoal = 'lose_fat' | 'build_muscle' | 'body_recomposition' | 'maintain'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active' | 'extremely_active'
export type Sex = 'male' | 'female' | 'other'

/** Matches the values onboarding already collects for jobActivity. */
export type JobActivity = 'sedentary' | 'on-my-feet' | 'physical'

export interface NutritionGoalSetup {
  currentWeight: number // pounds
  goalWeight: number // pounds
  height: number // inches
  age: number
  sex: Sex
  activityLevel: ActivityLevel
  goal: FitnessGoal
  /**
   * Two-factor activity, preferred over activityLevel when both are present.
   *
   * The single activity dropdown asked the client to blend how much they move
   * at work with how often they train, and then guess which band that lands
   * in. The app already knows both: job activity from onboarding, training
   * days from the assigned program. These fields are optional so that a client
   * who set up before this existed still calculates.
   */
  jobActivity?: JobActivity
  trainingDaysPerWeek?: number
}

/** Which guardrail, if any, decided the final calorie number. */
export type ClampReason =
  | 'max_deficit' // would have exceeded 25% below maintenance
  | 'absolute_floor' // hit the 1,200 / 1,500 kcal floor
  | 'bmr_floor' // would have gone below resting metabolic rate
  | 'max_surplus' // would have exceeded 15% above maintenance
  | 'low_carb' // carbohydrate fell below a workable level

export interface CalculatedTargets {
  bmr: number
  maintenanceCalories: number
  dailyCalories: number
  proteinGrams: number
  fatGrams: number
  carbGrams: number
  /** Negative for a deficit, positive for a surplus. */
  calorieDeficitOrSurplus: number
  /** Signed. Negative means losing. Recomputed after clamping, so it is honest. */
  expectedLbsPerWeek: number
  /** Signed percent of bodyweight per week. */
  expectedRatePctPerWeek: number
  /** Null when the goal is maintenance, or the goal weight is already reached. */
  weeksToGoal: number | null
  /** Null when nothing bound. Non-null means: tell the client, flag the coach. */
  clamp: ClampReason | null
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
}

/** Energy in a pound of bodyweight change, in calories. */
const CALORIES_PER_POUND = 3500

/**
 * Absolute intake floors. Below these, a diet stops being a diet and starts
 * needing supervision that a training business is not set up to provide.
 */
const ABSOLUTE_FLOOR: Record<Sex, number> = {
  female: 1200,
  male: 1500,
  other: 1350,
}

/** Never cut more than this fraction below maintenance, whatever the rate says. */
const MAX_DEFICIT_FRACTION = 0.25
/** Never add more than this fraction above maintenance. */
const MAX_SURPLUS_FRACTION = 0.15
/** A surplus smaller than this is inside measurement noise and just demoralising. */
const MIN_SURPLUS = 150
/** Below this, carbohydrate is too low to support four or more sessions a week. */
const LOW_CARB_GRAMS = 100

export function bmi(weightLb: number, heightIn: number): number {
  if (!heightIn) return 0
  return (703 * weightLb) / (heightIn * heightIn)
}

/**
 * Target rate of weight change, as a signed fraction of bodyweight per week.
 *
 * Fat loss bands come off BMI as a stand-in for body composition: someone
 * carrying more fat mass tolerates — and needs — a faster rate than someone
 * already lean, for whom an aggressive deficit mostly costs training quality
 * and muscle.
 */
function targetRatePerWeek(goal: FitnessGoal, weightLb: number, heightIn: number): number {
  const b = bmi(weightLb, heightIn)

  switch (goal) {
    case 'lose_fat':
      if (b >= 30) return -0.0085
      if (b >= 25) return -0.0065
      if (b >= 22) return -0.005
      return -0.004
    case 'build_muscle': {
      // Expressed per month in the literature; converted to weeks here.
      // Beginners and leaner clients have more room before the surplus just
      // becomes fat.
      const perMonth = b < 22 ? 0.0075 : 0.005
      return perMonth / 4.345
    }
    case 'body_recomposition':
    case 'maintain':
      return 0
  }
}

/**
 * Basal Metabolic Rate, Mifflin-St Jeor.
 *
 * 'other' averages the male and female constants. It is a pragmatic choice:
 * the equations differ only by a fixed offset, so the average lands between
 * them rather than defaulting someone to a number built for a body they do
 * not have.
 */
export function calculateBMR(weight: number, height: number, age: number, sex: Sex): number {
  const weightKg = weight * 0.453592
  const heightCm = height * 2.54
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age

  if (sex === 'male') return Math.round(base + 5)
  if (sex === 'female') return Math.round(base - 161)
  return Math.round(base + (5 - 161) / 2)
}

export function calculateMaintenanceCalories(bmrValue: number, activityLevel: ActivityLevel): number {
  return Math.round(bmrValue * ACTIVITY_MULTIPLIERS[activityLevel])
}

/**
 * Two-factor activity multiplier: what the job costs, plus what training adds.
 *
 * Deliberately calibrated to land on the old dropdown's numbers rather than
 * below them, so that moving to this does not quietly re-baseline everyone's
 * calories. A desk worker training four days comes out at 1.55, which is
 * exactly what picking "Moderate (3-5 days/week)" produced before:
 *
 *   desk + 0 days = 1.20   (was "Sedentary",    1.20)
 *   desk + 4 days = 1.55   (was "Moderate",     1.55)
 *   desk + 6 days = 1.73   (was "Very Active",  1.725)
 *
 * The gain is not a different answer, it is a more reliable one: two facts the
 * client can state plainly, instead of one band they have to self-assess into.
 */
const JOB_BASE: Record<JobActivity, number> = {
  sedentary: 1.2,
  'on-my-feet': 1.32,
  physical: 1.45,
}
const PER_TRAINING_DAY = 0.0875
const MAX_MULTIPLIER = 1.95

export function activityMultiplier(job: JobActivity, trainingDaysPerWeek: number): number {
  const days = Math.max(0, Math.min(7, trainingDaysPerWeek))
  return Math.min(MAX_MULTIPLIER, JOB_BASE[job] + days * PER_TRAINING_DAY)
}

/**
 * The legacy band closest to a two-factor multiplier.
 *
 * activity_level is still written to the database so that anything reading it
 * keeps working. This keeps that column meaningful rather than frozen at
 * whatever the client last picked from a dropdown they no longer see.
 */
export function nearestActivityLevel(multiplier: number): ActivityLevel {
  let best: ActivityLevel = 'moderate'
  let bestGap = Infinity
  for (const [level, m] of Object.entries(ACTIVITY_MULTIPLIERS) as Array<[ActivityLevel, number]>) {
    const gap = Math.abs(m - multiplier)
    if (gap < bestGap) {
      bestGap = gap
      best = level
    }
  }
  return best
}

export const JOB_ACTIVITY_OPTIONS: Array<{ value: JobActivity; label: string }> = [
  { value: 'sedentary', label: 'Mostly sitting (desk job, driving)' },
  { value: 'on-my-feet', label: 'On my feet most of the day' },
  { value: 'physical', label: 'Physical work (lifting, trades, manual)' },
]

/**
 * Maintenance from whichever inputs we have. Two-factor when the client has
 * told us both, the old single dropdown otherwise.
 */
export function maintenanceFor(bmrValue: number, setup: NutritionGoalSetup): number {
  if (setup.jobActivity && typeof setup.trainingDaysPerWeek === 'number') {
    return Math.round(bmrValue * activityMultiplier(setup.jobActivity, setup.trainingDaysPerWeek))
  }
  return calculateMaintenanceCalories(bmrValue, setup.activityLevel)
}

/**
 * Protein reference weight.
 *
 * The previous version scaled protein off GOAL weight, which inverted the
 * prescription: a 300 lb client cutting to 180 was told to eat 180 g, or
 * 0.60 g per pound of the body he actually had, while a 165 lb client gaining
 * to 190 was told 1.10 g per pound. The client with the most lean mass to
 * protect and the most appetite to manage got the least protein.
 *
 * Current weight is the right anchor, capped for anyone well above their goal
 * so that a client with 120 lb to lose is not asked to eat 300 g a day.
 */
export function proteinReferenceWeight(currentWeight: number, goalWeight: number): number {
  return Math.min(currentWeight, goalWeight * 1.25)
}

const PROTEIN_PER_LB: Record<FitnessGoal, number> = {
  lose_fat: 0.95,
  body_recomposition: 1.0,
  build_muscle: 0.85,
  maintain: 0.75,
}

/**
 * Split out so the adjustment engine recomputes macros exactly the way setup
 * does. When this lived inline in calculateNutritionTargets, any later change
 * to a target had to re-implement the fat floor and the carbohydrate
 * remainder, and the two would drift.
 */
export function deriveMacros(
  dailyCalories: number,
  currentWeight: number,
  goalWeight: number,
  goal: FitnessGoal
): { proteinGrams: number; fatGrams: number; carbGrams: number; lowCarb: boolean } {
  const refWeight = proteinReferenceWeight(currentWeight, goalWeight)
  let proteinGrams = Math.round(refWeight * PROTEIN_PER_LB[goal])

  // Fat takes the higher of 27.5% of calories and an essential-intake floor of
  // 0.3 g per pound of reference weight. In a clamped low-calorie case the
  // floor is what binds.
  const fatFromPercent = (dailyCalories * 0.275) / 9
  const fatFloor = refWeight * 0.3
  let fatGrams = Math.round(Math.max(fatFromPercent, fatFloor))

  // Keep the macros summing to the calorie target and never negative. Protein
  // is defended first, then fat; carbohydrate absorbs the remainder.
  const capProteinCals = dailyCalories * 0.5
  if (proteinGrams * 4 > capProteinCals) proteinGrams = Math.floor(capProteinCals / 4)

  let carbCals = dailyCalories - proteinGrams * 4 - fatGrams * 9
  if (carbCals < 0) {
    fatGrams = Math.max(0, Math.floor((dailyCalories - proteinGrams * 4) / 9))
    carbCals = dailyCalories - proteinGrams * 4 - fatGrams * 9
  }
  const carbGrams = Math.max(0, Math.round(carbCals / 4))

  return { proteinGrams, fatGrams, carbGrams, lowCarb: carbGrams < LOW_CARB_GRAMS }
}

/** The floors the adjustment engine must also respect. */
export function calorieFloorFor(sex: Sex, bmrValue: number): number {
  return Math.max(ABSOLUTE_FLOOR[sex] ?? ABSOLUTE_FLOOR.other, bmrValue)
}

/**
 * Full calculation. Rate first, then clamps, then macros, then an honest
 * restatement of the rate the clamped calories will actually produce.
 */
export function calculateNutritionTargets(setup: NutritionGoalSetup): CalculatedTargets {
  const bmrValue = calculateBMR(setup.currentWeight, setup.height, setup.age, setup.sex)
  const maintenanceCalories = maintenanceFor(bmrValue, setup)

  // --- Intended change, from the rate band ---
  const rate = targetRatePerWeek(setup.goal, setup.currentWeight, setup.height)
  const intendedLbsPerWeek = rate * setup.currentWeight
  let delta = Math.round((intendedLbsPerWeek * CALORIES_PER_POUND) / 7)

  if (setup.goal === 'build_muscle' && delta > 0 && delta < MIN_SURPLUS) {
    delta = MIN_SURPLUS
  }

  // --- Clamps, in order. First one to bind is the one we report. ---
  let clamp: ClampReason | null = null
  const floor = ABSOLUTE_FLOOR[setup.sex] ?? ABSOLUTE_FLOOR.other

  const maxDeficit = -Math.round(maintenanceCalories * MAX_DEFICIT_FRACTION)
  if (delta < maxDeficit) {
    delta = maxDeficit
    clamp = 'max_deficit'
  }

  const maxSurplus = Math.round(maintenanceCalories * MAX_SURPLUS_FRACTION)
  if (delta > maxSurplus) {
    delta = maxSurplus
    clamp = 'max_surplus'
  }

  let dailyCalories = maintenanceCalories + delta

  if (dailyCalories < floor) {
    dailyCalories = floor
    clamp = 'absolute_floor'
  }

  if (dailyCalories < bmrValue) {
    dailyCalories = bmrValue
    clamp = 'bmr_floor'
  }

  // Round to something a human would say. Rounding happens AFTER the clamps,
  // so it has to be re-checked against them: rounding 2,286 down to 2,275 put
  // a client back under the BMR floor that had just been applied.
  dailyCalories = Math.round(dailyCalories / 25) * 25
  const hardFloor = Math.max(floor, bmrValue)
  if (dailyCalories < hardFloor) dailyCalories = Math.ceil(hardFloor / 25) * 25

  const finalDelta = dailyCalories - maintenanceCalories

  // --- Macros ---
  const macros = deriveMacros(dailyCalories, setup.currentWeight, setup.goalWeight, setup.goal)
  const { proteinGrams, fatGrams, carbGrams } = macros
  if (macros.lowCarb && clamp === null) clamp = 'low_carb'

  // --- What this will actually do, after clamping ---
  const expectedLbsPerWeek = (finalDelta * 7) / CALORIES_PER_POUND
  const expectedRatePctPerWeek = setup.currentWeight
    ? (expectedLbsPerWeek / setup.currentWeight) * 100
    : 0

  const toGo = setup.goalWeight - setup.currentWeight
  const weeksToGoal =
    Math.abs(expectedLbsPerWeek) < 0.01 || Math.sign(toGo) !== Math.sign(expectedLbsPerWeek)
      ? null
      : Math.ceil(Math.abs(toGo / expectedLbsPerWeek))

  return {
    bmr: bmrValue,
    maintenanceCalories,
    dailyCalories,
    proteinGrams,
    fatGrams,
    carbGrams,
    calorieDeficitOrSurplus: finalDelta,
    expectedLbsPerWeek: Math.round(expectedLbsPerWeek * 100) / 100,
    expectedRatePctPerWeek: Math.round(expectedRatePctPerWeek * 100) / 100,
    weeksToGoal,
    clamp,
  }
}

/**
 * Plain-language explanation of a clamp, for the client. Deliberately calm:
 * a client who hits a floor has not done anything wrong, and the message they
 * read should not imply otherwise.
 */
export function clampExplanation(clamp: ClampReason, sex: Sex): string {
  switch (clamp) {
    case 'absolute_floor':
      return `We have set your calories at the lowest level we will prescribe (${
        ABSOLUTE_FLOOR[sex] ?? ABSOLUTE_FLOOR.other
      } calories). Your progress will be steadier rather than fast, which is the right trade. Anthony will review this with you.`
    case 'bmr_floor':
      return 'Your target has been raised to match what your body burns at rest. Eating below that is not something we will set automatically. Anthony will review this with you.'
    case 'max_deficit':
      return 'We have capped your deficit at 25% below your maintenance level. A steeper cut costs muscle and training quality without speeding up fat loss much.'
    case 'max_surplus':
      return 'We have capped your surplus at 15% above maintenance. Eating more than this adds fat faster than it adds muscle.'
    case 'low_carb':
      return 'Your carbohydrate target is low for your training load. Anthony will review whether this target should be adjusted.'
  }
}

export function formatCalorieTarget(
  dailyCalories: number,
  maintenanceCalories: number,
  surplus: number
): string {
  if (surplus === 0) return `${dailyCalories} cal (maintenance)`
  if (surplus > 0) return `${dailyCalories} cal (+${surplus} surplus)`
  return `${dailyCalories} cal (${surplus} deficit)`
}

export function getActivityLevelLabel(level: ActivityLevel): string {
  const labels: Record<ActivityLevel, string> = {
    sedentary: 'Sedentary (little exercise)',
    light: 'Light (1-3 days/week)',
    moderate: 'Moderate (3-5 days/week)',
    very_active: 'Very Active (6-7 days/week)',
    extremely_active: 'Extremely Active (twice/day)',
  }
  return labels[level]
}

export function getGoalLabel(goal: FitnessGoal): string {
  const labels: Record<FitnessGoal, string> = {
    lose_fat: 'Lose Fat',
    build_muscle: 'Build Muscle',
    body_recomposition: 'Body Recomposition',
    maintain: 'Maintain Weight',
  }
  return labels[goal]
}

/* ------------------------------------------------------------------------ *
 * Health screening
 *
 * A gate, not a warning. These are the cases where an automated calorie
 * prescription is either outside what a personal training certification
 * covers, or is actively contraindicated. A checkbox someone clicks past is
 * not a guardrail, so a positive answer ends the flow and routes to Anthony.
 * ------------------------------------------------------------------------ */

export interface HealthScreen {
  pregnantOrBreastfeeding: boolean
  eatingDisorderHistory: boolean
  kidneyDisease: boolean
  diabetes: boolean
  heartLiverOrBariatric: boolean
  weightAffectingMedication: boolean
  underProfessionalCare: boolean
}

export const EMPTY_HEALTH_SCREEN: HealthScreen = {
  pregnantOrBreastfeeding: false,
  eatingDisorderHistory: false,
  kidneyDisease: false,
  diabetes: false,
  heartLiverOrBariatric: false,
  weightAffectingMedication: false,
  underProfessionalCare: false,
}

export interface ScreenOutcome {
  /** True means: do not calculate anything. */
  blocked: boolean
  /** Shown to the client. Never alarming, never diagnostic. */
  message: string | null
  /** True means Anthony gets told either way. */
  flagCoach: boolean
  /** Short machine-readable tag for the coach dashboard and logs. */
  code: string | null
}

export const HEALTH_SCREEN_QUESTIONS: Array<{
  key: keyof HealthScreen
  label: string
}> = [
  { key: 'pregnantOrBreastfeeding', label: 'I am pregnant or breastfeeding' },
  {
    key: 'eatingDisorderHistory',
    label: 'I have a history of disordered eating',
  },
  { key: 'kidneyDisease', label: 'I have kidney disease' },
  { key: 'diabetes', label: 'I have diabetes' },
  {
    key: 'heartLiverOrBariatric',
    label: 'I have heart or liver disease, or have had bariatric surgery',
  },
  {
    key: 'weightAffectingMedication',
    label: 'I take medication that affects my weight or appetite',
  },
  {
    key: 'underProfessionalCare',
    label: 'I am already working with a doctor or dietitian on my nutrition',
  },
]

const REFER = 'Anthony will be in touch to talk through the right next step.'

export function screenHealth(s: HealthScreen): ScreenOutcome {
  // Kidney disease first: the protein targets this file produces are the
  // single most directly contraindicated output in the product.
  if (s.kidneyDisease) {
    return {
      blocked: true,
      code: 'kidney',
      flagCoach: true,
      message: `Protein targets need to come from your kidney care team, so we will not set them automatically. ${REFER}`,
    }
  }
  if (s.pregnantOrBreastfeeding) {
    return {
      blocked: true,
      code: 'pregnancy',
      flagCoach: true,
      message: `Energy needs during pregnancy and breastfeeding are individual and should come from your provider. ${REFER}`,
    }
  }
  if (s.eatingDisorderHistory) {
    return {
      blocked: true,
      code: 'ed_history',
      flagCoach: true,
      message: `Thank you for telling us. Calorie tracking is not the right tool for everyone, and we would rather get this right than hand you a number. ${REFER}`,
    }
  }
  if (s.diabetes) {
    return {
      blocked: true,
      code: 'diabetes',
      flagCoach: true,
      message: `Changing carbohydrate intake interacts with diabetes medication, so this needs a person rather than a calculator. ${REFER}`,
    }
  }
  if (s.heartLiverOrBariatric) {
    return {
      blocked: true,
      code: 'clinical',
      flagCoach: true,
      message: `Your nutrition needs are clinically managed, so we will not set targets automatically. ${REFER}`,
    }
  }
  if (s.underProfessionalCare) {
    return {
      blocked: true,
      code: 'existing_care',
      flagCoach: true,
      message: `You already have a plan from a professional, and two sets of advice is worse than one. ${REFER}`,
    }
  }
  // Not a block. Weight and appetite signals will not mean what the
  // adjustment engine assumes, so the coach needs to know.
  if (s.weightAffectingMedication) {
    return {
      blocked: false,
      code: 'medication',
      flagCoach: true,
      message: null,
    }
  }
  return { blocked: false, code: null, flagCoach: false, message: null }
}

/* ------------------------------------------------------------------------ */

const MIN_AGE = 18
const MAX_AGE = 100
/** Lowest BMI we will accept as a goal. Below this is underweight. */
const MIN_HEALTHY_BMI = 18.5

export function validateSetup(setup: Partial<NutritionGoalSetup>): string[] {
  const errors: string[] = []

  if (!setup.currentWeight || setup.currentWeight <= 0) errors.push('Current weight is required')
  if (!setup.goalWeight || setup.goalWeight <= 0) errors.push('Goal weight is required')
  if (!setup.height || setup.height <= 0) errors.push('Height is required')
  if (!setup.age || setup.age <= 0) errors.push('Age is required')
  if (!setup.sex) errors.push('Sex is required')
  if (!setup.activityLevel) errors.push('Activity level is required')
  if (!setup.goal) errors.push('Fitness goal is required')
  if (errors.length > 0) return errors

  const { currentWeight, goalWeight, height, age, goal } = setup as NutritionGoalSetup

  if (currentWeight < 60 || currentWeight > 700) errors.push('Please check your current weight')
  if (goalWeight < 60 || goalWeight > 700) errors.push('Please check your goal weight')
  if (height < 48 || height > 90) errors.push('Please check your height')

  // An automated deficit is not appropriate for a minor, and this is a gate
  // rather than a warning. The previous version allowed 13 and up.
  if (age < MIN_AGE) {
    errors.push(
      `AJM Fit sets nutrition targets for adults only. Anthony can still coach your training, so please message him.`
    )
  } else if (age > MAX_AGE) {
    errors.push('Please check your age')
  }
  if (errors.length > 0) return errors

  const goalBmi = bmi(goalWeight, height)
  const currentBmi = bmi(currentWeight, height)

  if (goalBmi < MIN_HEALTHY_BMI) {
    const healthy = Math.ceil((MIN_HEALTHY_BMI * height * height) / 703)
    errors.push(
      `That goal weight is below a healthy range for your height. The lowest we would target is about ${healthy} lbs.`
    )
  }

  if (goal === 'lose_fat' && currentBmi < MIN_HEALTHY_BMI) {
    errors.push(
      'Your current weight is already below a healthy range for your height, so we will not set a fat-loss target. Please message Anthony.'
    )
  }

  // Direction sanity. These usually mean a typo or a misread dropdown, and
  // silently calculating the opposite of what someone meant is worse than
  // asking.
  if (goal === 'lose_fat' && goalWeight > currentWeight) {
    errors.push('Your goal weight is above your current weight, but your goal is set to lose fat.')
  }
  if (goal === 'build_muscle' && goalWeight < currentWeight) {
    errors.push('Your goal weight is below your current weight, but your goal is set to build muscle.')
  }

  return errors
}
