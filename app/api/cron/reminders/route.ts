import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReminder } from '@/lib/notify-client'
import {
  dueReminder,
  localDateFor,
  localHourFor,
  DEFAULT_PREFS,
  type ClientSnapshot,
  type ReminderPrefs,
} from '@/lib/reminders'
import { rotationState } from '@/lib/rotation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * The first scheduled job in this app that speaks to a CLIENT.
 *
 * Every other cron writes to the database or emails the coach. Seven of eleven
 * clients are drifting — four have never started, three last trained between
 * 21 and 51 days ago — and not one has ever received a message from the app,
 * because nothing could send one.
 *
 * Runs hourly and sends to whoever is at their chosen local hour, so a client
 * five timezones away is nudged at six in the evening rather than at two in
 * the afternoon. Most hours send nothing, which is the intended behaviour
 * rather than a sign it is broken.
 *
 * `?dry=1` decides everything and sends nothing.
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
  const now = new Date()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const [{ data: users }, { data: apps }, { data: prefRows }, { data: checkIns }, { data: assignments }] = await Promise.all([
    admin.from('users').select('id, name, status, timezone, created_at'),
    admin.from('applications').select('user_id, tier').order('created_at', { ascending: false }),
    admin.from('notification_prefs').select('*'),
    admin.from('check_ins').select('user_id, week_of'),
    admin
      .from('program_assignments')
      .select('user_id, training_days, assigned_at')
      .is('ended_at', null)
      .order('assigned_at', { ascending: false }),
  ])

  const active = ((users ?? []) as Array<{ id: string; status: string; timezone: string | null; created_at: string }>)
    .filter((u) => u.status === 'active')
  if (active.length === 0) {
    return NextResponse.json({ ok: true, considered: 0, sent: 0 })
  }

  const tierOf: Record<string, string> = {}
  for (const a of (apps ?? []) as Array<{ user_id: string; tier: string }>) {
    // Rows arrive newest first, so the first seen per client is current.
    if (!(a.user_id in tierOf)) tierOf[a.user_id] = a.tier
  }

  const prefsOf: Record<string, ReminderPrefs> = {}
  for (const p of (prefRows ?? []) as Array<ReminderPrefs & { user_id: string }>) {
    prefsOf[p.user_id] = { training: p.training, check_ins: p.check_ins, progress: p.progress, send_hour: p.send_hour }
  }

  const trainingDaysOf: Record<string, number[] | null> = {}
  for (const a of (assignments ?? []) as Array<{ user_id: string; training_days: number[] | null }>) {
    // Newest first, so the first seen per client is their current program.
    if (!(a.user_id in trainingDaysOf)) trainingDaysOf[a.user_id] = a.training_days ?? null
  }

  const weeksOf: Record<string, string[]> = {}
  for (const c of (checkIns ?? []) as Array<{ user_id: string; week_of: string }>) {
    ;(weeksOf[c.user_id] ??= []).push(c.week_of)
  }

  // Last logged workout per client, counting only sessions they actually
  // logged against — an opened-and-abandoned session is not training, and
  // treating it as such would silence the nudge for someone who needs it.
  const { data: workouts } = await admin
    .from('workouts')
    .select('id, user_id, date, started_at')
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(500)
  const workoutRows = (workouts ?? []) as Array<{ id: string; user_id: string; date: string | null; started_at: string }>
  const { data: sets } = await admin
    .from('workout_sets')
    .select('workout_id')
    .in('workout_id', workoutRows.length ? workoutRows.map((w) => w.id) : ['00000000-0000-0000-0000-000000000000'])
  const logged = new Set(((sets ?? []) as Array<{ workout_id: string }>).map((s) => s.workout_id))

  const lastWorkout: Record<string, string> = {}
  // Sessions in the last 7 days and the 7 before that, for the weekly
  // summary's comparison — which is the only thing that makes it worth
  // sending at all.
  const sessionCounts: Record<string, { now: number; before: number }> = {}
  const dayAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
  const weekAgo = dayAgo(7)
  const fortnightAgo = dayAgo(14)

  for (const w of workoutRows) {
    if (!logged.has(w.id)) continue
    const d = w.date || w.started_at.slice(0, 10)
    if (!lastWorkout[w.user_id] || d > lastWorkout[w.user_id]) lastWorkout[w.user_id] = d
    const c = (sessionCounts[w.user_id] ??= { now: 0, before: 0 })
    if (d >= weekAgo) c.now++
    else if (d >= fortnightAgo) c.before++
  }

  const results: Array<{ user: string; kind: string; sent: boolean }> = []
  let considered = 0

  for (const u of active) {
    const prefs = prefsOf[u.id] ?? DEFAULT_PREFS
    // Only at the client's chosen hour, in their own timezone.
    if (localHourFor(u.timezone, now) !== prefs.send_hour) continue
    considered++

    const tier = tierOf[u.id]
    const snapshot: ClientSnapshot = {
      userId: u.id,
      coached: tier === 'accelerator' || tier === 'full-experience',
      lastWorkoutDate: lastWorkout[u.id] ?? null,
      signedUpAt: u.created_at,
      checkInWeeks: weeksOf[u.id] ?? [],
      trainingDays: trainingDaysOf[u.id] ?? null,
      sessionsThisWeek: sessionCounts[u.id]?.now ?? 0,
      sessionsLastWeek: sessionCounts[u.id]?.before ?? 0,
      prefs,
    }

    const due = dueReminder(snapshot, localDateFor(u.timezone, now))
    if (!due) continue

    if (dryRun) {
      results.push({ user: u.id.slice(0, 8), kind: due.kind, sent: false })
      continue
    }

    // What they are coming back to, so the message names a session rather than
    // saying "a workout". Best-effort: a nudge without it is still worth more
    // than no nudge.
    let nextSession: string | null = null
    let lastLift: { exercise: string; weight: number; reps: number } | null = null
    try {
      const context = await sessionContext(admin, u.id, due.kind === 'quiet_7d')
      nextSession = context.nextSession
      lastLift = context.lastLift
    } catch {
      // Carry on without it.
    }

    const sent = await sendReminder({
      userId: u.id,
      kind: due.kind,
      occurrenceKey: due.occurrenceKey,
      daysQuiet: due.daysQuiet,
      nextSession,
      lastLift,
      sessionsThisWeek: sessionCounts[u.id]?.now ?? 0,
      sessionsLastWeek: sessionCounts[u.id]?.before ?? 0,
    })
    results.push({ user: u.id.slice(0, 8), kind: due.kind, sent })
  }

  const summary = `${considered} at their hour, ${results.filter((r) => r.sent).length} sent`
  if (!dryRun) {
    try {
      await admin.from('cron_runs').insert({ job: 'reminders', summary, ok: true })
    } catch {
      // The log is for us; never fail a run over it.
    }
  }

  return NextResponse.json({ ok: true, dryRun, considered, results })
}

