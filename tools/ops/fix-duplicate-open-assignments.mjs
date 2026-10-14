/**
 * Two clients are following two programs at once.
 *
 * program_assignments has always expressed "the program you are on" as the
 * row with ended_at null, and nothing has ever let a CLIENT write that column
 * — so every path that ends an assignment from the browser has been quietly
 * writing nothing. Starting a custom program left the Blueprint one open.
 *
 * The policy in 20261013_assignment_lifecycle.sql stops it happening again.
 * This closes the rows already stranded: for each client, keep the most
 * recently assigned open row and end the rest, backdating ended_at to when
 * the newer one started so the history reads as a clean handover rather than
 * two programs overlapping for weeks.
 *
 *   node tools/ops/fix-duplicate-open-assignments.mjs            # dry run
 *   node tools/ops/fix-duplicate-open-assignments.mjs --confirm
 */
import { supa, parseArgs, requireConfirm, logAction, fail } from './_lib.mjs'

const args = parseArgs()
const sb = supa()

const { data: rows, error } = await sb
  .from('program_assignments')
  .select('id, user_id, program_id, assigned_at')
  .is('ended_at', null)
  .order('assigned_at', { ascending: true })
if (error) fail(error.message)

const byUser = new Map()
for (const r of rows ?? []) {
  if (!byUser.has(r.user_id)) byUser.set(r.user_id, [])
  byUser.get(r.user_id).push(r)
}

const names = new Map()
const { data: users } = await sb.from('users').select('id, name')
for (const u of users ?? []) names.set(u.id, u.name)

const programs = new Map()
const { data: progs } = await sb.from('programs').select('id, name, source')
for (const p of progs ?? []) programs.set(p.id, p)

const plan = []
for (const [userId, list] of byUser) {
  if (list.length < 2) continue
  // Newest wins: it is the one the client last chose and is training.
  const keep = list[list.length - 1]
  for (const stale of list.slice(0, -1)) {
    plan.push({
      id: stale.id,
      user: names.get(userId) ?? userId,
      stale: programs.get(stale.program_id)?.name ?? stale.program_id,
      staleSince: stale.assigned_at,
      endAt: keep.assigned_at,
      keep: programs.get(keep.program_id)?.name ?? keep.program_id,
    })
  }
}

console.log(`\n${byUser.size} clients with an open program, ${plan.length} stale rows to close\n`)
for (const p of plan) {
  console.log(`  ${p.user}`)
  console.log(`    close : ${String(p.stale).slice(0, 56)}`)
  console.log(`            open since ${p.staleSince.slice(0, 10)}, ending at ${p.endAt.slice(0, 10)}`)
  console.log(`    keep  : ${String(p.keep).slice(0, 56)}`)
}

if (plan.length === 0) {
  console.log('Nothing to do — every client has exactly one open program.\n')
  process.exit(0)
}

requireConfirm(args, `close ${plan.length} stale open assignments`)

for (const p of plan) {
  const { error: e } = await sb
    .from('program_assignments')
    .update({ ended_at: p.endAt })
    .eq('id', p.id)
  if (e) fail(`${p.user}: ${e.message}`)
}

await logAction({
  action: 'fix_duplicate_open_assignments',
  summary: `Closed ${plan.length} stale open program assignments`,
  detail: { rows: plan },
})
console.log(`\n✔ Closed ${plan.length} rows.\n`)
