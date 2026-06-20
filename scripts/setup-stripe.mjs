/**
 * Reconciles the AJM FIT Stripe catalog to the desired prices below. Run any
 * time pricing changes:  node scripts/setup-stripe.mjs
 *
 * For each tier/cycle: creates the price if missing, leaves it alone if the
 * amount matches, or (since Stripe prices are immutable) creates a new price and
 * moves the lookup_key onto it + archives the old one when the amount changed.
 * Tiers with `weekly: null` are monthly-only — any existing weekly is archived.
 *
 * Prices are addressed everywhere by lookup_key `<tier>_<cycle>`.
 */
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const stripe = new Stripe(env.STRIPE_SECRET_KEY)

// amounts in cents; weekly: null => monthly-only
const TIERS = [
  { id: 'blueprint',       name: 'The Blueprint',       monthly: 1997,  weekly: null },
  { id: 'accelerator',     name: 'The Accelerator',     monthly: 39700, weekly: 10000 },
  { id: 'full-experience', name: 'The Full Experience', monthly: 69700, weekly: 17500 },
]

async function priceByLookup(key) {
  return (await stripe.prices.list({ lookup_keys: [key], limit: 1 })).data[0]
}

for (const tier of TIERS) {
  const products = await stripe.products.list({ limit: 100, active: true })
  let product = products.data.find((p) => p.metadata?.ajmfit_tier === tier.id)
  if (!product) {
    product = await stripe.products.create({ name: tier.name, metadata: { ajmfit_tier: tier.id } })
    console.log(`product created: ${tier.name} (${product.id})`)
  }

  for (const cycle of ['monthly', 'weekly']) {
    const lookup_key = `${tier.id}_${cycle}`
    const desired = cycle === 'monthly' ? tier.monthly : tier.weekly
    const existing = await priceByLookup(lookup_key)

    if (desired == null) {
      if (existing) {
        await stripe.prices.update(existing.id, { active: false })
        console.log(`  archived ${lookup_key} ($${existing.unit_amount / 100}) — monthly-only tier`)
      }
      continue
    }
    if (existing && existing.unit_amount === desired) {
      console.log(`  ok ${lookup_key} = $${desired / 100}`)
      continue
    }
    const price = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: desired,
      recurring: { interval: cycle === 'monthly' ? 'month' : 'week' },
      lookup_key,
      transfer_lookup_key: !!existing,
      metadata: { ajmfit_tier: tier.id, ajmfit_cycle: cycle },
    })
    if (existing) {
      await stripe.prices.update(existing.id, { active: false })
      console.log(`  updated ${lookup_key}: $${existing.unit_amount / 100} → $${desired / 100} (${price.id})`)
    } else {
      console.log(`  created ${lookup_key} = $${desired / 100} (${price.id})`)
    }
  }
}

console.log('Stripe catalog reconciled.')
process.exit(0)
