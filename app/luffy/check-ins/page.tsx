'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllCheckIns, previousWeekOf, type CheckIn } from '@/lib/check-ins'
import { fetchBriefSource } from '@/lib/admin'
import { buildBrief, type BriefSession } from '@/lib/client-brief'

interface ClientLite {
  id: string
  name: string | null
  email: string | null
}

const labelCls = 'text-white/30 text-2xs font-display font-bold uppercase tracking-[0.15em]'

/** 1-5 rating, coloured so a problem is visible without reading. */
function Rating({ label, value }: { label: string; value: number | null }) {
  const tone =
    value == null
      ? 'text-white/30'
      : value <= 2
      ? 'text-state-danger'
      : value === 3
      ? 'text-state-warning'
      : 'text-state-success'
  return (
    <div>
      <p className={labelCls}>{label}</p>
      <p className={`font-display font-extrabold text-xl tabular-nums mt-0.5 ${tone}`}>
        {value ?? '—'}
        {value != null && <span className="text-white/25 text-xs font-body">/5</span>}
      </p>
    </div>
  )
}

/**
 * The coach's review queue.
 *
 * Check-ins awaiting a reply come first, oldest at the top — that ordering is
 * the whole point, because the person who has waited longest is the one most
 * likely to disengage. Each card carries last week's answers beside this
 * week's so a trend is visible without opening anything else.
 */
