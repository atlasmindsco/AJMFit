import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail } from '@/lib/email'

export const runtime = 'nodejs'

const FALLBACK_COACH_EMAIL = 'anthony@ajmfit.com'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Emails the coach the first time a client ever finishes a workout.
 *
 * ONCE PER CLIENT, EVER. Not per workout — the audit stress-tested that and
 * it is 57 emails a day at a hundred clients, every one reporting that the
 * expected thing happened. A completed workout is not news; a FIRST completed
 * workout is the moment somebody becomes a real client.
 *
 * Why this one is worth an interrupt. Seven of fifteen active clients have
 * never logged a single set, and of the eight who did, six trained within a
 * day of signing up. Nobody warms up slowly — they begin at once or never. So
 * the evening of the first session is the whole window, and a message from
 * the coach that evening is the highest-value thing in coaching. Until now
 * nothing told him it had happened.
 *
 * Deduped through notifications_sent with a constant occurrence key, so a
 * unique index in the database enforces "once" rather than this code
 * remembering to. Called best-effort from the client when a session ends; a
 * mail failure must never affect the workout they just finished.
 */
export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: dbUser } = await admin
    .from('users')
    .select('id, name, email, created_at')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!dbUser) return NextResponse.json({ error: 'No account' }, { status: 404 })

  /* Is this actually their first?
     Counted from the database rather than trusted from the caller: the client
     posts this whenever a session ends, and the server decides whether it
     means anything. Two finished workouts means we are past the moment. */
  const { count: finished } = await admin
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', dbUser.id)
    .not('ended_at', 'is', null)
  if ((finished ?? 0) !== 1) {
    return NextResponse.json({ ok: true, skipped: 'not their first' })
  }

  /* And did they actually lift anything?
     A workout row exists the moment somebody opens a session, and three of
     the 104 rows in production were opened and abandoned without a single
     set. Arun's only session is one of them: started 8 November, zero sets,
     never closed. Emailing "Arun finished his first workout" about that would
     send the coach to congratulate somebody who opened a screen.
     The ledger row is claimed below only once this passes, so an empty
     session leaves the real first one still to come. */
  const { count: logged } = await admin
    .from('workout_sets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', dbUser.id)
  if ((logged ?? 0) === 0) {
    return NextResponse.json({ ok: true, skipped: 'nothing logged' })
  }

  /* Claim it, so two tabs or a retry cannot send twice.
     A duplicate-key violation here is the system working. The row records the
     CLIENT's id — it is the ledger of what has been announced about them,
     even though the email goes to the coach. */
  const { error: claimErr } = await admin.from('notifications_sent').insert({
    user_id: dbUser.id,
    kind: 'first_workout',
    channel: 'email',
    occurrence_key: 'first',
  })
  if (claimErr) {
    return NextResponse.json({ ok: true, skipped: 'already sent' })
  }

  const { data: settings } = await admin
    .from('coach_settings')
    .select('email')
    .limit(1)
    .maybeSingle()

  /* What they actually did, so the coach can open with something real rather
     than "congratulations". The difference between a template and a coach. */
  const { data: workout } = await admin
    .from('workouts')
    .select('id, day_name, duration_seconds')
    .eq('user_id', dbUser.id)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let lifts: string[] = []
  if (workout?.id) {
    const { data: sets } = await admin
      .from('workout_sets')
      .select('exercise_name, weight, reps')
      .eq('workout_id', workout.id)
      .eq('is_intensity_set', false)
      .order('set_number', { ascending: true })

    // Heaviest set per exercise, in the order they trained them.
    const best = new Map<string, { weight: number; reps: number }>()
    for (const s of (sets ?? []) as Array<{ exercise_name: string; weight: number | null; reps: number | null }>) {
      const w = Number(s.weight) || 0
      const r = Number(s.reps) || 0
      const cur = best.get(s.exercise_name)
      if (!cur || w > cur.weight) best.set(s.exercise_name, { weight: w, reps: r })
    }
    lifts = Array.from(best)
      .slice(0, 5)
      .map(([name, v]) => (v.weight > 0 ? `${name} — ${v.weight} × ${v.reps}` : `${name} — ${v.reps} reps`))
  }

  const name = (dbUser.name as string) || (dbUser.email as string) || 'A client'
  const day = workout?.day_name ? String(workout.day_name) : null
  const mins = workout?.duration_seconds ? Math.round(Number(workout.duration_seconds) / 60) : null
  const joined = dbUser.created_at
    ? Math.max(0, Math.floor((Date.now() - Date.parse(String(dbUser.created_at))) / 86400000))
    : null

  const detail = [
    day ? `Session: ${day}` : null,
    mins && mins > 0 ? `${mins} minutes` : null,
    joined != null ? (joined === 0 ? 'Signed up today' : `Signed up ${joined} days ago`) : null,
  ].filter(Boolean) as string[]

  try {
    await sendMail({
      to: (settings?.email as string) || FALLBACK_COACH_EMAIL,
      replyTo: (dbUser.email as string) || undefined,
      subject: `${name} just finished their first workout`,
      text: [
        `${name} logged their first ever session.`,
        '',
        ...detail,
        '',
        ...(lifts.length ? ['What they did:', ...lifts, ''] : []),
        'This is the one message that matters most. Send it tonight.',
        '',
        `https://ajmfit.com/luffy/messages`,
      ].join('\n'),
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1B2D50">
        <p style="font-size:18px;margin:0 0 12px"><strong>${escapeHtml(
          name
        )}</strong> just finished their first ever workout.</p>
        ${
          detail.length
            ? `<p style="margin:0 0 12px;color:#64748B">${detail.map(escapeHtml).join(' &middot; ')}</p>`
            : ''
        }
        ${
          lifts.length
            ? `<ul style="margin:0 0 16px;padding-left:18px">${lifts
                .map((l) => `<li>${escapeHtml(l)}</li>`)
                .join('')}</ul>`
            : ''
        }
        <p style="margin:0 0 16px">Asking how it felt, tonight, is the highest-value message you will send them.</p>
        <p style="margin:0"><a href="https://ajmfit.com/luffy/messages" style="color:#1A7BFF">Message ${escapeHtml(
          name
        )}</a></p>
      </div>`,
    })
  } catch (e) {
    console.error('[first-workout-notify] email failed', e)
  }

  return NextResponse.json({ ok: true, sent: true })
}
