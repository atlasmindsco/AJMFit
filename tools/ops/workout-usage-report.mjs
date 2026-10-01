/**
 * Read-only: how clients actually use the workout logger.
 *
 * The execution audit is about friction, and friction leaves fingerprints in
 * the data — sessions abandoned part-way, sets logged without a rep count,
 * exercises in the program that nobody ever logs, the RIR chip nobody taps.
 * This reads; it never writes.
 */
import { supa } from './_lib.mjs'

const db = supa()
const pct = (n, d) => (d === 0 ? '  -  ' : `${String(Math.round((n / d) * 100)).padStart(3)}%`)

const { data: workouts } = await db
  .from('workouts')
  .select('id,user_id,day_name,program_name,started_at,ended_at,duration_seconds')
  .order('started_at', { ascending: false })
  .limit(500)

const { data: sets } = await db
  .from('workout_sets')
  .select('workout_id,exercise_name,set_number,weight,reps,completed,rir,is_intensity_set,duration_seconds,logged_at')

const { data: profiles } = await db.from('profiles').select('id,full_name')
const nameOf = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name || p.id.slice(0, 8)]))

const byWorkout = new Map()
for (const s of sets ?? []) {
  if (!byWorkout.has(s.workout_id)) byWorkout.set(s.workout_id, [])
  byWorkout.get(s.workout_id).push(s)
}

console.log('\n════ SESSIONS ════\n')
const total = (workouts ?? []).length
const ended = (workouts ?? []).filter((w) => w.ended_at).length
const timed = (workouts ?? []).filter((w) => w.duration_seconds != null).length
const empty = (workouts ?? []).filter((w) => (byWorkout.get(w.id) ?? []).length === 0).length
console.log(`  total sessions            ${total}`)
console.log(`  ended                     ${ended}  ${pct(ended, total)}`)
console.log(`  have a real duration      ${timed}  ${pct(timed, total)}`)
console.log(`  ZERO sets logged          ${empty}  ${pct(empty, total)}   <- opened, logged nothing`)

const durs = (workouts ?? []).filter((w) => w.duration_seconds > 0).map((w) => w.duration_seconds / 60).sort((a, b) => a - b)
if (durs.length) {
  const med = durs[Math.floor(durs.length / 2)]
  console.log(`  median duration           ${Math.round(med)} min  (range ${Math.round(durs[0])}-${Math.round(durs[durs.length - 1])})`)
  console.log(`  under 10 min              ${durs.filter((d) => d < 10).length}`)
  console.log(`  over 150 min              ${durs.filter((d) => d > 150).length}   <- forgot to press End`)
}

console.log('\n════ SET QUALITY ════\n')
const working = (sets ?? []).filter((s) => !s.is_intensity_set)
const bothFilled = working.filter((s) => s.weight != null && s.reps != null).length
const weightOnly = working.filter((s) => s.weight != null && s.reps == null).length
const repsOnly = working.filter((s) => s.weight == null && s.reps != null).length
const neither = working.filter((s) => s.weight == null && s.reps == null && s.duration_seconds == null).length
const withRir = working.filter((s) => s.rir != null).length
console.log(`  working sets              ${working.length}`)
console.log(`  weight + reps             ${bothFilled}  ${pct(bothFilled, working.length)}`)
console.log(`  weight only (half-done)   ${weightOnly}  ${pct(weightOnly, working.length)}   <- abandoned mid-entry`)
console.log(`  reps only                 ${repsOnly}  ${pct(repsOnly, working.length)}`)
console.log(`  completely blank          ${neither}  ${pct(neither, working.length)}`)
console.log(`  RIR recorded              ${withRir}  ${pct(withRir, working.length)}`)
console.log(`  intensity sets ever used  ${(sets ?? []).filter((s) => s.is_intensity_set).length}`)
console.log(`  timed/cardio sets         ${(sets ?? []).filter((s) => s.duration_seconds != null).length}`)

