'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Button from '@/components/ui/Button'

interface Tier {
  name: string
  monthlyPrice: number
  tagline: string
  features: string[]
  featured?: boolean
  monthlyOnly?: boolean
}

const tiers: Tier[] = [
  {
    name: 'The Blueprint',
    monthlyPrice: 19.97,
    monthlyOnly: true,
    tagline: 'Self-guided. Full app access.',
    features: [
      'Full studio app, workouts, nutrition, programs library',
      'Photo food recognition + macro tracking',
      'Workout logging + PR tracking',
      'Chea AI assistant',
      'Community access',
      'M-F messaging access',
    ],
  },
  {
    name: 'The Accelerator',
    monthlyPrice: 397,
    tagline: 'For those ready to level up.',
    featured: true,
    features: [
      'Everything in The Blueprint',
      'Custom 3-4 day/week workout plan',
      'New plan every 30 days (3 phases)',
      'Weekly 30-45 min video check-in',
      'Form feedback via video review',
      'Priority response M-F',
    ],
  },
  {
    name: 'The Full Experience',
    monthlyPrice: 697,
    tagline: 'Maximum output. Zero guesswork.',
    features: [
      'Everything in The Accelerator',
      '2x live 45-min virtual training sessions/week',
      'Real-time coaching & intensity',
      'Live form correction every session',
    ],
  },
]

function getWeeklyPrice(monthly: number): number {
  return Math.ceil(monthly / 4)
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
}

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'weekly'>('monthly')

  return (
    <section className="py-28 md:py-36 relative bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="font-display font-semibold text-sm uppercase tracking-[0.3em] text-brand-blue">
            Invest In Yourself
          </span>
          <h2 className="font-display font-extrabold text-4xl md:text-6xl uppercase tracking-[-0.02em] mt-4 text-brand-navy">
            Choose Your
            <br />
            <span className="text-brand-orange">Level</span>
          </h2>
        </motion.div>

        {/* Payment Plan Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-14 flex flex-col items-center"
        >
          <p className="font-display font-semibold text-xs uppercase tracking-[0.25em] text-brand-slate mb-5">
            Payment Plans Available
          </p>
          <div className="relative inline-flex items-center bg-brand-offwhite rounded-sm border border-brand-navy/[0.08] p-1">
            {/* Sliding indicator */}
            <motion.div
              className="absolute top-1 bottom-1 rounded-sm bg-brand-navy"
              layout
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                left: billingCycle === 'monthly' ? 4 : '50%',
                width: 'calc(50% - 4px)',
              }}
            />
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`relative z-10 px-7 py-3 font-display font-bold text-sm uppercase tracking-[0.12em] transition-colors duration-200 ${
                billingCycle === 'monthly' ? 'text-white' : 'text-brand-navy'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('weekly')}
              className={`relative z-10 px-7 py-3 font-display font-bold text-sm uppercase tracking-[0.12em] transition-colors duration-200 ${
                billingCycle === 'weekly' ? 'text-white' : 'text-brand-navy'
              }`}
            >
              Weekly
            </button>
          </div>
          <p className="mt-4 text-xs font-body text-brand-slate">
            {billingCycle === 'weekly'
              ? 'Billed weekly, same program, easier on the wallet'
              : 'Billed once per month at the start of each cycle'}
          </p>
          <p className="mt-3 font-display font-bold text-sm uppercase tracking-[0.1em] text-brand-navy">
            Every plan starts with a free 7-day trial, no commitment required.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch"
        >
          {tiers.map((tier) => {
            const isMonthly = tier.monthlyOnly || billingCycle === 'monthly'
            const displayPrice = isMonthly
              ? tier.monthlyPrice
              : getWeeklyPrice(tier.monthlyPrice)

            return (
              <motion.div
                key={tier.name}
                variants={cardVariants}
                className={`relative flex flex-col rounded-sm overflow-hidden ${
                  tier.featured
                    ? 'bg-brand-navy text-white lg:scale-105 shadow-[0_8px_60px_rgba(27,45,80,0.2)]'
                    : 'bg-brand-offwhite border border-brand-navy/[0.08] text-brand-navy'
                }`}
              >
                {tier.featured && (
                  <div className="bg-brand-orange text-white text-center py-2 font-display font-bold text-xs uppercase tracking-[0.2em]">
                    Most Popular
                  </div>
                )}

                <div className="p-8 md:p-10 flex flex-col flex-1">
                  <h3
                    className={`font-display font-bold text-lg uppercase tracking-wide ${
                      tier.featured ? 'text-brand-orange' : 'text-brand-blue'
                    }`}
                  >
                    {tier.name}
                  </h3>

                  <div className="mt-4 flex items-baseline gap-1">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={`${tier.name}-${isMonthly ? 'm' : 'w'}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        className={`font-display font-extrabold text-5xl tracking-tight ${
                          tier.featured ? 'text-white' : 'text-brand-navy'
                        }`}
                      >
                        ${displayPrice}
                      </motion.span>
                    </AnimatePresence>
                    <span
                      className={`text-sm font-body ${
                        tier.featured ? 'text-white/50' : 'text-brand-slate'
                      }`}
                    >
                      /{isMonthly ? 'month' : 'week'}
                    </span>
                  </div>

                  <p
                    className={`mt-3 text-sm font-body ${
                      tier.featured ? 'text-white/60' : 'text-brand-slate'
                    }`}
                  >
                    {tier.tagline}
                  </p>

                  <div
                    className={`mt-8 h-px ${
                      tier.featured ? 'bg-white/10' : 'bg-brand-navy/10'
                    }`}
                  />

                  <ul className="mt-8 flex flex-col gap-4 flex-1">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-1 shrink-0 text-xs text-brand-orange">
                          ◆
                        </span>
                        <span
                          className={`text-sm font-body leading-relaxed ${
                            tier.featured ? 'text-white/70' : 'text-brand-slate'
                          }`}
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-10">
                    {tier.name === 'The Blueprint' ? (
                      // Blueprint is self-serve: no application, straight to
                      // Stripe Checkout (account + program picker follow).
                      // Plain <a> so the checkout route is never prefetched.
                      <>
                        <a
                          href="/api/stripe/checkout-blueprint"
                          className="inline-flex w-full items-center justify-center gap-2 px-8 py-4 font-display font-bold text-sm uppercase tracking-[0.15em] rounded-sm transition-colors duration-200 bg-transparent text-brand-navy border-2 border-brand-navy/30 hover:border-brand-navy hover:bg-brand-navy/5 active:bg-brand-navy/10"
                        >
                          Start Now
                        </a>
                        <p className="mt-3 text-center text-xs font-body text-brand-slate">
                          Have a free code? Enter{' '}
                          <span className="font-bold text-brand-navy tracking-wide">ZEROOUT</span>{' '}
                          at checkout for $0.
                          <span className="mt-0.5 block text-brand-slate/70">
                            On a phone, tap the price at the top of the payment page, then &ldquo;Add promotion code.&rdquo;
                          </span>
                        </p>
                      </>
                    ) : (
                      <Button
                        href="/apply"
                        variant={tier.featured ? 'primary' : 'secondary'}
                        fullWidth
                      >
                        Get Started
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

      </div>
    </section>
  )
}
