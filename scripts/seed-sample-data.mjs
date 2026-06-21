/**
 * Seed (or clean) sample training + nutrition data for the test client, so the
 * real studio pages can be verified with realistic data.
 *
 *   node scripts/seed-sample-data.mjs          # seed
 *   node scripts/seed-sample-data.mjs clean     # remove ALL training/nutrition data for the test client
 *
 * Test client email is below. Reads service-role key from .env.local.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const EMAIL = 'shanmarric@gmail.com'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const CLEAN = process.argv[2] === 'clean'

const ymd = (d) => d.toISOString().slice(0, 10)
const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

const { data: user } = await sb.from('users').select('id').eq('email', EMAIL).single()
if (!user) {
  console.error(`No user for ${EMAIL}`)
  process.exit(1)
}
const uid = user.id

// ---- clean: remove all training/nutrition rows for the test client ----
async function clean() {
  for (const t of ['workout_sets', 'exercise_prs', 'exercise_swaps', 'workouts', 'food_logs', 'daily_logs', 'messages', 'scheduled_sessions', 'program_assignments']) {
    const { error } = await sb.from(t).delete().eq('user_id', uid)
    console.log(`cleared ${t}${error ? ' ERROR ' + error.message : ''}`)
  }
}

if (CLEAN) {
  await clean()
  console.log('sample data removed.')
  process.exit(0)
}

// ---- seed ----
await clean() // start fresh

// targets
await sb.from('users').update({
  daily_cal_target: 2200, protein_target: 180, carb_target: 220, fat_target: 70,
}).eq('id', uid)

// food logs across the last 7 days (3 meals/day, ~2050-2250 kcal)
const meals = [
  { food_name: 'Oats, eggs & berries', calories: 520, protein: 32, carbs: 60, fats: 16 },
  { food_name: 'Chicken, rice & veg', calories: 720, protein: 62, carbs: 78, fats: 16 },
  { food_name: 'Salmon, potatoes & greens', calories: 810, protein: 70, carbs: 64, fats: 28 },
]
const foodRows = []
for (let i = 6; i >= 0; i--) {
  const date = ymd(daysAgo(i))
  for (const m of meals) {
    foodRows.push({ user_id: uid, date, meal_id: null, source: 'seed', ...m })
  }
}
await sb.from('food_logs').insert(foodRows)
console.log(`seeded ${foodRows.length} food logs`)

// today's water
await sb.from('daily_logs').upsert(
  { user_id: uid, date: ymd(new Date()), water_oz: 72, notes: '[seed]' },
  { onConflict: 'user_id,date' }
)

// workouts this week (3 sessions)
const sessions = [
  { offset: 4, day_name: 'Push Day' },
  { offset: 2, day_name: 'Pull Day' },
  { offset: 0, day_name: 'Leg Day' },
]
for (const s of sessions) {
  const start = daysAgo(s.offset)
  const { data: w } = await sb
    .from('workouts')
    .insert({
      user_id: uid,
      date: ymd(start),
      day_name: s.day_name,
      program_name: 'Phase 1 — Foundation',
      started_at: start.toISOString(),
      ended_at: new Date(start.getTime() + 55 * 60000).toISOString(),
      duration_seconds: 55 * 60,
      notes: '[seed]',
    })
    .select('id')
    .single()
  const wid = w.id
  const exs = [
    { exercise_name: 'Bench Press', sets: [[135, 10], [155, 8], [175, 6]] },
    { exercise_name: 'Incline DB Press', sets: [[60, 12], [65, 10]] },
  ]
  let setRows = []
  for (const ex of exs) {
    ex.sets.forEach(([weight, reps], idx) => {
      setRows.push({
        workout_id: wid, user_id: uid, exercise_name: ex.exercise_name,
        set_number: idx + 1, weight, reps, completed: true,
      })
    })
  }
  await sb.from('workout_sets').insert(setRows)
}
console.log(`seeded ${sessions.length} workouts with sets`)

// PRs
await sb.from('exercise_prs').insert([
  { user_id: uid, exercise_name: 'Bench Press', weight: 175, reps: 6, previous_weight: 165, set_at: daysAgo(0).toISOString() },
  { user_id: uid, exercise_name: 'Back Squat', weight: 245, reps: 5, previous_weight: 225, set_at: daysAgo(2).toISOString() },
  { user_id: uid, exercise_name: 'Deadlift', weight: 315, reps: 3, previous_weight: 295, set_at: daysAgo(5).toISOString() },
])
console.log('seeded 3 PRs')
console.log('sample data ready.')
process.exit(0)
