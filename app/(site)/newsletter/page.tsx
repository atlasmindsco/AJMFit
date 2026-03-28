'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Button from '@/components/ui/Button'

const previewIssues = [
  {
    number: '#012',
    title: 'The Compound Effect of Consistency',
    excerpt:
      'Why showing up at 70% beats waiting for the perfect 100% day. Plus: a 3-move finisher you can do in 8 minutes.',
  },
  {
    number: '#011',
    title: 'You Don\'t Need More Time — You Need a System',
    excerpt:
      'How to build a training schedule that fits your real life, not the one you wish you had.',
  },
  {
    number: '#010',
    title: 'The Supplement Stack That Actually Matters',
    excerpt:
      'Cutting through the noise: what\'s worth your money, what\'s marketing, and what most people are missing.',
  },
]

const benefits = [
  'Weekly training insights & programming tips',
  'Mindset strategies for long-term discipline',
  'Supplement recommendations backed by science',
  'Early access to program openings',
  'Real talk — no fluff, no gimmicks',
]

export default function NewsletterPage() {
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
    <div className="pt-28 pb-20">
      {/* Header */}
      <section className="max-w-5xl mx-auto px-6 lg:px-8 text-center mb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Image
            src="/BandGnewsletter.png"
            alt="Brains & Gains Newsletter"
            width={400}
            height={225}
            className="mx-auto mb-10 rounded-sm"
            priority
          />
          <span className="font-display font-semibold text-sm uppercase tracking-[0.3em] text-brand-blue">
            Newsletter
          </span>
          <h1 className="font-display font-extrabold text-5xl md:text-7xl uppercase tracking-[-0.03em] mt-4 text-brand-navy">
            Brains &amp; Gains
          </h1>
          <p className="mt-6 text-brand-slate font-body text-lg max-w-2xl mx-auto leading-relaxed">
            Weekly insights on training smarter, building discipline, and making your time count. Straight to your inbox — no fluff, no spam.
          </p>
        </motion.div>
      </section>

      {/* Signup */}
      <section className="max-w-xl mx-auto px-6 lg:px-8 mb-28">
        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-10 bg-brand-orange/10 border border-brand-orange/20 rounded-sm text-center"
          >
            <span className="block text-brand-blue text-5xl mb-4">✓</span>
            <p className="font-display font-bold text-xl text-brand-navy uppercase">
              You&rsquo;re In.
            </p>
            <p className="text-brand-slate text-sm font-body mt-2">
              Welcome to Brains &amp; Gains. Check your inbox.
            </p>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3"
          >
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-5 py-4 bg-brand-offwhite border border-brand-navy/10 rounded-sm text-brand-navy font-body text-sm placeholder:text-brand-slate/50 focus:border-brand-blue/50 focus:outline-none transition-colors duration-200"
            />
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Subscribing...' : 'Subscribe'}
            </Button>
          </motion.form>
        )}
        {error && (
          <p className="mt-3 text-red-500 text-sm font-body text-center">{error}</p>
        )}
      </section>

      {/* What you get */}
      <section className="max-w-3xl mx-auto px-6 lg:px-8 mb-28">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-display font-extrabold text-3xl md:text-4xl uppercase tracking-tight text-brand-navy">
            What You <span className="text-brand-orange">Get</span>
          </h2>
        </motion.div>

        <motion.ul
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex flex-col gap-4 max-w-md mx-auto"
        >
          {benefits.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-1 shrink-0 text-xs text-brand-orange">◆</span>
              <span className="text-brand-slate font-body leading-relaxed">{b}</span>
            </li>
          ))}
        </motion.ul>
      </section>

      {/* Recent Issues */}
      <section className="max-w-4xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-display font-extrabold text-3xl md:text-4xl uppercase tracking-tight text-brand-navy">
            Recent <span className="text-brand-blue">Issues</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {previewIssues.map((issue, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-brand-offwhite border border-brand-navy/[0.06] rounded-sm p-8 hover:border-brand-orange/20 hover:shadow-[0_4px_24px_rgba(240,139,30,0.06)] transition-all duration-300"
            >
              <span className="font-display font-bold text-xs uppercase tracking-[0.2em] text-brand-blue">
                {issue.number}
              </span>
              <h3 className="font-display font-bold text-lg uppercase tracking-tight text-brand-navy mt-3 mb-3">
                {issue.title}
              </h3>
              <p className="text-brand-slate font-body text-sm leading-[1.7]">
                {/* [PLACEHOLDER] — Replace with real excerpts */}
                {issue.excerpt}
              </p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}
