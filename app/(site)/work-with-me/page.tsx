'use client'

import { motion } from 'framer-motion'
import Button from '@/components/ui/Button'

const tiers = [
  {
    name: 'The Blueprint',
    price: '$19.97',
    tagline: 'Self-guided. Full app access.',
    equipment: 'Any equipment, programs library scales to what you have',
    features: [
      'Full studio app, workouts, nutrition, programs library',
      'Photo food recognition + macro tracking',
      'Workout logging + PR tracking',
      'Chea AI assistant',
      'Community access',
      'M-F messaging access',
    ],
    idealFor:
      "You want structure without the cost of 1:1 coaching. Track your training, nutrition, and progress in one place, choose from the programs library and run your own training.",
  },
  {
    name: 'The Accelerator',
    price: '$397',
    tagline: 'For those ready to level up.',
    equipment: 'Dumbbells, Bands, or Full Home Gym',
    featured: true,
    features: [
      'Everything in The Blueprint',
      'Custom 3-4 day/week workout plan',
      'New plan every 30 days (3 phases)',
      'Weekly 30-45 min video check-in',
      'Form feedback via video review',
      'Priority response M-F',
    ],
    idealFor:
      "You want more than just the app, you want a coach in your corner. Custom programming, weekly check-ins, and form reviews keep you accountable and training right.",
  },
  {
    name: 'The Full Experience',
    price: '$697',
    tagline: 'Maximum output. Zero guesswork.',
    equipment: 'Full Home Gym Recommended',
    features: [
      'Everything in The Accelerator',
      '2x live 45-min virtual training sessions/week',
      'Real-time coaching & intensity',
      'Live form correction every session',
    ],
    idealFor:
      "You want to be coached like an athlete. Live sessions, real-time intensity, zero guesswork. This is the closest thing to having a trainer standing next to you.",
  },
]

const faqs = [
  {
    q: "I don't have a gym membership. Can I still do this?",
    a: 'Absolutely. Every program is scaled to your available equipment, whether that\'s a pair of dumbbells, resistance bands, or a full home gym setup. No commercial gym required.',
  },
  {
    q: 'How long are the programs?',
    a: 'Each phase runs 30 days. After each phase, you get a fresh program built on your progress. Most clients commit to at least 3 months to see significant transformation.',
  },
  {
    q: 'What does the welcome call cover?',
    a: "We'll discuss your goals, current fitness level, available equipment, schedule, and any health considerations. This helps build your custom program from day one.",
  },
  {
    q: 'Can I upgrade my tier later?',
    a: "Yes. You can upgrade at any time, you'll simply shift into the higher tier at the start of your next billing cycle.",
  },
  {
    q: 'What if I need to cancel?',
    a: "Life happens. You can cancel anytime with 30 days' notice. No long-term contracts, no penalties.",
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

export default function WorkWithMePage() {
  return (
    <div className="pt-28 pb-20">
      {/* Header */}
      <section className="max-w-5xl mx-auto px-6 lg:px-8 text-center mb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="font-display font-semibold text-sm uppercase tracking-[0.3em] text-brand-blue">
            Programs
          </span>
          <h1 className="font-display font-extrabold text-5xl md:text-7xl uppercase tracking-[-0.03em] mt-4 text-brand-navy">
            Work With Me
          </h1>
          <p className="mt-6 text-brand-slate font-body text-lg max-w-2xl mx-auto leading-relaxed">
            Three tiers. One standard. Every program is custom-built for your goals, your equipment, and your schedule.
          </p>
        </motion.div>
      </section>

      {/* Tiers */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 mb-28">
        <div className="flex flex-col gap-12">
          {tiers.map((tier) => (
            <motion.div
              key={tier.name}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              className={`grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-sm overflow-hidden ${
                tier.featured
                  ? 'ring-2 ring-brand-orange/30 shadow-[0_8px_60px_rgba(240,139,30,0.1)]'
                  : 'border border-brand-navy/[0.08]'
              }`}
            >
              {/* Info side */}
              <div
                className={`p-10 md:p-14 flex flex-col ${
                  tier.featured ? 'bg-brand-navy text-white' : 'bg-brand-offwhite'
                }`}
              >
                {tier.featured && (
                  <span className="self-start bg-brand-orange text-white text-xs font-display font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-sm mb-6">
                    Most Popular
                  </span>
                )}
                <h2
                  className={`font-display font-extrabold text-3xl md:text-4xl uppercase tracking-tight ${
                    tier.featured ? 'text-white' : 'text-brand-navy'
                  }`}
                >
                  {tier.name}
                </h2>
                <div className="flex items-baseline gap-2 mt-4">
                  <span
                    className={`font-display font-extrabold text-5xl tracking-tight ${
                      tier.featured ? 'text-brand-orange' : 'text-brand-navy'
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
                  className={`mt-4 font-body leading-relaxed ${
                    tier.featured ? 'text-white/60' : 'text-brand-slate'
                  }`}
                >
                  {tier.idealFor}
                </p>
                <div className="mt-6">
                  <span
                    className={`inline-block text-xs font-display font-semibold uppercase tracking-[0.15em] px-3 py-1.5 rounded-sm ${
                      tier.featured
                        ? 'bg-white/10 text-white/60'
                        : 'bg-brand-navy/5 text-brand-slate'
                    }`}
                  >
                    Equipment: {tier.equipment}
                  </span>
                </div>
              </div>

              {/* Features side */}
              <div
                className={`p-10 md:p-14 flex flex-col justify-between ${
                  tier.featured ? 'bg-brand-navy/95 text-white' : 'bg-white'
                }`}
              >
                <ul className="flex flex-col gap-4">
                  {tier.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <span className="mt-1 shrink-0 text-xs text-brand-orange">◆</span>
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
                    // Self-serve: straight to Stripe Checkout, no application.
                    <a
                      href="/api/stripe/checkout-blueprint"
                      className="inline-flex w-full items-center justify-center gap-2 px-8 py-4 font-display font-bold text-sm uppercase tracking-[0.15em] rounded-sm transition-colors duration-200 bg-transparent text-brand-navy border-2 border-brand-navy/30 hover:border-brand-navy hover:bg-brand-navy/5 active:bg-brand-navy/10"
                    >
                      Start Now
                    </a>
                  ) : (
                    <Button
                      href="/apply"
                      variant={tier.featured ? 'primary' : 'secondary'}
                      fullWidth
                    >
                      Apply Now
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 lg:px-8 mb-28">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="font-display font-semibold text-sm uppercase tracking-[0.3em] text-brand-blue">
            FAQ
          </span>
          <h2 className="font-display font-extrabold text-3xl md:text-5xl uppercase tracking-[-0.02em] mt-4 text-brand-navy">
            Common Questions
          </h2>
        </motion.div>

        <div className="flex flex-col gap-6">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="bg-brand-offwhite border border-brand-navy/[0.06] rounded-sm p-8"
            >
              <h3 className="font-display font-bold text-lg uppercase tracking-tight text-brand-navy mb-3">
                {faq.q}
              </h3>
              <p className="text-brand-slate font-body leading-[1.7] text-sm">
                {faq.a}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display font-extrabold text-3xl md:text-4xl uppercase tracking-tight text-brand-navy">
            Ready to <span className="text-brand-orange">Start?</span>
          </h2>
          <p className="mt-4 text-brand-slate font-body">
            Fill out the intake form and we&rsquo;ll be in touch within 24 hours.
          </p>
          <div className="mt-8">
            <Button href="/apply" variant="primary">
              Apply for Coaching
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
