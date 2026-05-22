'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import Button from '@/components/ui/Button'

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
}

export default function AboutPage() {
  return (
    <div className="pt-28 pb-20">
      {/* Hero header */}
      <section className="max-w-5xl mx-auto px-6 lg:px-8 mb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <span className="font-display font-semibold text-sm uppercase tracking-[0.3em] text-brand-blue">
            The Story
          </span>
          <h1 className="font-display font-extrabold text-5xl md:text-7xl uppercase tracking-[-0.03em] mt-4 text-brand-navy">
            About AJMFit
          </h1>
        </motion.div>
      </section>

      {/* Story section */}
      <section className="max-w-6xl mx-auto px-6 lg:px-8 mb-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Photo placeholder */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="relative aspect-[4/5] bg-brand-offwhite border border-brand-navy/[0.08] rounded-sm overflow-hidden"
          >
            <Image
              src="/about-photo.jpg"
              alt="AJMFit founder"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/30 via-transparent to-transparent z-10" />
          </motion.div>

          {/* Story copy */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <h2 className="font-display font-extrabold text-3xl md:text-4xl uppercase tracking-tight mb-8 text-brand-navy">
              Built On <span className="text-brand-orange">Accountability</span>
            </h2>

            <div className="space-y-8 text-brand-slate font-body leading-[1.8]">
              <div className="flex items-start gap-5">
                <div className="shrink-0 mt-1.5">
                  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="8" width="4" height="16" rx="1.5" fill="#1B2D50" />
                    <rect x="7" y="10" width="3" height="12" rx="1" fill="#1B2D50" />
                    <rect x="10" y="14" width="12" height="4" rx="1" fill="#F76B16" />
                    <rect x="22" y="10" width="3" height="12" rx="1" fill="#1B2D50" />
                    <rect x="25" y="8" width="4" height="16" rx="1.5" fill="#1B2D50" />
                  </svg>
                </div>
                <p>
                  I started AJMFit because I saw too many people putting in the work but not getting the results. Not because they lacked effort — but because they lacked the right plan and someone to hold them to a higher standard.
                </p>
              </div>
              <div className="flex items-start gap-5">
                <div className="shrink-0 mt-1.5">
                  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="8" width="4" height="16" rx="1.5" fill="#1B2D50" />
                    <rect x="7" y="10" width="3" height="12" rx="1" fill="#1B2D50" />
                    <rect x="10" y="14" width="12" height="4" rx="1" fill="#F76B16" />
                    <rect x="22" y="10" width="3" height="12" rx="1" fill="#1B2D50" />
                    <rect x="25" y="8" width="4" height="16" rx="1.5" fill="#1B2D50" />
                  </svg>
                </div>
                <p>
                  Fitness changed my life. Not just physically, but mentally and spiritually. It taught me discipline, patience, and what it means to be a good steward of the body you&rsquo;ve been given.
                </p>
              </div>
              <div className="flex items-start gap-5">
                <div className="shrink-0 mt-1.5">
                  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="8" width="4" height="16" rx="1.5" fill="#1B2D50" />
                    <rect x="7" y="10" width="3" height="12" rx="1" fill="#1B2D50" />
                    <rect x="10" y="14" width="12" height="4" rx="1" fill="#F76B16" />
                    <rect x="22" y="10" width="3" height="12" rx="1" fill="#1B2D50" />
                    <rect x="25" y="8" width="4" height="16" rx="1.5" fill="#1B2D50" />
                  </svg>
                </div>
                <p>
                  That&rsquo;s why every program I build isn&rsquo;t just about reps and sets — it&rsquo;s about maximizing the potential you already have. You showed up. My job is to make sure that effort actually counts.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ISSA Certification */}
      <section className="max-w-5xl mx-auto px-6 lg:px-8 mb-28">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="bg-brand-offwhite border border-brand-navy/[0.08] rounded-sm p-10 md:p-14 flex flex-col md:flex-row items-center gap-10"
        >
          <div className="shrink-0 w-24 h-24 bg-brand-blue/10 rounded-sm flex items-center justify-center">
            <span className="font-display font-extrabold text-3xl text-brand-blue">ISSA</span>
          </div>
          <div>
            <h3 className="font-display font-bold text-xl md:text-2xl uppercase tracking-tight text-brand-navy mb-3">
              ISSA Certified Personal Trainer
            </h3>
            <p className="text-brand-slate font-body leading-[1.7]">
              Every program is built on a foundation of exercise science — not guesswork. ISSA certification means evidence-based programming, proper form standards, and the knowledge to adapt training to any body, any goal, any equipment setup.
            </p>
          </div>
        </motion.div>
      </section>

      {/* The 40% Gap */}
      <section className="max-w-5xl mx-auto px-6 lg:px-8 mb-28">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="font-display font-extrabold text-4xl md:text-6xl uppercase tracking-[-0.02em] text-brand-navy">
            The <span className="text-brand-orange">40%</span> Gap
          </h2>
          <p className="mt-8 text-brand-slate font-body text-lg max-w-3xl mx-auto leading-relaxed">
            Most people train at about 60% of their actual capacity — not because they&rsquo;re lazy, but because they don&rsquo;t know what they&rsquo;re leaving on the table. That gap between where you are and where you could be? That&rsquo;s your unfair advantage. My job is to close it.
          </p>
        </motion.div>
      </section>

      {/* Scripture as belief */}
      <section className="max-w-4xl mx-auto px-6 lg:px-8 mb-28">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative bg-brand-offwhite border border-brand-blue/10 rounded-sm p-10 md:p-16 text-center"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(46,106,176,0.04),transparent)]" />
          <div className="relative z-10">
            <span className="font-display font-semibold text-sm uppercase tracking-[0.3em] text-brand-blue mb-6 block">
              The Belief Behind Everything
            </span>
            <blockquote className="font-display font-extrabold italic text-2xl md:text-4xl uppercase leading-[1.1] tracking-[-0.01em] text-brand-navy">
              &ldquo;To whom much is given, much is required.&rdquo;
            </blockquote>
            <p className="mt-6 text-brand-slate text-sm font-body tracking-widest uppercase">
              — Luke 12:48
            </p>
            <p className="mt-8 text-brand-slate font-body leading-[1.8] max-w-2xl mx-auto">
              This isn&rsquo;t just a tagline — it&rsquo;s the standard. You&rsquo;ve been given a body, talent, time, and opportunity. The question isn&rsquo;t whether you&rsquo;ll work hard. It&rsquo;s whether you&rsquo;ll be a good steward of what you&rsquo;ve been given.
            </p>
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display font-extrabold text-3xl md:text-4xl uppercase tracking-tight text-brand-navy">
            Let&rsquo;s <span className="text-brand-orange">Work</span>
          </h2>
          <p className="mt-4 text-brand-slate font-body">
            Apply for coaching and let&rsquo;s build something that lasts.
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
