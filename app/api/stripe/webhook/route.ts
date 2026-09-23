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

    // What we had before this event, so the coach is alerted on the transition
    // rather than on every webhook Stripe sends for the same state.
    const { data: prior } = await db
      .from('subscriptions')
      .select('status, cancel_at_period_end')
      .eq('stripe_subscription_id', sub.id)
      .maybeSingle()
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

    // Tell the coach when billing breaks or someone cancels. Nothing previously
    // surfaced either — a client could lapse and be locked out of the studio
    // without anyone knowing to reach out.
    const nowCancelling = !!sub.cancel_at_period_end && !prior?.cancel_at_period_end
    const broke = (status === 'past_due' || status === 'unpaid') && prior?.status !== status
    const ended = status === 'canceled' && prior?.status !== 'canceled'
    if (nowCancelling || broke || ended) {
      try {
        const { data: u } = await db.from('users').select('name, email').eq('id', userId).maybeSingle()
        const { data: cs } = await db.from('coach_settings').select('email').limit(1).maybeSingle()
        const who = `${u?.name ?? 'A client'} (${u?.email ?? 'unknown'})`
        const what = ended
          ? 'cancelled — their access has ended'
          : broke
            ? 'has a failed payment — they are paused and locked out until the card is fixed'
            : 'has set their plan to cancel at the end of the period'
        const { sendMail } = await import('@/lib/email')
        await sendMail({
          to: (cs?.email as string) || 'anthony@ajmfit.com',
          replyTo: (u?.email as string) || undefined,
          subject: `Billing: ${u?.name ?? 'a client'} ${ended ? 'cancelled' : broke ? 'payment failed' : 'is cancelling'}`,
          text: `${who} ${what}.`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1B2D50">
            <p style="margin:0 0 10px"><strong>${who}</strong> ${what}.</p>
            <p style="color:#64748B;margin:0">Worth a message before they go quiet for good.</p>
          </div>`,
        })
      } catch (e) {
        console.error('[stripe webhook] billing alert failed', e)
      }
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

          // Blueprint direct checkout (guest, no application funnel): the buyer
          // has no account yet. Create/find the user from the checkout email,
          // record a placeholder accepted application (keeps tier resolution +
          // the coach dashboard coherent), send the set-password invite, and
          // backfill user_id so subscription events sync from here on.
          if (!sub.metadata?.user_id && session.metadata?.flow === 'blueprint_direct') {
            const email = session.customer_details?.email?.toLowerCase()
            if (email) {
              const name =
                session.customer_details?.name?.trim() || email.split('@')[0]
              let { data: user } = await db
                .from('users')
                .select('id, auth_id')
                .eq('email', email)
                .maybeSingle()
              if (!user) {
                const { data: created } = await db
                  .from('users')
                  .insert({ name, email, status: 'pending' })
                  .select('id, auth_id')
                  .single()
                user = created
              }
              if (user) {
                await db
                  .from('users')
                  .update({
                    stripe_customer_id:
                      typeof session.customer === 'string' ? session.customer : session.customer?.id,
                  })
                  .eq('id', user.id)

                // Placeholder application so /luffy and tier fallbacks work.
                const { data: existingApp } = await db
                  .from('applications')
                  .select('id')
                  .eq('user_id', user.id)
                  .limit(1)
                  .maybeSingle()
                if (!existingApp) {
                  await db.from('applications').insert({
                    user_id: user.id,
                    goals: 'Blueprint self-serve signup (direct checkout)',
                    equipment: [],
                    availability: 'Self-guided',
                    tier: 'blueprint',
                    billing_cycle: 'monthly',
                    status: 'accepted',
                    reviewed_at: new Date().toISOString(),
                  })
                }

                // Set-password invite (only if they have no login yet).
                if (!user.auth_id) {
                  try {
                    const origin = new URL(request.url).origin
                    await db.auth.admin.inviteUserByEmail(email, {
                      redirectTo: `${origin}/auth/callback`,
                    })
                  } catch (e) {
                    console.error('[stripe webhook] blueprint invite failed', e)
                  }
                }

                await stripe.subscriptions.update(sub.id, {
                  metadata: { ...sub.metadata, user_id: user.id },
                })
                sub.metadata = { ...sub.metadata, user_id: user.id }
              }
            }
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
