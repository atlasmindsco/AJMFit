import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail } from '@/lib/email'

export const runtime = 'nodejs'

const COACH_EMAIL = 'anthony@ajmfit.com'

/**
 * Notifies Coach Anthony when a client beats a personal record, so he can
 * reach out and celebrate them. Fired from the workout logger. Best-effort:
 * a mail hiccup never affects the client's session.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let exerciseName: string
  let weight: number
  let reps: number | null
  let previousWeight: number | null
  try {
    const b = (await request.json()) as { exerciseName?: string; weight?: number; reps?: number; previousWeight?: number }
    exerciseName = String(b.exerciseName ?? '').slice(0, 120)
    weight = Number(b.weight)
    reps = b.reps != null ? Number(b.reps) : null
    previousWeight = b.previousWeight != null ? Number(b.previousWeight) : null
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!exerciseName || !Number.isFinite(weight)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data: u } = await admin.from('users').select('name, email').eq('auth_id', user.id).maybeSingle()
  const name = (u?.name as string) || 'A client'
  const clientEmail = (u?.email as string) || ''

  // Tell the client too. They see an animation at the moment it happens, but
  // nothing afterwards — and a personal record is the single best reason to
  // pull someone back into the app later.
  if (clientEmail) {
    const firstName = name.trim().split(/\s+/)[0]
    try {
      await sendMail({
        to: clientEmail,
        replyTo: COACH_EMAIL,
        subject: `New personal record: ${exerciseName} ${weight} lbs`,
        text: `${firstName}, you just hit a personal record on ${exerciseName}: ${weight} lbs${reps ? ` for ${reps} reps` : ''}.`,
        html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1B2D50">
          <p style="font-size:20px;margin:0 0 6px"><strong>${firstName}, that is a new personal record.</strong></p>
          <p style="font-size:18px;margin:0 0 12px">${exerciseName} — ${weight} lbs${reps ? ` × ${reps}` : ''}${
            previousWeight ? ` <span style="color:#64748B">(your previous best was ${previousWeight} lbs)</span>` : ''
          }</p>
          <p style="color:#64748B;margin:0">Logged in your training studio. Keep it going.</p>
        </div>`,
      })
    } catch (e) {
      console.error('[pr-notify] client email failed', e)
    }
  }

  try {
    await sendMail({
      to: COACH_EMAIL,
      replyTo: clientEmail || undefined,
      subject: `New PR: ${name} — ${exerciseName} ${weight} lbs`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1B2D50">
        <p style="font-size:20px;margin:0 0 6px"><strong>${name}</strong> just hit a personal record!</p>
        <p style="font-size:18px;margin:0 0 12px"><strong>${exerciseName}</strong> — ${weight} lbs${reps ? ` × ${reps}` : ''}${
          previousWeight ? ` <span style="color:#64748B">(previous best ${previousWeight} lbs)</span>` : ''
        }</p>
        <p style="color:#64748B;margin:0">Shoot them a quick message to celebrate the win.</p>
      </div>`,
    })
  } catch (e) {
    console.error('[pr-notify] email failed', e)
  }

  return NextResponse.json({ ok: true })
}
