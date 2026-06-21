/**
 * Read-only snapshot of the Stripe account (whatever mode the key is in).
 * Lists account mode, prices, recent customers, subscriptions, checkout
 * sessions, and payments. Run: node scripts/stripe-status.mjs
 */
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const key = env.STRIPE_SECRET_KEY || ''
const stripe = new Stripe(key)
console.log(`KEY MODE: ${key.startsWith('sk_live') ? 'LIVE' : key.startsWith('sk_test') ? 'TEST' : 'UNKNOWN'}`)
console.log('='.repeat(60))

const prices = await stripe.prices.list({ limit: 20, expand: ['data.product'] })
console.log(`\nPRICES (${prices.data.length}):`)
for (const p of prices.data) {
  const amt = p.unit_amount != null ? `$${(p.unit_amount / 100).toFixed(2)}` : 'n/a'
  console.log(`  ${p.lookup_key || '(no key)'} — ${amt}/${p.recurring?.interval || 'once'} — ${p.product?.name || p.product} — active:${p.active}`)
}

const customers = await stripe.customers.list({ limit: 10 })
console.log(`\nCUSTOMERS (showing ${customers.data.length}):`)
for (const c of customers.data) console.log(`  ${c.id} — ${c.email} — created ${new Date(c.created * 1000).toISOString().slice(0, 10)}`)

const subs = await stripe.subscriptions.list({ limit: 10, status: 'all' })
console.log(`\nSUBSCRIPTIONS (showing ${subs.data.length}):`)
for (const s of subs.data) console.log(`  ${s.id} — ${s.status} — ${s.customer} — ${s.items.data[0]?.price?.lookup_key || s.items.data[0]?.price?.id}`)

const sessions = await stripe.checkout.sessions.list({ limit: 10 })
console.log(`\nCHECKOUT SESSIONS (showing ${sessions.data.length}):`)
for (const s of sessions.data) console.log(`  ${s.id} — ${s.status}/${s.payment_status} — ${s.customer_email || s.customer || '(none)'} — ${new Date(s.created * 1000).toISOString().slice(0, 16)}`)

const charges = await stripe.charges.list({ limit: 10 })
console.log(`\nPAYMENTS/CHARGES (showing ${charges.data.length}):`)
for (const c of charges.data) console.log(`  ${c.id} — ${c.status} — $${(c.amount / 100).toFixed(2)} — ${c.billing_details?.email || c.customer || '(none)'} — ${new Date(c.created * 1000).toISOString().slice(0, 16)}`)

console.log('\n' + '='.repeat(60))
console.log('Done.')
process.exit(0)
