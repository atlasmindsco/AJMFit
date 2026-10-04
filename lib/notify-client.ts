/**
 * Telling a client something, once.
 *
 * Every automated path in this app points at the coach. The client is emailed
 * when they apply, when they book a session, when they reset a password and
 * when they set a lifting record — and that is the complete list. In
 * particular, a coach can write a considered reply to a check-in and the client
 * finds out by happening to open the Messages tab, which makes real coaching
 * work look like no work at all.
 *
 * Server-only: uses the service-role client and the mail transport.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail } from '@/lib/email'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const SITE = 'https://ajmfit.com'

export type NotifyKind = 'coach_reply' | 'check_in_reply' | 'quiet_4d' | 'quiet_7d' | 'check_in_due'

/**
 * Record that something was sent, and refuse to send it twice.
 *
 * `occurrenceKey` groups a repeating notification into one spell — for the
 * quiet ladder it is the date of the last logged workout, so the day-4 nudge
 * fires once per spell of inactivity rather than every day from day four
 * onward, which is how a helpful nudge becomes the reason someone turns
 * notifications off.
 *
 * A unique index enforces it in the database rather than here, because this
 * code will eventually be called from somewhere that forgets to check.
 */
async function claim(
  userId: string,
  kind: NotifyKind,
  channel: 'email' | 'push' | 'in_app',
  occurrenceKey: string | null
): Promise<boolean> {
  if (!occurrenceKey) return true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { error } = await admin
    .from('notifications_sent')
    .insert({ user_id: userId, kind, channel, occurrence_key: occurrenceKey })
  // A duplicate-key violation is the system working, not a failure.
  if (error) return false
  return true
}

/** Mark a send that has no natural occurrence to group by. */
async function record(userId: string, kind: NotifyKind, channel: 'email' | 'push' | 'in_app') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    await admin.from('notifications_sent').insert({ user_id: userId, kind, channel })
  } catch {
    // The ledger is for us, not for them. Never fail a send over it.
  }
}

const shell = (title: string, body: string, cta: { href: string; label: string }) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1420;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;">
      <tr><td>
        <p style="margin:0 0 4px;color:#F76B16;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">AJM Fit</p>
        <h1 style="margin:0 0 16px;color:#1B2D50;font-size:22px;">${escapeHtml(title)}</h1>
        ${body}
        <a href="${cta.href}" style="display:inline-block;margin-top:24px;background:#1A7BFF;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:14px;">${escapeHtml(cta.label)}</a>
      </td></tr>
    </table>
  </td></tr>
