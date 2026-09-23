'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { signOut, getCurrentUserId } from '@/lib/current-user'
import { createClient } from '@/lib/supabase/client'

/**
 * Full-screen paywall shown in the studio to an approved client whose
 * subscription isn't active yet.
 *
 * Someone who has never subscribed starts a Stripe Checkout with the 7-day
 * trial. Someone who already has a Stripe customer — typically a failed
 * payment that set them to 'paused' — is sent to the billing portal instead.
 * Offering them checkout would have started a second subscription alongside
 * the broken one and billed them twice.
 */
export default function MembershipPaywall() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasBilling, setHasBilling] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const id = await getCurrentUserId()
      if (!id || !active) return
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const { data } = await db
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', id)
        .not('stripe_customer_id', 'is', null)
        .limit(1)
        .maybeSingle()
      if (active) setHasBilling(!!data?.stripe_customer_id)
    })()
    return () => {
      active = false
    }
  }, [])

  const start = async () => {
    setLoading(true)
    setError(null)
    try {
      const endpoint = hasBilling ? '/api/stripe/portal' : '/api/stripe/checkout'
      const res = await fetch(endpoint, { method: 'POST' })
      const body = (await res.json()) as { url?: string; error?: string }
      if (body.url) {
        window.location.href = body.url
        return
      }
      setError(body.error ?? 'Could not open billing. Please try again.')
    } catch {
      setError('Could not open billing. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/members'
  }

  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <Image src="/AJMfit.png" alt="AJMFit" width={40} height={40} className="w-10 h-10 object-contain" />
          <span className="font-display font-bold text-white text-lg uppercase tracking-[0.15em]">AJM Fit</span>
        </div>

        <div className="rounded-card border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-8 sm:p-10">
          <span className="inline-block rounded-full bg-brand-orange/15 px-3 py-1 font-display font-bold text-[10px] uppercase tracking-[0.2em] text-brand-orange">
            Application approved
          </span>

          <h1 className="mt-5 font-display font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-white">
            Start your membership
          </h1>
          <p className="mt-3 text-white/60 text-sm font-body leading-relaxed">
            You&rsquo;re in. Begin your 7-day free trial to unlock your custom plan, nutrition tracking,
            and direct access to Coach Anthony. No charge today, cancel anytime during the trial.
          </p>

          {error && <p className="mt-4 text-red-300 text-sm font-body">{error}</p>}

          <button
            onClick={start}
            disabled={loading}
            className="mt-7 w-full py-4 rounded-control bg-brand-orange text-white font-display font-bold text-sm uppercase tracking-[0.12em] hover:bg-brand-orangedark active:scale-[0.98] transition-all duration-200 disabled:opacity-60"
          >
            {loading ? 'Starting…' : 'Start 7-day free trial'}
          </button>

          <p className="mt-4 text-white/30 text-xs font-body">
            Secure checkout via Stripe.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="mt-6 text-white/40 hover:text-white/70 text-sm font-body transition-colors duration-200"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
