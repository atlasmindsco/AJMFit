import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyWebhookSignature, type CalendlyWebhookEvent } from '@/lib/calendly'

// We need the raw request body for signature verification, so opt out of any
// caching/parsing and run on Node (crypto.timingSafeEqual is Node-only).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Constant-time string compare (length-safe). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}

/**
 * Authenticates the webhook. Calendly's plan here doesn't issue signing keys,
 * so the primary check is a shared secret in the callback URL (?token=...). If a
 * signing key is ever configured (higher plan), HMAC verification takes over.
 */
function isAuthentic(request: Request, rawBody: string): boolean {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY
  if (signingKey) {
    return verifyWebhookSignature({
      rawBody,
      signatureHeader: request.headers.get('calendly-webhook-signature'),
      signingKey,
    })
  }
  const expected = process.env.CALENDLY_WEBHOOK_TOKEN
  const provided = new URL(request.url).searchParams.get('token')
  return !!expected && !!provided && safeEqual(provided, expected)
}

/**
 * Receives Calendly webhooks (invitee.created / invitee.canceled) and mirrors
 * the booking into scheduled_sessions so the trainer portal and client studio
 * show self-booked sessions alongside trainer-created ones.
 *
 * Bookings are matched to clients by email. A booking from someone who isn't a
 * registered user is acknowledged (200) but skipped, there's nowhere to file it.
 */
export async function POST(request: Request) {
  const rawBody = await request.text()

  // 1. Authenticate (fail closed).
  if (!isAuthentic(request, rawBody)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse.
  let evt: CalendlyWebhookEvent
  try {
    evt = JSON.parse(rawBody) as CalendlyWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const db = createAdminClient()
  // New columns aren't in the generated types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessions = db.from('scheduled_sessions') as any
  const { payload } = evt

  // 3a. Cancellation, flip the matching row to cancelled.
  if (evt.event === 'invitee.canceled') {
    await sessions.update({ status: 'cancelled' }).eq('calendly_invitee_uri', payload.uri)
    return NextResponse.json({ ok: true })
  }

  // 3b. New booking, match the client by email, then upsert.
  if (evt.event === 'invitee.created') {
    const email = payload.email?.toLowerCase().trim()
    if (!email) return NextResponse.json({ ok: true, skipped: 'no email' })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: user } = await (db.from('users') as any)
      .select('id')
      .ilike('email', email)
      .maybeSingle()

    if (!user) {
      // Prospect, not a registered client, nothing to file against.
      return NextResponse.json({ ok: true, skipped: 'no matching user' })
    }

    const start = new Date(payload.scheduled_event.start_time)
    const end = new Date(payload.scheduled_event.end_time)
    const durationMin = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))

    await sessions.upsert(
      {
        user_id: user.id,
        starts_at: payload.scheduled_event.start_time,
        duration_min: durationMin,
        type: payload.scheduled_event.name || 'Calendly session',
        notes: `Booked via Calendly by ${payload.name}`,
        status: 'scheduled',
        join_url: payload.scheduled_event.location?.join_url ?? null,
        calendly_event_uri: payload.scheduled_event.uri,
        calendly_invitee_uri: payload.uri,
      },
      { onConflict: 'calendly_invitee_uri' }
    )
    return NextResponse.json({ ok: true })
  }

  // Unhandled event type, acknowledge so Calendly doesn't retry.
  return NextResponse.json({ ok: true, ignored: evt.event })
}
