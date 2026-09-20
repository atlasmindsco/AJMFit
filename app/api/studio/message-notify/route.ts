import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail } from '@/lib/email'

export const runtime = 'nodejs'

const FALLBACK_COACH_EMAIL = 'anthony@ajmfit.com'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Emails the coach when a client sends a message. Fired from the client's
 * message composer after the message is saved.
 *
 * Only notifies on the FIRST unread message in a thread: a client typing three
 * messages in a row produces one email, and the next one is sent only after the
 * coach opens the thread (which clears read_at via markThreadRead). Best-effort
 * throughout — a mail failure must never break the client's send.
 */
export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: dbUser } = await admin
    .from('users')
    .select('id, name, email')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!dbUser) return NextResponse.json({ error: 'No account' }, { status: 404 })

  // Single-coach business, so there is at most one coach_settings row. Missing
  // row means never-saved settings, which defaults to notifying.
  const { data: settings } = await admin
    .from('coach_settings')
    .select('email, notify_new_message')
    .limit(1)
    .maybeSingle()
  if (settings && settings.notify_new_message === false) {
    return NextResponse.json({ ok: true, skipped: 'notifications off' })
  }

  const { count } = await admin
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', dbUser.id)
    .eq('from_trainer', false)
    .is('read_at', null)
  if ((count ?? 0) > 1) {
    return NextResponse.json({ ok: true, skipped: 'already notified' })
  }

  const { data: latest } = await admin
    .from('messages')
    .select('body, created_at')
    .eq('user_id', dbUser.id)
    .eq('from_trainer', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const name = (dbUser.name as string) || 'A client'
  const body = String(latest?.body ?? '').slice(0, 500)

  try {
    await sendMail({
      to: (settings?.email as string) || FALLBACK_COACH_EMAIL,
      replyTo: (dbUser.email as string) || undefined,
      subject: `New message from ${name}`,
      text: `${name} sent you a message:\n\n${body}\n\nReply at https://ajmfit.com/luffy/messages`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1B2D50">
        <p style="font-size:18px;margin:0 0 12px"><strong>${escapeHtml(name)}</strong> sent you a message:</p>
        <blockquote style="margin:0 0 16px;padding:12px 16px;background:#F1F5F9;border-left:3px solid #1B2D50;white-space:pre-wrap">${escapeHtml(
          body
        )}</blockquote>
        <p style="margin:0"><a href="https://ajmfit.com/luffy/messages" style="color:#1A7BFF">Reply in the portal</a>, or just reply to this email.</p>
      </div>`,
    })
  } catch (e) {
    console.error('[message-notify] email failed', e)
  }

  return NextResponse.json({ ok: true })
}
