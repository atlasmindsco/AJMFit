'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Button from '@/components/ui/Button'

export default function Newsletter() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || loading) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) throw new Error('Signup failed')
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="py-28 md:py-36 relative bg-brand-offwhite">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(46,106,176,0.04),transparent)]" />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 max-w-2xl mx-auto px-6 lg:px-8 text-center"
      >
        <span className="font-display font-semibold text-sm uppercase tracking-[0.3em] text-brand-blue">
          Newsletter
        </span>
        <h2 className="font-display font-extrabold text-4xl md:text-5xl uppercase tracking-[-0.02em] mt-4 text-brand-navy">
          Brains &amp; Gains
        </h2>
        <p className="mt-6 text-brand-slate font-body leading-relaxed">
          Weekly insights on training smarter, building discipline, and making your time in the gym actually count. No fluff — just real talk.
        </p>

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-10 p-8 bg-brand-orange/10 border border-brand-orange/20 rounded-sm"
          >
            <p className="font-display font-bold text-lg text-brand-navy uppercase">
              You&rsquo;re In.
            </p>
            <p className="text-brand-slate text-sm font-body mt-2">
              Welcome to Brains &amp; Gains. Check your inbox.
            </p>
          </motion.div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-10 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-5 py-4 bg-white border border-brand-navy/10 rounded-sm text-brand-navy font-body text-sm placeholder:text-brand-slate/50 focus:border-brand-blue/50 focus:outline-none transition-colors duration-200"
            />
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Subscribing...' : 'Subscribe'}
            </Button>
          </form>
        )}
        {error && (
          <p className="mt-3 text-red-500 text-sm font-body">{error}</p>
        )}
      </motion.div>
    </section>
  )
}
