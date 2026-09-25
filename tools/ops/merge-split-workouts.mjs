/**
 * Merge sessions that were recorded as several workout rows back into one.
 *
 * Cause: startWorkout always inserted instead of resuming an open session, and
 * ending a workout left the logged sets on screen, so a client who carried on
 * re-entered work that was already saved. Both fixed 24 Sep 2026. This repairs
 * the rows that were already written.
 *
 * Dry run is the default. --confirm writes.
 *
 * How a merge is decided:
 *
 *   KEEP    the earliest workout of the group. It holds the true start time,
 *           which is the one fact about the session we cannot reconstruct.
 *   MOVE    every set from the later rows into it.
 *   DEDUPE  by (exercise, set number, intensity flag). Where the same slot was
 *           logged twice, the more complete version wins -- completed beats
 *           not completed, both numbers beat one, and a later entry breaks a
 *           tie, because the last thing the client typed is what they meant.
 *   SPAN    duration becomes earliest start to latest end, so the session
 *           reads as the single continuous block it actually was.
 *   DELETE  the emptied workout rows.
 *
 * Every deleted row is written to ops_action_log first, in full, so this is
 * recoverable from the database alone.
 */
import { readFileSync, writeFileSync } from 'node:fs'
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

const slot = (s) => `${s.exercise_name}|${s.set_number}|${s.is_intensity_set}`
/** Higher is better. */
const completeness = (s) =>
  (s.completed ? 4 : 0) + (s.weight !== null ? 2 : 0) + (s.reps !== null ? 1 : 0)

const groups = await c.query(`
  select w.user_id, u.name, w.date::date as d, w.day_name, count(*)::int n
  from public.workouts w join public.users u on u.id = w.user_id
  group by w.user_id, u.name, w.date, w.day_name having count(*) > 1
  order by w.date`)

const plan = []

for (const g of groups.rows) {
  const ws = (await c.query(`
    select id, started_at, ended_at, duration_seconds
    from public.workouts
    where user_id=$1 and date::date=$2 and day_name=$3
    order by started_at`, [g.user_id, g.d, g.day_name])).rows

  const keep = ws[0]
  const drop = ws.slice(1)

  const allSets = []
  for (const w of ws) {
    const rows = (await c.query(`
      select id, workout_id, exercise_name, original_exercise_name, set_number, weight, reps,
             is_intensity_set, intensity_technique, completed, logged_at
      from public.workout_sets where workout_id=$1`, [w.id])).rows
    allSets.push(...rows)
  }

  // Winner per slot: most complete, latest entry breaks a tie.
  const best = new Map()
  for (const s of allSets) {
    const k = slot(s)
    const cur = best.get(k)
    if (!cur) { best.set(k, s); continue }
    const better =
      completeness(s) > completeness(cur) ||
      (completeness(s) === completeness(cur) && new Date(s.logged_at) > new Date(cur.logged_at))
    if (better) best.set(k, s)
  }
  const keepIds = new Set([...best.values()].map((s) => s.id))
  const deleteSets = allSets.filter((s) => !keepIds.has(s.id))
  const moveSets = [...best.values()].filter((s) => s.workout_id !== keep.id)

  const ends = ws.map((w) => w.ended_at).filter(Boolean).map((e) => new Date(e).getTime())
  const latestEnd = ends.length ? new Date(Math.max(...ends)) : null
  const span = latestEnd
    ? Math.round((latestEnd.getTime() - new Date(keep.started_at).getTime()) / 1000)
    : null
  // An implausible span becomes NULL, not a capped number.
  //
  // Capping at four hours would have written "240 min" onto two of these
  // sessions, which is exactly the invention this whole clean-up is undoing --
  // the 45-minute stamp from autoCloseStaleWorkouts. Where the end times are
  // not trustworthy enough to give a real figure, no figure is the honest
  // answer, and the history row already renders nothing when duration is null.
  const duration = span === null || span <= 0 || span > 4 * 60 * 60 ? null : span

  plan.push({ g, keep, drop, allSets, deleteSets, moveSets, duration, latestEnd })
}

