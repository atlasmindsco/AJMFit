/**
 * Pure-function checks for the nutrition goal engine's building blocks.
 *
 * Ported from tests/nutrition-system.test.ts, which was written in Jest style
 * against an API that the September 2026 safety audit removed. Nothing ran it
 * -- there is no test runner in this project -- so it sat there producing 100
 * TypeScript errors and hiding real ones. The assertions worth keeping are
 * here, against the functions lib/nutrition-goals actually exports.
 *
 * Deliberately NOT ported, because the audit reversed the behaviour on
 * purpose and a test asserting the old numbers would re-encode the bug:
 *
 *   - calculateDailyCalories(maintenance, goal) and its flat -20% / +10%
 *     bands. Targets are anchored to a rate of bodyweight change now, because
 *     a flat percentage handed a small sedentary woman 941 calories.
 *   - calculateProteinTarget(goalWeight, goal) and its 1.0 g per lb of GOAL
 *     weight. Protein anchors to CURRENT weight (capped) now; the old anchor
 *     gave a 300 lb client cutting to 180 only 0.60 g per pound of the body
 *     he actually had.
 *   - "Body recomposition maintains calories" asserting
 *     dailyCalories === maintenanceCalories. Calories are rounded to the
 *     nearest 25 after clamping, so recomp lands within 12 of maintenance,
 *     not exactly on it. The surviving intent -- no intended deficit or
 *     surplus -- is checked below.
 *
 * Two of its assertions were simply wrong and are corrected here rather than
 * carried over: female BMR for 150 lb / 65" / 25 yo is 1426 by Mifflin-St
 * Jeor, not 1384; and currentWeight 700 is inside the accepted range, so the
 * "weight too high" case never rejected anything. 800 is used instead.
 *
 * Whole-engine safety invariants (floors, macro sums, validation gates,
 * health screening) live in verify-nutrition.ts. This file covers the pieces
 * underneath it that nothing else exercises.
 */
import {
  calculateBMR,
  calculateMaintenanceCalories,
  activityMultiplier,
  nearestActivityLevel,
  maintenanceFor,
  proteinReferenceWeight,
  deriveMacros,
  calorieFloorFor,
  calculateNutritionTargets,
  clampExplanation,
  formatCalorieTarget,
  validateSetup,
  getActivityLevelLabel,
  getGoalLabel,
  type NutritionGoalSetup,
  type ClampReason,
} from '../lib/nutrition-goals.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0

const eq = (label: string, got: any, want: any) => {
  const ok = got === want
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 46), W(got, 12), ok ? '' : `expected ${want}`)
}
const near = (label: string, got: number, want: number, tol: number) => {
  const ok = Math.abs(got - want) <= tol
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 46), W(got, 12), ok ? '' : `expected ${want} +/-${tol}`)
}
const ok_ = (label: string, cond: boolean, detail: string) => {
  if (!cond) fail++
  console.log(W(cond ? '  ok' : '  FAIL', 7), W(label, 46), detail)
}

/* ---------------------------------------------------------------- *
 * BMR -- Mifflin-St Jeor
 * ---------------------------------------------------------------- */
console.log('BMR (Mifflin-St Jeor)\n')
eq('male 210lb 72in 28yo', calculateBMR(210, 72, 28, 'male'), 1961)
eq('female 150lb 65in 25yo', calculateBMR(150, 65, 25, 'female'), 1426)
eq('other 180lb 70in 30yo', calculateBMR(180, 70, 30, 'other'), 1700)

// 'other' averages the male and female constants rather than defaulting
// someone to an equation built for a body they do not have.
const bmrM = calculateBMR(180, 70, 30, 'male')
const bmrF = calculateBMR(180, 70, 30, 'female')
const bmrO = calculateBMR(180, 70, 30, 'other')
ok_('other sits between male and female', bmrO > bmrF && bmrO < bmrM, `${bmrF} < ${bmrO} < ${bmrM}`)
near('other is their midpoint', bmrO, (bmrM + bmrF) / 2, 1)

/* ---------------------------------------------------------------- *
 * Maintenance -- legacy single dropdown
 * ---------------------------------------------------------------- */
console.log('\nMAINTENANCE from activity band (BMR 2000)\n')
eq('sedentary x1.2', calculateMaintenanceCalories(2000, 'sedentary'), 2400)
eq('light x1.375', calculateMaintenanceCalories(2000, 'light'), 2750)
eq('moderate x1.55', calculateMaintenanceCalories(2000, 'moderate'), 3100)
eq('very_active x1.725', calculateMaintenanceCalories(2000, 'very_active'), 3450)
eq('extremely_active x1.9', calculateMaintenanceCalories(2000, 'extremely_active'), 3800)