console.log('\n════ DID THEY FINISH THE SESSION? ════\n')
// A session where the last exercise logged is not the last in the workout is
// a session someone walked away from.
let fullyLogged = 0
const partials = []
for (const w of workouts ?? []) {
  const rows = (byWorkout.get(w.id) ?? []).filter((s) => !s.is_intensity_set)
  if (rows.length === 0) continue
  const done = rows.filter((s) => s.weight != null && s.reps != null).length
  const ratio = done / rows.length
  if (ratio === 1) fullyLogged++
  else partials.push({ w, done, of: rows.length, ratio })
}
console.log(`  every started set finished ${fullyLogged}`)
console.log(`  partially filled           ${partials.length}`)
for (const p of partials.slice(0, 10)) {
  console.log(`    ${(nameOf[p.w.user_id] ?? '?').padEnd(18)} ${String(p.w.day_name ?? '').slice(0, 22).padEnd(24)} ${p.done}/${p.of} sets  ${p.w.started_at.slice(0, 10)}`)
}

console.log('\n════ SETS PER SESSION ════\n')
const counts = (workouts ?? []).map((w) => (byWorkout.get(w.id) ?? []).filter((s) => s.weight != null && s.reps != null).length).filter((n) => n > 0).sort((a, b) => a - b)
if (counts.length) {
  console.log(`  median sets logged        ${counts[Math.floor(counts.length / 2)]}`)
  console.log(`  sessions with 1-3 sets    ${counts.filter((n) => n <= 3).length}   <- logged the first exercise and stopped`)
}

console.log('\n════ TIME BETWEEN SETS (what rest really looks like) ════\n')
// logged_at gaps inside one exercise, as a proxy for real rest taken.
const gaps = []
for (const [, rows] of byWorkout) {
  const byEx = {}
  for (const s of rows) {
    if (s.weight == null || s.reps == null) continue
    ;(byEx[s.exercise_name] ??= []).push(s)
  }
  for (const list of Object.values(byEx)) {
    list.sort((a, b) => a.set_number - b.set_number)
    for (let i = 1; i < list.length; i++) {
      const g = (Date.parse(list[i].logged_at) - Date.parse(list[i - 1].logged_at)) / 1000
      if (g > 0 && g < 1800) gaps.push(g)
    }
  }
}
gaps.sort((a, b) => a - b)
if (gaps.length) {
  console.log(`  samples                   ${gaps.length}`)
  console.log(`  median gap                ${Math.round(gaps[Math.floor(gaps.length / 2)])}s`)
  console.log(`  under 20s                 ${gaps.filter((g) => g < 20).length}  ${pct(gaps.filter((g) => g < 20).length, gaps.length)}   <- entered after the fact, not live`)
  console.log(`  over 5 min                ${gaps.filter((g) => g > 300).length}`)
} else {
  console.log('  no multi-set data')
}

console.log('\n════ SWAPS ════\n')
const { data: swaps } = await db.from('exercise_swaps').select('user_id,original_exercise_name,swapped_exercise_name')
console.log(`  swaps saved               ${(swaps ?? []).length}`)
for (const s of (swaps ?? []).slice(0, 10)) {
  console.log(`    ${(nameOf[s.user_id] ?? '?').padEnd(18)} ${s.original_exercise_name} -> ${s.swapped_exercise_name}`)
}

console.log('\n════ PER CLIENT ════\n')
const byUser = {}
for (const w of workouts ?? []) {
  const u = (byUser[w.user_id] ??= { sessions: 0, sets: 0, lastAt: '' })
  u.sessions++
  u.sets += (byWorkout.get(w.id) ?? []).filter((s) => s.weight != null && s.reps != null).length
  if (w.started_at > u.lastAt) u.lastAt = w.started_at
}
for (const [uid, u] of Object.entries(byUser).sort((a, b) => b[1].sessions - a[1].sessions)) {
  console.log(`  ${(nameOf[uid] ?? uid.slice(0, 8)).padEnd(20)} ${String(u.sessions).padStart(3)} sessions  ${String(u.sets).padStart(4)} sets  last ${u.lastAt.slice(0, 10)}`)
}
console.log()
