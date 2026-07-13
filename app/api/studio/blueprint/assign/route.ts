import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DAYS_TO_SPLIT, type BlueprintGoal, type BlueprintLocation } from '@/lib/blueprint'

export const runtime = 'nodejs'

const GOALS: BlueprintGoal[] = ['muscle', 'strength', 'lean_out']
const LOCATIONS: BlueprintLocation[] = ['gym', 'home']

/**
 * Blueprint self-assign. A Blueprint client picks Goal + Days/week + Location;
 * we resolve the matching pre-made template and assign it to them. Runs with the
 * service role because RLS lets only the trainer write program_assignments — we
 * gate it here by confirming the caller is a Blueprint-tier member and the
 * target program is a blueprint template.
 */
export async function POST(request: Request) {
  // 1. Who's calling?
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Validate input.
  let goal: string, location: string, days: number
  try {
    const body = (await request.json()) as { goal?: string; location?: string; days?: number }
    goal = String(body.goal)
    location = String(body.location)
    days = Number(body.days)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const split = DAYS_TO_SPLIT[days]
  if (!GOALS.includes(goal as BlueprintGoal) || !LOCATIONS.includes(location as BlueprintLocation) || !split) {
    return NextResponse.json({ error: 'Invalid choices' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // 3. Resolve the caller's DB user + confirm Blueprint tier.
  const { data: dbUser } = await admin.from('users').select('id').eq('auth_id', user.id).single()
  if (!dbUser) return NextResponse.json({ error: 'No account' }, { status: 404 })

  const { data: sub } = await admin.from('subscriptions').select('tier').eq('user_id', dbUser.id).maybeSingle()
  if (sub?.tier !== 'blueprint') {
    return NextResponse.json({ error: 'This picker is for Blueprint members.' }, { status: 403 })
  }

  // 4. Find the one matching template.
  const { data: program } = await admin
    .from('programs')
    .select('id')
    .eq('source', 'blueprint')
    .eq('goal', goal)
    .eq('split_key', split)
    .eq('location', location)
    .maybeSingle()
  if (!program) {
    return NextResponse.json({ error: 'That program is not available yet.' }, { status: 404 })
  }

  // 5. Assign it — end any current assignment, then open the new one.
  await admin.from('program_assignments').update({ ended_at: new Date().toISOString() }).eq('user_id', dbUser.id).is('ended_at', null)
  const { error: aErr } = await admin.from('program_assignments').insert({
    user_id: dbUser.id,
    program_id: program.id,
    notes: `Blueprint self-select: ${goal} / ${split} / ${location}`,
  })
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, programId: program.id })
}