/* ---------------------------------------------------------------- *
 * Maintenance -- two-factor, calibrated to land ON the old bands so
 * that adopting it does not re-baseline anyone's calories.
 * ---------------------------------------------------------------- */
console.log('\nTWO-FACTOR ACTIVITY (must not re-baseline the old bands)\n')
near('desk + 0 days == old sedentary 1.20', activityMultiplier('sedentary', 0), 1.2, 0.005)
near('desk + 4 days == old moderate 1.55', activityMultiplier('sedentary', 4), 1.55, 0.005)
near('desk + 6 days == old very_active 1.725', activityMultiplier('sedentary', 6), 1.725, 0.01)
near('physical + 7 days capped', activityMultiplier('physical', 7), 1.95, 0.001)
near('negative training days clamp to 0', activityMultiplier('sedentary', -3), 1.2, 0.005)
near('10 training days clamp to 7', activityMultiplier('sedentary', 10), activityMultiplier('sedentary', 7), 0.001)

eq('nearest band to 1.20', nearestActivityLevel(1.2), 'sedentary')
eq('nearest band to 1.30', nearestActivityLevel(1.3), 'light')
eq('nearest band to 1.55', nearestActivityLevel(1.55), 'moderate')
eq('nearest band to 1.725', nearestActivityLevel(1.725), 'very_active')
eq('nearest band to 1.95', nearestActivityLevel(1.95), 'extremely_active')

// maintenanceFor prefers the two facts the app already knows, and falls back
// to the dropdown for clients who set up before those fields existed.
const base: NutritionGoalSetup = {
  currentWeight: 180, goalWeight: 170, height: 70, age: 30,
  sex: 'male', activityLevel: 'moderate', goal: 'lose_fat',
}
eq('maintenanceFor falls back to the band', maintenanceFor(2000, base), 3100)
eq('maintenanceFor prefers job + days',
  maintenanceFor(2000, { ...base, jobActivity: 'sedentary', trainingDaysPerWeek: 4 }), 3100)
ok_('partial two-factor still falls back',
  maintenanceFor(2000, { ...base, jobActivity: 'physical' }) === 3100,
  'jobActivity without trainingDaysPerWeek -> band')

/* ---------------------------------------------------------------- *
 * Protein anchor -- the audit's central correction
 * ---------------------------------------------------------------- */
console.log('\nPROTEIN REFERENCE WEIGHT (current weight, capped)\n')
eq('165 -> 190 bulking uses current', proteinReferenceWeight(165, 190), 165)
eq('180 -> 180 maintaining uses current', proteinReferenceWeight(180, 180), 180)
eq('300 -> 180 capped at 1.25x goal', proteinReferenceWeight(300, 180), 225)
ok_('big cut is not asked to eat 300g',
  Math.round(proteinReferenceWeight(300, 180) * 0.95) < 250,
  `${Math.round(proteinReferenceWeight(300, 180) * 0.95)}g`)

// The regression the audit found: the client with the most lean mass to
// protect must not get the lowest protein per pound of actual bodyweight.
const bigCut = deriveMacros(2400, 300, 180, 'lose_fat')
const smallBulk = deriveMacros(2800, 165, 190, 'build_muscle')
ok_('heavy cutter gets >= 0.7 g/lb actual',
  bigCut.proteinGrams / 300 >= 0.7,
  `${(bigCut.proteinGrams / 300).toFixed(2)} g/lb (${bigCut.proteinGrams}g at 300lb)`)
ok_('bulker is not over-prescribed',
  smallBulk.proteinGrams / 165 < 1.1,
  `${(smallBulk.proteinGrams / 165).toFixed(2)} g/lb`)

/* ---------------------------------------------------------------- *
 * Macro derivation -- fat percentage, fat floor, carb remainder
 * ---------------------------------------------------------------- */
console.log('\nMACROS (fat 27.5% or floor, carbs take the remainder)\n')
for (const cals of [2000, 2500, 3000]) {
  const d = deriveMacros(cals, 180, 175, 'maintain')
  const pct = (d.fatGrams * 9) / cals
  near(`fat is ~27.5% of ${cals} cal`, pct * 100, 27.5, 1.5)
}
for (const [cals, w, gw] of [[2000, 180, 175], [2700, 200, 180], [3200, 210, 200]] as const) {
  const d = deriveMacros(cals, w, gw, 'lose_fat')
  const sum = d.proteinGrams * 4 + d.carbGrams * 4 + d.fatGrams * 9
  near(`macros sum to ${cals} cal`, sum, cals, 12)
  ok_(`no negative macro at ${cals} cal`,
    d.proteinGrams >= 0 && d.fatGrams >= 0 && d.carbGrams >= 0,
    `P${d.proteinGrams} F${d.fatGrams} C${d.carbGrams}`)
}

