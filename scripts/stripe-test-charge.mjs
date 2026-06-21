/**
 * Produces a REAL paid transaction in Stripe TEST mode so a charge is
 * visible in the dashboard (the normal flow uses a 7-day trial = $0 upfront).
 * Attaches a test Visa, creates a no-trial subscription -> immediate invoice
 * + charge, prints the result, then cancels to clean up.
 * Run: node scripts/stripe-test-charge.mjs
 */
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const key = env.STRIPE_SECRET_KEY || ''
if (!key.startsWith('sk_test')) { console.error('Refusing: key is not TEST mode.'); process.exit(1) }
const stripe = new Stripe(key)

const EMAIL = 'shanmarric@gmail.com'
const customer = (await stripe.customers.list({ email: EMAIL, limit: 1 })).data[0]
  || (await stripe.customers.create({ email: EMAIL }))
console.log(`customer: ${customer.id}`)

// Attach a test card and make it the default.
const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id })
await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } })

const price = (await stripe.prices.list({ lookup_keys: ['blueprint_monthly'], limit: 1 })).data[0]
console.log(`price: ${price.lookup_key} $${(price.unit_amount / 100).toFixed(2)}/${price.recurring.interval}`)

// No trial -> bills immediately.
const sub = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: price.id }],
  default_payment_method: pm.id,
  expand: ['latest_invoice.charge'],
  metadata: { test_charge: 'true' },
})
const inv = sub.latest_invoice
const charge = inv?.charge
console.log('--- RESULT ---')
console.log(`subscription: ${sub.id} (${sub.status})`)
console.log(`invoice: ${inv?.id} — ${inv?.status} — $${(inv?.amount_paid / 100).toFixed(2)}`)
console.log(`charge: ${charge?.id} — ${charge?.status} — $${(charge?.amount / 100).toFixed(2)} — ${charge?.payment_method_details?.card?.brand} ****${charge?.payment_method_details?.card?.last4}`)

// Clean up so we don't leave a billing sub running.
await stripe.subscriptions.cancel(sub.id)
console.log('cleanup: subscription canceled (the paid charge stays visible in the dashboard)')
process.exit(0)
