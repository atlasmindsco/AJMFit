'use client'

import { motion } from 'framer-motion'
import IntakeForm from '@/components/forms/IntakeForm'

export default function ApplyPage() {
  return (
    <div className="pt-28 pb-20">
      <section className="max-w-5xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="font-display font-semibold text-sm uppercase tracking-[0.3em] text-brand-blue">
            Get Started
          </span>
          <h1 className="font-display font-extrabold text-5xl md:text-7xl uppercase tracking-[-0.03em] mt-4 text-brand-navy">
            Apply for Coaching
          </h1>
          <p className="mt-6 text-brand-slate font-body text-lg max-w-2xl mx-auto leading-relaxed">
            Tell us about yourself, your goals, and what you&rsquo;re working with. We&rsquo;ll build your plan from there.
          </p>
        </motion.div>

        <IntakeForm />
      </section>
    </div>
  )
}
