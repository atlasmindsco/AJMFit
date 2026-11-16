import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Move a client between the gym and home versions of their own program.
 *
 * Runs with the service role because RLS lets only the trainer write
 * program_assignments. The gate here is narrower than the trainer's: a caller
 * may only swap THEIR OWN open assignment, and only for the twin of the
 * program they are already on — same goal, same split, other location. There
 * is no way to pass an arbitrary program id and be assigned it.
 *
 * THE BLOCK CLOCK IS CARRIED ACROSS. Block progress is measured from the
 * assignment's `assigned_at`, so creating a fresh row would drop someone from
 * week six back to week one for the crime of going away for a fortnight. The
 * original date and block length move to the new assignment, which is what
 * makes this a location change rather than a restart.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: dbUser } = await admin.from('users').select('id').eq('auth_id', user.id).single()
  if (!dbUser) return NextResponse.json({ error: 'No account' }, { status: 404 })

  // The open assignment, which is the only thing this may act on.
  const { data: current } = await admin
    .from('program_assignments')
    .select('id, program_id, assigned_at, block_weeks, training_days')
    .eq('user_id', dbUser.id)
    .is('ended_at', null)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!current) return NextResponse.json({ error: 'No program to switch.' }, { status: 404 })

  const { data: prog } = await admin
    .from('programs')
    .select('id, goal, split_key, location, source')
    .eq('id', current.program_id)
    .maybeSingle()
  if (!prog || prog.source !== 'blueprint') {
    return NextResponse.json(
      { error: 'This program was built for you by hand, so there is no automatic home version. Message Anthony.' },
      { status: 409 }
    )
  }
  if (prog.location !== 'gym' && prog.location !== 'home') {
    return NextResponse.json({ error: 'That program has no location set.' }, { status: 409 })
  }

  const target = prog.location === 'gym' ? 'home' : 'gym'
  const { data: twin } = await admin
    .from('programs')
    .select('id, name')
    .eq('source', 'blueprint')
    .eq('goal', prog.goal)
    .eq('split_key', prog.split_key)
    .eq('location', target)
    .maybeSingle()
  if (!twin) {
    return NextResponse.json({ error: 'There is no matching program for that location yet.' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const { error: endErr } = await admin
    .from('program_assignments')
    .update({ ended_at: now })
    .eq('id', current.id)
  if (endErr) return NextResponse.json({ error: endErr.message }, { status: 500 })

  const { error: insErr } = await admin.from('program_assignments').insert({
    user_id: dbUser.id,
    program_id: twin.id,
    // The two fields that make this a move rather than a restart.
    assigned_at: current.assigned_at,
    block_weeks: current.block_weeks,
    training_days: current.training_days,
    notes: `Switched to ${target} equipment${prog.location === 'gym' ? ' (away from the gym)' : ' (back at the gym)'}`,
  })
  if (insErr) {
    // Put the original back rather than leaving them with no program at all.
    await admin.from('program_assignments').update({ ended_at: null }).eq('id', current.id)
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, programId: twin.id, name: twin.name, location: target })
}
