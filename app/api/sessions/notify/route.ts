import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail, buildEventICS, sessionConfirmationHTML } from '@/lib/email'

/**
 * Emails a client their session booking confirmation (with a Zoom link, if any,
 * and a calendar invite). Trainer-only. Best-effort: returns ok even when SMTP
 * is unconfigured so the booking flow never blocks on email.
 */
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

  let body: {
    userId?: string
    type?: string
    starts_at?: string
    duration_min?: number
    join_url?: string | null
  }
  try {
    body = await request.json()
    if (!body.userId || !body.starts_at || !body.duration_min) throw new Error('missing fields')
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Resolve the client's email + name (service role; bypasses RLS).
  const admin = createAdminClient()
  const { data: client } = await admin
    .from('users')
    .select('email, name')
    .eq('id', body.userId)
    .single<{ email: string | null; name: string | null }>()

  if (!client?.email) {
    return NextResponse.json({ ok: false, reason: 'no-email' })
  }

  const type = body.type || 'Training Session'
  const firstName = (client.name ?? '').trim().split(/\s+/)[0] ?? ''
  const when = new Date(body.starts_at).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  })

  const ics = buildEventICS({
    uid: `${body.userId}-${new Date(body.starts_at).getTime()}@ajmfit.com`,
    title: `AJM Fit — ${type}`,
    description: body.join_url ? `Join on Zoom: ${body.join_url}` : 'Session with Coach Anthony',
    location: body.join_url ?? undefined,
    startISO: body.starts_at,
    durationMin: Number(body.duration_min),
  })

  try {
    const sent = await sendMail({
      to: client.email,
      subject: `Your ${type} is booked — AJM Fit`,
      html: sessionConfirmationHTML({ firstName, type, when, durationMin: Number(body.duration_min), joinUrl: body.join_url }),
      text: `Your ${type} is booked for ${when} (${body.duration_min} min).${body.join_url ? ` Join: ${body.join_url}` : ''}`,
      ics,
    })
    return NextResponse.json({ ok: true, sent })
  } catch (e) {
    console.error('[sessions/notify] send failed', e)
    return NextResponse.json({ ok: false, reason: 'send-failed' })
  }
}
