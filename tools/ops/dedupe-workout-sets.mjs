/**
 * Collapse duplicate workout_sets rows down to one per logical set.
 *
 * Cause: saveSet does a SELECT to see whether the set already exists, then
 * INSERTs if it does not, and it is called on every keystroke. Typing "50"
 * fires two saves; typing "14" reps fires two more. They race: each one's
 * SELECT runs before any of the others' INSERTs land, so all of them insert.
 * A single set becomes one row per character typed.
 *
 * Across the database that is 952 rows for 340 real sets -- 64% of the table
 * is keystroke debris, and every client's training volume reads roughly three
 * times what they actually lifted.
 *
 * The winner for each (workout, exercise, set number, intensity flag) is the
 * most complete row -- completed beats not completed, both numbers beat one --
 * with the latest logged_at breaking a tie, because the last thing a client
 * typed is what they meant. logged_at carries milliseconds and is distinct on
 * every row, so the tie-break is deterministic.
 *
 * Dry run is the default. --confirm writes. Every deleted row is copied into
 * ops_action_log first, so this is recoverable from the database alone.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

for (const l of readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(l)
  if (!m || process.env[m[1]]) continue
  let v = m[2].trim()
  if (v.length > 1 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) v = v.slice(1, -1)
  process.env[m[1]] = v
}

const confirm = process.argv.includes('--confirm')
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

const completeness = (s) =>
  (s.completed ? 4 : 0) + (s.weight !== null ? 2 : 0) + (s.reps !== null ? 1 : 0)

const all = (await c.query(`
  select s.id, s.workout_id, s.exercise_name, s.original_exercise_name, s.set_number,
         s.weight, s.reps, s.is_intensity_set, s.intensity_technique, s.completed, s.logged_at,
         u.name as client, w.date::date as d, w.day_name
  from public.workout_sets s
  join public.workouts w on w.id = s.workout_id
  join public.users u on u.id = w.user_id
  order by s.logged_at`)).rows

const bySlot = new Map()
for (const s of all) {
  const k = `${s.workout_id}|${s.exercise_name}|${s.set_number}|${s.is_intensity_set}`
  if (!bySlot.has(k)) bySlot.set(k, [])
  bySlot.get(k).push(s)
}

const doomed = []
for (const rows of bySlot.values()) {
  if (rows.length === 1) continue
  const winner = rows.reduce((a, b) => {
    if (completeness(b) > completeness(a)) return b
    if (completeness(b) === completeness(a) && b.logged_at > a.logged_at) return b
    return a
  })
  for (const r of rows) if (r.id !== winner.id) doomed.push(r)
}

// Per-client summary of what changes, including the volume correction, which
// is the number a client would actually notice.
const vol = (rows) => rows.reduce((n, s) => n + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0)
const byClient = new Map()
for (const s of all) {
  if (!byClient.has(s.client)) byClient.set(s.client, { keep: [], drop: [] })
  byClient.get(s.client)[doomed.some((d) => d.id === s.id) ? 'drop' : 'keep'].push(s)
}

const W = (s, n) => String(s ?? '').padEnd(n)
console.log(`\n${all.length} set rows, ${bySlot.size} real sets, ${doomed.length} duplicates to remove\n`)
console.log(W('CLIENT', 22), W('ROWS', 7), W('REAL', 7), W('REMOVE', 8), W('VOLUME BEFORE', 15), 'VOLUME AFTER')
console.log('-'.repeat(86))
for (const [client, { keep, drop }] of byClient) {
  if (drop.length === 0) continue
  console.log(
    W(client, 22), W(keep.length + drop.length, 7), W(keep.length, 7), W(drop.length, 8),
    W(Math.round(vol([...keep, ...drop])).toLocaleString() + ' lbs', 15),
    Math.round(vol(keep)).toLocaleString() + ' lbs'
  )
}

if (!confirm) {
  console.log('\nDRY RUN. Nothing was written. Re-run with --confirm to apply.\n')
  await c.end()
  process.exit(0)
}

try {
  await c.query('begin')
  await c.query(
    `insert into public.ops_action_log (actor, action, target, summary, detail)
     values ('claude-code', 'dedupe-workout-sets', 'all clients', $1, $2)`,
    [
      `Removed ${doomed.length} duplicate workout_sets rows (keystroke debris from a read-then-insert race in saveSet).`,
      JSON.stringify({
        reason: 'saveSet ran per keystroke with a non-atomic exists-then-insert; concurrent saves all inserted',
        rowsBefore: all.length,
        realSets: bySlot.size,
        deleted: doomed,
      }),
    ]
  )
  // Chunked: a single delete with 600+ ids is fine, but this keeps the
  // statement readable in the logs if it ever has to be audited.
  for (let i = 0; i < doomed.length; i += 200) {
    await c.query(`delete from public.workout_sets where id = any($1)`,
      [doomed.slice(i, i + 200).map((r) => r.id)])
  }
  await c.query('commit')
  console.log(`\n✓ Removed ${doomed.length} rows. Full copies are in ops_action_log under action = dedupe-workout-sets.\n`)
} catch (e) {
  await c.query('rollback')
  console.error(`\n✖ Failed, nothing changed: ${e.message}\n`)
  process.exitCode = 1
}

await c.end()
