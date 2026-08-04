/**
 * Comprehensive test suite for nutrition goals system
 */

import {
  calculateBMR,
  calculateMaintenanceCalories,
  calculateDailyCalories,
  calculateProteinTarget,
  calculateFatTarget,
  calculateCarbTarget,
  calculateNutritionTargets,
  validateSetup,
  getActivityLevelLabel,
  getGoalLabel,
} from '../lib/nutrition-goals'

describe('Nutrition Goals System', () => {
  describe('BMR Calculation (Mifflin-St Jeor)', () => {
    test('Male: 210 lbs, 72", 28yo', () => {
      const bmr = calculateBMR(210, 72, 28, 'male')
      expect(bmr).toBeCloseTo(1961, -1) // ±10 cal tolerance
    })

    test('Female: 150 lbs, 65", 25yo', () => {
      const bmr = calculateBMR(150, 65, 25, 'female')
      expect(bmr).toBeCloseTo(1384, -1)
    })

    test('Other: average of male/female', () => {
      const bmr = calculateBMR(180, 70, 30, 'other')
      expect(bmr).toBeGreaterThan(0)
    })
  })

  describe('Maintenance Calories (TDEE)', () => {
    const bmr = 2000

    test('Sedentary: BMR × 1.2', () => {
      const tdee = calculateMaintenanceCalories(bmr, 'sedentary')
      expect(tdee).toBe(2400)
    })

    test('Light: BMR × 1.375', () => {
      const tdee = calculateMaintenanceCalories(bmr, 'light')
      expect(tdee).toBe(2750)
    })

    test('Moderate: BMR × 1.55', () => {
      const tdee = calculateMaintenanceCalories(bmr, 'moderate')
      expect(tdee).toBe(3100)
    })

    test('Very Active: BMR × 1.725', () => {
      const tdee = calculateMaintenanceCalories(bmr, 'very_active')
      expect(tdee).toBe(3450)
    })

    test('Extremely Active: BMR × 1.9', () => {
      const tdee = calculateMaintenanceCalories(bmr, 'extremely_active')
      expect(tdee).toBe(3800)
    })
  })

  describe('Daily Calorie Target by Goal', () => {
    const maintenance = 3000

    test('Lose Fat: -20% deficit', () => {
      const { calories, surplus } = calculateDailyCalories(maintenance, 'lose_fat')
      expect(calories).toBe(2400)
      expect(surplus).toBe(-600)
    })

    test('Build Muscle: +10% surplus', () => {
      const { calories, surplus } = calculateDailyCalories(maintenance, 'build_muscle')
      expect(calories).toBe(3300)
      expect(surplus).toBe(300)
    })

    test('Body Recomposition: maintenance', () => {
      const { calories, surplus } = calculateDailyCalories(maintenance, 'body_recomposition')
      expect(calories).toBe(3000)
      expect(surplus).toBe(0)
    })

    test('Maintain: maintenance', () => {
      const { calories, surplus } = calculateDailyCalories(maintenance, 'maintain')
      expect(calories).toBe(3000)
      expect(surplus).toBe(0)
    })
  })

  describe('Protein Target (based on goal weight)', () => {
    const goalWeight = 180

    test('Lose Fat: 1.0g per lb', () => {
      const protein = calculateProteinTarget(goalWeight, 'lose_fat')
      expect(protein).toBe(180)
    })

    test('Build Muscle: 0.9-1.0g per lb', () => {
      const protein = calculateProteinTarget(goalWeight, 'build_muscle')
      expect(protein).toBeCloseTo(171, 0)
    })

    test('Body Recomposition: 1.0g per lb', () => {
      const protein = calculateProteinTarget(goalWeight, 'body_recomposition')
      expect(protein).toBe(180)
    })

    test('Maintain: 0.8g per lb', () => {
      const protein = calculateProteinTarget(goalWeight, 'maintain')
      expect(protein).toBe(144)
    })
  })

  describe('Fat Target (27.5% of calories)', () => {
    test('2000 cal: ~61g fat', () => {
      const fat = calculateFatTarget(2000)
      expect(fat).toBeCloseTo(61, 0)
    })

    test('2500 cal: ~76g fat', () => {
      const fat = calculateFatTarget(2500)
      expect(fat).toBeCloseTo(76, 0)
    })

    test('3000 cal: ~92g fat', () => {
      const fat = calculateFatTarget(3000)
      expect(fat).toBeCloseTo(92, 0)
    })
  })

  describe('Carb Target (remaining calories)', () => {
    test('2000 cal, 150g protein, 60g fat → ~238g carbs', () => {
      const carbs = calculateCarbTarget(2000, 150, 60)
      expect(carbs).toBeCloseTo(238, 0)
    })

    test('3000 cal, 200g protein, 90g fat → ~363g carbs', () => {
      const carbs = calculateCarbTarget(3000, 200, 90)
      expect(carbs).toBeCloseTo(363, 0)
    })
  })

  describe('Full Nutrition Targets Calculation', () => {
    test('Male, 210→185 lbs, 72", 28yo, Very Active, Lose Fat', () => {
      const result = calculateNutritionTargets({
        currentWeight: 210,
        goalWeight: 185,
        height: 72,
        age: 28,
        sex: 'male',
        activityLevel: 'very_active',
        goal: 'lose_fat',
      })

      expect(result.maintenanceCalories).toBeCloseTo(3383, -1)
      expect(result.dailyCalories).toBeCloseTo(2706, -1)
      expect(result.proteinGrams).toBe(185)
      expect(result.fatGrams).toBe(83)
      expect(result.carbGrams).toBe(305)
      expect(result.calorieDeficitOrSurplus).toBe(-677)

      // Verify macros sum to calories (within 10 cal tolerance)
      const macroCalories = result.proteinGrams * 4 + result.carbGrams * 4 + result.fatGrams * 9
      expect(macroCalories).toBeCloseTo(result.dailyCalories, 0)
    })

    test('Female, 150→140 lbs, 65", 25yo, Moderate, Build Muscle', () => {
      const result = calculateNutritionTargets({
        currentWeight: 150,
        goalWeight: 140,
        height: 65,
        age: 25,
        sex: 'female',
        activityLevel: 'moderate',
        goal: 'build_muscle',
      })

      expect(result.dailyCalories).toBeGreaterThan(result.maintenanceCalories)
      expect(result.calorieDeficitOrSurplus).toBeGreaterThan(0)
      expect(result.proteinGrams).toBeGreaterThan(0)

      // Verify macros sum to calories
      const macroCalories = result.proteinGrams * 4 + result.carbGrams * 4 + result.fatGrams * 9
      expect(macroCalories).toBeCloseTo(result.dailyCalories, 0)
    })
  })

  describe('Validation', () => {
    test('Valid setup passes validation', () => {
      const errors = validateSetup({
        currentWeight: 200,
        goalWeight: 180,
        height: 72,
        age: 25,
        sex: 'male',
        activityLevel: 'moderate',
        goal: 'lose_fat',
      })
      expect(errors.length).toBe(0)
    })

    test('Missing currentWeight', () => {
      const errors = validateSetup({
        goalWeight: 180,
        height: 72,
        age: 25,
        sex: 'male',
        activityLevel: 'moderate',
        goal: 'lose_fat',
      })
      expect(errors.some((e) => e.includes('Current weight'))).toBe(true)
    })

    test('Invalid age (too young)', () => {
      const errors = validateSetup({
        currentWeight: 200,
        goalWeight: 180,
        height: 72,
        age: 8,
        sex: 'male',
        activityLevel: 'moderate',
        goal: 'lose_fat',
      })
      expect(errors.some((e) => e.includes('Age'))).toBe(true)
    })

    test('Weight too high', () => {
      const errors = validateSetup({
        currentWeight: 700,
        goalWeight: 180,
        height: 72,
        age: 25,
        sex: 'male',
        activityLevel: 'moderate',
        goal: 'lose_fat',
      })
      expect(errors.some((e) => e.includes('weight seems too high'))).toBe(true)
    })
  })

  describe('Display Labels', () => {
    test('Activity level labels', () => {
      expect(getActivityLevelLabel('sedentary')).toContain('Sedentary')
      expect(getActivityLevelLabel('light')).toContain('1-3 days')
      expect(getActivityLevelLabel('moderate')).toContain('3-5 days')
      expect(getActivityLevelLabel('very_active')).toContain('6-7 days')
      expect(getActivityLevelLabel('extremely_active')).toContain('twice/day')
    })

    test('Goal labels', () => {
      expect(getGoalLabel('lose_fat')).toBe('Lose Fat')
      expect(getGoalLabel('build_muscle')).toBe('Build Muscle')
      expect(getGoalLabel('body_recomposition')).toBe('Body Recomposition')
      expect(getGoalLabel('maintain')).toBe('Maintain Weight')
    })
  })

  describe('Edge Cases', () => {
    test('Very low calorie intake', () => {
      const result = calculateNutritionTargets({
        currentWeight: 120,
        goalWeight: 110,
        height: 60,
        age: 25,
        sex: 'female',
        activityLevel: 'sedentary',
        goal: 'lose_fat',
      })
      expect(result.dailyCalories).toBeGreaterThan(1000) // Minimum viable
    })

    test('High calorie surplus', () => {
      const result = calculateNutritionTargets({
        currentWeight: 200,
        goalWeight: 220,
        height: 76,
        age: 25,
        sex: 'male',
        activityLevel: 'extremely_active',
        goal: 'build_muscle',
      })
      expect(result.calorieDeficitOrSurplus).toBeGreaterThan(200)
    })

    test('Body recomposition maintains calories', () => {
      const result = calculateNutritionTargets({
        currentWeight: 180,
        goalWeight: 180,
        height: 70,
        age: 30,
        sex: 'male',
        activityLevel: 'moderate',
        goal: 'body_recomposition',
      })
      expect(result.calorieDeficitOrSurplus).toBe(0)
      expect(result.dailyCalories).toBe(result.maintenanceCalories)
    })
  })
})
