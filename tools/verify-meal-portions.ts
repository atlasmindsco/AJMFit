/**
 * Do the portions add up to the macros the client is shown?
 *
 * This is the only check that matters. A meal library's whole value is that
 * "520 cal, 45g protein" beside a name is TRUE, and the moment portions are
 * printed next to it the two have to agree — otherwise the app is showing a
 * client an amount of food and a number that amount does not produce.
 *
 * Reference values are per 100g, from standard composition tables, cooked
 * where the portion says cooked. They do not need to be perfect: the check is
 * whether a portion list lands near its stated macros, not whether a brand of
 * yoghurt is 59 or 61 calories.
 */
import { MEALS } from '../lib/meal-library.ts'
import { PORTIONS, portionLine, ingredientsFor } from '../lib/meal-portions.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 50), detail)
}

/** Per 100g: calories, protein, carbs, fats. */
const FOODS: Record<string, [number, number, number, number]> = {
  water: [0, 0, 0, 0],
  // Dairy and eggs
  greek_yoghurt_0: [59, 10.2, 3.6, 0.4],
  cottage_cheese: [98, 11, 3.4, 4.3],
  cream_cheese: [342, 6, 4, 34],
  parmesan: [420, 38, 4, 28],
  soured_cream: [198, 2.4, 4.6, 19],
  milk_semi: [50, 3.4, 4.8, 1.8],
  milk_skimmed: [35, 3.4, 5, 0.2],
  egg: [143, 12.6, 0.7, 9.5],
  egg_white: [52, 11, 0.7, 0.2],
  // Meat and fish
  chicken_breast: [165, 31, 0, 3.6],
  chicken_thigh: [179, 24.8, 0, 8.2],
  turkey_breast: [135, 29, 0, 1.7],
  turkey_mince_5: [152, 27, 0, 5],
  beef_mince_5: [170, 27, 0, 7],
  pork_loin: [160, 28, 0, 5],
  salmon: [208, 20, 0, 13],
  smoked_salmon: [117, 18, 0, 4.3],
  cod: [90, 20, 0, 0.7],
  tuna_water: [116, 26, 0, 1],
  prawns: [99, 24, 0.2, 0.3],
  jerky: [280, 33, 11, 11],
  // Plant protein
  tofu_firm: [144, 17, 2.8, 8.7],
  tempeh: [192, 20, 7.6, 11],
  seitan: [141, 25, 14, 2],
  edamame: [122, 11, 10, 5],
  pea_protein: [400, 80, 5, 7],
  whey: [400, 80, 10, 5],
  protein_bar: [367, 33, 40, 12],
  // Grains and starch
  oats: [380, 13, 67, 7],
  bread_wholemeal: [247, 13, 41, 3.4],
  bread_rye: [259, 9, 48, 3.3],
  tortilla: [310, 8, 51, 7],
  pitta: [275, 9, 55, 1.2],
  crackers: [430, 9, 70, 13],
  rice_cooked: [130, 2.7, 28, 0.3],
  rice_brown_cooked: [123, 2.7, 26, 1],
  pasta_cooked: [158, 6, 31, 0.9],
  noodles_cooked: [138, 4.5, 25, 2.1],
  quinoa_cooked: [120, 4.4, 21, 1.9],
  granola: [471, 10, 64, 20],
  potatoes: [77, 2, 17, 0.1],
  sweet_potato: [86, 1.6, 20, 0.1],
  // Pulses
  lentils_dry: [352, 25, 60, 1],
  chickpeas: [139, 7.3, 22, 2.6],
  chickpeas_roasted: [392, 19, 61, 7],
  black_beans: [132, 8.9, 24, 0.5],
  kidney_beans: [127, 8.7, 23, 0.5],
  white_beans: [114, 8, 21, 0.3],
  falafel: [333, 13, 32, 18],
  hummus: [166, 8, 14, 10],
  // Fruit and veg
  berries: [50, 0.8, 12, 0.3],
  banana: [89, 1.1, 23, 0.3],
  apple: [52, 0.3, 14, 0.2],
  pineapple: [50, 0.5, 13, 0.1],
  avocado: [160, 2, 9, 15],
  spinach: [23, 2.9, 3.6, 0.4],
  kale: [49, 4.3, 9, 0.9],
  broccoli: [34, 2.8, 7, 0.4],
  asparagus: [20, 2.2, 3.9, 0.1],
  green_beans: [31, 1.8, 7, 0.1],
  peppers: [31, 1, 6, 0.3],
  mixed_veg: [45, 2.5, 8, 0.4],
  salad_leaves: [17, 1.4, 3.3, 0.2],
  cucumber: [15, 0.7, 3.6, 0.1],
  carrot: [41, 0.9, 10, 0.2],
  sweetcorn: [86, 3.2, 19, 1.2],
  tomatoes_tinned: [32, 1.6, 7, 0.3],
  // Fats, sauces, extras
  olive_oil: [884, 0, 0, 100],
  peanut_butter: [588, 25, 20, 50],
  almonds: [579, 21, 22, 50],
  chia: [486, 17, 42, 31],
  tahini: [595, 17, 21, 54],
  honey: [304, 0.3, 82, 0],
  mayo_light: [250, 0.5, 8, 24],
  caesar_dressing: [430, 2, 4, 46],
  salsa: [36, 1.5, 7, 0.2],
  marinara: [55, 1.6, 8, 1.8],
  soy_sauce: [53, 8, 5, 0.1],
  soy_milk: [43, 3.3, 2.5, 1.8],
  coconut_milk_light: [73, 0.7, 2, 7],
}

