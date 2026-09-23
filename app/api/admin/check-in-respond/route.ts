import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Coach's reply to a weekly check-in. Trainer-only.
 *
 * The reply is written to the check-in and mirrored into the client's message
 * thread, so feedback lands where they already look rather than somewhere they
 * have to remember to visit. Setting coach_response is also what clears the
 * client's "Review Needed" status on the coach dashboard.
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

  let checkInId: string
  let response: string
  try {
    const body = (await request.json()) as { checkInId?: string; response?: string }
    if (!body.checkInId || !body.response?.trim()) throw new Error('missing fields')
    checkInId = body.checkInId
    response = body.response.trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: ci } = await admin
    .from('check_ins')
    .select('id, user_id, week_of')
    .eq('id', checkInId)
    .maybeSingle()
  if (!ci) return NextResponse.json({ error: 'Check-in not found' }, { status: 404 })

  const { error: uErr } = await admin
    .from('check_ins')
    .update({ coach_response: response, coach_responded_at: new Date().toISOString() })
    .eq('id', checkInId)
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

  await admin.from('messages').insert({
    user_id: ci.user_id,
    from_trainer: true,
    body: `On your check-in:\n\n${response}`,
  })

  return NextResponse.json({ ok: true })
}
