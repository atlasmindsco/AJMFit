/**
 * The 68 seeded programs prescribe the Plank in REPS.
 *
 * "2 x 10", "3 x 15", "3 x 20" — 45 slots. The generator applies a goal's
 * scheme by ROLE, and the plank's role is "core" like any crunch, so it got a
 * rep count. A client reported it: a plank is seconds.
 *
 * Three seconds a "rep", which is roughly how an isometric is counted and
 * which lands the three schemes exactly on 30, 45 and 60 seconds. It also
 * keeps what the goal meant — Build Strength holds least in total, Lean Out
 * most. Matches lib/holds.ts and the seeder, both fixed in the same commit.
 *
 * Targeted rather than a full reseed: 45 rows do not justify rewriting all 68
 * programs' content.
 *
 *   node tools/ops/fix-plank-prescriptions.mjs            # dry run
 *   node tools/ops/fix-plank-prescriptions.mjs --confirm
 */
import { readFileSync } from 'node:fs'
import { supa, parseArgs, requireConfirm, logAction, fail } from './_lib.mjs'

const args = parseArgs()
const sb = supa()

const LIB = JSON.parse(
  readFileSync(new URL('../../public/exercises/exercises.json', import.meta.url), 'utf8')
)
const FORCE = new Map(LIB.map((e) => [e.name, e.force]))

const toSeconds = (reps) => {
  const n = parseInt(String(reps ?? ''), 10)
  if (!Number.isFinite(n)) return null
  const s = Math.min(120, Math.max(15, Math.round(n * 3)))
  return s % 60 === 0 && s >= 60 ? `${s / 60} min` : `${s} sec`
}

// Filtered server-side by name. An unfiltered select returns PostgREST's
// default 1000 rows and program_exercises has 1,517 — the first run of this
// script reported 31 slots instead of 45 and would have left 14 unfixed.
const staticNames = LIB.filter((e) => e.force === 'static').map((e) => e.name)
const { data: rows, error } = await sb
  .from('program_exercises')
  .select('id, exercise_name, sets, reps, program_day_id')
  .in('exercise_name', staticNames)
if (error) fail(error.message)
console.log(`scanned ${rows?.length ?? 0} held-exercise rows`)

const plan = []
for (const r of rows ?? []) {
  if (FORCE.get(r.exercise_name) !== 'static') continue
  // Already timed — leave it alone, so this is safe to re-run.
  if (/sec|min/i.test(String(r.reps ?? ''))) continue
  const next = toSeconds(r.reps)
  if (!next) continue
  plan.push({ id: r.id, name: r.exercise_name, sets: r.sets, from: r.reps, to: next })
}

const grouped = new Map()
for (const p of plan) {
  const key = `${p.name} ${p.sets} x ${p.from} -> ${p.sets} x ${p.to}`
  grouped.set(key, (grouped.get(key) ?? 0) + 1)
}

console.log(`\n${plan.length} prescribed slots to change\n`)
for (const [k, n] of grouped) console.log(`  ${k.padEnd(44)} ${n} slots`)

if (plan.length === 0) {
  console.log('\nNothing to do — already timed.\n')
  process.exit(0)
}

requireConfirm(args, `change ${plan.length} program_exercises rows from reps to seconds`)

let done = 0
for (const p of plan) {
  const { error: e } = await sb.from('program_exercises').update({ reps: p.to }).eq('id', p.id)
  if (e) fail(`${p.name}: ${e.message}`)
  done++
}

await logAction({
  action: 'fix_plank_prescriptions',
  summary: `Converted ${done} held-exercise slots from rep counts to seconds`,
  detail: { rule: '3 seconds per rep, clamped 15-120', groups: [...grouped.entries()] },
})
console.log(`\n✔ Updated ${done} rows.\n`)
