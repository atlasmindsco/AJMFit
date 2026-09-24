/**
 * Read-only: compare every existing client's stored nutrition targets against
 * what the corrected engine would produce now.
 *
 * Nothing is written. This exists so Anthony can see, before any client does,
 * whose numbers move and by how much — particularly anyone whose stored target
 * sits below a floor the new engine would have refused to go under.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

function loadLocalEnv() {
  let raw
  try {
    raw = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
  } catch {
    return
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!m || process.env[m[1]] !== undefined) continue
    let v = m[2].trim()
    if (v.length > 1 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
}
loadLocalEnv()

const { calculateNutritionTargets, validateSetup } = await import('../../lib/nutrition-goals.ts')

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const { rows } = await client.query(`
  select name, current_weight, goal_weight, height, age, sex, activity_level, nutrition_goal,
         daily_cal_target, protein_target, custom_cal_target
  from public.users
  where nutrition_goal_setup_complete = true
  order by name`)

const W = (s, n) => String(s ?? '').padEnd(n)
console.log(`\n${rows.length} clients with nutrition setup complete\n`)
console.log(W('CLIENT', 18), W('OLD CAL', 8), W('NEW CAL', 8), W('OLD P', 7), W('NEW P', 7), W('CLAMP', 16), 'NOTE')
console.log('-'.repeat(100))

let moved = 0
let clamped = 0
for (const r of rows) {
  const setup = {
    currentWeight: Number(r.current_weight),
    goalWeight: Number(r.goal_weight),
    height: Number(r.height),
    age: Number(r.age),
    sex: r.sex,
    activityLevel: r.activity_level,
    goal: r.nutrition_goal,
  }
  const errs = validateSetup(setup)
  if (errs.length) {
    console.log(W(r.name, 18), W(r.daily_cal_target, 8), 'would now be REJECTED:', errs[0].slice(0, 50))
    continue
  }
  const next = calculateNutritionTargets(setup)
  const oldCal = Number(r.daily_cal_target)
  const oldP = Number(r.protein_target)
  const notes = []
  if (r.custom_cal_target !== null) notes.push('coach override in force')
  const floor = r.sex === 'female' ? 1200 : r.sex === 'male' ? 1500 : 1350
  if (oldCal < floor) notes.push(`OLD TARGET WAS BELOW ${floor} FLOOR`)
  if (next.clamp) clamped++
  if (Math.abs(next.dailyCalories - oldCal) > 25 || Math.abs(next.proteinGrams - oldP) > 5) moved++

  console.log(
    W(r.name, 18), W(oldCal, 8), W(next.dailyCalories, 8),
    W(oldP + 'g', 7), W(next.proteinGrams + 'g', 7),
    W(next.clamp ?? '-', 16), notes.join(' | ')
  )
}

console.log(`\n${moved} of ${rows.length} would see a meaningful change. ${clamped} hit a guardrail.`)
console.log('Nothing was written.\n')
await client.end()
