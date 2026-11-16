/**
 * Who actually clicks Start Now, and what happens to them.
 *
 * Reads the checkout_attempts log and joins it to Stripe. Until this table has
 * data the honest answer to "why does 92% of checkout abandon" is that nobody
 * knows: Stripe writes nothing to an abandoned session, so the only thing
 * provable from its records is how many paid.
 *
 * Read-only. Safe to run any time.
 *
 *   node tools/ops/checkout-funnel-report.mjs
 *   node tools/ops/checkout-funnel-report.mjs --days=30
 */
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'
import { supa, parseArgs } from './_lib.mjs'

const args = parseArgs()
const days = Number(args.days ?? 90)
const sb = supa()

const raw = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
const key = /^\s*STRIPE_SECRET_KEY\s*=\s*(.+)$/m.exec(raw)?.[1].trim().replace(/^["']|["']$/g, '')
const stripe = new Stripe(key)

const since = new Date(Date.now() - days * 86400000).toISOString()
const { data: hits, error } = await sb
  .from('checkout_attempts')
  .select('*')
  .gte('created_at', since)
  .order('created_at', { ascending: false })
if (error) {
  console.error(`\n✖ ${error.message}\n`)
  process.exit(1)
}

console.log(`\nBLUEPRINT CHECKOUT, last ${days} days\n`)

if (!hits.length) {
  console.log('  No clicks logged yet.')
  console.log('  This table started collecting on 15 Nov 2026 — before that,')
  console.log('  nothing recorded who clicked, which is the whole reason it exists.\n')
  process.exit(0)
}

const humans = hits.filter((h) => !h.looks_like_bot)
const bots = hits.filter((h) => h.looks_like_bot)

// Join to Stripe for outcomes.
const ids = humans.map((h) => h.stripe_session_id).filter(Boolean)
const outcomes = new Map()
for (const id of ids) {
  try {
    const s = await stripe.checkout.sessions.retrieve(id)
    outcomes.set(id, s.status)
  } catch {
    outcomes.set(id, 'unknown')
  }
}
const paid = humans.filter((h) => outcomes.get(h.stripe_session_id) === 'complete').length

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—')

console.log(`  clicks logged          ${String(hits.length).padStart(5)}`)
console.log(`    from a real browser  ${String(humans.length).padStart(5)}   ${pct(humans.length, hits.length)}`)
console.log(`    from a bot or crawler${String(bots.length).padStart(5)}   ${pct(bots.length, hits.length)}`)
console.log('')
console.log(`  of the real browsers, paid: ${paid} of ${humans.length}  (${pct(paid, humans.length)})`)
console.log('')
console.log('  The second number is the real conversion rate. Counting Stripe')
console.log('  sessions alone counts every crawler as a lost customer.')

console.log('\n\nWHERE THE REAL CLICKS CAME FROM\n')
const byRef = {}
for (const h of humans) {
  let r = h.referer || '(typed or unknown)'
  try { r = new URL(r).pathname } catch { /* keep as-is */ }
  byRef[r] = (byRef[r] ?? 0) + 1
}
for (const [r, n] of Object.entries(byRef).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${r}`)
}

if (bots.length) {
  console.log('\n\nWHAT THE BOTS WERE\n')
  const byUa = {}
  for (const b of bots) {
    const name = (b.user_agent || '').slice(0, 46) || '(no user agent)'
    byUa[name] = (byUa[name] ?? 0) + 1
  }
  for (const [u, n] of Object.entries(byUa).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${String(n).padStart(4)}  ${u}`)
  }
}
console.log('')
