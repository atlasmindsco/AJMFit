import { activityMultiplier, calculateBMR, calculateNutritionTargets, type NutritionGoalSetup } from '../lib/nutrition-goals.ts'

const OLD: Record<string, number> = { sedentary:1.2, light:1.375, moderate:1.55, very_active:1.725, extremely_active:1.9 }
const W=(s:any,n:number)=>String(s).padEnd(n)
console.log('Two-factor multiplier vs the old dropdown band a client would have picked\n')
console.log(W('JOB',14), W('DAYS',6), W('NEW MULT',10), W('OLD BAND',18), W('OLD MULT',10), 'DRIFT')
console.log('-'.repeat(74))
const rows: Array<[any, number, string]> = [
  ['sedentary',0,'sedentary'], ['sedentary',3,'moderate'], ['sedentary',4,'moderate'],
  ['sedentary',5,'moderate'], ['sedentary',6,'very_active'],
  ['on-my-feet',3,'moderate'], ['on-my-feet',4,'very_active'], ['on-my-feet',6,'very_active'],
  ['physical',3,'very_active'], ['physical',5,'extremely_active'], ['physical',6,'extremely_active'],
]
let worst = 0
for (const [job, days, band] of rows) {
  const m = activityMultiplier(job, days)
  const o = OLD[band]
  const drift = ((m - o) / o) * 100
  if (Math.abs(drift) > Math.abs(worst)) worst = drift
  console.log(W(job,14), W(days,6), W(m.toFixed(3),10), W(band,18), W(o.toFixed(3),10), `${drift>=0?'+':''}${drift.toFixed(1)}%`)
}
console.log(`\nworst drift: ${worst.toFixed(1)}%`)

console.log('\nSame client, old path vs new path (200lb male, 5\'10", 35, desk job, trains 4x):')
const base: NutritionGoalSetup = { currentWeight:200, goalWeight:175, height:70, age:35, sex:'male', activityLevel:'moderate', goal:'lose_fat' }
const oldR = calculateNutritionTargets(base)
const newR = calculateNutritionTargets({ ...base, jobActivity:'sedentary', trainingDaysPerWeek:4 })
console.log(`  dropdown path : maintenance ${oldR.maintenanceCalories}, target ${oldR.dailyCalories}, protein ${oldR.proteinGrams}g`)
console.log(`  two-factor    : maintenance ${newR.maintenanceCalories}, target ${newR.dailyCalories}, protein ${newR.proteinGrams}g`)
console.log(`  BMR ${calculateBMR(200,70,35,'male')}`)

console.log('\nFallback still works when the new fields are absent:')
console.log('  ', calculateNutritionTargets(base).dailyCalories === oldR.dailyCalories ? 'yes' : 'NO')