export default function CoachCheckInsPage() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [clients, setClients] = useState<Map<string, ClientLite>>(new Map())
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [sending, setSending] = useState<string | null>(null)
  const [source, setSource] = useState<{ sessionsByUser: Map<string, string[]>; liftsByUser: Map<string, BriefSession[]> }>({
    sessionsByUser: new Map(),
    liftsByUser: new Map(),
  })

  const load = async () => {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const [all, { data: users }, src] = await Promise.all([
      fetchAllCheckIns().catch(() => []),
      db.from('users').select('id, name, email'),
      fetchBriefSource().catch(() => ({ sessionsByUser: new Map(), liftsByUser: new Map() })),
    ])
    setSource(src)
    setCheckIns(all)
    setClients(new Map(((users ?? []) as ClientLite[]).map((u) => [u.id, u])))
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const respond = async (id: string) => {
    const text = (drafts[id] ?? '').trim()
    if (!text) return
    setSending(id)
    try {
      const res = await fetch('/api/admin/check-in-respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkInId: id, response: text }),
      })
      if (!res.ok) throw new Error('failed')
      setDrafts((d) => ({ ...d, [id]: '' }))
      await load()
    } catch (e) {
      console.error('[check-in respond] failed', e)
    } finally {
      setSending(null)
    }
  }

  const awaiting = checkIns.filter((c) => !c.coach_response)
  const answered = checkIns.filter((c) => c.coach_response).slice(0, 20)

  const daysWaiting = (iso: string) =>
    Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)

  /**
   * The seven days this check-in covers, against the seven before it.
   *
   * Windowed on the check-in's own week rather than "the last 7 days", so a
   * reply written three days late still describes the week the client was
   * actually reporting on.
   */
  const briefFor = (c: CheckIn) => {
    const client = clients.get(c.user_id)
    if (!client) return null
    const prev = checkIns.find((x) => x.user_id === c.user_id && x.week_of === previousWeekOf(c.week_of))

    const weekStart = c.week_of
    const weekEnd = new Date(`${c.week_of}T00:00:00Z`)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
    const end = weekEnd.toISOString().slice(0, 10)
    const priorStart = previousWeekOf(c.week_of)

    const inRange = (d: string, from: string, to: string) => d >= from && d < to
    const sessions = (source.sessionsByUser.get(c.user_id) ?? []).filter((d) => inRange(d, weekStart, end))
    const priorSessions = (source.sessionsByUser.get(c.user_id) ?? []).filter((d) => inRange(d, priorStart, weekStart))
    const lifts = (source.liftsByUser.get(c.user_id) ?? []).filter((l) => inRange(l.date, weekStart, end))
    const priorLifts = (source.liftsByUser.get(c.user_id) ?? []).filter((l) => inRange(l.date, priorStart, weekStart))

    return buildBrief({
      clientName: client.name ?? 'there',
      windowDays: 7,
      sessionDates: sessions,
      priorSessionDates: priorSessions,
      lifts,
      priorLifts,
      weightNow: c.weight_lb,
      weightBefore: prev?.weight_lb ?? null,
      energy: c.energy,
      nutritionAdherence: c.nutrition_adherence,
      sleep: c.sleep_quality,
      hunger: c.hunger,
      win: c.win,
      obstacle: c.obstacle,
    })
  }

  const card = (c: CheckIn, isAwaiting: boolean) => {
    const client = clients.get(c.user_id)
    const prev = checkIns.find(
      (x) => x.user_id === c.user_id && x.week_of === previousWeekOf(c.week_of)
    )
    const waited = daysWaiting(c.submitted_at)
    const weightDelta =
      c.weight_lb != null && prev?.weight_lb != null
        ? Math.round((Number(c.weight_lb) - Number(prev.weight_lb)) * 10) / 10
        : null

    return (
      <div
        key={c.id}
        className={`bg-surface-raised rounded-card border p-5 ${
          isAwaiting && waited >= 3 ? 'border-state-danger/40' : 'border-white/[0.10]'
        }`}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="font-display font-bold text-white text-base">{client?.name ?? 'Unknown'}</p>
            <p className="text-white/35 text-xs font-body mt-0.5">
              Week of{' '}
              {new Date(c.week_of + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {isAwaiting && (
                <span className={waited >= 3 ? 'text-state-danger' : 'text-white/35'}>
                  {' '}
                  · waiting {waited === 0 ? 'today' : `${waited}d`}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <p className={labelCls}>Weight</p>
            <p className="font-display font-extrabold text-xl text-white tabular-nums mt-0.5">
              {c.weight_lb != null ? Number(c.weight_lb) : '—'}
              {weightDelta != null && (
                <span className={`text-xs font-body ml-1.5 ${weightDelta === 0 ? 'text-white/30' : 'text-brand-orange'}`}>
                  {weightDelta > 0 ? '+' : ''}
                  {weightDelta}
                </span>
              )}
            </p>
          </div>
          <div>
            <p className={labelCls}>Workouts</p>
            <p className="font-display font-extrabold text-xl text-white tabular-nums mt-0.5">
              {c.workouts_completed ?? '—'}
            </p>
          </div>
          <Rating label="Nutrition" value={c.nutrition_adherence} />
          <Rating label="Energy" value={c.energy} />
        </div>

        {(c.win || c.obstacle) && (
          <div className="space-y-2.5 mb-4">
            {c.win && (
              <div>
                <p className={labelCls}>Win</p>
                <p className="text-white/75 text-sm font-body mt-0.5 leading-relaxed">{c.win}</p>
              </div>
            )}
            {c.obstacle && (
              <div>
                <p className={labelCls}>Obstacle</p>
                <p className="text-white/75 text-sm font-body mt-0.5 leading-relaxed">{c.obstacle}</p>
              </div>
            )}
          </div>
        )}

        {isAwaiting ? (
          <>
            {/* Their numbers, assembled.
                Reviewing a check-in properly takes ten to fifteen minutes, and
                most of that is opening four screens to find what is already
                known. Software cannot make the DECIDING faster; it can remove
                the gathering, which is the part with no coaching in it. */}
            {(() => {
              const brief = briefFor(c)
              if (!brief) return null
              return (
                <div className="mb-3 px-4 py-3 rounded-control bg-white/[0.03] border border-white/[0.07]">
                  <p className={labelCls}>Their week</p>
                  <ul className="mt-1.5 space-y-1">
                    {brief.facts.map((f, i) => (
                      <li key={i} className="text-white/70 text-sm font-body leading-relaxed">
                        {f}
                      </li>
                    ))}
                  </ul>
                  {brief.flags.length > 0 && (
                    <p className="text-state-warning text-xs font-body mt-2.5">
                      {brief.flags.join(' · ')}
                    </p>
                  )}
                  {brief.draft && !(drafts[c.id] ?? '').trim() && (
                    <button
                      onClick={() => setDrafts((d) => ({ ...d, [c.id]: brief.draft! + ' ' }))}
                      className="mt-3 px-3 py-1.5 rounded-control bg-brand-blue/15 text-brand-blue text-2xs font-display font-bold uppercase tracking-wide hover:bg-brand-blue/25 transition-colors duration-150"
                    >
                      Start from these facts
                    </button>
                  )}
                </div>
              )
            })()}

            <textarea
              rows={3}
              value={drafts[c.id] ?? ''}
              onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
              placeholder="What changes this week, and why. This goes to their messages too."
              className="w-full px-3 py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-sm font-body placeholder:text-white/25 focus:outline-none focus:border-brand-blue/50"
            />
            <button
              onClick={() => respond(c.id)}
              disabled={!(drafts[c.id] ?? '').trim() || sending === c.id}
              className="mt-2 px-5 py-2.5 rounded-control bg-brand-orange text-white text-xs font-display font-bold uppercase tracking-[0.12em] hover:bg-brand-orangedark active:scale-[0.98] transition-all duration-200 disabled:opacity-40"
            >
              {sending === c.id ? 'Sending…' : 'Send reply'}
            </button>
          </>
        ) : (
          <div className="pt-3 border-t border-white/[0.06]">
            <p className={labelCls}>Your reply</p>
            <p className="text-white/60 text-sm font-body mt-1 whitespace-pre-wrap leading-relaxed">
              {c.coach_response}
            </p>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">Check-ins</h1>
        <p className="text-white/40 text-sm font-body mt-1">
          {awaiting.length === 0
            ? 'Nothing waiting on you.'
            : `${awaiting.length} waiting on a reply, longest first.`}
        </p>
      </header>

      {awaiting.length > 0 && <div className="space-y-3 mb-8">{awaiting.map((c) => card(c, true))}</div>}

      {answered.length > 0 && (
        <>
          <p className={`${labelCls} mb-2`}>Answered</p>
          <div className="space-y-3">{answered.map((c) => card(c, false))}</div>
        </>
      )}

      {checkIns.length === 0 && (
        <div className="bg-surface-raised rounded-card border border-white/[0.10] p-8 text-center">
          <p className="text-white font-display font-bold text-sm">No check-ins yet</p>
          <p className="text-white/40 text-sm font-body mt-1">
            They&rsquo;ll appear here as clients submit them each week.
          </p>
        </div>
      )}
    </div>
  )
}
