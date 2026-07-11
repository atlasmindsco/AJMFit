import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail } from '@/lib/email'
import { ONBOARDING_LABELS, type OnboardingAnswers } from '@/lib/onboarding'

/**
 * Emails Coach Anthony when a client submits their onboarding form.
 * The signed-in user's own form is read server-side (no client-supplied data).
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
  if (!dbUser) return NextResponse.json({ error: 'No client record' }, { status: 404 })

  const { data: form } = await admin
    .from('onboarding_forms')
    .select('answers, updated_at')
    .eq('user_id', dbUser.id)
    .maybeSingle()
  if (!form) return NextResponse.json({ error: 'No form found' }, { status: 404 })

  const answers = (form.answers ?? {}) as OnboardingAnswers
  const firstName = String(dbUser.name || '').trim().split(/\s+/)[0]
  const rows = (Object.keys(ONBOARDING_LABELS) as Array<keyof OnboardingAnswers>)
    .filter((k) => (answers[k] ?? '').toString().trim())
    .map(
      (k) => `<tr><td style="color:#94a3b8;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;padding:12px 0 2px;">${ONBOARDING_LABELS[k]}</td></tr>
       <tr><td style="color:#1B2D50;font-size:15px;line-height:1.6;padding-bottom:10px;border-bottom:1px solid #eef1f5;">${String(answers[k])}</td></tr>`
    )
    .join('')

  try {
    await sendMail({
      to: 'anthony@ajmfit.com',
      replyTo: dbUser.email,
      subject: `Onboarding form: ${dbUser.name} is ready for their call`,
      html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1420;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#1B2D50;padding:24px 32px;" align="center">
        <img src="https://ajmfit.com/AJMfit.png" width="44" height="44" alt="AJM Fit" style="display:block;margin:0 auto 8px;" />
        <div style="color:#ffffff;font-size:14px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">AJM FIT</div>
      </td></tr>
      <tr><td style="padding:32px 32px 8px;">
        <p style="margin:0 0 4px;color:#F76B16;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Onboarding form submitted</p>
        <h1 style="margin:0 0 6px;color:#1B2D50;font-size:22px;font-weight:800;">${dbUser.name}</h1>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;border-left:4px solid #F76B16;border-radius:6px;margin:16px 0 24px;">
          <tr><td style="padding:18px 20px;">
            <p style="margin:0 0 12px;color:#1B2D50;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">What to do next</p>
            <p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.6;"><strong>1.</strong> Read ${firstName}'s answers below before the onboarding call.</p>
            <p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.6;"><strong>2.</strong> Check your schedule. If they have not booked the call yet, nudge them by replying to this email.</p>
            <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;"><strong>3.</strong> You can also see these answers anytime on their card in your <a href="https://ajmfit.com/luffy" style="color:#1A7BFF;">dashboard</a>.</p>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      </td></tr>
      <tr><td style="padding:24px 32px 32px;" align="center">
        <a href="https://ajmfit.com/luffy" style="display:inline-block;background:#F76B16;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:14px 28px;border-radius:8px;">Open dashboard</a>
      </td></tr>
    </table>
  </td></tr>
</table>`,
    })
  } catch (e) {
    console.error('[onboarding notify] email failed', e)
    return NextResponse.json({ ok: true, emailed: false })
  }
  return NextResponse.json({ ok: true, emailed: true })
}
