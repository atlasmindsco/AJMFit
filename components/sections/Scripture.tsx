'use client'

import { motion } from 'framer-motion'

export default function Scripture() {
  return (
    <section className="relative py-28 md:py-40 overflow-hidden bg-brand-offwhite">
      {/* Subtle background accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(46,106,176,0.05),transparent)]" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Decorative line */}
          <div className="flex items-center justify-center gap-4 mb-10">
            <span className="block w-12 h-px bg-brand-blue/30" />
            <span className="text-brand-blue text-xs uppercase tracking-[0.3em] font-display font-semibold">
              The Standard
            </span>
            <span className="block w-12 h-px bg-brand-blue/30" />
          </div>

          <blockquote>
            <p className="font-display font-extrabold italic text-3xl md:text-5xl lg:text-6xl uppercase leading-[1.05] tracking-[-0.02em] text-brand-navy">
              &ldquo;To Whom Much Is Given,
              <br />
              <span className="text-brand-blue">Much Is Required.&rdquo;</span>
            </p>
          </blockquote>

          <p className="mt-8 text-brand-slate font-body text-sm tracking-widest uppercase">, Luke 12:48
          </p>
        </motion.div>
      </div>
    </section>
  )
}
