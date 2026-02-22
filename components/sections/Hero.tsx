'use client'

import { motion } from 'framer-motion'
import Button from '@/components/ui/Button'

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  }),
}

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden grain-overlay bg-brand-offwhite">
      {/* Background gradient layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-offwhite via-white to-blue-50/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(46,106,176,0.08),transparent)]" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-white to-transparent" />

      {/* Content */}
      <div className="relative z-20 max-w-6xl mx-auto px-6 lg:px-8 text-center pt-28 pb-20">
        <motion.p
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="font-display font-semibold text-sm uppercase tracking-[0.3em] text-brand-blue mb-8"
        >
          ISSA Certified Personal Training
        </motion.p>

        <motion.h1
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="font-display font-extrabold uppercase leading-[0.9] tracking-[-0.03em]"
        >
          <span className="block text-[clamp(3rem,10vw,8rem)] text-brand-navy">
            Stop Wasting
          </span>
          <span className="block text-[clamp(3rem,10vw,8rem)] text-outline italic">
            Your Potential
          </span>
        </motion.h1>

        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mt-8 text-lg md:text-xl text-brand-slate font-body max-w-2xl mx-auto leading-relaxed"
        >
          You&rsquo;re already showing up. Let&rsquo;s make it count.
          <br className="hidden md:block" />
          Custom programs, real accountability, and results that stick.
        </motion.p>

        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button href="/apply" variant="primary">
            Apply for Coaching
          </Button>
          <Button href="/work-with-me" variant="secondary">
            See Programs
          </Button>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.8 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2"
      >
        <span className="text-brand-navy/30 text-xs uppercase tracking-[0.2em] font-display">
          Scroll
        </span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-px h-8 bg-gradient-to-b from-brand-navy/30 to-transparent"
        />
      </motion.div>
    </section>
  )
}
