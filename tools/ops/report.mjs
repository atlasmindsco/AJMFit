/**
 * REPORTS — read-only views across the AJM Fit backend.
 *
 * Read-only by design: no --confirm, no writes, nothing logged. Safe to run
 * any time, including against production.
 *
 *   node tools/ops/report.mjs clients                 # everyone, with tier + last activity
 *   node tools/ops/report.mjs applications            # pending applications
 *   node tools/ops/report.mjs behind [--days=7]       # active clients not training
 *   node tools/ops/report.mjs unread                  # clients waiting on a reply
 *   node tools/ops/report.mjs log [--limit=20]        # recent ops action log
 */
import { supa, parseArgs, fail } from './_lib.mjs'

const args = parseArgs()
const which = args._[0]
const sb = supa()

const die = (msg) => fail(`${msg}\n\nUsage: node tools/ops/report.mjs <clients|applications|behind|unread|log>`)
if (!which) die('Pick a report.')

/** Tier comes from Stripe when there is a subscription, else the latest application. */
async function tierMap(userIds) {
  const [{ data: subs }, { data: apps }] = await Promise.all([
    sb.from('subscriptions').select('user_id, tier, status').in('user_id', userIds),
    sb.from('applications').select('user_id, tier, created_at').in('user_id', userIds)
      .order('created_at', { ascending: false }),
  ])
  const out = new Map()
  for (const a of apps ?? []) if (!out.has(a.user_id)) out.set(a.user_id, a.tier)
  for (const s of subs ?? []) if (s.tier) out.set(s.user_id, s.tier)
  return out
}

/** user_id -> most recent workout date. */
async function lastWorkoutMap(userIds) {
  const { data } = await sb.from('workouts').select('user_id, date').in('user_id', userIds)
    .order('date', { ascending: false })
  const out = new Map()
  for (const w of data ?? []) if (!out.has(w.user_id)) out.set(w.user_id, w.date)
  return out
}

const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null)
const show = (rows, empty) => (rows.length ? console.table(rows) : console.log(`\n${empty}\n`))

if (which === 'clients') {
  const { data: users, error } = await sb.from('users')
    .select('id, name, email, status, created_at').order('created_at', { ascending: false })
  if (error) fail(error.message)
  const ids = users.map((u) => u.id)
  const [tiers, last] = await Promise.all([tierMap(ids), lastWorkoutMap(ids)])
  show(
    users.map((u) => ({
      name: u.name,
      email: u.email,
      status: u.status,
      tier: tiers.get(u.id) ?? '—',
      lastWorkout: last.get(u.id) ?? 'never',
      daysAgo: daysSince(last.get(u.id)) ?? '—',
    })),
    'No clients yet.'
  )
} else if (which === 'applications') {
  const { data, error } = await sb.from('applications')
    .select('id, user_id, tier, billing_cycle, status, goals, availability, created_at')
    .eq('status', 'pending').order('created_at', { ascending: false })
  if (error) fail(error.message)
  if (!data.length) show([], 'No pending applications.')
  else {
    const { data: users } = await sb.from('users').select('id, name, email')
      .in('id', data.map((a) => a.user_id))
    const byId = new Map((users ?? []).map((u) => [u.id, u]))
    show(
      data.map((a) => ({
        name: byId.get(a.user_id)?.name ?? '?',
        email: byId.get(a.user_id)?.email ?? '?',
        tier: a.tier,
        billing: a.billing_cycle,
        availability: a.availability,
        goals: String(a.goals ?? '').slice(0, 60),
        waitingDays: daysSince(a.created_at),
      })),
      'No pending applications.'
    )
  }
} else if (which === 'behind') {
  const threshold = Number(args.days ?? 7)
  if (!Number.isFinite(threshold) || threshold < 1) fail('--days must be a positive number.')
  const { data: users, error } = await sb.from('users').select('id, name, email').eq('status', 'active')
  if (error) fail(error.message)
  const last = await lastWorkoutMap(users.map((u) => u.id))
  const rows = users
    .map((u) => ({ name: u.name, email: u.email, lastWorkout: last.get(u.id) ?? 'never', daysAgo: daysSince(last.get(u.id)) }))
    .filter((r) => r.daysAgo === null || r.daysAgo >= threshold)
    .sort((a, b) => (b.daysAgo ?? 1e9) - (a.daysAgo ?? 1e9))
  console.log(`\nActive clients with no workout in ${threshold}+ days:`)
  show(rows, 'Everyone is training. Nothing to chase.')
} else if (which === 'unread') {
  const { data, error } = await sb.from('messages')
    .select('user_id, body, created_at').eq('from_trainer', false).is('read_at', null)
    .order('created_at', { ascending: false })
  if (error) fail(error.message)
  if (!data.length) show([], 'Nothing unread.')
  else {
    const { data: users } = await sb.from('users').select('id, name')
      .in('id', [...new Set(data.map((m) => m.user_id))])
    const byId = new Map((users ?? []).map((u) => [u.id, u.name]))
    const first = new Map()
    for (const m of data) if (!first.has(m.user_id)) first.set(m.user_id, m)
    show(
      [...first.entries()].map(([uid, m]) => ({
        name: byId.get(uid) ?? '?',
        unread: data.filter((x) => x.user_id === uid).length,
        waitingDays: daysSince(m.created_at),
        latest: String(m.body ?? '').slice(0, 70),
      })),
      'Nothing unread.'
    )
  }
} else if (which === 'log') {
  const limit = Number(args.limit ?? 20)
  const { data, error } = await sb.from('ops_action_log')
    .select('created_at, actor, action, target, summary').order('created_at', { ascending: false }).limit(limit)
  if (error) fail(error.message)
  show(
    (data ?? []).map((r) => ({
      when: r.created_at.slice(0, 19).replace('T', ' '),
      actor: r.actor,
      action: r.action,
      target: r.target ?? '—',
      summary: String(r.summary ?? '').slice(0, 70),
    })),
    'Action log is empty.'
  )
} else {
  die(`Unknown report "${which}".`)
}
