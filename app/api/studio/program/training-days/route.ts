import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Set which weekdays a client trains, on their own open assignment.
 *
 * WHY THIS ROUTE EXISTS. The question is asked once, in the Blueprint picker,
 * where it is optional — and every client in production has skipped it, so
 * `training_days` is null on every open assignment. The dashboard card that
 * was meant to recover from that ("Which days do you train?") pointed at
 * /studio/schedule, which is a Calendly booking page and has never had any
 * way to answer. The card asked a question with no reachable answer, which is
 * why nobody has ever set their days rather than evidence that nobody cares.
 *
 * Runs with the service role because RLS lets only the trainer write
 * program_assignments. The gate here is deliberately narrower than the
 * trainer's: the caller may touch ONE column on THEIR OWN open assignment and
 * nothing else. No assignment id comes off the wire, so there is no id to
 * tamper with.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { days?: unknown }
  try {
    body = (await request.json()) as { days?: unknown }
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  // Never trust the shape off the wire: a stray 7 or a duplicate would sit in
  // the column forever and silently never match a weekday. Same cleaning as
  // the picker's, so both paths can only ever store 0..6, deduped, sorted.
  //
  // An empty selection stores null, not [], and means "do not remind me".
  // [] would read as "trains on no days", which the reminders would treat as
  // a set to compare against and get wrong every day of the week.
  const raw = body.days
  let days: number[] | null = null
  if (Array.isArray(raw)) {
    const clean = Array.from(
      new Set(raw.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))
    ).sort((a, b) => a - b)
    days = clean.length > 0 ? clean : null
  } else if (raw !== null && raw !== undefined) {
    return NextResponse.json({ error: 'days must be an array or null' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: dbUser } = await admin
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!dbUser) return NextResponse.json({ error: 'No account' }, { status: 404 })

  // The open assignment, which is the only row this may act on.
  const { data: current } = await admin
    .from('program_assignments')
    .select('id')
    .eq('user_id', dbUser.id)
    .is('ended_at', null)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!current) {
    return NextResponse.json({ error: 'No program to set days on.' }, { status: 404 })
  }

  // Scoped by id AND user_id: belt and braces, so a stale read can never
  // write to somebody else's row.
  const { data: updated, error } = await admin
    .from('program_assignments')
    .update({ training_days: days })
    .eq('id', current.id)
    .eq('user_id', dbUser.id)
    .select('id, training_days')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // An update that matched no row comes back as a success with an empty list,
  // not as an error. Three silent failures in this project have come from
  // trusting that, so check the row count rather than the absence of an error.
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'Could not save your days.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, days: updated[0].training_days ?? null })
}
