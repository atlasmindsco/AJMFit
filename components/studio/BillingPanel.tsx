'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TIER_LABELS, type Tier } from '@/lib/stripe/catalog'

interface SubRow {
  tier: string | null
  status: string | null
  current_period_end: string | null
  trial_end: string | null
  cancel_at_period_end: boolean
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null

/**
 * What the client is paying, when it renews, and how to change it.
 *
 * None of this was visible anywhere: no renewal date, no trial end, no way to
 * cancel or update a card. Billing that a client cannot see or control is the
 * fastest route to a chargeback, and in several jurisdictions an online
 * subscription has to be cancellable online.
 */
export default function BillingPanel({ userId }: { userId: string }) {
  const [sub, setSub] = useState<SubRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const { data } = await db
        .from('subscriptions')
        .select('tier, status, current_period_end, trial_end, cancel_at_period_end')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!active) return
      setSub((data ?? null) as SubRow | null)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [userId])

  const openPortal = async () => {
    setOpening(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not open billing.')
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open billing.')
      setOpening(false)
    }
  }

  if (loading || !sub) return null

  const trialing = sub.status === 'trialing' && sub.trial_end
  const renews = fmt(sub.current_period_end)

  const line = () => {
    if (sub.cancel_at_period_end && renews) return `Ends ${renews}. You keep access until then.`
    if (sub.status === 'past_due' || sub.status === 'unpaid')
      return 'Your last payment did not go through. Update your card to get back in.'
    if (trialing) return `Free trial ends ${fmt(sub.trial_end)}, then billing starts.`
    if (renews) return `Renews automatically on ${renews}. Cancel any time.`
    return 'Active.'
  }

  const urgent = sub.status === 'past_due' || sub.status === 'unpaid'

  return (
    <div
      className={`rounded-card border p-5 mb-6 ${
        urgent ? 'bg-state-danger/[0.08] border-state-danger/30' : 'bg-surface-raised border-white/[0.10]'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display font-bold text-white text-sm">
            {sub.tier ? TIER_LABELS[sub.tier as Tier] ?? sub.tier : 'Your plan'}
          </p>
          <p className={`text-xs font-body mt-1 leading-relaxed ${urgent ? 'text-state-danger' : 'text-white/45'}`}>
            {line()}
          </p>
          {error && <p className="text-state-danger text-xs font-body mt-1.5">{error}</p>}
        </div>
        <button
          onClick={openPortal}
          disabled={opening}
          className={`shrink-0 px-4 py-2.5 rounded-control text-xs font-display font-bold uppercase tracking-[0.12em] transition-all duration-200 active:scale-[0.98] disabled:opacity-40 ${
            urgent
              ? 'bg-brand-orange text-white hover:bg-brand-orangedark'
              : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white'
          }`}
        >
          {opening ? 'Opening…' : urgent ? 'Update card' : 'Manage'}
        </button>
      </div>
    </div>
  )
}
