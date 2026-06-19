import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Sends a "set your password" invite to an approved client. Trainer-only.
 * The invite link routes through /auth/callback, which establishes a session
 * and forwards to the set-password page. An auth user is created here; the DB
 * trigger links it to the existing public.users row by email.
 */
export async function POST(request: Request) {
  // 1. Authorize: caller must be the trainer.
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const role = (user?.app_metadata as { role?: string } | undefined)?.role
  if (!user || role !== 'trainer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Resolve the target user's email.
  let userId: string
  try {
    const body = (await request.json()) as { userId?: string }
    if (!body.userId) throw new Error('missing userId')
    userId = body.userId
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: target, error: lookupErr } = await admin
    .from('users')
    .select('email, auth_id')
    .eq('id', userId)
    .single<{ email: string; auth_id: string | null }>()

  if (lookupErr || !target) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Already has an auth account → nothing to send.
  if (target.auth_id) {
    return NextResponse.json({ ok: true, alreadyInvited: true })
  }

  const origin = new URL(request.url).origin
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    target.email,
    { redirectTo: `${origin}/auth/callback?next=/members/reset` }
  )

  if (inviteErr) {
    // If the auth user already exists, treat as success (they can log in / reset).
    if (/already/i.test(inviteErr.message)) {
      return NextResponse.json({ ok: true, alreadyInvited: true })
    }
    return NextResponse.json({ error: inviteErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
