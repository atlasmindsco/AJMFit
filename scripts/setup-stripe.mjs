/**
 * Idempotently creates the AJM FIT Stripe catalog: one product per tier, with a
 * monthly + weekly recurring price each, addressable by lookup_key
 * (`<tier>_<cycle>`). Re-running reuses anything that already exists.
 *
 *   node scripts/setup-stripe.mjs
 *
 * Reads STRIPE_SECRET_KEY from .env.local.
 */
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const key = env.STRIPE_SECRET_KEY
if (!key) { console.error('STRIPE_SECRET_KEY missing in .env.local'); process.exit(1) }

const stripe = new Stripe(key)

// amounts in cents; weekly = ceil(monthly/4) to match the site
const TIERS = [
  { id: 'blueprint',       name: 'The Blueprint',       monthly: 29700, weekly: 7500 },
  { id: 'accelerator',     name: 'The Accelerator',     monthly: 49700, weekly: 12500 },
  { id: 'full-experience', name: 'The Full Experience', monthly: 69700, weekly: 17500 },
]

for (const tier of TIERS) {
  // find or create the product (matched by metadata.ajmfit_tier)
  const products = await stripe.products.list({ limit: 100, active: true })
  let product = products.data.find((p) => p.metadata?.ajmfit_tier === tier.id)
  if (!product) {
    product = await stripe.products.create({
      name: tier.name,
      metadata: { ajmfit_tier: tier.id },
    })
    console.log(`product created: ${tier.name} (${product.id})`)
  } else {
    console.log(`product exists:  ${tier.name} (${product.id})`)
  }

  for (const cycle of ['monthly', 'weekly']) {
    const lookup_key = `${tier.id}_${cycle}`
    const existing = await stripe.prices.list({ lookup_keys: [lookup_key], limit: 1 })
    if (existing.data[0]) {
      console.log(`  price exists:  ${lookup_key} (${existing.data[0].id})`)
      continue
    }
    const price = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: cycle === 'monthly' ? tier.monthly : tier.weekly,
      recurring: { interval: cycle === 'monthly' ? 'month' : 'week' },
      lookup_key,
      metadata: { ajmfit_tier: tier.id, ajmfit_cycle: cycle },
    })
    console.log(`  price created: ${lookup_key} (${price.id})`)
  }
}

console.log('Stripe catalog ready.')
process.exit(0)
