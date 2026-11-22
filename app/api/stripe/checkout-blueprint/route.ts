import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { BILLABLE } from '@/lib/duplicate-subs'

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

  /**
   * Already paying? Then this link is not for them.
   *
   * This route creates a GUEST Stripe session — no customer, no signed-in
   * user, no check — so clicking it twice produced two Stripe customers and
   * two live subscriptions, and nothing noticed. Ruth Fleurime ended up with
   * three across two accounts and Luis with two.
   *
   * A visitor with no session falls straight through, because the common case
   * is somebody buying for the first time and adding friction to that to stop
   * a rare double-click would be the wrong trade. The guard only fires for
   * somebody the cookie says is already signed in and already paying.
   *
   * Nothing here cancels, refunds or changes a subscription. It can only
   * decline to start a new one.
   */
  const signedIn = await (async () => {
    try {
      const supabase = createServerClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null
      const admin = createAdminClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = admin as any
      const { data: row } = await db
        .from('users')
        .select('id, email')
        .eq('auth_id', user.id)
        .maybeSingle()
      if (!row?.id) return null
      const { data: subs } = await db
        .from('subscriptions')
        .select('status, stripe_subscription_id')
        .eq('user_id', row.id)
      const live = (subs ?? []).filter(
        (r: { status: string | null; stripe_subscription_id: string | null }) =>
          r.stripe_subscription_id && BILLABLE.indexOf(String(r.status)) !== -1
      )
      return { id: row.id as string, email: row.email as string | null, live: live.length }
    } catch {
      // Never let the check stop somebody buying. A failed lookup falls
      // through to the normal path.
      return null
    }
  })()

  if (signedIn && signedIn.live > 0) {
    return NextResponse.redirect(`${origin}/studio?already=1`, 303)
  }

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
    // A signed-in buyer without a live subscription — somebody whose payment
    // lapsed, say — is attached to the account they already have. Without
    // this the webhook matches on the checkout email alone, and a different
    // address becomes a second person: that is how Ruth ended up with two.
    ...(signedIn
      ? {
          client_reference_id: signedIn.id,
          ...(signedIn.email ? { customer_email: signedIn.email } : {}),
        }
      : {}),
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
