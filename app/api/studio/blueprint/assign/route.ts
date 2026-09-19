import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DAYS_TO_SPLIT, SPLIT_CHOICE_TO_KEY, EMPHASIS_CHOICE_TO_KEY, type BlueprintGoal, type BlueprintLocation } from '@/lib/blueprint'

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
  let goal: string, location: string, days: number, splitChoice: string | undefined, emphasisChoice: string | undefined
  try {
    const body = (await request.json()) as { goal?: string; location?: string; days?: number; splitChoice?: string; emphasisChoice?: string }
    goal = String(body.goal)
    location = String(body.location)
    days = Number(body.days)
    splitChoice = body.splitChoice
    emphasisChoice = body.emphasisChoice
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Resolve split key: for 5-day users, use splitChoice; for 4-day users, use emphasisChoice; otherwise use defaults
  let split: string | undefined
  if (days === 5 && splitChoice) {
    split = SPLIT_CHOICE_TO_KEY[splitChoice]
  } else if (days === 4 && emphasisChoice) {
    split = EMPHASIS_CHOICE_TO_KEY[emphasisChoice]
  } else {
    split = DAYS_TO_SPLIT[days]
  }

  if (!GOALS.includes(goal as BlueprintGoal) || !LOCATIONS.includes(location as BlueprintLocation) || !split) {
    return NextResponse.json({ error: 'Invalid choices' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // 3. Resolve the caller's DB user + confirm Blueprint tier.
  const { data: dbUser } = await admin.from('users').select('id').eq('auth_id', user.id).single()
  if (!dbUser) return NextResponse.json({ error: 'No account' }, { status: 404 })

  // Prefer the Stripe subscription; fall back to the latest application's tier
  // (beta testers and admin-activated clients have no subscriptions row —
  // matches fetchMyTier in lib/scheduling.ts, which is what shows the picker).
  const { data: sub } = await admin.from('subscriptions').select('tier').eq('user_id', dbUser.id).maybeSingle()
  let tier: string | undefined = sub?.tier
  if (!tier) {
    const { data: app } = await admin
      .from('applications')
      .select('tier')
      .eq('user_id', dbUser.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    tier = app?.tier
  }
  if (tier !== 'blueprint') {
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
  let splitLabel = split
  if (days === 5 && splitChoice) {
    splitLabel = `${days}d-${splitChoice}`
  } else if (days === 4 && emphasisChoice) {
    splitLabel = `${days}d-${emphasisChoice}`
  }
  const { error: aErr } = await admin.from('program_assignments').insert({
    user_id: dbUser.id,
    program_id: program.id,
    notes: `Blueprint self-select: ${goal} / ${splitLabel} / ${location}`,
  })
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, programId: program.id })
}
