/**
 * Two personal records that cannot be displayed truthfully.
 *
 *   Chance London   Plank   45 x 150
 *   Alexandro       Barbell Bench Press   100 x 51
 *
 * The first is a plank. Planks are held, not repeated — the 150 is seconds,
 * logged before the hold fix converted 45 library slots from reps to time.
 * exercise_prs models a record as weight x reps and has nowhere to put a
 * duration, so there is no honest way to render it: "45 x 150" is nonsense
 * and "150 reps" is a lie. A record for a hold is a real feature and this is
 * not it.
 *
 * The second is 51 reps of a bench press at 100lb, under a name the exercise
 * library does not contain. It comes from the same single Self-Guided session
 * in July that produced the other unresolvable names the audit found.
 *
 * Deleting rather than hiding, because this data is already on screen: the
 * homepage shows a Recent PRs list, so Chance has been looking at "Plank
 * 45 x 150" as an achievement for two months. Leaving it and filtering at
 * every display site means every future screen has to remember to filter.
 *
 * Neither deletion touches a workout or a logged set. The sessions stay
 * exactly as they were; only the derived record goes.
 *
 *   node tools/ops/prune-bad-prs.mjs            # dry run
 *   node tools/ops/prune-bad-prs.mjs --confirm
 */
import { readFileSync } from 'node:fs'
import { supa, parseArgs, requireConfirm, logAction, fail } from './_lib.mjs'

const args = parseArgs()
const sb = supa()

const LIB = JSON.parse(readFileSync(new URL('../../public/exercises/exercises.json', import.meta.url), 'utf8'))
const byName = new Map(LIB.map((e) => [e.name, e]))

const { data: prs, error } = await sb
  .from('exercise_prs')
  .select('id, user_id, exercise_name, weight, reps, set_at')
if (error) fail(error.message)

const { data: users } = await sb.from('users').select('id, name')
const nameOf = new Map((users ?? []).map((u) => [u.id, u.name]))

// A record is undisplayable when the movement is held rather than repeated,
// or when the rep count is one nobody performed.
const MAX_PLAUSIBLE_REPS = 50
const bad = (prs ?? [])
  .map((p) => {
    const lib = byName.get(p.exercise_name)
    if (lib?.force === 'static') return { ...p, why: 'held exercise — reps are seconds, and a PR has nowhere to put a duration' }
    if (p.reps > MAX_PLAUSIBLE_REPS) return { ...p, why: `${p.reps} reps is not a set anyone performed` }
    return null
  })
  .filter(Boolean)

console.log(`\n${bad.length} of ${(prs ?? []).length} personal records cannot be displayed truthfully\n`)
for (const p of bad) {
  console.log(`  ${String(nameOf.get(p.user_id) ?? p.user_id).slice(0, 20).padEnd(21)} ${String(p.exercise_name).slice(0, 28).padEnd(29)} ${p.weight} x ${p.reps}  ${String(p.set_at).slice(0, 10)}`)
  console.log(`    ${p.why}`)
}

if (bad.length === 0) {
  console.log('Nothing to prune.\n')
  process.exit(0)
}

requireConfirm(args, `delete ${bad.length} personal records (workouts and logged sets are untouched)`)

for (const p of bad) {
  const { error: e } = await sb.from('exercise_prs').delete().eq('id', p.id)
  if (e) fail(`${p.exercise_name}: ${e.message}`)
}

await logAction({
  action: 'prune_bad_prs',
  summary: `Deleted ${bad.length} undisplayable personal records`,
  detail: {
    removed: bad.map((p) => ({
      client: nameOf.get(p.user_id) ?? p.user_id,
      exercise: p.exercise_name,
      weight: p.weight,
      reps: p.reps,
      set_at: p.set_at,
      why: p.why,
    })),
  },
})
console.log(`\n✔ Deleted ${bad.length}. No workout or logged set was changed.\n`)
