/**
 * Read-only: run the adjustment engine against every real client and print
 * what it WOULD decide. Writes nothing.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const l of readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(l)
  if (!m || process.env[m[1]]) continue
  let v = m[2].trim()
  if (v.length > 1 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) v = v.slice(1, -1)
  process.env[m[1]] = v
}

const { evaluateClient, resolveTiers } = await import('../../lib/nutrition-evaluate.ts')

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data: users, error } = await admin
  .from('users')
  .select('id, name, email, nutrition_goal_setup_complete, nutrition_goal, current_weight, goal_weight, height, age, sex, activity_level, job_activity, training_days_per_week, health_screen, nutrition_block_code, daily_cal_target, protein_target, carb_target, fat_target, custom_cal_target, custom_protein_target, custom_carb_target, custom_fat_target')
  .eq('nutrition_goal_setup_complete', true)

if (error) { console.error(error); process.exit(1) }

const tiers = await resolveTiers(admin, users.map(u => u.id))

const W = (s, n) => String(s ?? '').padEnd(n)
console.log(`\n${users.length} clients\n`)
console.log(W('CLIENT', 20), W('VERDICT', 18), W('CAL', 14), W('ESCALATION', 26), 'WHY')
console.log('-'.repeat(120))
for (const u of users) {
  const out = await evaluateClient(admin, { ...u, tier: tiers.get(u.id) ?? null }, { dryRun: true })
  if (out.skipped) { console.log(W(out.name, 20), W('skipped', 18), W('', 14), W('', 26), out.skipped); continue }
  const r = out.result
  console.log(
    W(out.name, 20), W(r.verdict, 18),
    W(r.newCalories ? `${r.evidence.currentCalories} -> ${r.newCalories}` : '-', 14),
    W(r.escalation ?? '-', 26),
    r.coachNote.slice(0, 60)
  )
}
console.log('\nNothing was written.\n')
