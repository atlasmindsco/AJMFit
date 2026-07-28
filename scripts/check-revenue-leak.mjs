/** Checks each live subscription for discounts (ZEROOUT) + identifies customers. */
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim()
}
const stripe = new Stripe(env.STRIPE_SECRET_KEY)
const subs = await stripe.subscriptions.list({ limit: 10, status: 'all', expand: ['data.customer', 'data.discounts'] })
for (const s of subs.data) {
  const cust = typeof s.customer === 'object' ? s.customer : { email: s.customer }
  const disc = (s.discounts ?? [])
    .map((d) => (typeof d === 'object' && d?.coupon ? `${d.coupon.name ?? d.coupon.id} (${d.coupon.percent_off}% off, duration=${d.coupon.duration})` : String(d)))
    .join('; ')
  console.log(`${s.id} | ${s.status} | ${cust.email} | trial_end=${s.trial_end ? new Date(s.trial_end * 1000).toISOString().slice(0, 10) : '-'} | discount: ${disc || 'NONE'}`)
}
const invoices = await stripe.invoices.list({ limit: 10 })
console.log('\nInvoices:')
for (const inv of invoices.data) {
  console.log(`  ${inv.id} | ${inv.status} | total $${(inv.total / 100).toFixed(2)} | paid $${(inv.amount_paid / 100).toFixed(2)} | ${inv.customer_email}`)
}
process.exit(0)
