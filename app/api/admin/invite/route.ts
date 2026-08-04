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

  // Send approval email with login credentials (no expiring links)
  const sendApprovalEmail = async (tempPassword?: string): Promise<boolean> => {
    try {
      const firstName = String(target.name || '').trim().split(/\s+/)[0]
      await sendMail({
        to: target.email,
        replyTo: 'anthony@ajmfit.com',
        subject: "You're approved! Here's how to get started",
        html: approvalEmailHTML({ firstName, tempPassword, email: target.email }),
      })
      return true
    } catch (e) {
      console.error('[invite] approval email failed', e)
      return false
    }
  }

  // Existing auth account (this is the "Resend invite" path): an email with
  // no credentials would leave them just as locked out, so set a FRESH
  // temporary password and include it. Their old password stops working,
  // which is exactly what someone who lost access needs.
  if (target.auth_id) {
    const tempPassword = `AJM${Math.random().toString(36).substring(2, 11).toUpperCase()}`
    const { error: pwErr } = await admin.auth.admin.updateUserById(target.auth_id, {
      password: tempPassword,
    })
    if (pwErr) {
      return NextResponse.json({ error: 'Could not reset their access. Try again.' }, { status: 502 })
    }
    const sent = await sendApprovalEmail(tempPassword)
    return sent
      ? NextResponse.json({ ok: true, resent: true })
      : NextResponse.json({ error: 'Could not send approval email. Try again.' }, { status: 502 })
  }

  // Create new auth account with temporary password (no expiring invite links)
  try {
    const tempPassword = `AJM${Math.random().toString(36).substring(2, 11).toUpperCase()}`

    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: target.email,
      password: tempPassword,
      email_confirm: true, // Confirm email immediately
    })

    if (authErr) {
      // Auth user exists but wasn't linked yet: find them by email, set a
      // fresh temp password, link, and send credentials (an email without a
      // password would leave them locked out).
      if (/already/i.test(authErr.message)) {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const existing = list?.users?.find(
          (u: { email?: string }) => u.email?.toLowerCase() === target.email.toLowerCase()
        )
        if (!existing) {
          return NextResponse.json({ error: 'Account exists but could not be found. Try again.' }, { status: 500 })
        }
        const { error: pwErr } = await admin.auth.admin.updateUserById(existing.id, {
          password: tempPassword,
        })
        if (pwErr) {
          return NextResponse.json({ error: 'Could not reset their access. Try again.' }, { status: 502 })
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from('users').update({ auth_id: existing.id }).eq('id', userId)
        const sent = await sendApprovalEmail(tempPassword)
        return sent
          ? NextResponse.json({ ok: true, resent: true })
          : NextResponse.json({ error: 'Could not send approval email. Try again.' }, { status: 502 })
      }
      return NextResponse.json({ error: authErr.message }, { status: 500 })
    }

    if (authUser?.user?.id) {
      // Link the auth account to the user
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('users').update({ auth_id: authUser.user.id }).eq('id', userId)

      // Send approval email with credentials
      await sendApprovalEmail(tempPassword)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[invite] create auth failed', e)
    return NextResponse.json({ error: 'Could not create account. Try again.' }, { status: 500 })
  }
}
