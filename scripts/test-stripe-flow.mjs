/**
 * End-to-end Stripe test (TEST mode). Exercises:
 *  - Checkout Session creation (price lookup_key resolves, trial set)
 *  - a real trial subscription → fires the production webhook → DB sync
 * Then cleans up. Run: node scripts/test-stripe-flow.mjs
 */
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const stripe = new Stripe(env.STRIPE_SECRET_KEY)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EMAIL = 'shanmarric@gmail.com'

const { data: user } = await sb
  .from('users')
  .select('id,email,stripe_customer_id,status')
  .eq('email', EMAIL)
  .single()
console.log(`user ${user.id} | starting status: ${user.status}`)

// 1. Reset to pending so we can watch it flip to active.
await sb.from('users').update({ status: 'pending' }).eq('id', user.id)

// 2. Ensure a Stripe customer.
let customerId = user.stripe_customer_id
if (!customerId) {
  const c = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } })
  customerId = c.id
  await sb.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id)
}
console.log(`customer: ${customerId}`)

// 3. Resolve price by lookup_key (same path the route uses).
const price = (await stripe.prices.list({ lookup_keys: ['accelerator_monthly'], limit: 1 })).data[0]
console.log(`price: ${price.id} ($${(price.unit_amount / 100).toFixed(2)}/${price.recurring.interval})`)

// 4. Checkout Session (verifies the route's Stripe call works).
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: customerId,
  line_items: [{ price: price.id, quantity: 1 }],
  subscription_data: {
    trial_period_days: 7,
    metadata: { user_id: user.id, tier: 'accelerator', billing_cycle: 'monthly' },
  },
  success_url: 'https://ajmfit.com/studio?subscribed=1',
  cancel_url: 'https://ajmfit.com/studio',
})
console.log(`checkout session: ${session.url?.startsWith('https://') ? 'URL ok' : 'FAILED'}`)

// 5. Create a real trial subscription → fires the production webhook.
const sub = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: price.id }],
  trial_period_days: 7,
  metadata: { user_id: user.id, tier: 'accelerator', billing_cycle: 'monthly' },
  trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
})
console.log(`subscription created: ${sub.id} (${sub.status}) — waiting for webhook…`)

// 6. Poll the DB for the webhook to land.
let userStatus = null
let subRows = []
for (let i = 0; i < 12; i++) {
  await new Promise((r) => setTimeout(r, 2000))
  const u = await sb.from('users').select('status').eq('id', user.id).single()
  const s = await sb.from('subscriptions').select('stripe_subscription_id,status,tier,billing_cycle').eq('user_id', user.id)
  userStatus = u.data?.status
  subRows = s.data ?? []
  if (userStatus === 'active' && subRows.length) break
}
console.log('--- RESULT ---')
console.log(`users.status after webhook: ${userStatus} (expect: active)`)
console.log(`subscriptions rows: ${JSON.stringify(subRows)}`)

// 7. Cleanup.
await stripe.subscriptions.cancel(sub.id)
console.log('cleanup: test subscription canceled')
process.exit(0)
