import { evaluateClient } from '../lib/nutrition-evaluate.ts'

/** Minimal stand-in for the Supabase admin client: enough query-builder to satisfy the gathering code. */
function stubAdmin(tables: Record<string, any[]>) {
  const q = (rows: any[]) => {
    const api: any = {
      _rows: rows,
      select() { return api },
      eq(col: string, val: any) { api._rows = api._rows.filter((r: any) => r[col] === val); return api },
      in(col: string, vals: any[]) { api._rows = api._rows.filter((r: any) => vals.includes(r[col])); return api },
      gte(col: string, v: any) { api._rows = api._rows.filter((r: any) => r[col] >= v); return api },
      order(col: string, o: any) {
        api._rows = [...api._rows].sort((a: any, b: any) =>
          o?.ascending === false ? String(b[col]).localeCompare(String(a[col])) : String(a[col]).localeCompare(String(b[col])))
        return api
      },
      limit(n: number) { api._rows = api._rows.slice(0, n); return api },
      maybeSingle() { return Promise.resolve({ data: api._rows[0] ?? null }) },
      single() { return Promise.resolve({ data: api._rows[0] ?? null }) },
      update() { return api },
      insert() { return api },
      then(res: any) { return Promise.resolve({ data: api._rows, error: null }).then(res) },
    }
    return api
  }
  return { from: (t: string) => q(tables[t] ?? []) }
}

const d = (back: number) => new Date(Date.now() - back * 86400000).toISOString().slice(0, 10)
const today = new Date()

// A client losing far too slowly: 202 lb a fortnight ago, 201.7 now, adherence 5.
const weights = [
  { user_id: 'u1', recorded_on: d(0), weight_lb: 201.7, waist_in: 36 },
  { user_id: 'u1', recorded_on: d(2), weight_lb: 201.8, waist_in: null },
  { user_id: 'u1', recorded_on: d(4), weight_lb: 201.6, waist_in: null },
  { user_id: 'u1', recorded_on: d(6), weight_lb: 201.8, waist_in: null },
  { user_id: 'u1', recorded_on: d(14), weight_lb: 202.0, waist_in: null },
  { user_id: 'u1', recorded_on: d(16), weight_lb: 202.1, waist_in: null },
  { user_id: 'u1', recorded_on: d(18), weight_lb: 201.9, waist_in: 36.2 },
]
const user = {
  id: 'u1', name: 'Slow Loser', tier: 'accelerator',
  nutrition_goal_setup_complete: true, nutrition_goal: 'lose_fat',
  current_weight: 202, goal_weight: 175, height: 70, age: 35, sex: 'male',
  activity_level: 'moderate', job_activity: 'sedentary', training_days_per_week: 4,
  health_screen: {}, nutrition_block_code: null,
  daily_cal_target: 2300, protein_target: 190, carb_target: 220, fat_target: 70,
  custom_cal_target: null, custom_protein_target: null, custom_carb_target: null, custom_fat_target: null,
}
const admin = stubAdmin({
  body_metrics: weights,
  check_ins: [{ user_id: 'u1', week_of: d(2), nutrition_adherence: 5, energy: 4, hunger: 2, sleep_quality: 4, training_performance: 4 }],
  nutrition_target_history: [{ user_id: 'u1', created_at: new Date(Date.now() - 40 * 86400000).toISOString() }],
  nutrition_adjustments: [],
  users: [user],
})

const out = await evaluateClient(admin as any, user, { dryRun: true, today })
const e = out.result.evidence
console.log('GATHERING\n')
console.log('  recent 7d average :', e.currentAvgWeight, '(expect ~201.72 from 4 weigh-ins)')
console.log('  prior window avg  :', e.priorAvgWeight, '(expect ~202.0 from 3 weigh-ins)')
console.log('  weigh-ins counted :', e.weighInsInWindow, '(expect 4)')
console.log('  actual rate       :', e.actualRatePct, '%/wk')
console.log('  target rate       :', e.targetRatePct, '%/wk')
console.log('  adherence         :', e.adherence, ' hunger:', e.hunger)
console.log('\nDECISION\n')
console.log('  verdict       :', out.result.verdict)
console.log('  calories      :', e.currentCalories, '->', out.result.newCalories)
console.log('  needs approval:', out.result.requiresApproval, '(accelerator, so should be true)')
console.log('  client reads  :', out.result.reason)

const ok =
  out.result.verdict === 'decrease' &&
  out.result.newCalories !== null && out.result.newCalories < 2300 &&
  out.result.requiresApproval === true &&
  e.weighInsInWindow === 4
console.log('\n' + (ok ? 'END-TO-END GATHERING PASSED' : '*** FAILED ***'))
