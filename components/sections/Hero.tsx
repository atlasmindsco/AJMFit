'use client'

import { motion } from 'framer-motion'
import Button from '@/components/ui/Button'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden grain-overlay bg-brand-offwhite">
      {/* Layered gradient backdrop. There was a <video src="/hero-video.mp4">
          here, but that file does not exist in the repo or in production — the
          request returned the 404 page — so it only ever cost a wasted fetch,
          and its mute button did nothing when clicked. */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-offwhite/70 via-white/50 to-blue-50/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(46,106,176,0.08),transparent)]" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-white to-transparent" />

      {/* Content — CSS-animated, not JS-gated, so it paints immediately. */}
      <div className="relative z-20 max-w-6xl mx-auto px-6 lg:px-8 text-center pt-40 sm:pt-32 md:pt-28 pb-20">
        <p
          style={{ animationDelay: '0.05s' }}
          className="animate-fade-up font-display font-semibold text-sm uppercase tracking-[0.3em] text-brand-blue mb-8"
        >
          ISSA Certified Personal Training
        </p>

        <h1
          style={{ animationDelay: '0.14s' }}
          className="animate-fade-up font-display font-extrabold uppercase leading-[0.9] tracking-[-0.03em]"
        >
          <span className="block text-[clamp(3rem,10vw,8rem)] text-brand-navy">
            Stop Wasting
          </span>
          <span className="block text-[clamp(3rem,10vw,8rem)] text-outline italic">
            Your Potential
          </span>
        </h1>

        <p
          style={{ animationDelay: '0.23s' }}
          className="animate-fade-up mt-8 text-lg md:text-xl text-brand-slate font-body max-w-2xl mx-auto leading-relaxed"
        >
          You&rsquo;re already showing up. Let&rsquo;s make it count.{' '}
          <br className="hidden md:block" />
          Custom programs, real accountability, and results that stick.
        </p>

        <div
          style={{ animationDelay: '0.32s' }}
          className="animate-fade-up mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button href="/apply" variant="primary">
            Apply for Coaching
          </Button>
          <Button href="/work-with-me" variant="secondary">
            See Programs
          </Button>
        </div>
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
