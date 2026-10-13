/**
 * How much of each thing is in a suggested meal.
 *
 * The library gave a name and a macro line — "Greek yoghurt with berries and
 * honey, 380 cal, 32g protein" — and left the client to guess whether that
 * meant a small pot or a large one. A coach reported it: the suggestions were
 * unusable without amounts, because the macros they are chosen for only hold
 * at one portion size.
 *
 * These are not decoration. The whole point of a meal library is that the
 * numbers beside a meal are true, so the portions have to PRODUCE those
 * numbers. tools/verify-meal-portions.ts adds every portion up against a
 * reference table and fails when a meal drifts more than 12% from its stated
 * calories or protein — which is how the first draft of this file was
 * corrected rather than shipped.
 *
 * Grams throughout for anything weighable, because "a handful of oats" is the
 * problem being fixed. Cooked weights for rice and pasta, since that is what a
 * client has in front of them.
 */

export interface Portion {
  /** What the client reads: "200g", "2 slices", "1 tbsp". */
  amount: string
  /** The food, as it would appear on a shopping list. */
  food: string
  /** Weight in grams, for the macro check. Units resolve to grams here. */
  grams: number
  /** Key into the reference table in the verifier. */
  ref: string
}

export const p = (amount: string, food: string, grams: number, ref: string): Portion => ({
  amount,
  food,
  grams,
  ref,
})

/**
 * Portions by meal id.
 *
 * Every id in MEALS must appear here — the verifier checks that too, so a meal
 * added later without portions fails rather than silently showing nothing.
 */
