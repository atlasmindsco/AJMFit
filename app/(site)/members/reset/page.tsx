'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Set-password page. Reached after the auth callback establishes a session from
 * an invite or password-reset email. Sets a new password, then routes the user
 * into their portal.
 */
export default function SetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Confirm a session exists (the callback should have set one).
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        setError('This link has expired. Please request a new one.')
      }
      setReady(true)
    })
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { data: updated, error: updateError } = await supabase.auth.updateUser({
      password,
    })
    setLoading(false)

    if (updateError) {
      setError('Could not set your password. The link may have expired.')
      return
    }

    const role = (updated.user?.app_metadata as { role?: string } | undefined)?.role
    router.push(role === 'trainer' ? '/luffy' : '/studio')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-brand-offwhite flex flex-col items-center justify-center px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="flex justify-center mb-10">
          <Link href="/">
            <Image src="/AJMfit.png" alt="AJMFit" width={80} height={80} className="w-20 h-20 object-contain" />
          </Link>
        </div>

        <div className="bg-white rounded-sm border border-brand-navy/[0.08] shadow-[0_4px_40px_rgba(27,45,80,0.06)] p-8 md:p-10">
          <h1 className="font-display font-extrabold text-2xl uppercase tracking-[0.05em] text-brand-navy text-center">
            Set Your Password
          </h1>
          <p className="text-center text-sm font-body text-brand-slate mt-2">
            Choose a password to access your studio
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="new-password" className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-sm font-body text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors duration-200"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                disabled={!ready}
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-sm font-body text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors duration-200"
                placeholder="Re-enter your password"
                autoComplete="new-password"
                disabled={!ready}
              />
            </div>

            {error && <p className="text-sm font-body text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading || !ready}
              className="w-full py-3.5 bg-brand-navy text-white font-display font-bold text-sm uppercase tracking-[0.12em] rounded-sm hover:bg-brand-navy/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50 focus-visible:ring-offset-2 transition-all duration-200 disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Set Password & Continue'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/members" className="font-body text-sm text-brand-blue hover:text-brand-blue/80 transition-colors duration-200">
              Back to Login
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
