import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'

export const runtime = 'nodejs'

/**
 * Blueprint direct checkout: the $19.97 self-serve tier skips the application
 * funnel entirely. A visitor clicks "Start Now" on the pricing card and lands
 * straight in Stripe Checkout (guest, email collected there, 7-day trial).
 * The webhook (checkout.session.completed, flow=blueprint_direct) then creates
 * their account and emails the set-password invite.
 *
 * GET so the pricing card can be a plain link. A stray hit just creates an
 * unpaid Checkout Session that expires on its own.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin

  const price = (
    await stripe.prices.list({ lookup_keys: ['blueprint_monthly'], limit: 1 })
  ).data[0]
  if (!price) {
    return NextResponse.redirect(`${origin}/?checkout=unavailable`, 303)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: price.id, quantity: 1 }],
    // Shows the "Add promotion code" box at checkout. Codes are distributed
    // privately by the coach; nothing on the site advertises them.
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: 7,
      metadata: { tier: 'blueprint', billing_cycle: 'monthly', flow: 'blueprint_direct' },
    },
    metadata: { flow: 'blueprint_direct' },
    success_url: `${origin}/blueprint/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/work-with-me`,
  })

  if (!session.url) {
    return NextResponse.redirect(`${origin}/?checkout=unavailable`, 303)
  }
  return NextResponse.redirect(session.url, 303)
}
