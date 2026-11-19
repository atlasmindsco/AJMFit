/**
 * Give prescriptions a rep range and an effort target.
 *
 * WHAT THIS CHANGES. A prescription reading "4 x 8" becomes "4 x 8-12", with
 * rep_min 8, rep_max 12 and a target RIR from the program's goal. The
 * prescribed number always becomes the FLOOR, so no client ends up doing less
 * work than their program asked for yesterday — the only change is that there
 * is now somewhere to climb before the weight goes up.
 *
 * WHY IT MATTERS. lib/progression.ts runs double progression off the range in
 * the `reps` text. With a single number the top and bottom are the same, so
 * the engine tells a client to add weight the first session they hit the
 * prescribed reps, every session, with no buffer. Right for a true novice,
 * too fast for everybody else, and currently how every client is training.
 *
 * SCOPE. By default only the programs somebody has actually been assigned —
 * 14 of 68. The other 54 have never been given to anybody and can wait for a
 * coach to look at them. Pass --all to include them.
 *
 * Dry run unless --confirm. The dry run prints every change it would make.
 *
 *   node tools/ops/backfill-rep-ranges.mjs
 *   node tools/ops/backfill-rep-ranges.mjs --confirm
 *   node tools/ops/backfill-rep-ranges.mjs --all --confirm
 */
import { supa, parseArgs, requireConfirm, logAction, fail } from './_lib.mjs'

const args = parseArgs()
const sb = supa()
const includeAll = Boolean(args.all)

/* The mapping, kept in step with lib/rep-ranges.ts by verify-rep-ranges.ts.
   Duplicated here rather than imported because this is a plain .mjs script
   and the library is TypeScript; the verifier asserts they agree. */
const RANGES = {
  1: null,
  3: [3, 5],
  5: [5, 7],
  6: [6, 8],
  8: [8, 12],
  10: [10, 12],
  12: [12, 15],
  15: [15, 20],
  20: [20, 25],
}

function rangeFor(reps) {
  const raw = String(reps ?? '').trim()
  if (raw === '' || /[a-z]/i.test(raw) || /[-–]/.test(raw)) return null
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return null
  if (n in RANGES) return RANGES[n]
  const keys = Object.keys(RANGES).map(Number).sort((a, b) => a - b)
  let key = null
  for (const k of keys) if (k <= n) key = k
  if (key === null || !RANGES[key]) return null
  return [n, n + (RANGES[key][1] - RANGES[key][0])]
}

const RIR = { strength: 2, muscle: 2, lean_out: 3 }
const rirFor = (goal) => RIR[goal] ?? 2

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
const programs = await all('programs', 'id, name, goal, source')
const days = await all('program_days', 'id, program_id, name')
const exercises = await all('program_exercises', 'id, program_day_id, exercise_name, sets, reps, rep_min, rep_max, target_rir')

const programOf = new Map(days.map((d) => [d.id, d.program_id]))
const dayName = new Map(days.map((d) => [d.id, d.name]))
const byId = new Map(programs.map((p) => [p.id, p]))

const inScope = exercises.filter((e) => {
  const pid = programOf.get(e.program_day_id)
  if (!pid) return false
  return includeAll || assigned.has(pid)
})

const changes = []
const skipped = { timed: 0, alreadyRange: 0, single: 0, alreadyDone: 0 }

for (const e of inScope) {
  const pid = programOf.get(e.program_day_id)
  const prog = byId.get(pid)
  const rir = rirFor(prog?.goal)

  if (e.rep_min != null && e.target_rir != null) {
    skipped.alreadyDone++
    continue
  }

  const r = rangeFor(e.reps)
  if (!r) {
    const raw = String(e.reps ?? '')
    if (/[a-z]/i.test(raw)) skipped.timed++
    else if (/[-–]/.test(raw)) skipped.alreadyRange++
    else skipped.single++
    // An existing range still deserves its structured columns and an effort
    // target. Only the `reps` text is left alone.
    const m = raw.match(/^(\d+)\s*[-–]\s*(\d+)$/)
    if (m) {
      changes.push({
        id: e.id,
        program: prog?.name ?? '?',
        day: dayName.get(e.program_day_id) ?? '?',
        exercise: e.exercise_name,
        from: raw,
        to: raw,
        patch: { rep_min: Number(m[1]), rep_max: Number(m[2]), target_rir: rir },
      })
    } else if (e.target_rir == null && !/[a-z]/i.test(raw)) {
      // A bare single: no range, but an effort target still applies.
      changes.push({
        id: e.id,
        program: prog?.name ?? '?',
        day: dayName.get(e.program_day_id) ?? '?',
        exercise: e.exercise_name,
        from: raw,
        to: raw,
        patch: { target_rir: rir },
      })
    }
    continue
  }

  changes.push({
    id: e.id,
    program: prog?.name ?? '?',
    day: dayName.get(e.program_day_id) ?? '?',
    exercise: e.exercise_name,
    from: String(e.reps),
    to: `${r[0]}-${r[1]}`,
    patch: { rep_min: r[0], rep_max: r[1], target_rir: rir, reps: `${r[0]}-${r[1]}` },
  })
}

const widened = changes.filter((c) => c.from !== c.to)

console.log(`\nSCOPE: ${includeAll ? 'every program' : 'programs that have ever been assigned'}`)
console.log(`  ${inScope.length} prescriptions in scope`)
console.log(`  ${widened.length} get a widened rep range`)
console.log(`  ${changes.length - widened.length} get only the structured columns or an effort target`)
console.log(`  left alone: ${skipped.timed} timed or distance · ${skipped.alreadyDone} already done\n`)

const sample = {}
for (const c of widened) {
  const k = `${c.from} -> ${c.to}`
  sample[k] = (sample[k] ?? 0) + 1
}
console.log('REP CHANGES')
Object.entries(sample)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`))

console.log('\nFIRST TWELVE, IN FULL')
for (const c of widened.slice(0, 12)) {
  console.log(`  ${c.exercise} · ${c.day}`)
  console.log(`     ${c.from} -> ${c.to}   rir ${c.patch.target_rir}   [${c.program.slice(0, 48)}]`)
}

requireConfirm(args, `update ${changes.length} prescriptions`)

let done = 0
let failedRows = 0
for (const c of changes) {
  const { data, error } = await sb
    .from('program_exercises')
    .update(c.patch)
    .eq('id', c.id)
    .select('id')
  // PostgREST reports a filtered-out update as a success with no rows, so the
  // row count is the only honest signal that anything landed.
  if (error || !data || data.length === 0) {
    failedRows++
    if (failedRows <= 5) console.error(`  FAILED ${c.exercise}: ${error?.message ?? 'no rows updated'}`)
  } else {
    done++
  }
}

console.log(`\n${done} updated, ${failedRows} failed`)

await logAction({
  action: 'backfill_rep_ranges',
  target: includeAll ? 'all programs' : 'assigned programs',
  summary: `${done} prescriptions given rep ranges and effort targets (${widened.length} ranges widened)`,
  detail: JSON.stringify({ scope: includeAll ? 'all' : 'assigned', done, failed: failedRows, widened: widened.length }),
})

if (failedRows > 0) fail(`${failedRows} rows did not update`)
console.log('✓ Done.')
