'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { setCurrentUserId } from '@/lib/current-user'

/**
 * Shown on studio pages when no user is in localStorage.
 * Pre-auth shim: enter the email you applied with → we look up the user and
 * store the ID client-side. TODO(auth): replace with real Supabase Auth.
 */
export default function ResumeSession({ title = 'Sign in to continue' }: { title?: string }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: lookupErr } = await supabase
        .from('users')
        .select('id')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .eq('email' as any, email.trim().toLowerCase())
        .maybeSingle()
      if (lookupErr) throw lookupErr
      if (!data) {
        setError(`No account found for ${email}. Did you apply with this email?`)
        return
      }
      setCurrentUserId((data as { id: string }).id)
      window.location.reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-md mx-auto">
      <div className="bg-white rounded-xl border border-[#1B2D50]/[0.06] p-8">
        <h1 className="font-display font-extrabold text-2xl text-[#1B2D50] mb-2">{title}</h1>
        <p className="text-[#64748B] text-sm font-body mb-6">
          Enter the email you applied with. No password needed (yet).
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            required
            className="w-full px-4 py-3 bg-[#FAFBFD] border border-[#1B2D50]/10 rounded-md text-[#1B2D50] text-sm font-body focus:outline-none focus:border-[#1668E0]/50 transition-colors duration-200"
          />
          {error && <p className="text-red-600 text-xs font-body">{error}</p>}
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-3 bg-[#1668E0] text-white text-sm font-display font-bold uppercase tracking-[0.12em] rounded-md hover:bg-[#0F52C9] disabled:opacity-50 transition-colors duration-200"
          >
            {loading ? 'Looking up...' : 'Continue'}
          </button>
        </form>
        <p className="text-[#64748B] text-xs font-body mt-6 text-center">
          Don&rsquo;t have an account?{' '}
          <a href="/apply" className="text-[#1668E0] underline">
            Apply for coaching
          </a>
        </p>
      </div>
    </div>
  )
}
