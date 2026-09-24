/**
 * Recalculate every existing client's nutrition targets with the corrected
 * engine, and record why in nutrition_target_history.
 *
 * Run at Anthony's instruction after the September 2026 nutrition audit. The
 * engine changed in two ways that move real numbers: protein now anchors to
 * current weight rather than goal weight, and calorie targets are rate-based
 * with floors instead of a flat percentage of maintenance.
 *
 * Dry run is the default. --confirm writes.
 *
 * Clients whose stored setup no longer validates are skipped and listed, not
 * guessed at. A client with a coach override in force has their calculated
 * columns updated but keeps eating to Anthony's numbers, and the history row
 * says so.
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

const confirm = process.argv.includes('--confirm')
const { calculateNutritionTargets, validateSetup } = await import('../../lib/nutrition-goals.ts')

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const { rows } = await client.query(`
  select id, name, current_weight, goal_weight, height, age, sex, activity_level, nutrition_goal,
         daily_cal_target, protein_target, carb_target, fat_target,
         custom_cal_target, custom_protein_target, custom_carb_target, custom_fat_target
  from public.users
  where nutrition_goal_setup_complete = true
  order by name`)

const REASON =
  'Your targets were recalculated after a review of how they are worked out. ' +
  'Protein now scales from your current weight instead of your goal weight, and ' +
  'calorie targets now have safety floors they will not go below. Anthony approved this change.'

const W = (s, n) => String(s ?? '').padEnd(n)
const plan = []
const skipped = []

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
    skipped.push({ name: r.name, why: errs[0] })
    continue
  }
  const next = calculateNutritionTargets(setup)
  const overridden =
    r.custom_cal_target !== null || r.custom_protein_target !== null ||
    r.custom_carb_target !== null || r.custom_fat_target !== null
  plan.push({ row: r, next, overridden })
}

console.log(`\n${rows.length} clients with setup complete. ${plan.length} to update, ${skipped.length} skipped.\n`)
console.log(W('CLIENT', 20), W('CAL', 14), W('PROTEIN', 14), W('CARB', 12), W('FAT', 11), 'CLAMP')
console.log('-'.repeat(92))
for (const { row: r, next, overridden } of plan) {
  console.log(
    W(r.name, 20),
    W(`${Math.round(r.daily_cal_target)} -> ${next.dailyCalories}`, 14),
    W(`${Math.round(r.protein_target)}g -> ${next.proteinGrams}g`, 14),
    W(`${Math.round(r.carb_target)}g -> ${next.carbGrams}g`, 12),
    W(`${Math.round(r.fat_target)}g -> ${next.fatGrams}g`, 11),
    next.clamp ?? '-',
    overridden ? ' [COACH OVERRIDE IN FORCE — client keeps Anthony\'s numbers]' : ''
  )
}
if (skipped.length) {
  console.log('\nSkipped:')
  for (const s of skipped) console.log(`  ${s.name}: ${s.why}`)
}

if (!confirm) {
  console.log('\nDRY RUN. Nothing was written. Re-run with --confirm to apply.\n')
  await client.end()
  process.exit(0)
}

let updated = 0
for (const { row: r, next, overridden } of plan) {
  try {
    await client.query('begin')
    await client.query(
      `update public.users
         set daily_cal_target = $2, protein_target = $3, carb_target = $4, fat_target = $5,
             updated_at = now()
       where id = $1`,
      [r.id, next.dailyCalories, next.proteinGrams, next.carbGrams, next.fatGrams]
    )
    await client.query(
      `insert into public.nutrition_target_history
         (user_id, cal_target, protein_target, carb_target, fat_target, source, reason, clamp, evidence)
       values ($1,$2,$3,$4,$5,'coach',$6,$7,$8)`,
      [
        r.id, next.dailyCalories, next.proteinGrams, next.carbGrams, next.fatGrams,
        REASON, next.clamp,
        JSON.stringify({
          migration: 'nutrition-audit-2026-09',
          previous: {
            calories: Number(r.daily_cal_target),
            protein: Number(r.protein_target),
            carbs: Number(r.carb_target),
            fats: Number(r.fat_target),
          },
          bmr: next.bmr,
          maintenance: next.maintenanceCalories,
          expectedLbsPerWeek: next.expectedLbsPerWeek,
          supersededByCoachOverride: overridden,
        }),
      ]
    )
    await client.query('commit')
    updated++
  } catch (e) {
    await client.query('rollback')
    console.error(`  ✖ ${r.name}: ${e.message}`)
  }
}

console.log(`\n✓ Updated ${updated} of ${plan.length}. Each has a history row explaining the change.\n`)
await client.end()