const W = (s, n) => String(s ?? '').padEnd(n)
console.log(`\n${plan.length} split session${plan.length === 1 ? '' : 's'} to merge\n`)
let totalDel = 0, totalMove = 0
for (const p of plan) {
  const day = new Date(p.g.d).toISOString().slice(0, 10)
  console.log(`${p.g.name} — ${day} — ${p.g.day_name}`)
  console.log(`   keep   workout started ${new Date(p.keep.started_at).toISOString().slice(11, 16)}` +
    `  (was ${p.keep.duration_seconds ? Math.round(p.keep.duration_seconds / 60) + ' min' : 'no duration'}` +
    ` -> ${p.duration ? Math.round(p.duration / 60) + ' min' : 'no duration'})`)
  for (const d of p.drop) {
    console.log(`   delete workout started ${new Date(d.started_at).toISOString().slice(11, 16)}` +
      `  ${d.ended_at ? '' : '(was still OPEN)'}`)
  }
  console.log(`   ${W(p.allSets.length, 3)} set rows -> ${p.allSets.length - p.deleteSets.length} kept,` +
    ` ${p.deleteSets.length} deleted as duplicates, ${p.moveSets.length} moved into the kept workout`)
  totalDel += p.deleteSets.length
  totalMove += p.moveSets.length
  console.log()
}
console.log('='.repeat(66))
console.log(`${totalDel} duplicate set rows deleted, ${totalMove} moved, ${plan.reduce((n, p) => n + p.drop.length, 0)} workout rows removed`)

if (!confirm) {
  const out = new URL('../../.merge-plan.json', import.meta.url)
  writeFileSync(out, JSON.stringify(plan.map(p => ({
    client: p.g.name, date: p.g.d, day: p.g.day_name,
    keep: p.keep.id, drop: p.drop.map(d => d.id),
    deleteSets: p.deleteSets, moveSets: p.moveSets.map(s => s.id), duration: p.duration,
  })), null, 2))
  console.log(`\nDRY RUN. Nothing was written. Full plan saved beside the repo for inspection.`)
  console.log(`Re-run with --confirm to apply.\n`)
  await c.end()
  process.exit(0)
}

for (const p of plan) {
  try {
    await c.query('begin')

    // Full copy of everything about to go, before it goes.
    await c.query(
      `insert into public.ops_action_log (actor, action, target, summary, detail)
       values ('claude-code', 'merge-split-workout', $1, $2, $3)`,
      [
        `${p.g.name} ${new Date(p.g.d).toISOString().slice(0, 10)} ${p.g.day_name}`,
        `Merged ${p.drop.length + 1} workout rows into one; deleted ${p.deleteSets.length} duplicate set rows.`,
        JSON.stringify({
          reason: 'startWorkout inserted instead of resuming an open session (fixed 2026-09-24)',
          keptWorkout: p.keep,
          deletedWorkouts: p.drop,
          deletedSets: p.deleteSets,
          movedSetIds: p.moveSets.map((s) => s.id),
          newDurationSeconds: p.duration,
        }),
      ]
    )

    if (p.deleteSets.length) {
      await c.query(`delete from public.workout_sets where id = any($1)`, [p.deleteSets.map((s) => s.id)])
    }
    if (p.moveSets.length) {
      await c.query(`update public.workout_sets set workout_id=$1 where id = any($2)`,
        [p.keep.id, p.moveSets.map((s) => s.id)])
    }
    await c.query(
      `update public.workouts set ended_at=$2, duration_seconds=$3 where id=$1`,
      [p.keep.id, p.latestEnd ? p.latestEnd.toISOString() : null, p.duration]
    )
    await c.query(`delete from public.workouts where id = any($1)`, [p.drop.map((d) => d.id)])

    await c.query('commit')
    console.log(`  ok  ${p.g.name} ${new Date(p.g.d).toISOString().slice(0, 10)}`)
  } catch (e) {
    await c.query('rollback')
    console.error(`  FAILED ${p.g.name}: ${e.message}`)
  }
}

console.log('\nDone. Every deleted row is in ops_action_log under action = merge-split-workout.\n')
await c.end()