const macrosOf = (mealId: string) => {
  let cal = 0, pro = 0, carb = 0, fat = 0
  for (const x of ingredientsFor(mealId)) {
    const ref = FOODS[x.ref]
    if (!ref) return null
    const f = x.grams / 100
    cal += ref[0] * f
    pro += ref[1] * f
    carb += ref[2] * f
    fat += ref[3] * f
  }
  return { cal: Math.round(cal), pro: Math.round(pro), carb: Math.round(carb), fat: Math.round(fat) }
}

console.log('EVERY MEAL HAS PORTIONS\n')
{
  const missing = MEALS.filter((m) => ingredientsFor(m.id).length === 0)
  g('all 44 meals have portions', missing.length === 0, missing.map((m) => m.id).join(', '))

  const orphans = Object.keys(PORTIONS).filter((id) => !MEALS.some((m) => m.id === id))
  g('no portions for a meal that is gone', orphans.length === 0, orphans.join(', '))

  const unknownRef = Object.values(PORTIONS).flat().filter((x) => !FOODS[x.ref])
  g('every ingredient is in the table', unknownRef.length === 0, unknownRef.map((x) => x.ref).join(', '))

  const noAmount = Object.values(PORTIONS).flat().filter((x) => !x.amount.trim() || !x.food.trim())
  g('every portion says an amount and a food', noAmount.length === 0)

  // Grams must match the amount where the amount IS grams, or the displayed
  // number and the checked number are different claims.
  const mismatched = Object.values(PORTIONS).flat().filter((x) => {
    const m = /^(\d+)\s*(g|ml)$/.exec(x.amount.trim())
    return m ? Number(m[1]) !== x.grams : false
  })
  g('gram amounts match their weights', mismatched.length === 0, mismatched.map((x) => x.food).join(', '))
}

console.log('\nDO THE PORTIONS PRODUCE THE STATED MACROS?')
console.log('Tolerance 2%: the macros are DERIVED from these portions, so a real drift means one side was edited without the other.\n')

const TOL = 0.02
let worstCal = 0
let worstPro = 0
const offenders: string[] = []

for (const meal of MEALS) {
  const got = macrosOf(meal.id)
  if (!got) continue
  const calDrift = Math.abs(got.cal - meal.calories) / meal.calories
  const proDrift = Math.abs(got.pro - meal.protein) / meal.protein
  worstCal = Math.max(worstCal, calDrift)
  worstPro = Math.max(worstPro, proDrift)
  if (calDrift > TOL || proDrift > TOL) {
    offenders.push(
      `${W(meal.id, 4)} ${W(meal.name.slice(0, 38), 39)} says ${meal.calories}cal/${meal.protein}p, portions give ${got.cal}cal/${got.pro}p`
    )
  }
}

g('every meal is within tolerance', offenders.length === 0, `${offenders.length} of ${MEALS.length} drift`)
for (const o of offenders) console.log('         ' + o)
console.log(`\n  worst calorie drift ${Math.round(worstCal * 100)}%, worst protein drift ${Math.round(worstPro * 100)}%`)

console.log('\nHOW IT READS\n')
{
  const line = portionLine(ingredientsFor('b1'))
  g('a portion line is readable', /^[0-9]/.test(line) && line.includes('·'), line)
  g('and not absurdly long', Object.values(PORTIONS).every((ps) => portionLine(ps).length < 150))
  g('water is listed and counts as nothing', ingredientsFor('s1').some((x) => x.ref === 'water'))
}

console.log(fail === 0 ? '\nAll portion checks passed.' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
