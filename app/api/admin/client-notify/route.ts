import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyCoachReply } from '@/lib/notify-client'

export const runtime = 'nodejs'

/**
 * Email a client that their coach has replied. Trainer-only.
 *
 * The coach's message composer runs in the browser and writes straight to the
 * database, so it cannot send mail itself — the transport and the service-role
 * client are both server-side. This is the thin bridge.
 *
 * Fired AFTER the message is saved and never awaited by the composer, for the
 * same reason the client-to-coach notification works this way: a mail failure
 * must not make a sent message look unsent.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const role = (user?.app_metadata as { role?: string } | undefined)?.role
  if (!user || role !== 'trainer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let userId: string
  let excerpt: string
  try {
    const body = (await request.json()) as { userId?: string; excerpt?: string }
    if (!body.userId || !body.excerpt?.trim()) throw new Error('missing fields')
    userId = body.userId
    excerpt = body.excerpt.trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const sent = await notifyCoachReply({ userId, excerpt })
  return NextResponse.json({ ok: true, sent })
}
