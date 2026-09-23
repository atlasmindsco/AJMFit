import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/server'

export const runtime = 'nodejs'

/**
 * Opens the Stripe billing portal for the signed-in client.
 *
 * Subscriptions already renew indefinitely until cancelled — that is Stripe's
 * default for mode: 'subscription' — but there was no way for a client to
 * cancel, update a card or see an invoice without emailing Anthony. Worse, a
 * client whose payment failed was set to 'paused' and locked out of the
 * studio, and the only button they were offered started a brand new checkout,
 * which would have left them paying for two subscriptions.
 *
 * The portal is Stripe-hosted, so cancellation, card updates, invoices and the
 * dunning flow stay correct without being reimplemented here.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: dbUser } = await admin.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!dbUser) return NextResponse.json({ error: 'No account' }, { status: 404 })

  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', dbUser.id)
    .not('stripe_customer_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account yet.' }, { status: 404 })
  }

  const origin = new URL(request.url).origin
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id as string,
      return_url: `${origin}/studio`,
    })
    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[stripe portal] failed', e)
    return NextResponse.json({ error: 'Could not open billing. Try again.' }, { status: 502 })
  }
}
