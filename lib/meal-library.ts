import type { Allergen, EatingPattern, FoodPreferences } from '@/lib/food-preferences'

/**
 * A small, filterable meal library.
 *
 * Deliberately not a meal plan. Fixed seven-day plans assume a client will eat
 * what they are told, for weeks, including the parts they dislike and the
 * meals they cannot make on a Tuesday; adherence collapses and the client
 * concludes they failed. A library plus swaps preserves choice, which is what
 * actually predicts whether someone is still doing this in March.
 *
 * Suitability for an eating pattern is DERIVED from ingredient tags rather
 * than hand-listed per meal. Hand-listing means every new meal is a chance to
 * forget that a Caesar dressing has anchovies in it; deriving means the rule
 * is written once and applied the same way every time.
 */

/** What a meal contains, for pattern rules. Distinct from allergens. */
export type Ingredient =
  | 'red_meat'
  | 'poultry'
  | 'pork'
  | 'fish'
  | 'shellfish'
  | 'dairy'
  | 'eggs'
  | 'honey'

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Meal {
  id: string
  name: string
  slot: MealSlot
  calories: number
  protein: number
  carbs: number
  fats: number
  /** Hands-on time, in minutes. */
  prep: number
  contains: Ingredient[]
  allergens: Allergen[]
}

