import {
  calculateNutritionTargets, validateSetup, screenHealth, bmi,
  EMPTY_HEALTH_SCREEN, type NutritionGoalSetup, type Sex, type ActivityLevel, type FitnessGoal,
} from '../lib/nutrition-goals.ts'

const cases: Array<[string, number, number, number, number, Sex, ActivityLevel, FitnessGoal]> = [
  ["62F sed, 5'0\" 110>95 lose",110,95,60,62,'female','sedentary','lose_fat'],
  ["55F sed, 5'2\" 130>115 lose",130,115,62,55,'female','sedentary','lose_fat'],
  ["45F light, 5'4\" 160>130 lose",160,130,64,45,'female','light','lose_fat'],
  ["35F mod, 5'6\" 180>140 lose",180,140,66,35,'female','moderate','lose_fat'],
  ["30M mod, 5'10\" 200>175 lose",200,175,70,30,'male','moderate','lose_fat'],
  ["35M sed, 5'9\" 300>180 lose",300,180,69,35,'male','sedentary','lose_fat'],
  ["50F sed, 5'3\" 200>140 lose",200,140,63,50,'female','sedentary','lose_fat'],
  ["28M v.active, 6'0\" 165>190 build",165,190,72,28,'male','very_active','build_muscle'],
  ["22M extreme, 5'11\" 150>185 build",150,185,71,22,'male','extremely_active','build_muscle'],
  ["40F mod, 5'5\" 150>150 recomp",150,150,65,40,'female','moderate','body_recomposition'],
]
const W=(s:any,n:number)=>String(s).padEnd(n)
console.log(W('CASE',34),W('MAINT',6),W('CALS',6),W('P',6),W('F',5),W('C',6),W('LB/WK',7),W('CLAMP',15))
console.log('-'.repeat(100))
let bad = 0
for (const [label,w,gw,h,a,s,act,goal] of cases) {
  const setup: NutritionGoalSetup = { currentWeight:w, goalWeight:gw, height:h, age:a, sex:s, activityLevel:act, goal }
  const errs = validateSetup(setup)
  if (errs.length) { console.log(W(label,34), 'REJECTED: ' + errs[0]); continue }
  const r = calculateNutritionTargets(setup)
  const floor = s==='female'?1200:s==='male'?1500:1350
  const flags:string[] = []
  if (r.dailyCalories < floor) { flags.push('BELOW FLOOR'); bad++ }
  if (r.dailyCalories < r.bmr) { flags.push('BELOW BMR'); bad++ }
  if (r.carbGrams < 0 || r.proteinGrams < 0 || r.fatGrams < 0) { flags.push('NEGATIVE MACRO'); bad++ }
  const sum = r.proteinGrams*4 + r.carbGrams*4 + r.fatGrams*9
  if (Math.abs(sum - r.dailyCalories) > 12) { flags.push(`SUM ${sum}!=${r.dailyCalories}`); bad++ }
  const ppl = r.proteinGrams / w
  if (ppl < 0.7) { flags.push(`PROTEIN ${ppl.toFixed(2)}g/lb LOW`); bad++ }
  console.log(W(label,34),W(r.maintenanceCalories,6),W(r.dailyCalories,6),
    W(r.proteinGrams+'g('+ppl.toFixed(2)+')',6),W(r.fatGrams+'g',5),W(r.carbGrams+'g',6),
    W(r.expectedLbsPerWeek,7),W(r.clamp ?? '-',15), flags.join(' | '))
}
console.log('\n=== validation gates ===')
const gate = (label:string, s:Partial<NutritionGoalSetup>) => {
  const e = validateSetup(s); console.log(W(label,40), e.length ? 'BLOCKED: '+e[0].slice(0,60) : '*** ALLOWED ***')
}
gate('13-year-old', {currentWeight:120,goalWeight:100,height:60,age:13,sex:'female',activityLevel:'light',goal:'lose_fat'})
gate('17-year-old', {currentWeight:140,goalWeight:125,height:66,age:17,sex:'male',activityLevel:'light',goal:'lose_fat'})
gate('goal BMI 15 (5\'10" -> 105lb)', {currentWeight:160,goalWeight:105,height:70,age:30,sex:'female',activityLevel:'light',goal:'lose_fat'})
gate('already underweight, wants loss', {currentWeight:105,goalWeight:98,height:68,age:25,sex:'female',activityLevel:'light',goal:'lose_fat'})
gate('lose_fat but goal is heavier', {currentWeight:160,goalWeight:180,height:68,age:30,sex:'male',activityLevel:'light',goal:'lose_fat'})
gate('normal adult', {currentWeight:180,goalWeight:160,height:70,age:35,sex:'male',activityLevel:'moderate',goal:'lose_fat'})

console.log('\n=== health screen ===')
for (const k of ['kidneyDisease','pregnantOrBreastfeeding','eatingDisorderHistory','diabetes','weightAffectingMedication'] as const) {
  const o = screenHealth({ ...EMPTY_HEALTH_SCREEN, [k]: true })
  console.log(W(k,28), o.blocked ? 'BLOCKED' : 'allowed', '| flagCoach:', o.flagCoach, '|', (o.message ?? '').slice(0,58))
}
const clean = screenHealth(EMPTY_HEALTH_SCREEN)
console.log(W('nothing declared',28), clean.blocked ? 'BLOCKED' : 'allowed', '| flagCoach:', clean.flagCoach)
console.log(bad === 0 ? '\nALL SAFETY CHECKS PASSED' : `\n*** ${bad} FAILURES ***`)
