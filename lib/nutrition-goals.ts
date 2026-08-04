/**
 * Nutrition goal calculation engine using Mifflin-St Jeor equation.
 * Supports multiple fitness goals with automatic macro distribution.
 */

export type FitnessGoal = 'lose_fat' | 'build_muscle' | 'body_recomposition' | 'maintain'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active' | 'extremely_active'
export type Sex = 'male' | 'female' | 'other'

export interface NutritionGoalSetup {
  currentWeight: number // in pounds
  goalWeight: number // in pounds
  height: number // in inches
  age: number
  sex: Sex
  activityLevel: ActivityLevel
  goal: FitnessGoal
}

export interface CalculatedTargets {
  maintenanceCalories: number
  dailyCalories: number
  proteinGrams: number
  fatGrams: number
  carbGrams: number
  calorieDeficitOrSurplus: number // negative for deficit, positive for surplus
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
}

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor equation.
 * Uses current weight for BMR calculation.
 * @param weight in pounds
 * @param height in inches
 * @param age in years
 * @param sex 'male', 'female', or 'other'
 */
export function calculateBMR(weight: number, height: number, age: number, sex: Sex): number {
  // Convert pounds to kilograms and inches to centimeters
  const weightKg = weight * 0.453592
  const heightCm = height * 2.54

  let bmr: number

  if (sex === 'male') {
    // Men: (10 × weight) + (6.25 × height) − (5 × age) + 5
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5
  } else if (sex === 'female') {
    // Women: (10 × weight) + (6.25 × height) − (5 × age) − 161
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161
  } else {
    // Other: average of male and female
    const maleBmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    const femaleBmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    bmr = (maleBmr + femaleBmr) / 2
  }

  return Math.round(bmr)
}

/**
 * Calculate maintenance calories (TDEE) using BMR and activity level.
 */
export function calculateMaintenanceCalories(
  bmr: number,
  activityLevel: ActivityLevel
): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel]
  return Math.round(bmr * multiplier)
}

/**
 * Calculate daily calorie target based on fitness goal.
 */
export function calculateDailyCalories(
  maintenanceCalories: number,
  goal: FitnessGoal
): { calories: number; surplus: number } {
  let calorieAdjustment = 0

  switch (goal) {
    case 'lose_fat':
      calorieAdjustment = -Math.round(maintenanceCalories * 0.2) // 20% deficit
      break
    case 'build_muscle':
      calorieAdjustment = Math.round(maintenanceCalories * 0.1) // 10% surplus
      break
    case 'body_recomposition':
      calorieAdjustment = 0 // maintenance
      break
    case 'maintain':
      calorieAdjustment = 0 // maintenance
      break
  }

  return {
    calories: maintenanceCalories + calorieAdjustment,
    surplus: calorieAdjustment,
  }
}

/**
 * Calculate protein target based on goal weight and fitness goal.
 * Returns grams per day.
 */
export function calculateProteinTarget(goalWeight: number, goal: FitnessGoal): number {
  let gramsPerPound: number

  switch (goal) {
    case 'lose_fat':
      gramsPerPound = 1.0 // 1g per pound of goal weight
      break
    case 'build_muscle':
      gramsPerPound = 0.95 // 0.9-1.0g per pound
      break
    case 'body_recomposition':
      gramsPerPound = 1.0 // 1g per pound of goal weight
      break
    case 'maintain':
      gramsPerPound = 0.8 // 0.8g per pound
      break
  }

  return Math.round(goalWeight * gramsPerPound)
}

/**
 * Calculate fat target as 25-30% of total calories.
 * Returns grams per day (fat = 9 calories/gram).
 */
export function calculateFatTarget(dailyCalories: number): number {
  // Use middle of range: 27.5%
  const fatCalories = dailyCalories * 0.275
  return Math.round(fatCalories / 9)
}

/**
 * Calculate carb target from remaining calories after protein and fat.
 * Returns grams per day (carbs = 4 calories/gram).
 */
export function calculateCarbTarget(
  dailyCalories: number,
  proteinGrams: number,
  fatGrams: number
): number {
  const proteinCalories = proteinGrams * 4
  const fatCalories = fatGrams * 9
  const carbCalories = dailyCalories - proteinCalories - fatCalories
  return Math.round(carbCalories / 4)
}

/**
 * Full calculation: takes setup data and returns all targets.
 */
export function calculateNutritionTargets(setup: NutritionGoalSetup): CalculatedTargets {
  const bmr = calculateBMR(setup.currentWeight, setup.height, setup.age, setup.sex)
  const maintenanceCalories = calculateMaintenanceCalories(bmr, setup.activityLevel)
  const { calories: dailyCalories, surplus } = calculateDailyCalories(
    maintenanceCalories,
    setup.goal
  )
  const proteinGrams = calculateProteinTarget(setup.goalWeight, setup.goal)
  const fatGrams = calculateFatTarget(dailyCalories)
  const carbGrams = calculateCarbTarget(dailyCalories, proteinGrams, fatGrams)

  return {
    maintenanceCalories,
    dailyCalories,
    proteinGrams,
    fatGrams,
    carbGrams,
    calorieDeficitOrSurplus: surplus,
  }
}

/**
 * Format calorie target for display with surplus/deficit indicator.
 */
export function formatCalorieTarget(
  dailyCalories: number,
  maintenanceCalories: number,
  surplus: number
): string {
  if (surplus === 0) return `${dailyCalories} cal (maintenance)`
  if (surplus > 0) return `${dailyCalories} cal (+${surplus} surplus)`
  return `${dailyCalories} cal (${surplus} deficit)`
}

/**
 * Get activity level label for display.
 */
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

/**
 * Get fitness goal label for display.
 */
export function getGoalLabel(goal: FitnessGoal): string {
  const labels: Record<FitnessGoal, string> = {
    lose_fat: 'Lose Fat',
    build_muscle: 'Build Muscle',
    body_recomposition: 'Body Recomposition',
    maintain: 'Maintain Weight',
  }
  return labels[goal]
}

/**
 * Validate nutrition goal setup data.
 */
export function validateSetup(setup: Partial<NutritionGoalSetup>): string[] {
  const errors: string[] = []

  if (!setup.currentWeight || setup.currentWeight <= 0) errors.push('Current weight is required')
  if (!setup.goalWeight || setup.goalWeight <= 0) errors.push('Goal weight is required')
  if (!setup.height || setup.height <= 0) errors.push('Height is required')
  if (!setup.age || setup.age <= 0) errors.push('Age is required')
  if (!setup.sex) errors.push('Sex is required')
  if (!setup.activityLevel) errors.push('Activity level is required')
  if (!setup.goal) errors.push('Fitness goal is required')

  if (setup.currentWeight && setup.currentWeight > 600) errors.push('Current weight seems too high')
  if (setup.height && setup.height > 120) errors.push('Height seems too high')
  if (setup.age && (setup.age < 13 || setup.age > 120)) errors.push('Age must be between 13 and 120')

  return errors
}
