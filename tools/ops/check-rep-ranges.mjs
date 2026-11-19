/**
 * Did the rep-range backfill land, and does it still make sense?
 *
 * Read-only. Run it after a backfill, and again whenever a coach has been
 * editing prescriptions, because the two things it checks are the two that go
 * wrong quietly: a `reps` text that no longer agrees with its structured
 * columns, and a client ending up prescribed fewer reps than before.
 */
import { supa, fail } from './_lib.mjs'

const sb = supa()
let bad = 0
const ok = (cond, label, extra = '') => {
  if (!cond) bad++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
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

const assignments = await all('program_assignments', 'program_id')
const assigned = new Set(assignments.map((a) => a.program_id))
const days = await all('program_days', 'id, program_id')
const programOf = new Map(days.map((d) => [d.id, d.program_id]))
const ex = await all('program_exercises', 'id, exercise_name, reps, rep_min, rep_max, target_rir, rest_seconds, program_day_id')

const inUse = ex.filter((e) => assigned.has(programOf.get(e.program_day_id)))
const timed = (r) => /[a-z]/i.test(String(r ?? ''))
const countable = inUse.filter((e) => !timed(e.reps))

console.log(`COVERAGE — prescriptions inside programs somebody has been assigned\n`)
console.log(`  ${inUse.length} prescriptions, of which ${countable.length} are rep counts\n`)

const withRange = countable.filter((e) => e.rep_min != null && e.rep_max != null)
const singles = countable.filter((e) => e.rep_min == null && /^\s*\d+\s*$/.test(String(e.reps)))
ok(
  withRange.length + singles.length === countable.length,
  'every rep count has a range or is a deliberate single',
  `${withRange.length} ranged, ${singles.length} single, ${countable.length} total`
)
ok(
  inUse.filter((e) => e.target_rir == null && !timed(e.reps)).length === 0,
  'every rep count carries an effort target',
  `${inUse.filter((e) => e.target_rir == null && !timed(e.reps)).length} without one`
)

console.log('\nTHE TEXT AND THE COLUMNS AGREE\n')
const disagree = withRange.filter((e) => {
  const want = e.rep_min === e.rep_max ? String(e.rep_min) : `${e.rep_min}-${e.rep_max}`
  return String(e.reps).trim() !== want
})
ok(disagree.length === 0, 'reps text matches rep_min and rep_max everywhere', `${disagree.length} disagree`)
disagree.slice(0, 5).forEach((e) => console.log(`        ${e.exercise_name}: "${e.reps}" vs ${e.rep_min}-${e.rep_max}`))

console.log('\nNOBODY IS PRESCRIBED LESS WORK THAN BEFORE\n')
// The backfill always used the original number as the floor, so the original
// prescription is recoverable as rep_min. A floor above the top, or a range
// the database would reject, would mean something else has edited these.
ok(withRange.filter((e) => e.rep_max < e.rep_min).length === 0, 'no range has its top below its floor')
ok(withRange.filter((e) => e.rep_min < 1).length === 0, 'no floor below one rep')
const wild = withRange.filter((e) => e.rep_max - e.rep_min > 8)
ok(wild.length === 0, 'no range wider than 8 reps', `${wild.length} wider`)
wild.slice(0, 5).forEach((e) => console.log(`        ${e.exercise_name}: ${e.rep_min}-${e.rep_max}`))

console.log('\nTIMED AND DISTANCE WORK WAS NOT TOUCHED\n')
const timedRows = inUse.filter((e) => timed(e.reps))
ok(
  timedRows.filter((e) => e.rep_min != null).length === 0,
  'no hold or carry was given a rep range',
  `${timedRows.length} timed rows, ${timedRows.filter((e) => e.rep_min != null).length} wrongly ranged`
)

console.log('\nTHE WHOLE CATALOG, NOT JUST THE PROGRAMS IN USE\n')
// Slice one covered only the 14 assigned programs. That left 54 programs
// still offering single numbers in the picker, so a client choosing one
// today would have got the old every-session load increase. Coverage is now
// the whole catalog, and this is the check that keeps it that way.
const everyCountable = ex.filter((e) => !timed(e.reps))
const noRange = everyCountable.filter(
  (e) => e.rep_min == null && !/^\s*\d+\s*$/.test(String(e.reps))
)
ok(noRange.length === 0, 'no rep count anywhere is left unclassified', `${noRange.length} unclassified`)
const noRir = everyCountable.filter((e) => e.target_rir == null)
ok(
  noRir.length === 0,
  'every rep count in the catalog carries an effort target',
  `${noRir.length} of ${everyCountable.length} without one`
)

console.log('\nHEAVY LOW-REP WORK KEPT ITS FIXED PRESCRIPTION\n')
// Five or fewer reps at 150s or more is a linear strength protocol: the reps
// are fixed on purpose and the load is what progresses.
const heavyWidened = ex.filter(
  (e) => e.rep_min != null && e.rep_min <= 5 && (e.rest_seconds ?? 0) >= 150 && e.rep_max > e.rep_min
)
ok(heavyWidened.length === 0, 'no heavy set of five or fewer was widened', `${heavyWidened.length} widened`)
heavyWidened.slice(0, 5).forEach((e) =>
  console.log(`        ${e.exercise_name}: ${e.rep_min}-${e.rep_max} at ${e.rest_seconds}s`)
)

console.log(bad === 0 ? '\nAll checks passed.' : `\n${bad} CHECK${bad === 1 ? '' : 'S'} FAILED`)
process.exit(bad === 0 ? 0 : 1)