// In a clamped low-calorie case the essential-fat floor binds instead of the
// percentage, the protein cap bites, and carbohydrate is flagged as low.
const squeezed = deriveMacros(1500, 200, 180, 'lose_fat')
near('fat floor binds at 1500 cal / 200 lb', squeezed.fatGrams, 60, 1)
ok_('protein capped at 50% of calories',
  squeezed.proteinGrams * 4 <= 1500 * 0.5,
  `${squeezed.proteinGrams}g = ${squeezed.proteinGrams * 4} cal of 750`)
ok_('low carbohydrate is flagged', squeezed.lowCarb === true, `${squeezed.carbGrams}g carbs`)
ok_('comfortable calories are not flagged',
  deriveMacros(2700, 200, 180, 'lose_fat').lowCarb === false,
  `${deriveMacros(2700, 200, 180, 'lose_fat').carbGrams}g carbs`)

console.log('\nCALORIE FLOOR\n')
eq('female floor beats a low BMR', calorieFloorFor('female', 1100), 1200)
eq('a high BMR beats the floor', calorieFloorFor('female', 1400), 1400)
eq('male floor', calorieFloorFor('male', 1200), 1500)
eq('other floor sits between', calorieFloorFor('other', 1000), 1350)

/* ---------------------------------------------------------------- *
 * Direction by goal. This is what the deleted calculateDailyCalories
 * was really asserting; the magnitudes it asserted came from the flat
 * percentage model and no longer apply.
 * ---------------------------------------------------------------- */
console.log('\nDIRECTION BY GOAL\n')
const targetsFor = (over: Partial<NutritionGoalSetup>) =>
  calculateNutritionTargets({ ...base, ...over })

const cut = targetsFor({ currentWeight: 200, goalWeight: 175, goal: 'lose_fat' })
ok_('lose_fat produces a deficit', cut.calorieDeficitOrSurplus < 0,
  `${cut.calorieDeficitOrSurplus} cal, ${cut.expectedLbsPerWeek} lb/wk`)
ok_('lose_fat loses weight on paper', cut.expectedLbsPerWeek < 0, `${cut.expectedLbsPerWeek} lb/wk`)
ok_('lose_fat gives a timeline', typeof cut.weeksToGoal === 'number' && cut.weeksToGoal > 0,
  `${cut.weeksToGoal} weeks`)

const bulk = targetsFor({
  currentWeight: 165, goalWeight: 190, height: 72, age: 28,
  activityLevel: 'very_active', goal: 'build_muscle',
})
ok_('build_muscle produces a surplus', bulk.calorieDeficitOrSurplus > 0, `+${bulk.calorieDeficitOrSurplus} cal`)
ok_('surplus clears the noise floor', bulk.calorieDeficitOrSurplus >= 135,
  `+${bulk.calorieDeficitOrSurplus} cal (min surplus 150, +/-12 rounding)`)
ok_('build_muscle eats above maintenance', bulk.dailyCalories > bulk.maintenanceCalories,
  `${bulk.dailyCalories} vs ${bulk.maintenanceCalories}`)

for (const goal of ['body_recomposition', 'maintain'] as const) {
  const r = targetsFor({ currentWeight: 180, goalWeight: 180, goal })
  ok_(`${goal}: no intended deficit or surplus`,
    Math.abs(r.calorieDeficitOrSurplus) <= 13,
    `${r.calorieDeficitOrSurplus} cal (25-cal rounding only)`)
  eq(`${goal}: no timeline`, r.weeksToGoal, null)
}

/* ---------------------------------------------------------------- *
 * Edge cases carried over from the deleted suite
 * ---------------------------------------------------------------- */
console.log('\nEDGE CASES\n')
const tiny = targetsFor({
  currentWeight: 120, goalWeight: 110, height: 60, age: 25,
  sex: 'female', activityLevel: 'sedentary', goal: 'lose_fat',
})
ok_('small sedentary woman is not starved',
  tiny.dailyCalories >= 1200 && tiny.dailyCalories >= tiny.bmr,
  `${tiny.dailyCalories} cal, floor 1200, bmr ${tiny.bmr}, clamp ${tiny.clamp}`)
ok_('and the clamp is reported', tiny.clamp !== null, `clamp=${tiny.clamp}`)

const bigBulk = targetsFor({
  currentWeight: 200, goalWeight: 220, height: 76, age: 25,
  activityLevel: 'extremely_active', goal: 'build_muscle',
})
ok_('large active bulk still gets a surplus', bigBulk.calorieDeficitOrSurplus > 0,
  `+${bigBulk.calorieDeficitOrSurplus} cal`)
ok_('rate stays sane for a bulk',
  bigBulk.expectedRatePctPerWeek > 0 && bigBulk.expectedRatePctPerWeek < 0.5,
  `${bigBulk.expectedRatePctPerWeek}% bw/wk`)

