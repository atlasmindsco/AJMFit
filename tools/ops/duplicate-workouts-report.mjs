/**
 * Read-only: find sessions that were split into multiple workout rows, and
 * measure how much set data is duplicated between them.
 *
 * The split was caused by startWorkout always inserting instead of resuming an
 * open session (fixed 24 Sep 2026). This report exists to size the historical
 * damage, which the fix does not undo.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'
for (const l of readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(l); if (!m || process.env[m[1]]) continue
  let v = m[2].trim(); if (v.length>1 && ((v[0]==='"'&&v.endsWith('"'))||(v[0]==="'"&&v.endsWith("'")))) v=v.slice(1,-1)
  process.env[m[1]] = v
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl:{rejectUnauthorized:false} }); await c.connect()

const groups = await c.query(`
  select u.name, w.date::date as d, w.day_name, count(*)::int n
  from public.workouts w join public.users u on u.id = w.user_id
  group by u.name, w.date, w.day_name having count(*) > 1
  order by w.date desc`)

let totalDup = 0, totalRows = 0
for (const g of groups.rows) {
  const ws = await c.query(`
    select w.id, w.started_at, w.ended_at, w.duration_seconds
    from public.workouts w join public.users u on u.id = w.user_id
    where u.name = $1 and w.date::date = $2 and w.day_name = $3
    order by w.started_at`, [g.name, g.d, g.day_name])

  console.log(`\n${g.name} — ${new Date(g.d).toISOString().slice(0,10)} — ${g.day_name}  (${g.n} workout rows)`)
  const seen = new Map()
  let dupHere = 0, rowsHere = 0
  for (const [i, w] of ws.rows.entries()) {
    const sets = (await c.query(
      `select exercise_name, set_number, weight, reps, is_intensity_set
       from public.workout_sets where workout_id=$1`, [w.id])).rows
    let dup = 0
    for (const s of sets) {
      const k = `${s.exercise_name}|${s.set_number}|${s.is_intensity_set}|${s.weight}|${s.reps}`
      if (seen.has(k)) dup++; else seen.set(k, w.id)
    }
    dupHere += dup; rowsHere += sets.length
    const mins = w.duration_seconds ? Math.round(w.duration_seconds/60) : null
    console.log(`   #${i+1}  ${new Date(w.started_at).toISOString().slice(11,16)}` +
      `  ${w.ended_at ? String(mins).padStart(3)+' min' : ' OPEN  '}` +
      `  ${String(sets.length).padStart(3)} sets` +
      `  ${dup ? `${dup} duplicate` : 'no duplicates'}`)
  }
  totalDup += dupHere; totalRows += rowsHere
  console.log(`   -> ${rowsHere} set rows, ${dupHere} of them duplicates`)
}
console.log(`\n${'='.repeat(64)}`)
console.log(`${groups.rows.length} split sessions across ${new Set(groups.rows.map(r=>r.name)).size} clients`)
console.log(`${totalRows} set rows involved, ${totalDup} are duplicates`)
console.log('\nNothing was written.')
await c.end()
