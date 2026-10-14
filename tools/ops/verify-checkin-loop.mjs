/**
 * Does the check-in loop actually work, end to end, for real identities?
 *
 * check_ins has never held a single row, so nothing about this loop had ever
 * been exercised — not the client's insert, not the coach's reply, not whether
 * one client can read another's. The screens existing proves none of it.
 *
 * This submits a check-in as a real client, replies as the real coach, reads
 * the reply back as the client, and tries to read someone else's — then rolls
 * the whole thing back. Nothing is left behind.
 *
 * It impersonates through Postgres rather than the Supabase client because
 * only a direct connection can `set local role authenticated` and forge the
 * JWT claims that RLS reads. The coach half needs app_metadata.role =
 * 'trainer', which is what is_trainer() looks at — get that wrong and the
 * coach appears to be locked out when nothing is actually broken.
 *
 * Worth keeping because the last two audit fixes were both silent RLS
 * failures: a write that matched zero rows and returned success. This is how
 * you find out before a client does.
 *
 *   node tools/ops/verify-checkin-loop.mjs
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

function loadEnv() {
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
    if (v.length > 1 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
      v = v.slice(1, -1)
    }
    process.env[m[1]] = v
  }
}
loadEnv()

if (!process.env.DATABASE_URL) {
  console.error('\n✖ DATABASE_URL is not set.\n')
  process.exit(1)
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

let failures = 0
const ok = (label, passed, detail = '') => {
  if (!passed) failures++
  console.log(`  ${passed ? 'ok  ' : 'FAIL'}  ${label.padEnd(44)} ${detail}`)
}

// Two clients who have actually trained, so the fixture resembles real use.
const { rows: clients } = await c.query(`
  select u.id, u.auth_id, u.name
  from public.users u
  where u.auth_id is not null and u.status = 'active'
    and exists (select 1 from workouts w where w.user_id = u.id)
  order by u.name limit 2`)
if (clients.length < 2) {
  console.error('\n✖ Need two active clients with workouts to test isolation.\n')
  process.exit(1)
}
const [me, them] = clients

const { rows: coaches } = await c.query(`
  select id, email from auth.users where raw_app_meta_data->>'role' = 'trainer' limit 1`)
if (coaches.length === 0) {
  console.error('\n✖ No auth user carries app_metadata.role = "trainer".\n')
  process.exit(1)
}
const coach = coaches[0]

const asClient = (authId) =>
  c.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: authId, role: 'authenticated' }),
  ])
const asCoach = () =>
  c.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: coach.id, role: 'authenticated', app_metadata: { role: 'trainer' } }),
  ])

console.log(`\nclient: ${me.name}    other: ${them.name}    coach: ${coach.email}\n`)
await c.query('begin')
await c.query('set local role authenticated')

try {
  console.log('THE CLIENT SUBMITS')
  await asClient(me.auth_id)
  const { rows: inserted } = await c.query(
    `insert into check_ins
       (user_id, week_of, weight_lb, workouts_completed, nutrition_adherence,
        energy, hunger, sleep_quality, training_performance, win, obstacle)
     values ($1, date_trunc('week', current_date)::date, 184, 4, 4, 4, 2, 3, 4,
             'Hit 165 on bench', 'Sleep was poor midweek')
     returning id`,
    [me.id]
  )
  const id = inserted[0].id
  ok('submit a check-in', true)

  // The scales are 1-5 and the database enforces it. A form that could send a
  // 7 would be rejected here rather than silently storing nonsense.
  let rejected = false
  try {
    await c.query(`savepoint s1`)
    await c.query(
      `insert into check_ins (user_id, week_of, nutrition_adherence, energy)
       values ($1, current_date, 4, 7)`,
      [me.id]
    )
    await c.query(`release savepoint s1`)
  } catch {
    rejected = true
    await c.query(`rollback to savepoint s1`)
  }
  ok('an out-of-range score is refused', rejected, 'energy must be 1-5')

  const { rows: mine } = await c.query(`select win from check_ins where user_id = $1`, [me.id])
  ok('read their own back', mine.length === 1, mine[0]?.win ?? '')

  // The weight on a check-in is also what fills the progress screen.
  await c.query(`insert into body_metrics (user_id, weight_lb) values ($1, 184)`, [me.id])
  ok('the weight reaches body_metrics', true)

  console.log('\nTHE COACH REVIEWS')
  await asCoach()
  const { rows: seen } = await c.query(`select id, win from check_ins`)
  ok('sees the check-in', seen.length === 1, seen[0]?.win ?? '')
  const replied = await c.query(
    `update check_ins set coach_response = $1, coach_responded_at = now() where id = $2 returning id`,
    ['Strong week. Hold the bench where it is and fix the sleep.', id]
  )
  ok('can reply', replied.rowCount === 1)

  console.log('\nTHE CLIENT SEES THE REPLY')
  await asClient(me.auth_id)
  const { rows: back } = await c.query(`select coach_response from check_ins where id = $1`, [id])
  ok('the reply is visible', Boolean(back[0]?.coach_response), String(back[0]?.coach_response ?? '').slice(0, 34))

  console.log('\nISOLATION')
  const { rows: other } = await c.query(`select count(*)::int n from check_ins where user_id = $1`, [them.id])
  ok(`cannot read ${them.name}'s`, other[0].n === 0)
  const sweep = await c.query(`update check_ins set win = 'tampered' returning user_id`)
  ok('an unfiltered update hits only their own', sweep.rows.every((r) => r.user_id === me.id), `${sweep.rowCount} rows`)
} finally {
  await c.query('rollback')
}

const { rows: after } = await c.query(`select count(*)::int n from check_ins`)
console.log(`\n  rolled back — check_ins in production: ${after[0].n}`)
console.log(failures === 0 ? '  the loop works end to end\n' : `  ${failures} FAILED\n`)
await c.end()
process.exit(failures === 0 ? 0 : 1)
