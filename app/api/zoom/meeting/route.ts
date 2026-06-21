import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createMeeting, deleteMeeting } from '@/lib/zoom'

async function requireTrainer() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const role = (user?.app_metadata as { role?: string } | undefined)?.role
  return Boolean(user) && role === 'trainer'
}

/**
 * Creates a Zoom meeting for a session. Trainer-only.
 * Keeps the Zoom secret server-side: the schedule page calls this, then stores
 * the returned join_url/meeting_id on the scheduled_sessions row.
 */
export async function POST(request: Request) {
  // 1. Authorize: caller must be the trainer.
  if (!(await requireTrainer())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Parse input.
  let topic: string, startISO: string, durationMin: number, agenda: string | undefined
  try {
    const body = (await request.json()) as {
      topic?: string
      startISO?: string
      durationMin?: number
      agenda?: string
    }
    if (!body.topic || !body.startISO || !body.durationMin) throw new Error('missing fields')
    topic = body.topic
    startISO = body.startISO
    durationMin = body.durationMin
    agenda = body.agenda
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // 3. Create the meeting.
  try {
    const meeting = await createMeeting({ topic, startISO, durationMin, agenda })
    return NextResponse.json({ join_url: meeting.join_url, meeting_id: meeting.id })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Zoom error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

/**
 * Deletes a Zoom meeting (e.g. when a session is cancelled). Trainer-only.
 * Best-effort: a Zoom failure still returns ok so the caller can proceed to
 * cancel the session row regardless.
 */
export async function DELETE(request: Request) {
  if (!(await requireTrainer())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const meetingId = new URL(request.url).searchParams.get('meeting_id')
  if (!meetingId) {
    return NextResponse.json({ error: 'Missing meeting_id' }, { status: 400 })
  }

  try {
    await deleteMeeting(meetingId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[zoom] delete failed', e)
    return NextResponse.json({ ok: false, warning: 'Zoom meeting could not be removed' })
  }
}
