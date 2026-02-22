'use client'

import { motion } from 'framer-motion'
import Button from '@/components/ui/Button'

interface Tier {
  name: string
  price: string
  tagline: string
  features: string[]
  featured?: boolean
}

const tiers: Tier[] = [
  {
    name: 'The Blueprint',
    price: '$297',
    tagline: 'Your foundation. Built right.',
    features: [
      'Custom 3-4 day/week workout plan',
      'New plan every 30 days (3 phases)',
      'Scaled to your equipment',
      'M-F messaging access',
      'Supplement recommendations',
    ],
  },
  {
    name: 'The Accelerator',
    price: '$497',
    tagline: 'For those ready to level up.',
    featured: true,
    features: [
      'Everything in The Blueprint',
      'Weekly 30-45 min video check-in',
      'Form feedback via video review',
      'Progress tracking & adjustments',
      'Priority response M-F',
    ],
  },
  {
    name: 'The Full Experience',
    price: '$697',
    tagline: 'Maximum output. Zero guesswork.',
    features: [
      'Everything in The Accelerator',
      '2x live 45-min virtual training sessions/week',
      'Real-time coaching & intensity',
      'Live form correction every session',
    ],
  },
]

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

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch"
        >
          {tiers.map((tier) => (
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
                  <span
                    className={`font-display font-extrabold text-5xl tracking-tight ${
                      tier.featured ? 'text-white' : 'text-brand-navy'
                    }`}
                  >
                    {tier.price}
                  </span>
                  <span
                    className={`text-sm font-body ${
                      tier.featured ? 'text-white/50' : 'text-brand-slate'
                    }`}
                  >
                    /month
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
                  <Button
                    href="/apply"
                    variant={tier.featured ? 'primary' : 'secondary'}
                    fullWidth
                  >
                    Get Started
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