/**
 * The next session's name and their best set last time out.
 *
 * Reuses the rotation engine so the name in the email is the same one the
 * dashboard will show them when they open it.
 */
async function sessionContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
  wantLift: boolean
): Promise<{ nextSession: string | null; lastLift: { exercise: string; weight: number; reps: number } | null }> {
  const short = (n: string) => n.replace(/^day\s*\d+\s*[—–-]\s*/i, '').trim() || n

  const { data: assignment } = await admin
    .from('program_assignments')
    .select('program_id')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextSession: string | null = null
  if (assignment?.program_id) {
    const { data: days } = await admin
      .from('program_days')
      .select('id, day_index, name')
      .eq('program_id', assignment.program_id)
      .order('day_index', { ascending: true })
    const dayRows = (days ?? []) as Array<{ id: string; name: string }>

    if (dayRows.length) {
      const { data: exCounts } = await admin
        .from('program_exercises')
        .select('program_day_id')
        .in('program_day_id', dayRows.map((d) => d.id))
      const counts: Record<string, number> = {}
      for (const e of (exCounts ?? []) as Array<{ program_day_id: string }>) {
        counts[e.program_day_id] = (counts[e.program_day_id] ?? 0) + 1
      }

      const { data: trained } = await admin
        .from('workouts')
        .select('day_name, ended_at')
        .eq('user_id', userId)
        .not('ended_at', 'is', null)
        .not('day_name', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(60)

      const state = rotationState(
        dayRows.map((d) => short(d.name)),
        dayRows.map((d) => (counts[d.id] ?? 0) > 0),
        ((trained ?? []) as Array<{ day_name: string; ended_at: string }>).map((w) => ({
          dayName: w.day_name,
          at: w.ended_at,
        }))
      )
      if (state.todayIndex >= 0) nextSession = short(dayRows[state.todayIndex].name)
    }
  }

  let lastLift: { exercise: string; weight: number; reps: number } | null = null
  if (wantLift) {
    const { data: recent } = await admin
      .from('workouts')
      .select('id')
      .eq('user_id', userId)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (recent?.id) {
      const { data: rows } = await admin
        .from('workout_sets')
        .select('exercise_name, weight, reps')
        .eq('workout_id', recent.id)
        .eq('is_intensity_set', false)
        .not('weight', 'is', null)
        .not('reps', 'is', null)
      const best = ((rows ?? []) as Array<{ exercise_name: string; weight: number; reps: number }>)
        .filter((r) => Number(r.weight) > 0 && Number(r.reps) > 0)
        .sort((a, b) => Number(b.weight) - Number(a.weight))[0]
      if (best) {
        lastLift = { exercise: best.exercise_name, weight: Number(best.weight), reps: Number(best.reps) }
      }
    }
  }

  return { nextSession, lastLift }
}
