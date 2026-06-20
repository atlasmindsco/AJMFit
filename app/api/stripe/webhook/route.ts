import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Stripe webhook. Verifies the signature, then mirrors subscription state into
 * the subscriptions table and flips users.status. Writes use the service-role
 * key (bypasses RLS).
 */
export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  const whsec = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !whsec) {
    return NextResponse.json({ error: 'Missing signature/secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, whsec)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any

  async function syncSubscription(sub: Stripe.Subscription) {
    const userId = sub.metadata?.user_id
    if (!userId) return

    const status = sub.status // trialing | active | past_due | canceled | unpaid | incomplete...
    // In current Stripe API versions the period boundary lives on the subscription item.
    const item = sub.items?.data?.[0] as
      | { current_period_end?: number }
      | undefined
    const periodEnd = item?.current_period_end ?? null
    await db.from('subscriptions').upsert(
      {
        user_id: userId,
        stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
        stripe_subscription_id: sub.id,
        tier: sub.metadata?.tier ?? null,
        billing_cycle: sub.metadata?.billing_cycle ?? null,
        status,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        cancel_at_period_end: !!sub.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_subscription_id' }
    )

    // Map Stripe status → app user status.
    const userStatus =
      status === 'active' || status === 'trialing'
        ? 'active'
        : status === 'past_due' || status === 'unpaid'
          ? 'paused'
          : status === 'canceled'
            ? 'cancelled'
            : null
    if (userStatus) {
      await db.from('users').update({ status: userStatus }).eq('id', userId)
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.subscription) {
          const subId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id
          const sub = await stripe.subscriptions.retrieve(subId)
          // Backfill user_id onto the subscription if missing.
          if (!sub.metadata?.user_id && session.client_reference_id) {
            await stripe.subscriptions.update(sub.id, {
              metadata: { ...sub.metadata, user_id: session.client_reference_id },
            })
            sub.metadata = { ...sub.metadata, user_id: session.client_reference_id }
          }
          await syncSubscription(sub)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object as Stripe.Subscription)
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error('[stripe webhook] handler error:', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
