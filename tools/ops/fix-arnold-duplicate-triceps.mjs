/**
 * The home Arnold split prescribes the same triceps isolation twice.
 *
 * Day 6 — Push B, positions 4 and 5, both "Decline Dumbbell Triceps
 * Extension". The gym variant pairs it with an EZ-Bar Skullcrusher; the home
 * variant had no bar substitute authored, so it repeated the dumbbell one.
 * Three programs (one per goal), and one client has been training it since
 * August.
 *
 * Position 5 becomes "Lying Dumbbell Tricep Extension" — the swap the library
 * already uses when a Triceps Pushdown needs a home equivalent.
 *
 * Targeted rather than a full reseed: the fix is three rows, and rewriting all
 * 68 programs' content to deliver it is a blast radius out of all proportion.
 * program-library/blueprint-library.json is fixed in the same commit, so a
 * later reseed agrees rather than reverting this.
 *
 *   node tools/ops/fix-arnold-duplicate-triceps.mjs            # dry run
 *   node tools/ops/fix-arnold-duplicate-triceps.mjs --confirm
 */
import { supa, parseArgs, requireConfirm, logAction, fail } from './_lib.mjs'

const WRONG = 'Decline Dumbbell Triceps Extension'
const RIGHT = 'Lying Dumbbell Tricep Extension'

const args = parseArgs()
const sb = supa()

const { data: progs, error: pErr } = await sb
  .from('programs')
  .select('id, name, split_key, location')
  .eq('source', 'blueprint')
  .eq('split_key', '6day_ppl_arnold')
  .eq('location', 'home')
if (pErr) fail(pErr.message)
if (!progs?.length) fail('No home Arnold programs found.')

const plan = []
for (const p of progs) {
  const { data: days } = await sb
    .from('program_days')
    .select('id, name')
    .eq('program_id', p.id)
    .ilike('name', '%Push B%')
  for (const d of days ?? []) {
    const { data: exs } = await sb
      .from('program_exercises')
      .select('id, order_index, exercise_name')
      .eq('program_day_id', d.id)
      .eq('exercise_name', WRONG)
      .order('order_index', { ascending: true })
    // Only the LATER of the pair moves. If there is just one, the row is
    // already correct and must be left alone.
    if ((exs ?? []).length < 2) continue
    const last = exs[exs.length - 1]
    plan.push({ program: p.name, day: d.name, rowId: last.id, position: last.order_index })
  }
}

console.log(`\n${progs.length} home Arnold programs, ${plan.length} rows to change\n`)
for (const x of plan) {
  console.log(`  ${x.program}`)
  console.log(`    ${x.day} position ${x.position}: ${WRONG} -> ${RIGHT}`)
}
if (plan.length === 0) {
  console.log('Nothing to do — already fixed.\n')
  process.exit(0)
}

requireConfirm(args, `change ${plan.length} program_exercises rows`)

for (const x of plan) {
  const { error } = await sb
    .from('program_exercises')
    .update({ exercise_name: RIGHT })
    .eq('id', x.rowId)
  if (error) fail(`${x.program}: ${error.message}`)
}

await logAction({
  action: 'fix_arnold_duplicate_triceps',
  summary: `Replaced a duplicated triceps isolation on ${plan.length} home Arnold Push B days`,
  detail: { from: WRONG, to: RIGHT, rows: plan },
})
console.log(`\n✔ Updated ${plan.length} rows.\n`)
