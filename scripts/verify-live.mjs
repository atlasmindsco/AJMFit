/**
 * Verifies live Stripe wiring WITHOUT charging:
 *  - live key resolves the 5 prices by lookup_key
 *  - a real Checkout Session can be created (the path /api/stripe/checkout uses)
 *  - the deployed webhook endpoint is live (400 bad-signature, not 404)
 * Run: node scripts/verify-live.mjs
 */
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const stripe = new Stripe(env.STRIPE_SECRET_KEY)
console.log(`mode: ${env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE' : 'TEST'}`)

const keys = ['blueprint_monthly', 'accelerator_monthly', 'accelerator_weekly', 'full-experience_monthly', 'full-experience_weekly']
for (const k of keys) {
  const p = (await stripe.prices.list({ lookup_keys: [k], limit: 1 })).data[0]
  console.log(p ? `  price ok: ${k} = $${(p.unit_amount / 100).toFixed(2)}/${p.recurring.interval}` : `  MISSING: ${k}`)
}

const price = (await stripe.prices.list({ lookup_keys: ['blueprint_monthly'], limit: 1 })).data[0]
const customer = await stripe.customers.create({ email: 'verify@ajmfit.com' })
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: customer.id,
  line_items: [{ price: price.id, quantity: 1 }],
  subscription_data: { trial_period_days: 7 },
  success_url: 'https://ajmfit.com/studio?subscribed=1',
  cancel_url: 'https://ajmfit.com/studio',
})
console.log(`checkout session: ${session.url?.startsWith('https://checkout.stripe.com') ? 'LIVE URL ok' : 'FAILED'}`)
console.log(`  ${session.url}`)
await stripe.customers.del(customer.id)

const res = await fetch('https://ajmfit.com/api/stripe/webhook', { method: 'POST', body: '{}' })
console.log(`webhook endpoint reachable: HTTP ${res.status} (expect 400 = live & verifying signatures; 404 = not deployed)`)
process.exit(0)
