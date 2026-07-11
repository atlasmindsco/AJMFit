import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail, approvalEmailHTML } from '@/lib/email'

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

  // 2. Resolve the target user's email. `approval: true` (set only by the
  //    Accept flow, not by Resend invite) also sends the branded "you're
  //    approved, here are your next steps" email with the onboarding links.
  let userId: string
  let isApproval = false
  try {
    const body = (await request.json()) as { userId?: string; approval?: boolean }
    if (!body.userId) throw new Error('missing userId')
    userId = body.userId
    isApproval = body.approval === true
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: target, error: lookupErr } = await admin
    .from('users')
    .select('email, auth_id, name')
    .eq('id', userId)
    .single<{ email: string; auth_id: string | null; name: string | null }>()

  if (lookupErr || !target) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const origin = new URL(request.url).origin

  // Already has an auth account: a second invite is impossible, but the
  // trainer's intent is "get them a working set-password link", so send the
  // branded password-recovery email instead of silently no-oping. This makes
  // "Resend invite" work for lost/expired invite links.
  const sendRecovery = async (): Promise<boolean> => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: target.email,
        options: { redirect_to: `${origin}/auth/callback?next=/members/reset` },
      }),
    })
    return res.ok
  }

  // On approval, also send the branded welcome/next-steps email (with the
  // onboarding form + call booking links). Best-effort: the invite is the
  // critical path.
  const sendApprovalEmail = async () => {
    if (!isApproval) return
    try {
      const firstName = String(target.name || '').trim().split(/\s+/)[0]
      await sendMail({
        to: target.email,
        replyTo: 'anthony@ajmfit.com',
        subject: "You're approved! Here's how to get started",
        html: approvalEmailHTML({ firstName }),
      })
    } catch (e) {
      console.error('[invite] approval email failed', e)
    }
  }

  if (target.auth_id) {
    const sent = await sendRecovery()
    if (sent) await sendApprovalEmail()
    return sent
      ? NextResponse.json({ ok: true, resent: true })
      : NextResponse.json({ error: 'Could not send the reset link. Try again.' }, { status: 502 })
  }

  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    target.email,
    { redirectTo: `${origin}/auth/callback?next=/members/reset` }
  )

  if (inviteErr) {
    // Auth user exists but the users row wasn't linked yet, fall back to recovery.
    if (/already/i.test(inviteErr.message)) {
      const sent = await sendRecovery()
      if (sent) await sendApprovalEmail()
      return sent
        ? NextResponse.json({ ok: true, resent: true })
        : NextResponse.json({ error: 'Could not send the reset link. Try again.' }, { status: 502 })
    }
    return NextResponse.json({ error: inviteErr.message }, { status: 500 })
  }

  await sendApprovalEmail()
  return NextResponse.json({ ok: true })
}
