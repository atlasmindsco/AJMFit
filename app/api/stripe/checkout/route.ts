import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/server'
import { priceLookupKey, TRIAL_DAYS, type Tier, type Cycle } from '@/lib/stripe/catalog'

export const runtime = 'nodejs'

/**
 * Creates a Stripe Checkout Session (subscription, 7-day trial) for the
 * logged-in client, using the tier + billing cycle from their application.
 * Returns { url } for the browser to redirect to.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any

  const { data: dbUser } = await db
    .from('users')
    .select('id,email,status,stripe_customer_id')
    .eq('auth_id', user.id)
    .single()
  if (!dbUser) return NextResponse.json({ error: 'No account found' }, { status: 404 })
  if (dbUser.status === 'active') {
    return NextResponse.json({ error: 'You already have an active membership.' }, { status: 400 })
  }

  const { data: app } = await db
    .from('applications')
    .select('tier,billing_cycle')
    .eq('user_id', dbUser.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (!app) return NextResponse.json({ error: 'No application on file.' }, { status: 400 })

  const cycle: Cycle = app.billing_cycle === 'weekly' ? 'weekly' : 'monthly'
  const lookup = priceLookupKey(app.tier as Tier, cycle)
  const prices = await stripe.prices.list({ lookup_keys: [lookup], limit: 1 })
  const price = prices.data[0]
  if (!price) return NextResponse.json({ error: 'Plan not configured.' }, { status: 500 })

  // Ensure a Stripe customer exists for this user.
  let customerId: string | null = dbUser.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: dbUser.email,
      metadata: { user_id: dbUser.id },
    })
    customerId = customer.id
    await db.from('users').update({ stripe_customer_id: customerId }).eq('id', dbUser.id)
  }

  const origin = new URL(request.url).origin
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: price.id, quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { user_id: dbUser.id, tier: app.tier, billing_cycle: cycle },
    },
    client_reference_id: dbUser.id,
    allow_promotion_codes: true,
    success_url: `${origin}/studio?subscribed=1`,
    cancel_url: `${origin}/studio?canceled=1`,
  })

  return NextResponse.json({ url: session.url })
}
