import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FALLBACK_COACH_EMAIL = 'anthony@ajmfit.com'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
const waitLabel = (d: number) => (d === 0 ? 'today' : d === 1 ? '1 day' : `${d} days`)

/**
 * Daily digest of everyone waiting on the coach: unread client messages and
 * pending applications. The safety net behind the per-message email — if that
 * one gets missed, this keeps surfacing it until the thread is opened.
 *
 * Sends NOTHING when there is nothing waiting. A digest that arrives every day
 * saying "all clear" is one you stop opening.
 *
 * Scheduled by vercel.json. Vercel sets CRON_SECRET as a bearer token when the
 * env var is configured; without it we fall back to the x-vercel-cron header.
 * The response body never contains client data, so the worst an unauthorized
 * caller achieves is making the coach's own digest arrive early.
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const [{ data: unread }, { data: pending }, { data: settings }, { data: awaitingCi }, { data: activeUsers }] =
    await Promise.all([
      admin
        .from('messages')
        .select('user_id, body, created_at')
        .eq('from_trainer', false)
        .is('read_at', null)
        .order('created_at', { ascending: true }),
      admin
        .from('applications')
        .select('user_id, tier, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      admin.from('coach_settings').select('email').limit(1).maybeSingle(),
      // Check-ins the coach has not replied to yet.
      admin
        .from('check_ins')
        .select('user_id, submitted_at, energy, nutrition_adherence')
        .is('coach_response', null)
        .order('submitted_at', { ascending: true }),
      admin.from('users').select('id').eq('status', 'active'),
    ])

  const unreadRows = (unread ?? []) as Array<{ user_id: string; body: string; created_at: string }>
  const pendingRows = (pending ?? []) as Array<{ user_id: string; tier: string; created_at: string }>
  const checkInRows = (awaitingCi ?? []) as Array<{
    user_id: string
    submitted_at: string
    energy: number | null
    nutrition_adherence: number | null
  }>

  // Clients who have gone quiet. This is the piece the coach cannot spot without
  // opening every profile, which is exactly what the digest should remove.
  const activeIds = ((activeUsers ?? []) as Array<{ id: string }>).map((u) => u.id)
  const cutoff = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10)
  const { data: recentWorkouts } = await admin
    .from('workouts')
    .select('user_id, date')
    .in('user_id', activeIds.length ? activeIds : ['00000000-0000-0000-0000-000000000000'])
    .gte('date', cutoff)
  const trainedRecently = new Set(((recentWorkouts ?? []) as Array<{ user_id: string }>).map((w) => w.user_id))
  const quietIds = activeIds.filter((id) => !trainedRecently.has(id))

  if (!unreadRows.length && !pendingRows.length && !checkInRows.length && !quietIds.length) {
    return NextResponse.json({ ok: true, sent: false, reason: 'nothing waiting' })
  }

  const idSet: Record<string, true> = {}
  for (const r of unreadRows) idSet[r.user_id] = true
  for (const r of pendingRows) idSet[r.user_id] = true
  for (const r of checkInRows) idSet[r.user_id] = true
  for (const id of quietIds) idSet[id] = true
  const { data: users } = await admin.from('users').select('id, name, email').in('id', Object.keys(idSet))
  const byId = new Map(
    ((users ?? []) as Array<{ id: string; name: string; email: string }>).map((u) => [u.id, u])
  )

  // Oldest-first input means the first row per client is their longest wait.
  const threads: Record<string, { oldest: string; latest: string; count: number }> = {}
  for (const m of unreadRows) {
    const t = threads[m.user_id]
    if (t) {
      t.count++
      t.latest = m.body
    } else {
      threads[m.user_id] = { oldest: m.created_at, latest: m.body, count: 1 }
    }
  }

  const sorted = Object.keys(threads)
    .map((uid) => ({ uid, ...threads[uid] }))
    .sort((a, b) => new Date(a.oldest).getTime() - new Date(b.oldest).getTime())

  const section = (title: string, rows: string[]) =>
    rows.length
      ? `<p style="margin:24px 0 8px;color:#F76B16;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">${title}</p>${rows.join(
          ''
        )}`
      : ''

  const messageRows = sorted.map((t) => {
    const u = byId.get(t.uid)
    const waiting = daysSince(t.oldest)
    const urgent = waiting >= 3
    return `<div style="padding:12px 0;border-bottom:1px solid #eef1f5;">
      <div style="color:#1B2D50;font-size:15px;font-weight:bold;">${escapeHtml(u?.name ?? 'Unknown client')}
        <span style="font-weight:normal;color:${urgent ? '#DC2626' : '#94a3b8'};font-size:13px;">
          · waiting ${waitLabel(waiting)}${t.count > 1 ? ` · ${t.count} messages` : ''}</span></div>
      <div style="color:#475569;font-size:14px;line-height:1.5;margin-top:4px;">${escapeHtml(
        String(t.latest ?? '').slice(0, 160)
      )}</div>
    </div>`
  })

  const applicationRows = pendingRows.map((a) => {
    const u = byId.get(a.user_id)
    return `<div style="padding:12px 0;border-bottom:1px solid #eef1f5;">
      <div style="color:#1B2D50;font-size:15px;font-weight:bold;">${escapeHtml(u?.name ?? 'Unknown applicant')}
        <span style="font-weight:normal;color:#94a3b8;font-size:13px;"> · ${escapeHtml(
          a.tier
        )} · waiting ${waitLabel(daysSince(a.created_at))}</span></div>
    </div>`
  })

  const checkInSectionRows = checkInRows.map((c) => {
    const u = byId.get(c.user_id)
    const low = [
      c.energy != null && c.energy <= 2 ? `energy ${c.energy}/5` : '',
      c.nutrition_adherence != null && c.nutrition_adherence <= 2 ? `nutrition ${c.nutrition_adherence}/5` : '',
    ].filter(Boolean)
    return `<div style="padding:12px 0;border-bottom:1px solid #eef1f5;">
      <div style="color:#1B2D50;font-size:15px;font-weight:bold;">${escapeHtml(u?.name ?? 'Unknown client')}
        <span style="font-weight:normal;color:#94a3b8;font-size:13px;"> · waiting ${waitLabel(
          daysSince(c.submitted_at)
        )}</span></div>
      ${low.length ? `<div style="color:#DC2626;font-size:13px;margin-top:2px;">${low.join(' · ')}</div>` : ''}
    </div>`
  })

  const quietSectionRows = quietIds.map((id) => {
    const u = byId.get(id)
    return `<div style="padding:12px 0;border-bottom:1px solid #eef1f5;">
      <div style="color:#1B2D50;font-size:15px;font-weight:bold;">${escapeHtml(u?.name ?? 'Unknown client')}
        <span style="font-weight:normal;color:#94a3b8;font-size:13px;"> · no workout in 10+ days</span></div>
    </div>`
  })

  const headline = [
    checkInRows.length ? `${checkInRows.length} check-${checkInRows.length === 1 ? 'in' : 'ins'} to review` : '',
    sorted.length ? `${sorted.length} ${sorted.length === 1 ? 'client' : 'clients'} waiting on a reply` : '',
    quietIds.length ? `${quietIds.length} gone quiet` : '',
    pendingRows.length ? `${pendingRows.length} pending ${pendingRows.length === 1 ? 'application' : 'applications'}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  try {
    await sendMail({
      to: (settings?.email as string) || FALLBACK_COACH_EMAIL,
      subject: `AJM Fit — ${headline}`,
      text: headline,
      html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1420;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#1B2D50;padding:24px 32px;" align="center">
        <img src="https://ajmfit.com/AJMfit.png" width="44" height="44" alt="AJM Fit" style="display:block;margin:0 auto 8px;" />
        <div style="color:#ffffff;font-size:14px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">AJM FIT</div>
      </td></tr>
      <tr><td style="padding:28px 32px 8px;">
        <h1 style="margin:0 0 4px;color:#1B2D50;font-size:20px;font-weight:800;">${escapeHtml(headline)}</h1>
        ${section('Check-ins to review', checkInSectionRows)}
        ${section('Waiting on a reply', messageRows)}
        ${section('Gone quiet', quietSectionRows)}
        ${section('Pending applications', applicationRows)}
      </td></tr>
      <tr><td style="padding:20px 32px 32px;">
        <a href="https://ajmfit.com/luffy/messages" style="display:inline-block;background:#1A7BFF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:8px;">Open the portal</a>
      </td></tr>
    </table>
  </td></tr>
</table>`,
    })
  } catch (e) {
    console.error('[cron/digest] email failed', e)
    return NextResponse.json({ ok: false, error: 'send failed' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, sent: true, threads: sorted.length, applications: pendingRows.length })
}