export const MEALS: Meal[] = [
  // --- Breakfast ---
  { id: 'b1', name: 'Greek yoghurt with berries and honey', slot: 'breakfast', calories: 372, protein: 30, carbs: 53, fats: 5, prep: 5, contains: ['dairy', 'honey'], allergens: ['dairy'] },
  { id: 'b2', name: 'Three-egg scramble with spinach and toast', slot: 'breakfast', calories: 475, protein: 32, carbs: 37, fats: 22, prep: 10, contains: ['eggs'], allergens: ['eggs', 'wheat_gluten'] },
  { id: 'b3', name: 'Protein oats with banana and peanut butter', slot: 'breakfast', calories: 474, protein: 34, carbs: 66, fats: 10, prep: 8, contains: ['dairy'], allergens: ['dairy', 'peanuts'] },
  { id: 'b4', name: 'Cottage cheese with pineapple', slot: 'breakfast', calories: 305, protein: 28, carbs: 24, fats: 11, prep: 3, contains: ['dairy'], allergens: ['dairy'] },
  { id: 'b5', name: 'Smoked salmon on rye with cream cheese', slot: 'breakfast', calories: 432, protein: 26, carbs: 40, fats: 18, prep: 5, contains: ['fish', 'dairy'], allergens: ['fish', 'dairy', 'wheat_gluten'] },
  { id: 'b6', name: 'Tofu scramble with peppers', slot: 'breakfast', calories: 363, protein: 25, carbs: 11, fats: 27, prep: 12, contains: [], allergens: ['soy'] },
  { id: 'b7', name: 'Overnight oats with whey and chia', slot: 'breakfast', calories: 419, protein: 36, carbs: 46, fats: 10, prep: 5, contains: ['dairy'], allergens: ['dairy'] },
  { id: 'b8', name: 'Turkey and egg white wrap', slot: 'breakfast', calories: 402, protein: 48, carbs: 34, fats: 6, prep: 10, contains: ['poultry', 'eggs'], allergens: ['eggs', 'wheat_gluten'] },
  { id: 'b9', name: 'Chocolate protein smoothie with oats', slot: 'breakfast', calories: 400, protein: 44, carbs: 51, fats: 4, prep: 3, contains: ['dairy'], allergens: ['dairy'] },

  // --- Lunch ---
  { id: 'l1', name: 'Chicken, rice and broccoli', slot: 'lunch', calories: 531, protein: 49, carbs: 58, fats: 11, prep: 20, contains: ['poultry'], allergens: [] },
  { id: 'l2', name: 'Tuna salad on greens with crackers', slot: 'lunch', calories: 435, protein: 61, carbs: 25, fats: 10, prep: 8, contains: ['fish'], allergens: ['fish', 'wheat_gluten'] },
  { id: 'l3', name: 'Turkey chilli', slot: 'lunch', calories: 495, protein: 42, carbs: 39, fats: 21, prep: 30, contains: ['poultry'], allergens: [] },
  { id: 'l4', name: 'Lentil and chickpea curry with rice', slot: 'lunch', calories: 537, protein: 23, carbs: 74, fats: 17, prep: 25, contains: [], allergens: [] },
  { id: 'l5', name: 'Chicken Caesar wrap', slot: 'lunch', calories: 560, protein: 48, carbs: 37, fats: 23, prep: 10, contains: ['poultry', 'dairy', 'eggs', 'fish'], allergens: ['dairy', 'eggs', 'fish', 'wheat_gluten'] },
  { id: 'l6', name: 'Beef and black bean burrito bowl', slot: 'lunch', calories: 571, protein: 51, carbs: 69, fats: 10, prep: 20, contains: ['red_meat'], allergens: [] },
  { id: 'l7', name: 'Prawn and vegetable stir fry with noodles', slot: 'lunch', calories: 472, protein: 40, carbs: 40, fats: 17, prep: 15, contains: ['shellfish'], allergens: ['shellfish', 'soy', 'wheat_gluten'] },
  { id: 'l8', name: 'Tempeh buddha bowl', slot: 'lunch', calories: 531, protein: 36, carbs: 49, fats: 24, prep: 20, contains: [], allergens: ['soy', 'sesame'] },
  { id: 'l9', name: 'Egg salad sandwich with side salad', slot: 'lunch', calories: 535, protein: 37, carbs: 38, fats: 25, prep: 10, contains: ['eggs', 'dairy'], allergens: ['eggs', 'dairy', 'wheat_gluten'] },

  // --- Dinner ---
  { id: 'd1', name: 'Grilled salmon, potatoes and asparagus', slot: 'dinner', calories: 576, protein: 40, carbs: 43, fats: 26, prep: 25, contains: ['fish'], allergens: ['fish'] },
  { id: 'd2', name: 'Lean beef stir fry with rice', slot: 'dinner', calories: 595, protein: 54, carbs: 66, fats: 12, prep: 20, contains: ['red_meat'], allergens: ['soy'] },
  { id: 'd3', name: 'Chicken thigh traybake with sweet potato', slot: 'dinner', calories: 605, protein: 49, carbs: 56, fats: 20, prep: 40, contains: ['poultry'], allergens: [] },
  { id: 'd4', name: 'Turkey meatballs with pasta and marinara', slot: 'dinner', calories: 631, protein: 61, carbs: 61, fats: 16, prep: 30, contains: ['poultry', 'eggs'], allergens: ['eggs', 'wheat_gluten'] },
  { id: 'd5', name: 'Cod with white beans and greens', slot: 'dinner', calories: 489, protein: 47, carbs: 42, fats: 17, prep: 25, contains: ['fish'], allergens: ['fish'] },
  { id: 'd6', name: 'Black bean and sweet potato chilli', slot: 'dinner', calories: 501, protein: 17, carbs: 79, fats: 15, prep: 35, contains: [], allergens: [] },
  { id: 'd7', name: 'Pork loin with rice and green beans', slot: 'dinner', calories: 576, protein: 46, carbs: 50, fats: 22, prep: 30, contains: ['pork'], allergens: [] },
  { id: 'd8', name: 'Chicken fajitas with tortillas', slot: 'dinner', calories: 570, protein: 49, carbs: 54, fats: 15, prep: 25, contains: ['poultry'], allergens: ['wheat_gluten'] },
  { id: 'd9', name: 'Tofu and vegetable curry with rice', slot: 'dinner', calories: 522, protein: 34, carbs: 59, fats: 18, prep: 25, contains: [], allergens: ['soy'] },

  // --- Snacks ---
  { id: 's1', name: 'Whey shake with water', slot: 'snack', calories: 120, protein: 24, carbs: 3, fats: 2, prep: 1, contains: ['dairy'], allergens: ['dairy'] },
  { id: 's2', name: 'Apple with peanut butter', slot: 'snack', calories: 270, protein: 8, carbs: 31, fats: 15, prep: 2, contains: [], allergens: ['peanuts'] },
  { id: 's3', name: 'Beef jerky', slot: 'snack', calories: 182, protein: 21, carbs: 7, fats: 7, prep: 0, contains: ['red_meat'], allergens: ['soy'] },
  { id: 's4', name: 'Greek yoghurt with almonds', slot: 'snack', calories: 269, protein: 27, carbs: 13, fats: 13, prep: 2, contains: ['dairy'], allergens: ['dairy', 'tree_nuts'] },
  { id: 's5', name: 'Three hard-boiled eggs', slot: 'snack', calories: 215, protein: 19, carbs: 1, fats: 14, prep: 12, contains: ['eggs'], allergens: ['eggs'] },
  { id: 's6', name: 'Protein bar', slot: 'snack', calories: 220, protein: 20, carbs: 24, fats: 7, prep: 0, contains: ['dairy'], allergens: ['dairy', 'soy'] },
  { id: 's7', name: 'Edamame with sea salt', slot: 'snack', calories: 195, protein: 18, carbs: 16, fats: 8, prep: 5, contains: [], allergens: ['soy'] },
  { id: 's8', name: 'Cottage cheese with cucumber', slot: 'snack', calories: 182, protein: 19, carbs: 9, fats: 7, prep: 3, contains: ['dairy'], allergens: ['dairy'] },
  { id: 's9', name: 'Hummus with carrots and pitta', slot: 'snack', calories: 295, protein: 11, carbs: 47, fats: 8, prep: 3, contains: [], allergens: ['sesame', 'wheat_gluten'] },

  // --- Plant-based, added to balance the library ---
  //
  // The first pass left a vegan client with 8 meals across all four slots and
  // only two dinners, which is not a library, it is a rut. These bring vegan
  // to 16 and, because vegan meals are also vegetarian, lift vegetarian
  // dinners from 2 to 4. Several deliberately carry no allergens at all, so
  // that a vegan client with allergies still has something to eat.
  { id: 'v1', name: 'Chia pudding with pea protein and berries', slot: 'breakfast', calories: 361, protein: 35, carbs: 26, fats: 13, prep: 5, contains: [], allergens: [] },
  { id: 'v2', name: 'Peanut butter and banana protein smoothie', slot: 'breakfast', calories: 424, protein: 37, carbs: 37, fats: 16, prep: 3, contains: [], allergens: ['peanuts'] },
  { id: 'v3', name: 'Falafel and quinoa salad bowl', slot: 'lunch', calories: 535, protein: 21, carbs: 62, fats: 24, prep: 15, contains: [], allergens: ['sesame', 'wheat_gluten'] },
  { id: 'v4', name: 'Black bean and corn salad with avocado', slot: 'lunch', calories: 482, protein: 23, carbs: 78, fats: 12, prep: 10, contains: [], allergens: [] },
  { id: 'v5', name: 'Seitan stir fry with rice', slot: 'dinner', calories: 506, protein: 43, carbs: 84, fats: 4, prep: 20, contains: [], allergens: ['wheat_gluten', 'soy'] },
  { id: 'v6', name: 'Red lentil dahl with brown rice', slot: 'dinner', calories: 523, protein: 26, carbs: 88, fats: 8, prep: 30, contains: [], allergens: [] },
  { id: 'v7', name: 'Roasted chickpeas', slot: 'snack', calories: 196, protein: 10, carbs: 31, fats: 4, prep: 2, contains: [], allergens: [] },
  { id: 'v8', name: 'Pea protein shake with water', slot: 'snack', calories: 120, protein: 24, carbs: 2, fats: 2, prep: 1, contains: [], allergens: [] },
]

