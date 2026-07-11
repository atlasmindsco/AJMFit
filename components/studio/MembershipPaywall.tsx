'use client'

import { useState } from 'react'
import Image from 'next/image'
import { signOut } from '@/lib/current-user'

/**
 * Full-screen paywall shown in the studio to an approved client whose
 * subscription isn't active yet. Starts a Stripe Checkout (7-day trial).
 */
export default function MembershipPaywall() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/members'
  }

  return (
    <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <Image src="/AJMfit.png" alt="AJMFit" width={40} height={40} className="w-10 h-10 object-contain" />
          <span className="font-display font-bold text-white text-lg uppercase tracking-[0.15em]">AJM Fit</span>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-8 sm:p-10">
          <span className="inline-block rounded-full bg-[#F76B16]/15 px-3 py-1 font-display font-bold text-[10px] uppercase tracking-[0.2em] text-[#F76B16]">
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
            className="mt-7 w-full py-4 rounded-lg bg-[#F76B16] text-white font-display font-bold text-sm uppercase tracking-[0.12em] hover:bg-[#D8590C] active:scale-[0.98] transition-all duration-200 disabled:opacity-60"
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
