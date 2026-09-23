import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Assigns a program to a client. Trainer-only.
 *
 * Until now there was no way for the coach to do this at all: program_assignments
 * appeared nowhere in /luffy or the admin API, and the only path to a program was
 * the Blueprint self-serve picker, which is gated to tier === 'blueprint'. An
 * Accelerator or Full Experience client therefore landed on a programs page
 * saying their program was being built, with no mechanism for anyone to build it.
 *
 * Assigning closes any currently open assignment rather than deleting it, so a
 * client's program history stays intact.
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
  let programId: string
  let note: string | undefined
  try {
    const body = (await request.json()) as { userId?: string; programId?: string; note?: string }
    if (!body.userId || !body.programId) throw new Error('missing ids')
    userId = body.userId
    programId = body.programId
    note = body.note?.trim() || undefined
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: client } = await admin.from('users').select('id, name').eq('id', userId).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { data: program } = await admin.from('programs').select('id, name').eq('id', programId).maybeSingle()
  if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 })

  await admin
    .from('program_assignments')
    .update({ ended_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('ended_at', null)

  const { error: aErr } = await admin.from('program_assignments').insert({
    user_id: userId,
    program_id: programId,
    notes: note ?? `Assigned by coach: ${program.name}`,
  })
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

  // Tell the client, in their own thread, that they have something to do.
  await admin.from('messages').insert({
    user_id: userId,
    from_trainer: true,
    body:
      `Your program is ready: ${program.name}.` +
      (note ? `\n\n${note}` : '') +
      `\n\nOpen Train to see this week's sessions.`,
  })

  return NextResponse.json({ ok: true, programName: program.name })
}