</table>`

/**
 * Your coach replied.
 *
 * The single highest-value message this app does not currently send, and the
 * cheapest: the reply is already written and already stored. Carries a short
 * excerpt rather than the whole thing, so the conversation still happens in
 * the app where the context lives.
 */
export async function notifyCoachReply(input: {
  userId: string
  excerpt: string
  aboutCheckIn?: boolean
}): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    const { data: u } = await admin
      .from('users')
      .select('name, email')
      .eq('id', input.userId)
      .maybeSingle()
    const email = (u?.email as string) || ''
    if (!email) return false

    const first = String(u?.name ?? '').split(' ')[0]
    const kind: NotifyKind = input.aboutCheckIn ? 'check_in_reply' : 'coach_reply'
    const title = input.aboutCheckIn ? 'Anthony reviewed your check-in' : 'Anthony replied'

    // Trimmed, because the point is to bring them back to the thread rather
    // than to move the conversation into their inbox.
    const excerpt = input.excerpt.trim().slice(0, 240)
    const body = `
      <p style="margin:0 0 12px;color:#475569;font-size:15px;line-height:1.6;">${first ? `${escapeHtml(first)}, ` : ''}${input.aboutCheckIn ? 'your check-in has a reply.' : 'you have a new message.'}</p>
      <blockquote style="margin:0;padding:12px 16px;border-left:3px solid #1A7BFF;background:#F7F9FC;color:#1B2D50;font-size:15px;line-height:1.6;">${escapeHtml(excerpt)}${input.excerpt.length > 240 ? '…' : ''}</blockquote>`

    await sendMail({
      to: email,
      subject: title,
      text: `${title}\n\n${excerpt}\n\n${SITE}/studio/messages`,
      html: shell(title, body, { href: `${SITE}/studio/messages`, label: 'Read and reply' }),
    })
    await record(input.userId, kind, 'email')
    return true
  } catch (err) {
    // Best effort, always. A mail failure must never break the coach's reply.
    console.error('[notify-client] coach reply failed:', err)
    return false
  }
}

/**
 * A reminder, sent once.
 *
 * Email rather than push, deliberately. Server push needs VAPID keys and a
 * stored subscription per client, and — more to the point — permission is only
 * ever asked inside the workout screen, so the clients who most need a nudge
 * are exactly the ones who have never been asked. Four of eleven have never
 * opened a workout at all. Email reaches everyone today.
 *
 * Every message names one thing to do. None of them counts the misses, and none
 * of them is signed as though Anthony wrote it: a templated line in his voice
 * spends the trust that makes his real messages land.
 */
export async function sendReminder(input: {
  userId: string
  kind: NotifyKind
  occurrenceKey: string
  daysQuiet: number
  /** Next session's name, when the rotation knows it. */
  nextSession?: string | null
  /** Their best set last time out, for the day-7 message. */
  lastLift?: { exercise: string; weight: number; reps: number } | null
}): Promise<boolean> {
  // Claim first. If another run already sent this, the insert fails and we
  // stop here rather than sending a second copy.
  const claimed = await claim(input.userId, input.kind, 'email', input.occurrenceKey)
  if (!claimed) return false

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    const { data: u } = await admin.from('users').select('name, email').eq('id', input.userId).maybeSingle()
    const email = (u?.email as string) || ''
    if (!email) return false
    const first = String(u?.name ?? '').split(' ')[0]
    const hi = first ? `${escapeHtml(first)}, ` : ''
    const session = input.nextSession ? escapeHtml(input.nextSession) : 'Your next session'

    let subject: string
    let body: string
    let cta = { href: `${SITE}/studio`, label: 'Open your workout' }

    if (input.kind === 'quiet_4d') {
      subject = `${input.nextSession ?? 'Your next session'} is still next`
      body = `
        <p style="margin:0 0 12px;color:#475569;font-size:15px;line-height:1.6;">${hi}${session} is still next up.</p>
        <p style="margin:0;color:#475569;font-size:15px;line-height:1.6;">Nothing's lost — your program picks up exactly where you left it.</p>`
    } else if (input.kind === 'quiet_7d') {
      subject = "It's been a week"
      // The one fact worth carrying: their own best lift. Already computed for
      // the progression engine, and it turns a guilt trigger into a reason.
      const lift = input.lastLift
        ? `<p style="margin:0 0 12px;color:#1B2D50;font-size:15px;line-height:1.6;">Last time out you hit <strong>${escapeHtml(input.lastLift.exercise)} ${input.lastLift.weight} lb × ${input.lastLift.reps}</strong>.</p>`
        : ''
      body = `
        <p style="margin:0 0 12px;color:#475569;font-size:15px;line-height:1.6;">${hi}it's been a week since your last session.</p>
        ${lift}
        <p style="margin:0;color:#475569;font-size:15px;line-height:1.6;">${session} is waiting whenever you're ready.</p>`
    } else {
      subject = 'Weekly check-in'
      cta = { href: `${SITE}/studio/check-in`, label: 'Check in' }
      body = `
        <p style="margin:0 0 12px;color:#475569;font-size:15px;line-height:1.6;">${hi}how did the week go?</p>
        <p style="margin:0;color:#475569;font-size:15px;line-height:1.6;">Two minutes, and it's what Anthony uses to decide what changes next week.</p>`
    }

    await sendMail({
      to: email,
      subject,
      text: `${subject}\n\n${cta.href}`,
      html: shell(subject, body, cta),
    })
    return true
  } catch (err) {
    console.error('[notify-client] reminder failed:', err)
    return false
  }
}

export { claim as claimNotification }
