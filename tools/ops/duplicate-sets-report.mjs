/**
 * Read-only: how many workout_sets rows exist beyond one per logical set.
 *
 * saveSet does a read-then-insert and is called on every keystroke, so
 * concurrent saves for the same slot all find nothing and all insert. A single
 * set can end up as half a dozen rows: one per character typed.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'
for (const l of readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(l); if (!m || process.env[m[1]]) continue
  let v = m[2].trim(); if (v.length>1 && ((v[0]==='"'&&v.endsWith('"'))||(v[0]==="'"&&v.endsWith("'")))) v=v.slice(1,-1)
  process.env[m[1]] = v
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl:{rejectUnauthorized:false} }); await c.connect()
const r = await c.query(`
  with slots as (
    select workout_id, exercise_name, set_number, is_intensity_set, count(*)::int n
    from public.workout_sets
    group by workout_id, exercise_name, set_number, is_intensity_set
  )
  select u.name, w.date::date d, w.day_name,
         sum(s.n)::int rows, count(*)::int slots, (sum(s.n) - count(*))::int extra
  from slots s
  join public.workouts w on w.id = s.workout_id
  join public.users u on u.id = w.user_id
  group by u.name, w.date, w.day_name, w.id
  having sum(s.n) > count(*)
  order by (sum(s.n) - count(*)) desc`)
console.table(r.rows.map(x => ({ client: x.name, date: new Date(x.d).toISOString().slice(0,10),
  day: x.day_name.slice(0,26), rows: x.rows, real_sets: x.slots, duplicates: x.extra })))
const t = await c.query(`
  with slots as (
    select workout_id, exercise_name, set_number, is_intensity_set, count(*)::int n
    from public.workout_sets group by 1,2,3,4)
  select sum(n)::int rows, count(*)::int slots from slots`)
console.log(`\nAcross all workouts: ${t.rows[0].rows} set rows for ${t.rows[0].slots} real sets` +
  `  ->  ${t.rows[0].rows - t.rows[0].slots} duplicate rows (${Math.round((t.rows[0].rows - t.rows[0].slots)/t.rows[0].rows*100)}%)`)
console.log('\nNothing was written.')
await c.end()
