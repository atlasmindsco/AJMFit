import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Set a Blueprint password straight after checkout, with no emailed link.
 *
 * The old flow was: pay → Stripe sends you back → "check your inbox" → find
 * the mail (or don't) → click → set a password → sign in. Of thirteen
 * Blueprint buyers, one never completed it at all and is still paying for an
 * account they have never opened, and three others took between one and
 * twenty-one days to get in. Every one of those days is someone who bought a
 * training program and could not train.
 *
 * So the welcome page asks for a password itself and this route sets it.
 *
 * WHAT PROVES THEY ARE ALLOWED TO
 *
 * The Stripe Checkout Session id, which Stripe put in the return URL and
 * nobody else knows. We re-fetch it here — never trusting what the browser
 * says about it — and require that it is genuinely paid and genuinely one of
 * ours. That id is the bearer token for this one action, so it is fenced
 * three ways:
 *
 *   1. The session must be complete and carry our blueprint_direct flow.
 *   2. It must be less than 24 hours old. Long enough for a tab left open
 *      overnight, short enough that a URL sitting in someone's history or a
 *      shared screenshot goes stale.
 *   3. The account must never have been signed into. This is the important
 *      one: it means the worst a leaked session id can do is set the first
 *      password on an account that has never been used. It can never take
 *      over a live account, which is the attack that would actually matter.
 *
 * Anyone who closes the tab still gets in the old way — the webhook's invite
 * email is untouched and remains the fallback.
 */

/** How long after paying the return URL can still set the first password. */
const CLAIM_WINDOW_SECONDS = 24 * 60 * 60

const SESSION_ID = /^cs_(live|test)_[A-Za-z0-9]+$/

export async function POST(request: Request) {
  let sessionId: string
  let password: string
  try {
    const body = (await request.json()) as { sessionId?: string; password?: string }
    sessionId = String(body.sessionId ?? '')
    password = String(body.password ?? '')
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (!SESSION_ID.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  // Matches the rule on the set-password page, so the two never disagree.
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  // 1. Is this a real, paid, recent Blueprint checkout?
  let email: string | null = null
  let name: string | null = null
  let customerId: string | null = null
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.status !== 'complete') {
      return NextResponse.json({ error: 'That checkout is not complete.' }, { status: 403 })
    }
    if (session.metadata?.flow !== 'blueprint_direct') {
      return NextResponse.json({ error: 'That checkout is not a Blueprint signup.' }, { status: 403 })
    }
    if (session.created && Date.now() / 1000 - session.created > CLAIM_WINDOW_SECONDS) {
      return NextResponse.json(
        { error: 'This link has expired. Check your email for the sign-in link, or write anthony@ajmfit.com.' },
        { status: 403 }
      )
    }
    email = session.customer_details?.email?.toLowerCase() ?? null
    name = session.customer_details?.name?.trim() || null
    customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
  } catch {
    return NextResponse.json({ error: 'Could not verify your purchase. Try again.' }, { status: 502 })
  }

  if (!email) {
    return NextResponse.json({ error: 'That checkout has no email on it.' }, { status: 422 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // 2. The app-level user row. Normally the webhook made it moments ago, but
  //    the browser can beat the webhook back, and someone who has paid should
  //    never be told to wait for a background job.
  let { data: user } = await admin
    .from('users')
    .select('id, auth_id')
    .eq('email', email)
    .maybeSingle()

  if (!user) {
    const { data: created, error: createErr } = await admin
      .from('users')
      .insert({ name: name || email.split('@')[0], email, status: 'pending' })
      .select('id, auth_id')
      .single()
    if (createErr || !created) {
      return NextResponse.json({ error: 'Could not set up your account. Try again.' }, { status: 500 })
    }
    user = created
  }

  if (customerId) {
    await admin.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  // 3. The auth account. It may already exist from the webhook's invite — an
  //    invited account that has never been signed into, which is exactly what
  //    we are allowed to finish setting up.
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = (list?.users ?? []).find(
    (u: { email?: string }) => u.email?.toLowerCase() === email
  ) as { id: string; last_sign_in_at?: string | null } | undefined

  if (existing) {
    // The fence that matters. Someone who has signed in has a password they
    // chose; a checkout id must never be able to replace it.
    if (existing.last_sign_in_at) {
      return NextResponse.json(
        { error: 'This account already has a password. Sign in instead, or reset it from the sign-in page.' },
        { status: 409 }
      )
    }
    const { error: pwErr } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    })
    if (pwErr) {
      return NextResponse.json({ error: 'Could not set your password. Try again.' }, { status: 500 })
    }
    await admin.from('users').update({ auth_id: existing.id }).eq('id', user.id)
    return NextResponse.json({ ok: true, email })
  }

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authErr || !authUser?.user?.id) {
    return NextResponse.json({ error: 'Could not create your login. Try again.' }, { status: 500 })
  }
  await admin.from('users').update({ auth_id: authUser.user.id }).eq('id', user.id)

  return NextResponse.json({ ok: true, email })
}
