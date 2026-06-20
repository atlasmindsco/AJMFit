'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Shown in the studio to a client whose membership isn't active yet (approved
 * but hasn't started their subscription). Starts a Stripe Checkout (7-day trial).
 */
export default function MembershipBanner() {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: u } = await supabase
        .from('users')
        .select('status')
        .eq('auth_id', data.user.id)
        .maybeSingle<{ status: string }>()
      if (u && u.status !== 'active') setShow(true)
    })
  }, [])

  const start = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const body = (await res.json()) as { url?: string; error?: string }
      if (body.url) {
        window.location.href = body.url
        return
      }
      setError(body.error ?? 'Could not start checkout. Please try again.')
    } catch {
      setError('Could not start checkout. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!show) return null

  return (
    <div className="mb-6 rounded-xl border border-[#F76B16]/30 bg-gradient-to-r from-[#F76B16]/[0.12] to-[#1A7BFF]/[0.08] px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">
            Start your membership
          </p>
          <p className="mt-1 text-white/60 text-sm font-body">
            Your application is approved. Begin your 7-day free trial to unlock your full plan — no charge today.
          </p>
          {error && <p className="mt-2 text-red-300 text-xs font-body">{error}</p>}
        </div>
        <button
          onClick={start}
          disabled={loading}
          className="shrink-0 px-6 py-3 rounded-lg bg-[#F76B16] text-white font-display font-bold text-sm uppercase tracking-[0.1em] hover:bg-[#D8590C] active:scale-[0.98] transition-all duration-200 disabled:opacity-60"
        >
          {loading ? 'Starting…' : 'Start free trial'}
        </button>
      </div>
    </div>
  )
}
