'use client'

import { useState } from 'react'

type Variant = 'band' | 'card'

/**
 * Brains & Gains signup. Posts to /api/newsletter (Kit). Two looks:
 *  - 'band': full-width blue gradient block (blog index)
 *  - 'card': white bordered card (end of a post)
 */
export default function NewsletterSignup({ variant = 'card' }: { variant?: Variant }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || state === 'loading') return
    setState('loading')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error('failed')
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (variant === 'band') {
    return (
      <div className="relative overflow-hidden rounded-md bg-gradient-to-br from-brand-blue to-[#0f5fe0] text-white p-9 lg:p-11 grain-overlay">
        <div className="absolute -top-10 -right-8 w-52 h-52 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 left-10 w-44 h-44 rounded-full bg-brand-orange/20 blur-2xl" />
        <div className="relative grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <span className="font-display font-semibold text-xs uppercase tracking-[0.3em] text-white/80">
              Brains &amp; Gains Newsletter
            </span>
            <h3 className="font-display font-extrabold text-3xl md:text-4xl uppercase tracking-tight mt-2 leading-[0.95]">
              Get Every Issue First
            </h3>
            <p className="text-white/80 mt-3 leading-relaxed max-w-md">
              Weekly training, nutrition, and mindset — straight to your inbox before it hits the archive. No fluff, no spam.
            </p>
          </div>
          {state === 'done' ? (
            <p className="font-display font-bold text-lg uppercase tracking-wide">You&rsquo;re in — check your inbox.</p>
          ) : (
            <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 px-5 py-4 rounded-sm bg-white text-brand-navy placeholder:text-brand-slate/50 focus:outline-none focus:ring-2 focus:ring-white/60"
              />
              <button
                type="submit"
                disabled={state === 'loading'}
                className="px-8 py-4 bg-brand-orange text-white font-display font-bold text-sm uppercase tracking-[0.15em] rounded-sm shadow-[0_4px_24px_rgba(247,107,22,0.35)] whitespace-nowrap hover:bg-orange-600 active:scale-95 transition disabled:opacity-60"
              >
                {state === 'loading' ? 'Subscribing…' : 'Subscribe'}
              </button>
            </form>
          )}
        </div>
        {state === 'error' && <p className="relative mt-3 text-white text-sm">Something went wrong — try again.</p>}
      </div>
    )
  }

  return (
    <div className="rounded-md border border-brand-navy/10 bg-white p-8 text-center shadow-[0_8px_30px_rgba(27,45,80,0.05)]">
      <span className="font-display font-semibold text-xs uppercase tracking-[0.3em] text-brand-blue">Brains &amp; Gains</span>
      <h3 className="font-display font-extrabold text-2xl uppercase tracking-tight mt-2 text-brand-navy">
        Don&rsquo;t Miss the Next Issue
      </h3>
      {state === 'done' ? (
        <p className="text-brand-slate mt-3 font-body">You&rsquo;re in — check your inbox to confirm.</p>
      ) : (
        <>
          <p className="text-brand-slate mt-2 mb-5 max-w-md mx-auto">Get insight like this in your inbox every week — free.</p>
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 px-5 py-3.5 rounded-sm bg-brand-offwhite border border-brand-navy/10 text-brand-navy placeholder:text-brand-slate/50 focus:outline-none focus:border-brand-blue/50 transition"
            />
            <button
              type="submit"
              disabled={state === 'loading'}
              className="px-7 py-3.5 bg-brand-orange text-white font-display font-bold text-sm uppercase tracking-[0.15em] rounded-sm whitespace-nowrap hover:bg-orange-600 active:scale-95 transition disabled:opacity-60"
            >
              {state === 'loading' ? 'Subscribing…' : 'Subscribe'}
            </button>
          </form>
          {state === 'error' && <p className="mt-3 text-red-500 text-sm">Something went wrong — try again.</p>}
        </>
      )}
    </div>
  )
}
