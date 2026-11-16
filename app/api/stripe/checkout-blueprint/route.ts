import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Crawlers, previewers and scanners, by the names they put in a user agent.
 *
 * 185 checkout sessions have been created and 15 paid, and nothing anywhere
 * records who the other 170 were. Stripe writes nothing to an abandoned
 * session, so "92% abandon" currently has no story attached and every
 * explanation for it is a guess. This is the cheapest thing that distinguishes
 * a person from a robot.
 *
 * robots.txt already disallows /api/, which stops the polite ones. Link
 * previewers — Slack, Discord, WhatsApp, iMessage — mostly do not read it,
 * and every one that follows this link mints a live Stripe session.
 */
const BOT_WORDS = [
  'bot', 'crawler', 'spider', 'slurp', 'scrape',
  'preview', 'fetcher', 'monitor', 'scanner', 'probe',
  'curl', 'wget', 'python-requests', 'httpclient', 'headless',
  'slack', 'discord', 'whatsapp', 'telegram', 'facebookexternalhit',
  'twitterbot', 'linkedinbot', 'embedly', 'pingdom', 'uptime',
  'lighthouse', 'gtmetrix', 'ahrefs', 'semrush',
]

function looksLikeBot(ua: string): boolean {
  const s = ua.toLowerCase()
  if (!s.trim()) return true // no user agent at all is not a browser
  return BOT_WORDS.some((w) => s.includes(w))
}

/**
 * Record the click. Best-effort and never in the way: a logging failure must
 * not stop someone buying, so this swallows everything and returns.
 */
async function logAttempt(request: Request, stripeSessionId: string | null): Promise<void> {
  try {
    const ua = request.headers.get('user-agent') ?? ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    await admin.from('checkout_attempts').insert({
      stripe_session_id: stripeSessionId,
      flow: 'blueprint_direct',
      user_agent: ua.slice(0, 500),
      referer: (request.headers.get('referer') ?? '').slice(0, 500),
      looks_like_bot: looksLikeBot(ua),
    })
  } catch {
    // Measurement is never worth a lost sale.
  }
}

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

  // Logged after the session exists so the row carries its id, which is what
  // lets a later report join these hits to who actually paid. Awaited rather
  // than fired and forgotten: a serverless function can be frozen the moment
  // it returns, and a dropped insert would leave exactly the blind spot this
  // is here to remove.
  await logAttempt(request, session.id)

  if (!session.url) {
    return NextResponse.redirect(`${origin}/?checkout=unavailable`, 303)
  }
  return NextResponse.redirect(session.url, 303)
}