/* ---------------------------------------------------------------- *
 * Validation -- required fields. The gates on age, BMI and direction
 * are covered in verify-nutrition.ts.
 * ---------------------------------------------------------------- */
console.log('\nVALIDATION (required fields)\n')
const valid: Partial<NutritionGoalSetup> = {
  currentWeight: 200, goalWeight: 180, height: 72, age: 25,
  sex: 'male', activityLevel: 'moderate', goal: 'lose_fat',
}
eq('a complete valid setup passes', validateSetup(valid).length, 0)

for (const key of ['currentWeight', 'goalWeight', 'height', 'age', 'sex', 'activityLevel', 'goal'] as const) {
  const missing = { ...valid }
  delete missing[key]
  const errs = validateSetup(missing)
  ok_(`missing ${key} is rejected`, errs.length > 0, errs[0] ?? 'ALLOWED')
}

// The old suite asserted 700 lbs was "too high"; the accepted range is
// 60-700 inclusive, so it never was. 800 is the case it meant.
const heavy = validateSetup({ ...valid, currentWeight: 800 })
ok_('800 lbs is rejected', heavy.some((e) => e.includes('current weight')), heavy[0] ?? 'ALLOWED')
ok_('700 lbs is inside the range (documents the boundary)',
  !validateSetup({ ...valid, currentWeight: 700 }).some((e) => e.includes('current weight')),
  'no weight error at the boundary')
const shortHeight = validateSetup({ ...valid, height: 20 })
ok_('an implausible height is rejected', shortHeight.length > 0, shortHeight[0] ?? 'ALLOWED')

// The old suite looked for the word "Age" in the minor rejection. The message
// is written to the client now and names what we will still do for them.
const minor = validateSetup({ ...valid, age: 8 })
ok_('a minor is rejected', minor.length > 0, minor[0]?.slice(0, 58) ?? 'ALLOWED')
ok_('and the message routes them to Anthony',
  minor.some((e) => e.toLowerCase().includes('anthony')),
  minor[0]?.slice(0, 58) ?? '-')

/* ---------------------------------------------------------------- *
 * Client-facing strings
 * ---------------------------------------------------------------- */
console.log('\nLABELS AND CLIENT-FACING COPY\n')
ok_('sedentary label', getActivityLevelLabel('sedentary').includes('Sedentary'), getActivityLevelLabel('sedentary'))
ok_('light label names its days', getActivityLevelLabel('light').includes('1-3 days'), getActivityLevelLabel('light'))
ok_('moderate label names its days', getActivityLevelLabel('moderate').includes('3-5 days'), getActivityLevelLabel('moderate'))
ok_('very_active label names its days', getActivityLevelLabel('very_active').includes('6-7 days'), getActivityLevelLabel('very_active'))
ok_('extremely_active label', getActivityLevelLabel('extremely_active').includes('twice/day'), getActivityLevelLabel('extremely_active'))

eq('lose_fat label', getGoalLabel('lose_fat'), 'Lose Fat')
eq('build_muscle label', getGoalLabel('build_muscle'), 'Build Muscle')
eq('body_recomposition label', getGoalLabel('body_recomposition'), 'Body Recomposition')
eq('maintain label', getGoalLabel('maintain'), 'Maintain Weight')

eq('format maintenance', formatCalorieTarget(2700, 2700, 0), '2700 cal (maintenance)')
eq('format surplus', formatCalorieTarget(2900, 2700, 200), '2900 cal (+200 surplus)')
eq('format deficit', formatCalorieTarget(2300, 2700, -400), '2300 cal (-400 deficit)')

// Every clamp has to be explainable to the client, and the floors are the
// ones that must say a human is reviewing it.
const clamps: ClampReason[] = ['max_deficit', 'absolute_floor', 'bmr_floor', 'max_surplus', 'low_carb']
for (const c of clamps) {
  const msg = clampExplanation(c, 'female')
  ok_(`${c} has a client explanation`, msg.length > 20, `${msg.length} chars`)
}
for (const c of ['absolute_floor', 'bmr_floor', 'low_carb'] as const) {
  ok_(`${c} names a human reviewer`,
    clampExplanation(c, 'female').includes('Anthony'),
    clampExplanation(c, 'female').slice(-38))
}
ok_('absolute_floor quotes the right number for her',
  clampExplanation('absolute_floor', 'female').includes('1200'),
  clampExplanation('absolute_floor', 'female').slice(0, 62))
ok_('absolute_floor quotes the right number for him',
  clampExplanation('absolute_floor', 'male').includes('1500'),
  clampExplanation('absolute_floor', 'male').slice(0, 62))

console.log('\n' + (fail === 0 ? 'ALL NUTRITION GOAL CHECKS PASSED' : `*** ${fail} FAILURES ***`))
