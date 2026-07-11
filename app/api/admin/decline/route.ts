import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail } from '@/lib/email'

/**
 * Declines an application AND sends the applicant a polite, reason-specific
 * email. Trainer-only. The coach picks the reason in /luffy; an optional
 * personal note is included verbatim.
 */

export type DeclineReason = 'capacity' | 'fit' | 'medical' | 'other'

const REASON_COPY: Record<DeclineReason, { line: string; followUp: string }> = {
  capacity: {
    line: 'Right now my coaching roster is at full capacity, and I would rather tell you that honestly than take you on and give you less than my full attention.',
    followUp:
      'Spots open up as clients graduate. Join the free Brains and Gains newsletter at ajmfit.com/blog and you will be the first to hear when applications reopen. I would genuinely like to work with you when there is room to do it right.',
  },
  fit: {
    line: 'After reading your application carefully, I do not think my program is the right fit for what you are trying to achieve, and you deserve a coach who is.',
    followUp:
      'That is a judgment about fit, not about you or your potential. Keep training, and if your goals shift down the road, you are always welcome to apply again.',
  },
  medical: {
    line: 'Based on what you shared about your health, the right first step is a conversation with your doctor and their go-ahead for a training program.',
    followUp:
      'That is me taking your health seriously, not a no. Once you have clearance, apply again and we will pick it up from there.',
  },
  other: {
    line: 'After reviewing your application, I will not be able to take you on as a client at this time.',
    followUp: 'Keep showing up for your training, and thank you again for considering AJM Fit.',
  },
}

function declineHTML(opts: { firstName: string; reason: DeclineReason; note?: string }): string {
  const copy = REASON_COPY[opts.reason]
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1420;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#1B2D50;padding:24px 32px;" align="center">
        <img src="https://ajmfit.com/AJMfit.png" width="44" height="44" alt="AJM Fit" style="display:block;margin:0 auto 8px;" />
        <div style="color:#ffffff;font-size:14px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">AJM FIT</div>
      </td></tr>
      <tr><td style="padding:36px 32px 16px;">
        <h1 style="margin:0 0 14px;color:#1B2D50;font-size:22px;font-weight:800;">Thank you for applying${opts.firstName ? ', ' + opts.firstName : ''}</h1>
        <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">I read every application personally, and I appreciate the time you put into yours.</p>
        <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">${copy.line}</p>
        ${opts.note ? `<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;font-style:italic;">"${opts.note}"</p>` : ''}
        <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">${copy.followUp}</p>
        <p style="margin:0;color:#475569;font-size:15px;line-height:1.7;">Coach Anthony</p>
      </td></tr>
      <tr><td style="padding:24px 32px 32px;border-top:1px solid #eef1f5;">
        <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">Questions? Just reply to this email.<br />AJM Fit &middot; Personal Training &amp; Coaching</p>
      </td></tr>
    </table>
  </td></tr>
</table>`
}

export async function POST(request: Request) {
  // Authorize: caller must be the trainer.
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const role = (user?.app_metadata as { role?: string } | undefined)?.role
  if (!user || role !== 'trainer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { userId?: string; applicationId?: string; reason?: string; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { userId, applicationId } = body
  const reason = (['capacity', 'fit', 'medical', 'other'] as const).includes(
    body.reason as DeclineReason
  )
    ? (body.reason as DeclineReason)
    : 'other'
  if (!userId || !applicationId) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: target, error: lookupErr } = await admin
    .from('users')
    .select('name, email')
    .eq('id', userId)
    .single()
  if (lookupErr || !target) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const { error: appErr } = await admin
    .from('applications')
    .update({ status: 'declined', reviewed_at: now, notes: body.note || null })
    .eq('id', applicationId)
  if (appErr) {
    return NextResponse.json({ error: 'Could not decline the application.' }, { status: 500 })
  }
  const { error: userErr } = await admin.from('users').update({ status: 'cancelled' }).eq('id', userId)
  if (userErr) {
    return NextResponse.json({ error: 'Could not update the client.' }, { status: 500 })
  }

  // Send the polite decline. Best-effort: the decline itself is committed.
  let emailed = false
  try {
    const firstName = String(target.name || '').trim().split(/\s+/)[0]
    emailed = await sendMail({
      to: target.email,
      replyTo: 'anthony@ajmfit.com',
      subject: 'Your AJM Fit application',
      html: declineHTML({ firstName, reason, note: body.note?.trim() || undefined }),
    })
  } catch (e) {
    console.error('[decline] email failed', e)
  }

  return NextResponse.json({ ok: true, emailed })
}
