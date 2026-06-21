/**
 * Creates (or reuses) the live Stripe webhook endpoint for production and
 * prints the signing secret. Run: node scripts/create-webhook.mjs
 */
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const stripe = new Stripe(env.STRIPE_SECRET_KEY)
const URL_ = 'https://ajmfit.com/api/stripe/webhook'
const EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]

const existing = (await stripe.webhookEndpoints.list({ limit: 100 })).data.find((w) => w.url === URL_)
if (existing) {
  console.log(`Endpoint already exists: ${existing.id}`)
  console.log('Secret is only shown at creation. Delete + recreate if you need it, or read it from the dashboard.')
  process.exit(0)
}
const wh = await stripe.webhookEndpoints.create({ url: URL_, enabled_events: EVENTS })
console.log(`Created: ${wh.id}`)
console.log(`URL: ${wh.url}`)
console.log(`SIGNING SECRET: ${wh.secret}`)
process.exit(0)
