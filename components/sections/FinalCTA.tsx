'use client'

import { motion } from 'framer-motion'
import Button from '@/components/ui/Button'

export default function FinalCTA() {
  return (
    <section className="relative py-28 md:py-36 overflow-hidden bg-brand-navy">
      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <span className="font-display font-extrabold text-[16vw] uppercase text-white/[0.03] whitespace-nowrap tracking-tighter">
          START NOW
        </span>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="font-display font-semibold text-sm uppercase tracking-[0.3em] text-brand-orange">
            Your Move
          </span>
          <h2 className="font-display font-extrabold text-4xl md:text-6xl uppercase tracking-[-0.02em] mt-4 text-white">
            Start Your
            <br />
            <span className="text-brand-orange">Training Today</span>
          </h2>
          <p className="mt-6 text-white/50 font-body text-lg max-w-xl mx-auto leading-relaxed">
            Pick your path. Every program comes with a free welcome call to build your custom plan from day one.
          </p>

          <div className="mt-12 flex flex-col items-center gap-4">
            <Button href="/apply" variant="primary">
              Apply for Coaching
            </Button>
            <Button href="/work-with-me" variant="secondary">
              See Programs
            </Button>
          </div>

          <p className="mt-8 text-white/30 font-body text-sm">
            Not ready yet?{' '}
            <a
              href="/blog"
              className="text-brand-orange/70 hover:text-brand-orange transition-colors duration-200 underline underline-offset-4"
            >
              Read the blog &amp; join the newsletter
            </a>{' '}
            to start learning.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
