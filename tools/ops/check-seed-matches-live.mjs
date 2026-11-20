/**
 * Would reseeding the Blueprint catalog change anything?
 *
 * Read-only, and the answer should be no.
 *
 * WHY IT IS WORTH ASKING. `seed-blueprint-programs.mjs` deletes every day of
 * a program before re-inserting it, and the library it reads from still
 * writes single rep numbers — "5", "8", "10". Before today, running it would
 * have silently undone the rep ranges on all 1,400 prescriptions and put
 * every client back on add-weight-every-session. The seed script now applies
 * the same widening rules the backfill did, which is only true as long as
 * somebody checks.
 *
 * Run this after touching either the library or the rules. A clean result
 * means a reseed is a no-op and therefore safe.
 */
import { readFileSync } from 'node:fs'
import { supa, fail } from './_lib.mjs'
import { rangeFor, formatRange, targetRirFor, boundsFor } from '../../lib/rep-ranges.ts'

const sb = supa()
let bad = 0
const ok = (cond, label, extra = '') => {
  if (!cond) bad++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const lib = JSON.parse(
  readFileSync(new URL('../../program-library/blueprint-library.json', import.meta.url), 'utf8')
)

/* What the seed WOULD write for each goal and role, by the current rules. */
const expected = new Map()
for (const [goalKey, goal] of Object.entries(lib.goals)) {
  for (const [role, scheme] of Object.entries(goal.byRole ?? {})) {
    const raw = scheme.reps ?? null
    if (!raw) continue
    const range = rangeFor(raw, scheme.rest_seconds ?? null)
    const reps = range ? formatRange(range) : raw
    // Mirrors the seed exactly, including the gate: a run or a hold has no
    // reps to record and therefore no effort target. Leaving this out is
    // what made the first version of this check disagree with the script it
    // was supposed to be checking.
    const bounds = boundsFor(reps)
    expected.set(`${goalKey}|${raw}|${scheme.rest_seconds ?? 0}`, {
      reps,
      rir: bounds ? targetRirFor(goalKey) : null,
      role,
    })
  }
}

console.log(`THE LIBRARY STILL HOLDS SINGLE NUMBERS, WHICH IS FINE\n`)
const singles = [...expected.keys()].filter((k) => /^[^|]+\|\d+\|/.test(k))
console.log(`        ${singles.length} role schemes write a bare number; the seed widens them on the way in.\n`)

console.log('WHAT A RESEED WOULD WRITE, AGAINST WHAT IS LIVE\n')

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

const programs = (await all('programs', 'id, goal, source')).filter((p) => p.source === 'blueprint')
const goalOf = new Map(programs.map((p) => [p.id, p.goal]))
const days = await all('program_days', 'id, program_id')
const programOf = new Map(days.map((d) => [d.id, d.program_id]))
const ex = await all('program_exercises', 'exercise_name, reps, rest_seconds, rep_min, rep_max, target_rir, program_day_id')
const live = ex.filter((e) => goalOf.has(programOf.get(e.program_day_id)))

// Rebuild the key from the live row: rep_min is the original number the
// library wrote, because widening always kept it as the floor.
let mismatched = 0
const examples = []
for (const e of live) {
  const goal = goalOf.get(programOf.get(e.program_day_id))
  const original = e.rep_min != null ? String(e.rep_min) : String(e.reps)
  const want = expected.get(`${goal}|${original}|${e.rest_seconds ?? 0}`)
  if (!want) continue // a hold or a prescription with no matching role scheme
  if (String(e.reps).trim() !== want.reps || e.target_rir !== want.rir) {
    mismatched++
    if (examples.length < 6) {
      examples.push(`${e.exercise_name}: live "${e.reps}" rir ${e.target_rir} · seed would write "${want.reps}" rir ${want.rir}`)
    }
  }
}

ok(
  mismatched === 0,
  'a reseed would write what is already there',
  `${mismatched} of ${live.length} would change`
)
examples.forEach((x) => console.log(`        ${x}`))

console.log('\nAND THE RULES THE SEED USES ARE THE ONES THE BACKFILL USED\n')
ok(rangeFor('5', 180) === null, 'a heavy five stays a five on the way in')
ok(formatRange(rangeFor('8', 120)) === '8-12', 'an 8 at 120s still widens to 8-12')
ok(targetRirFor('lean_out') === 3, 'lean out still leaves 3 in reserve')

console.log(bad === 0 ? '\nA reseed is safe.' : `\n${bad} CHECK${bad === 1 ? '' : 'S'} FAILED — do not reseed`)
process.exit(bad === 0 ? 0 : 1)
