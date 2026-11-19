/**
 * Bring already-backfilled prescriptions into line with the current mapping.
 *
 * WHY THIS EXISTS RATHER THAN A ONE-OFF REVERT. The mapping is a set of
 * coaching decisions, and coaching decisions get corrected. The first one to
 * be corrected was widening a 5x5 at three minutes' rest to 5-7, which turns
 * a linear strength protocol into something else — the reps there are fixed
 * on purpose and the load is what progresses.
 *
 * So rather than a script that undoes that specific thing, this re-reads the
 * rule and fixes whatever currently disagrees with it. The next correction
 * costs an edit to the rule and another run.
 *
 * It only touches rows the backfill has already filled, and only where the
 * current rule disagrees with what is stored. A prescription a coach has
 * edited by hand into something the rule does not produce WILL be overwritten
 * — that is the point of a resync, and the reason it prints every change
 * before asking.
 *
 *   node tools/ops/resync-rep-ranges.mjs
 *   node tools/ops/resync-rep-ranges.mjs --confirm
 */
/*
 * RUN WITH TYPE STRIPPING, so the rule comes from the one place it lives:
 *
 *   node --experimental-strip-types --import ./tools/_alias-hook.mjs \
 *     tools/ops/resync-rep-ranges.mjs
 */
import { supa, parseArgs, requireConfirm, logAction, fail } from './_lib.mjs'
import { rangeFor as libRangeFor } from '../../lib/rep-ranges.ts'

const args = parseArgs()
const sb = supa()

/** Takes the ORIGINAL rep count, which is recoverable as rep_min. */
function rangeFor(n, restSeconds) {
  const r = libRangeFor(String(n), restSeconds)
  return r ? [r.min, r.max] : null
}

async function all(table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999)
    if (error) fail(`${table}: ${error.message}`)
    out.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return out
}

const days = await all('program_days', 'id, name, program_id')
const programs = await all('programs', 'id, name')
const names = new Map(programs.map((p) => [p.id, p.name]))
const dayName = new Map(days.map((d) => [d.id, d.name]))
const programOf = new Map(days.map((d) => [d.id, d.program_id]))
const ex = await all('program_exercises', 'id, exercise_name, reps, rep_min, rep_max, rest_seconds, program_day_id')

// Only rows the backfill has filled. Everything else is out of scope.
const filled = ex.filter((e) => e.rep_min != null && e.rep_max != null)

const changes = []
for (const e of filled) {
  // The backfill always used the original prescription as the floor, so
  // rep_min IS the number the coach originally wrote.
  const original = e.rep_min
  const want = rangeFor(original, e.rest_seconds)
  const wantMin = want ? want[0] : original
  const wantMax = want ? want[1] : original
  const wantText = wantMin === wantMax ? String(wantMin) : `${wantMin}-${wantMax}`

  if (e.rep_min === wantMin && e.rep_max === wantMax && String(e.reps).trim() === wantText) continue

  changes.push({
    id: e.id,
    exercise: e.exercise_name,
    day: dayName.get(e.program_day_id) ?? '?',
    program: names.get(programOf.get(e.program_day_id)) ?? '?',
    rest: e.rest_seconds,
    from: String(e.reps),
    to: wantText,
    patch: { reps: wantText, rep_min: wantMin, rep_max: wantMax },
  })
}

console.log(`\n${filled.length} filled prescriptions checked against the current rule`)
console.log(`${changes.length} disagree and would change\n`)

if (changes.length === 0) {
  console.log('✓ Everything already matches. Nothing to do.')
  process.exit(0)
}

const grouped = {}
for (const c of changes) {
  const k = `${c.from} -> ${c.to}  (rest ${c.rest}s)`
  grouped[k] = (grouped[k] ?? 0) + 1
}
Object.entries(grouped)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`))

console.log('\nEVERY CHANGE, IN FULL')
for (const c of changes) {
  console.log(`  ${c.exercise} · ${c.day}`)
  console.log(`     ${c.from} -> ${c.to}   [${c.program.slice(0, 50)}]`)
}

requireConfirm(args, `resync ${changes.length} prescriptions`)

let done = 0
let failedRows = 0
for (const c of changes) {
  const { data, error } = await sb.from('program_exercises').update(c.patch).eq('id', c.id).select('id')
  if (error || !data || data.length === 0) {
    failedRows++
    if (failedRows <= 5) console.error(`  FAILED ${c.exercise}: ${error?.message ?? 'no rows updated'}`)
  } else {
    done++
  }
}

console.log(`\n${done} updated, ${failedRows} failed`)
await logAction({
  action: 'resync_rep_ranges',
  target: 'program_exercises',
  summary: `${done} prescriptions resynced to the current rep-range rule`,
  detail: JSON.stringify({ done, failed: failedRows, changes: Object.keys(grouped) }),
})
if (failedRows > 0) fail(`${failedRows} rows did not update`)
console.log('✓ Done.')
