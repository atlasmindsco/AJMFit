'use client'

import { motion } from 'framer-motion'

export default function Testimonial() {
  return (
    <section className="relative py-28 md:py-36 overflow-hidden bg-brand-navy">
      {/* Watermark text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <span className="font-display font-extrabold text-[18vw] uppercase text-white/[0.03] whitespace-nowrap tracking-tighter">
          RESULTS
        </span>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Quote mark */}
          <span className="block text-brand-orange text-7xl font-display font-extrabold leading-none mb-6">
            &ldquo;
          </span>

          <blockquote className="font-display font-bold text-2xl md:text-3xl lg:text-4xl uppercase leading-[1.2] tracking-tight text-white">
            I went from barely knowing what to do in the gym to training with a real plan, real accountability, and seeing real results. AJMFit changed how I approach fitness entirely.
          </blockquote>

          <div className="mt-10 flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-brand-orange/20 flex items-center justify-center">
              <span className="font-display font-bold text-brand-orange text-lg">R</span>
            </div>
            <p className="font-display font-semibold text-sm uppercase tracking-[0.15em] text-white">
              Rashad
            </p>
            <p className="text-white/40 text-xs font-body">
              AJMFit Client
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
