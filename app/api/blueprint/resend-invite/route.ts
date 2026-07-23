import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Re-sends the set-password email for a completed Blueprint direct checkout.
 * Public but safe: it only acts on a REAL paid blueprint_direct Checkout
 * Session id (unguessable), only emails that session's own email address, and
 * sends either an invite (no login yet) or a password reset (login exists).
 */
export async function POST(request: Request) {
  let sessionId: string
  try {
    const body = (await request.json()) as { session_id?: string }
    if (!body.session_id || !/^cs_(live|test)_[A-Za-z0-9]+$/.test(body.session_id)) {
      throw new Error('bad id')
    }
    sessionId = body.session_id
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch {
    return NextResponse.json({ error: 'Unknown checkout session' }, { status: 404 })
  }
  const paid = session.status === 'complete'
  const isBlueprint = session.metadata?.flow === 'blueprint_direct'
  const email = session.customer_details?.email?.toLowerCase()
  if (!paid || !isBlueprint || !email) {
    return NextResponse.json({ error: 'This checkout has no account attached.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const origin = new URL(request.url).origin
  const redirectTo = `${origin}/auth/callback?next=/members/reset`

  const { data: user } = await admin
    .from('users')
    .select('id, auth_id')
    .eq('email', email)
    .maybeSingle()

  try {
    if (user?.auth_id) {
      // Login exists: branded password-reset gets them in.
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, options: { redirect_to: redirectTo } }),
      })
      if (!res.ok) throw new Error(`recover ${res.status}`)
    } else {
      const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
      if (error && !/already/i.test(error.message)) throw error
      if (error) {
        // Auth user exists but not linked: fall back to recovery.
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/recover`, {
          method: 'POST',
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, options: { redirect_to: redirectTo } }),
        })
      }
    }
  } catch (e) {
    console.error('[blueprint resend] failed', e)
    return NextResponse.json({ error: 'Could not send the email. Try again in a minute.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, email })
}
