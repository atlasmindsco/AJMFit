'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Create your password here, on the page you land on after paying.
 *
 * This replaces "check your inbox for an email, then click a link, then set a
 * password, then sign in" with one field and one button. The measured cost of
 * the old flow was a buyer who never opened the account at all and several who
 * took one to three weeks to get in.
 *
 * ONE field, not a password and a confirmation.
 *
 * A confirmation box exists to catch a typo you cannot see, which is why it
 * has a "show password" toggle instead — the toggle catches the same typo and
 * costs one tap rather than a second full entry on a phone keyboard. Getting
 * it wrong is also cheap and recoverable here: they are signed straight in, so
 * a mistyped password shows up immediately rather than at the next login, and
 * "forgot password" is one click away on the sign-in page.
 */
export default function ClaimAccount({ sessionId, email }: { sessionId: string; email: string | null }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/blueprint/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, password }),
      })
      const data = (await res.json()) as { ok?: boolean; email?: string; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not set your password.')

      // Sign them in with what they just typed. Doing it here rather than on
      // the server keeps the session in the browser where the studio expects
      // it, and means they never see a login screen at all.
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email ?? email ?? '',
        password,
      })
      if (signInError) {
        // The password is set, so this is recoverable: send them to sign in
        // rather than leaving them on a dead page.
        router.push('/members?set=1')
        return
      }

      // Straight to the program picker — the actual next thing they want.
      router.push('/studio/programs')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="text-left">
      <label
        htmlFor="bp-password"
        className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2"
      >
        Create your password
      </label>

      {/* The email is read-only context, not a field. They just typed it into
          Stripe; asking again is a chance to typo it into a different account. */}
      {email && (
        <p className="text-brand-slate text-sm font-body mb-3">
          for <strong className="text-brand-navy">{email}</strong>
        </p>
      )}

      <div className="relative">
        <input
          id="bp-password"
          type={show ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3.5 pr-16 bg-white border border-brand-navy/[0.12] rounded-control font-body text-base text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/20 transition-colors duration-200"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          autoFocus
          disabled={busy}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-slate/70 hover:text-brand-navy text-xs font-display font-bold uppercase tracking-wide transition-colors"
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm font-body text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full py-4 bg-brand-orange text-white font-display font-bold text-sm uppercase tracking-[0.15em] rounded-control shadow-[0_4px_24px_rgba(247,107,22,0.3)] hover:bg-orange-600 active:scale-[0.99] transition-all duration-200 disabled:opacity-60"
      >
        {busy ? 'Setting up…' : 'Create account & start'}
      </button>

      <p className="mt-3 text-center text-brand-slate/70 text-xs font-body">
        Takes you straight to picking your program.
      </p>
    </form>
  )
}
