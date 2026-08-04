/**
 * Nutrition calculation engine for MyFitnessPal-style serving selection.
 * Handles unit conversions and real-time macro calculations.
 */

export interface NutritionData {
  calories: number
  protein: number
  carbs: number
  fats: number
  fiber?: number
  sugar?: number
  sodium?: number
}

export interface FoodNutrition extends NutritionData {
  id?: string
  name: string
  brand?: string
  barcode?: string
  baseWeight: number // in grams
  baseNutrition: NutritionData // per 100g or per baseWeight
  availableUnits: FoodUnit[]
}

export interface FoodUnit {
  name: string // "gram", "ounce", "cup", "piece", "scoop", "ml"
  abbreviation: string // "g", "oz", "cup", "pc", "scoop", "ml"
  gramsPerUnit: number // conversion factor to grams
}

/**
 * Standard unit definitions with gram conversions
 */
const STANDARD_UNITS: Record<string, FoodUnit> = {
  gram: { name: 'gram', abbreviation: 'g', gramsPerUnit: 1 },
  ounce: { name: 'ounce', abbreviation: 'oz', gramsPerUnit: 28.35 },
  pound: { name: 'pound', abbreviation: 'lb', gramsPerUnit: 453.592 },
  cup: { name: 'cup', abbreviation: 'cup', gramsPerUnit: 240 },
  fluidOunce: { name: 'fluid ounce', abbreviation: 'fl oz', gramsPerUnit: 29.5735 },
  milliliter: { name: 'milliliter', abbreviation: 'ml', gramsPerUnit: 1 },
  piece: { name: 'piece', abbreviation: 'pc', gramsPerUnit: 1 }, // placeholder
  scoop: { name: 'scoop', abbreviation: 'scoop', gramsPerUnit: 1 }, // placeholder
  tablespoon: { name: 'tablespoon', abbreviation: 'tbsp', gramsPerUnit: 15 },
  teaspoon: { name: 'teaspoon', abbreviation: 'tsp', gramsPerUnit: 5 },
  serving: { name: 'serving', abbreviation: 'serving', gramsPerUnit: 1 }, // placeholder
}

/**
 * Convert a quantity from one unit to grams
 */
export function convertToGrams(quantity: number, unit: FoodUnit): number {
  return quantity * unit.gramsPerUnit
}

/**
 * Convert grams to a specific unit
 */
export function convertFromGrams(grams: number, unit: FoodUnit): number {
  return grams / unit.gramsPerUnit
}

/**
 * Calculate nutrition for a specific serving
 * @param baseNutrition - Nutrition per 100g or per baseWeight
 * @param baseWeight - Weight of the base serving (usually 100)
 * @param servingGrams - Weight of the serving being logged
 */
export function calculateNutrition(
  baseNutrition: NutritionData,
  baseWeight: number,
  servingGrams: number
): NutritionData {
  const multiplier = servingGrams / baseWeight

  return {
    calories: Math.round(baseNutrition.calories * multiplier * 10) / 10,
    protein: Math.round(baseNutrition.protein * multiplier * 10) / 10,
    carbs: Math.round(baseNutrition.carbs * multiplier * 10) / 10,
    fats: Math.round(baseNutrition.fats * multiplier * 10) / 10,
    fiber: baseNutrition.fiber ? Math.round(baseNutrition.fiber * multiplier * 10) / 10 : undefined,
    sugar: baseNutrition.sugar ? Math.round(baseNutrition.sugar * multiplier * 10) / 10 : undefined,
    sodium: baseNutrition.sodium ? Math.round(baseNutrition.sodium * multiplier * 10) / 10 : undefined,
  }
}

/**
 * Get suggested units for a food type
 */
export function getSuggestedUnits(foodType: string): FoodUnit[] {
  const unitMap: Record<string, FoodUnit[]> = {
    chicken: [STANDARD_UNITS.gram, STANDARD_UNITS.ounce, STANDARD_UNITS.pound, STANDARD_UNITS.piece],
    meat: [STANDARD_UNITS.gram, STANDARD_UNITS.ounce, STANDARD_UNITS.pound],
    fish: [STANDARD_UNITS.gram, STANDARD_UNITS.ounce, STANDARD_UNITS.pound],
    rice: [STANDARD_UNITS.gram, STANDARD_UNITS.ounce, STANDARD_UNITS.cup, STANDARD_UNITS.serving],
    pasta: [STANDARD_UNITS.gram, STANDARD_UNITS.ounce, STANDARD_UNITS.cup, STANDARD_UNITS.serving],
    milk: [STANDARD_UNITS.cup, STANDARD_UNITS.fluidOunce, STANDARD_UNITS.milliliter],
    liquid: [STANDARD_UNITS.cup, STANDARD_UNITS.fluidOunce, STANDARD_UNITS.milliliter],
    powder: [STANDARD_UNITS.gram, STANDARD_UNITS.ounce, STANDARD_UNITS.scoop],
    vegetable: [STANDARD_UNITS.gram, STANDARD_UNITS.ounce, STANDARD_UNITS.cup, STANDARD_UNITS.piece],
    fruit: [STANDARD_UNITS.gram, STANDARD_UNITS.ounce, STANDARD_UNITS.piece, STANDARD_UNITS.cup],
    bread: [STANDARD_UNITS.gram, STANDARD_UNITS.ounce, STANDARD_UNITS.piece, STANDARD_UNITS.slice],
    oil: [STANDARD_UNITS.gram, STANDARD_UNITS.tablespoon, STANDARD_UNITS.teaspoon, STANDARD_UNITS.milliliter],
  }

  return unitMap[foodType.toLowerCase()] || [
    STANDARD_UNITS.gram,
    STANDARD_UNITS.ounce,
    STANDARD_UNITS.cup,
    STANDARD_UNITS.piece,
  ]
}

/**
 * Quick serving size adjusters (for +/- buttons)
 */
export const QUICK_ADJUSTMENTS = [0.25, 0.5, 1, 1.5, 2]

/**
 * Format nutrition for display
 */
export function formatNutrition(value: number | undefined, decimals = 1): string {
  if (value === undefined) return '—'
  return Number(value).toFixed(decimals)
}
