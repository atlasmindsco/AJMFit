'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CalendlyEmbed from '@/components/studio/CalendlyEmbed'
import {
  fetchMySessions,
  fetchMyTier,
  fetchWeekSessions,
  hasBookedOnboarding,
  type Session,
} from '@/lib/scheduling'
import { TIER_SCHEDULING, calendlyUrl } from '@/lib/scheduling-tiers'
import { TIER_LABELS, type Tier } from '@/lib/stripe/catalog'

interface Client {
  id: string
  name: string | null
  email: string | null
}

export default function SchedulePage() {
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [tier, setTier] = useState<Tier | null>(null)
  const [onboardingDone, setOnboardingDone] = useState(false)
  const [weekSessions, setWeekSessions] = useState<Session[]>([])
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setLoading(false)
        return
      }
      const { data: u } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('auth_id', user.id)
        .maybeSingle<Client>()
      if (cancelled || !u) {
        if (!cancelled) setLoading(false)
        return
      }

      const [t, onboarded, week, mine] = await Promise.all([
        fetchMyTier(u.id),
        hasBookedOnboarding(u.id),
        fetchWeekSessions(u.id),
        fetchMySessions(u.id),
      ])
      if (cancelled) return

      setClient(u)
      setTier(t)
      setOnboardingDone(onboarded)
      setWeekSessions(week)
      setSessions(mine)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
      </div>
    )
  }

  const config = tier ? TIER_SCHEDULING[tier] : null
  const prefill = {
    name: client?.name ?? undefined,
    email: client?.email ?? undefined,
  }

  const upcoming = sessions.filter(
    (s) => s.status === 'scheduled' && new Date(s.starts_at).getTime() > Date.now()
  )

  const hasAnyCalls = !!config && (config.onboardingSlug !== null || config.weekly.length > 0)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display font-bold text-white text-2xl uppercase tracking-[0.04em]">
          Schedule
        </h1>
        <p className="text-white/40 text-sm font-body mt-1">
          {tier ? `${TIER_LABELS[tier]} plan` : 'Book your calls with Coach Anthony'}
        </p>
      </header>

      {/* Plans without live calls (Blueprint) */}
      {!hasAnyCalls && (
        <section className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="font-display font-semibold text-white text-lg uppercase tracking-wide mb-1">
            Coaching calls
          </h2>
          <p className="text-white/50 text-sm font-body">
            Your plan is self-guided — full app access plus M-F messaging with Coach
            Anthony. Live welcome and weekly calls come with the Accelerator and Full
            Experience plans; upgrade any time to add them.
          </p>
        </section>
      )}

      {/* Onboarding / welcome call */}
      {config?.onboardingSlug && (
        <section className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display font-semibold text-white text-lg uppercase tracking-wide">
              Welcome call
            </h2>
            {onboardingDone && (
              <span className="text-xs font-body font-medium text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                Booked
              </span>
            )}
          </div>

          {onboardingDone ? (
            <p className="text-white/50 text-sm font-body">
              Your welcome call is on the books — see it under Upcoming below. Need a
              different time? Use the reschedule link in your Calendly confirmation email.
            </p>
          ) : (
            <>
              <p className="text-white/50 text-sm font-body mb-4">
                Let&rsquo;s kick things off. Pick a time for your welcome call so Coach
                Anthony can build your plan around your goals, schedule, and equipment.
              </p>
              <CalendlyEmbed url={calendlyUrl(config.onboardingSlug)} prefill={prefill} />
            </>
          )}
        </section>
      )}

      {/* Weekly calls (one section per call type the tier includes) */}
      {config?.weekly.map((wc) => {
        const used = weekSessions.filter((s) => wc.matchType.test(s.type ?? '')).length
        const remaining = Math.max(0, wc.quota - used)
        return (
          <section
            key={wc.key}
            className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display font-semibold text-white text-lg uppercase tracking-wide">
                {wc.label}
              </h2>
              <span className="text-xs font-body font-medium text-white/60 bg-white/[0.06] px-2.5 py-1 rounded-full">
                {used} / {wc.quota} this week
              </span>
            </div>

            {remaining === 0 ? (
              <p className="text-white/50 text-sm font-body">
                You&rsquo;ve booked all {wc.quota}{' '}
                {wc.quota === 1 ? 'of this' : 'of these'} week&rsquo;s{' '}
                {wc.label.toLowerCase()}
                {wc.quota === 1 ? '' : 's'}. New slots open next week.
              </p>
            ) : (
              <>
                <p className="text-white/50 text-sm font-body mb-4">
                  {remaining} {remaining === 1 ? 'slot' : 'slots'} left this week.
                </p>
                <CalendlyEmbed url={calendlyUrl(wc.slug)} prefill={prefill} />
              </>
            )}
          </section>
        )
      })}

      {/* Upcoming */}
      <section>
        <h2 className="font-display font-semibold text-white text-lg uppercase tracking-wide mb-3">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-white/40 text-sm font-body">No upcoming sessions yet.</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3"
              >
                <div>
                  <p className="text-white text-sm font-body font-medium">
                    {s.type || 'Session'}
                  </p>
                  <p className="text-white/40 text-xs font-body mt-0.5">
                    {new Date(s.starts_at).toLocaleString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}{' '}
                    · {s.duration_min} min
                  </p>
                </div>
                {s.join_url && (
                  <a
                    href={s.join_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-body font-semibold text-[#F76B16] hover:text-[#ff7d2e] transition-colors"
                  >
                    Join →
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