const has = (m: Meal, ...items: Ingredient[]) => items.some((i) => m.contains.includes(i))

/**
 * Whether a meal fits an eating pattern.
 *
 * Halal and kosher are handled as the dietary-law subset this library can
 * honestly speak to -- no pork, and for kosher also no shellfish and no meat
 * served with dairy. Certification and preparation are beyond what a meal list
 * can promise, which is why the UI says so rather than implying otherwise.
 */
export function fitsPattern(meal: Meal, pattern: EatingPattern): boolean {
  switch (pattern) {
    case 'none':
      return true
    case 'vegan':
      return !has(meal, 'red_meat', 'poultry', 'pork', 'fish', 'shellfish', 'dairy', 'eggs', 'honey')
    case 'vegetarian':
      return !has(meal, 'red_meat', 'poultry', 'pork', 'fish', 'shellfish')
    case 'pescatarian':
      return !has(meal, 'red_meat', 'poultry', 'pork')
    case 'halal':
      return !has(meal, 'pork')
    case 'kosher': {
      if (has(meal, 'pork', 'shellfish')) return false
      const meat = has(meal, 'red_meat', 'poultry')
      return !(meat && has(meal, 'dairy'))
    }
  }
}

export function isSafe(meal: Meal, allergens: FoodPreferences['allergens']): boolean {
  return !meal.allergens.some((a) => allergens.includes(a))
}

/** Soft filter. A disliked food is hidden, not forbidden. */
function isDisliked(meal: Meal, dislikes: string): boolean {
  const terms = dislikes
    .toLowerCase()
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
  if (terms.length === 0) return false
  const name = meal.name.toLowerCase()
  return terms.some((t) => name.includes(t))
}

export interface LibraryQuery {
  slot?: MealSlot
  /** Cap on calories, e.g. a third of the day's target. */
  maxCalories?: number
  /** Only meals at or above this protein. */
  minProtein?: number
  /** Only meals this quick. */
  maxPrep?: number
}

export function filterMeals(
  prefs: FoodPreferences,
  query: LibraryQuery = {}
): Meal[] {
  return MEALS.filter((m) => {
    if (query.slot && m.slot !== query.slot) return false
    if (!fitsPattern(m, prefs.eatingPattern)) return false
    if (!isSafe(m, prefs.allergens)) return false
    if (isDisliked(m, prefs.dislikes)) return false
    if (query.maxCalories !== undefined && m.calories > query.maxCalories) return false
    if (query.minProtein !== undefined && m.protein < query.minProtein) return false
    if (query.maxPrep !== undefined && m.prep > query.maxPrep) return false
    return true
  })
}

/**
 * Up to three alternatives at a similar calorie and protein cost, so swapping
 * does not require the client to understand macros.
 */
export function swapsFor(meal: Meal, prefs: FoodPreferences, limit = 3): Meal[] {
  return filterMeals(prefs, { slot: meal.slot })
    .filter((m) => m.id !== meal.id)
    .map((m) => ({
      meal: m,
      gap:
        Math.abs(m.calories - meal.calories) / Math.max(1, meal.calories) +
        Math.abs(m.protein - meal.protein) / Math.max(1, meal.protein),
    }))
    .sort((a, b) => a.gap - b.gap)
    .slice(0, limit)
    .map((x) => x.meal)
}