export const PORTIONS: Record<string, Portion[]> = {
  /* ── Breakfast ─────────────────────────────────────────────────── */
  b1: [
    p('270g', 'Greek yoghurt, 0% fat', 270, 'greek_yoghurt_0'),
    p('110g', 'mixed berries', 110, 'berries'),
    p('1 tbsp', 'honey', 21, 'honey'),
    p('20g', 'granola', 20, 'granola'),
  ],
  b2: [
    p('3 large', 'eggs', 150, 'egg'),
    p('80g', 'spinach', 80, 'spinach'),
    p('2 slices', 'wholemeal toast', 80, 'bread_wholemeal'),
    p('1 tsp', 'olive oil', 5, 'olive_oil'),
  ],
  b3: [
    p('50g', 'rolled oats', 50, 'oats'),
    p('1 scoop', 'whey protein', 30, 'whey'),
    p('1 medium', 'banana', 118, 'banana'),
    p('10g', 'peanut butter', 10, 'peanut_butter'),
  ],
  b4: [p('250g', 'cottage cheese', 250, 'cottage_cheese'), p('120g', 'pineapple', 120, 'pineapple')],
  b5: [
    p('90g', 'smoked salmon', 90, 'smoked_salmon'),
    p('2 slices', 'rye bread', 80, 'bread_rye'),
    p('35g', 'cream cheese', 35, 'cream_cheese'),
  ],
  b6: [
    p('140g', 'firm tofu', 140, 'tofu_firm'),
    p('120g', 'peppers', 120, 'peppers'),
    p('1 tbsp', 'olive oil', 14, 'olive_oil'),
  ],
  b7: [
    p('50g', 'rolled oats', 50, 'oats'),
    p('1 scoop', 'whey protein', 30, 'whey'),
    p('10g', 'chia seeds', 10, 'chia'),
    p('120ml', 'semi-skimmed milk', 120, 'milk_semi'),
  ],
  b8: [
    p('85g', 'turkey breast', 85, 'turkey_breast'),
    p('170ml', 'egg whites', 170, 'egg_white'),
    p('1 large', 'tortilla wrap', 64, 'tortilla'),
  ],
  b9: [
    p('1.5 scoops', 'chocolate whey', 45, 'whey'),
    p('20g', 'rolled oats', 20, 'oats'),
    p('1 medium', 'banana', 118, 'banana'),
    p('110ml', 'skimmed milk', 110, 'milk_skimmed'),
  ],
  v1: [
    p('25g', 'chia seeds', 25, 'chia'),
    p('1 scoop', 'pea protein', 30, 'pea_protein'),
    p('190ml', 'soy milk', 190, 'soy_milk'),
    p('75g', 'mixed berries', 75, 'berries'),
  ],
  v2: [
    p('1 scoop', 'pea protein', 30, 'pea_protein'),
    p('1 medium', 'banana', 118, 'banana'),
    p('20g', 'peanut butter', 20, 'peanut_butter'),
    p('190ml', 'soy milk', 190, 'soy_milk'),
  ],
  /* ── Lunch ─────────────────────────────────────────────────────── */
  l1: [
    p('130g', 'chicken breast, cooked', 130, 'chicken_breast'),
    p('170g', 'white rice, cooked', 170, 'rice_cooked'),
    p('150g', 'broccoli', 150, 'broccoli'),
    p('1 tsp', 'olive oil', 5, 'olive_oil'),
  ],
  l2: [
    p('2 tins', 'tuna in spring water, drained', 220, 'tuna_water'),
    p('80g', 'mixed salad leaves', 80, 'salad_leaves'),
    p('1 tbsp', 'light mayonnaise', 15, 'mayo_light'),
    p('30g', 'crackers', 30, 'crackers'),
  ],
  l3: [
    p('110g', 'turkey mince, 5% fat', 110, 'turkey_mince_5'),
    p('110g', 'kidney beans, drained', 110, 'kidney_beans'),
    p('200g', 'chopped tomatoes', 200, 'tomatoes_tinned'),
    p('1 tbsp', 'olive oil', 14, 'olive_oil'),
  ],
  l4: [
    p('60g', 'red lentils, dry', 60, 'lentils_dry'),
    p('75g', 'chickpeas, drained', 75, 'chickpeas'),
    p('75g', 'basmati rice, cooked', 75, 'rice_cooked'),
    p('1 tbsp', 'olive oil', 14, 'olive_oil'),
  ],
  l5: [
    p('120g', 'chicken breast, cooked', 120, 'chicken_breast'),
    p('1 large', 'tortilla wrap', 64, 'tortilla'),
    p('80g', 'romaine lettuce', 80, 'salad_leaves'),
    p('25g', 'Caesar dressing', 25, 'caesar_dressing'),
    p('10g', 'parmesan', 10, 'parmesan'),
  ],
  l6: [
    p('130g', 'lean beef mince, 5% fat', 130, 'beef_mince_5'),
    p('130g', 'black beans, drained', 130, 'black_beans'),
    p('130g', 'rice, cooked', 130, 'rice_cooked'),
    p('25g', 'salsa', 25, 'salsa'),
  ],
  l7: [
    p('130g', 'king prawns', 130, 'prawns'),
    p('110g', 'egg noodles, cooked', 110, 'noodles_cooked'),
    p('150g', 'stir fry vegetables', 150, 'mixed_veg'),
    p('1 tbsp', 'sesame oil', 14, 'olive_oil'),
  ],
  l8: [
    p('120g', 'tempeh', 120, 'tempeh'),
    p('120g', 'quinoa, cooked', 120, 'quinoa_cooked'),
    p('150g', 'roasted vegetables', 150, 'mixed_veg'),
    p('1 tbsp', 'tahini', 15, 'tahini'),
  ],
  l9: [
    p('4 large', 'eggs', 200, 'egg'),
    p('2 slices', 'wholemeal bread', 80, 'bread_wholemeal'),
    p('1 tbsp', 'light mayonnaise', 15, 'mayo_light'),
    p('80g', 'side salad', 80, 'salad_leaves'),
  ],
  v3: [
    p('90g', 'falafel', 90, 'falafel'),
    p('90g', 'quinoa, cooked', 90, 'quinoa_cooked'),
    p('150g', 'salad vegetables', 150, 'mixed_veg'),
    p('10g', 'tahini', 10, 'tahini'),
  ],
  v4: [
    p('170g', 'black beans, drained', 170, 'black_beans'),
    p('100g', 'sweetcorn', 100, 'sweetcorn'),
    p('65g', 'avocado', 65, 'avocado'),
    p('150g', 'salad vegetables', 150, 'mixed_veg'),
  ],
  /* ── Dinner ────────────────────────────────────────────────────── */
  d1: [
    p('160g', 'salmon fillet', 160, 'salmon'),
    p('220g', 'new potatoes', 220, 'potatoes'),
    p('150g', 'asparagus', 150, 'asparagus'),
    p('1 tsp', 'olive oil', 5, 'olive_oil'),
  ],
  d2: [
    p('160g', 'lean beef strips, 5% fat', 160, 'beef_mince_5'),
    p('180g', 'rice, cooked', 180, 'rice_cooked'),
    p('180g', 'stir fry vegetables', 180, 'mixed_veg'),
    p('1 tbsp', 'soy sauce', 15, 'soy_sauce'),
  ],
  d3: [
    p('170g', 'chicken thigh, skinless', 170, 'chicken_thigh'),
    p('220g', 'sweet potato', 220, 'sweet_potato'),
    p('150g', 'mixed vegetables', 150, 'mixed_veg'),
    p('1 tsp', 'olive oil', 5, 'olive_oil'),
  ],
  d4: [
    p('160g', 'turkey mince, 5% fat', 160, 'turkey_mince_5'),
    p('160g', 'pasta, cooked', 160, 'pasta_cooked'),
    p('130g', 'marinara sauce', 130, 'marinara'),
    p('15g', 'parmesan', 15, 'parmesan'),
  ],
  d5: [
    p('150g', 'cod fillet', 150, 'cod'),
    p('150g', 'cannellini beans, drained', 150, 'white_beans'),
    p('120g', 'kale', 120, 'kale'),
    p('1 tbsp', 'olive oil', 14, 'olive_oil'),
  ],
  d6: [
    p('120g', 'black beans, drained', 120, 'black_beans'),
    p('180g', 'sweet potato', 180, 'sweet_potato'),
    p('200g', 'chopped tomatoes', 200, 'tomatoes_tinned'),
    p('1 tbsp', 'olive oil', 14, 'olive_oil'),
  ],
  d7: [
    p('140g', 'pork loin', 140, 'pork_loin'),
    p('140g', 'rice, cooked', 140, 'rice_cooked'),
    p('150g', 'green beans', 150, 'green_beans'),
    p('1 tbsp', 'olive oil', 14, 'olive_oil'),
  ],
  d8: [
    p('130g', 'chicken breast, cooked', 130, 'chicken_breast'),
    p('2 medium', 'tortillas', 90, 'tortilla'),
    p('120g', 'peppers and onion', 120, 'peppers'),
    p('20g', 'soured cream', 20, 'soured_cream'),
  ],
  d9: [
    p('150g', 'firm tofu', 150, 'tofu_firm'),
    p('150g', 'rice, cooked', 150, 'rice_cooked'),
    p('150g', 'curry vegetables', 150, 'mixed_veg'),
    p('60ml', 'light coconut milk', 60, 'coconut_milk_light'),
  ],
  v5: [
    p('130g', 'seitan', 130, 'seitan'),
    p('180g', 'rice, cooked', 180, 'rice_cooked'),
    p('180g', 'stir fry vegetables', 180, 'mixed_veg'),
    p('1 tbsp', 'soy sauce', 15, 'soy_sauce'),
  ],
  v6: [
    p('75g', 'red lentils, dry', 75, 'lentils_dry'),
    p('120g', 'brown rice, cooked', 120, 'rice_brown_cooked'),
    p('150g', 'spinach and tomato', 150, 'mixed_veg'),
    p('1 tsp', 'coconut oil', 5, 'olive_oil'),
  ],
  /* ── Snacks ────────────────────────────────────────────────────── */
  s1: [p('1 scoop', 'whey protein', 30, 'whey'), p('300ml', 'water', 300, 'water')],
  s2: [p('1 medium', 'apple', 180, 'apple'), p('30g', 'peanut butter', 30, 'peanut_butter')],
  s3: [p('65g', 'beef jerky', 65, 'jerky')],
  s4: [p('210g', 'Greek yoghurt, 0% fat', 210, 'greek_yoghurt_0'), p('25g', 'almonds', 25, 'almonds')],
  s5: [p('3 large', 'eggs, hard-boiled', 150, 'egg')],
  s6: [p('1 bar', 'protein bar', 60, 'protein_bar')],
  s7: [p('160g', 'edamame, shelled', 160, 'edamame')],
  s8: [p('170g', 'cottage cheese', 170, 'cottage_cheese'), p('100g', 'cucumber', 100, 'cucumber')],
  s9: [
    p('70g', 'hummus', 70, 'hummus'),
    p('100g', 'carrot sticks', 100, 'carrot'),
    p('50g', 'pitta bread', 50, 'pitta'),
  ],
  v7: [p('50g', 'roasted chickpeas', 50, 'chickpeas_roasted')],
  v8: [p('1 scoop', 'pea protein', 30, 'pea_protein'), p('300ml', 'water', 300, 'water')],
}

/** "250g Greek yoghurt, 0% fat · 100g mixed berries · 1 tbsp honey" */
export function portionLine(portions: Portion[]): string {
  return portions.map((x) => `${x.amount} ${x.food}`).join(' · ')
}

/**
 * The ingredients and amounts for a meal.
 *
 * Named for ingredients rather than portions because lib/portions.ts already
 * owns portionsFor — that one is about hand-sized portions for eating off
 * plan, which is a different idea entirely.
 */
export function ingredientsFor(mealId: string): Portion[] {
  return PORTIONS[mealId] ?? []
}
