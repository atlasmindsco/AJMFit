import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail } from '@/lib/email'

export const runtime = 'nodejs'

const FALLBACK_COACH_EMAIL = 'anthony@ajmfit.com'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const scale = (n: number | null) => (n == null ? '—' : `${n}/5`)

/**
 * Emails the coach when a client submits a weekly check-in, with the answers
 * inline so a decision can be made without opening the app.
 *
 * Best-effort: the check-in is already saved by the time this runs, so a mail
 * failure must not look like the submission failed.
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

  const { data: ci } = await admin
    .from('check_ins')
    .select('*')
    .eq('user_id', dbUser.id)
    .order('week_of', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!ci) return NextResponse.json({ ok: true, skipped: 'no check-in' })

  const { data: settings } = await admin.from('coach_settings').select('email').limit(1).maybeSingle()
  const name = (dbUser.name as string) || 'A client'

  const row = (label: string, value: string) =>
    `<tr><td style="color:#94a3b8;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1.2px;padding:10px 0 2px;">${label}</td></tr>
     <tr><td style="color:#1B2D50;font-size:15px;line-height:1.6;padding-bottom:8px;border-bottom:1px solid #eef1f5;">${value}</td></tr>`

  try {
    await sendMail({
      to: (settings?.email as string) || FALLBACK_COACH_EMAIL,
      replyTo: (dbUser.email as string) || undefined,
      subject: `Check-in: ${name}`,
      text: `${name} submitted their weekly check-in. Nutrition ${scale(ci.nutrition_adherence)}, energy ${scale(ci.energy)}.`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1B2D50">
        <p style="font-size:19px;margin:0 0 14px"><strong>${escapeHtml(name)}</strong> sent their weekly check-in.</p>
        <table role="presentation" width="100%" style="max-width:520px;border-collapse:collapse">
          ${row('Bodyweight', ci.weight_lb != null ? `${Number(ci.weight_lb)} lbs` : '—')}
          ${row('Workouts completed', ci.workouts_completed != null ? String(ci.workouts_completed) : '—')}
          ${row('Nutrition', scale(ci.nutrition_adherence))}
          ${row('Energy and recovery', scale(ci.energy))}
          ${row('Best thing this week', ci.win ? escapeHtml(String(ci.win)) : '—')}
          ${row('What got in the way', ci.obstacle ? escapeHtml(String(ci.obstacle)) : '—')}
        </table>
        <p style="margin:18px 0 0"><a href="https://ajmfit.com/luffy/check-ins" style="color:#1A7BFF">Review and reply</a></p>
      </div>`,
    })
  } catch (e) {
    console.error('[check-in-notify] email failed', e)
  }

  return NextResponse.json({ ok: true })
}
