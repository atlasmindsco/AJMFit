import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { STALE_AFTER_HOURS } from '@/lib/active-workout'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Close workouts that were opened and never finished.
 *
 * WHY IT HAS TO BE A CRON. `autoCloseStaleWorkouts` has existed for a while
 * and does the same job client-side — but it runs when the client opens their
 * programs page, which means it never runs for the clients it was written
 * for. Arun's only session has been open since 8 November and Alexandro's
 * since 10 October. Neither of them came back, and coming back is the
 * trigger. The sweep fires for everybody except the people who need it.
 *
 * What those open rows cost, concretely:
 *
 *   - they are the most recent workout, so every "last trained" read sees a
 *     session that never happened. Arun looked like he had trained 14 days
 *     ago; his one session had zero sets and was never closed.
 *   - `fetchInProgressWorkout` would offer them back for resume, so the new
 *     resume bar would sit on a stranger's screen advertising a workout from
 *     six weeks ago.
 *   - the first-workout email counts finished workouts, so an open one
 *     silently holds back the one message in this product that matters most.
 *
 * NOT A DELETE. The sets stay — they are things the client actually did. What
 * ends is the session. Duration is left null rather than invented: this used
 * to stamp 45 minutes on everything it closed, which is why Jamel's two
 * sessions on 17 September both read exactly 45 minutes. Neither number was
 * measured. A workout nobody timed should show no time.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (!request.headers.get('x-vercel-cron')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = new URL(request.url).searchParams.get('dry') === '1'
  const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 3600_000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: stale, error } = await admin
    .from('workouts')
    .select('id, user_id, day_name, started_at')
    .is('ended_at', null)
    .lt('started_at', cutoff)
    .order('started_at', { ascending: true })
    // A bound rather than pagination: if this ever finds more than 500 open
    // sessions something is wrong upstream and closing them quietly is the
    // wrong response. The next run picks up the remainder either way.
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (stale ?? []) as Array<{ id: string; user_id: string; day_name: string; started_at: string }>
  const ageHours = (iso: string) => Math.round((Date.now() - Date.parse(iso)) / 3600_000)
  const found = rows.map((r) => ({ day: r.day_name, hoursOpen: ageHours(r.started_at) }))

  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, staleAfterHours: STALE_AFTER_HOURS, wouldClose: rows.length, found })
  }

  let closed = 0
  for (const r of rows) {
    const { error: upErr } = await admin
      .from('workouts')
      .update({ ended_at: new Date().toISOString(), duration_seconds: null })
      .eq('id', r.id)
      // Re-checked in the write, because the client may have finished this
      // very session between the read above and here.
      .is('ended_at', null)
    if (upErr) {
      console.error('[close-workouts] Failed to close', r.id, upErr.message)
      continue
    }
    closed++
  }

  // The ops log is the only record that any of this ran. A sweep nobody can
  // see afterwards is how the crons went five weeks without anyone noticing.
  await admin
    .from('cron_runs')
    .insert({
      job: 'close-workouts',
      summary: `${closed} stale ${closed === 1 ? 'session' : 'sessions'} closed of ${rows.length} found`,
      ok: closed === rows.length,
    })
    .then(
      () => {},
      () => {}
    )

  return NextResponse.json({ ok: true, staleAfterHours: STALE_AFTER_HOURS, closed, found })
}
