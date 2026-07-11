'use client'

import { motion } from 'framer-motion'

const painPoints = [
  {
    number: '01',
    title: 'Going Through The Motions',
    description:
      "You show up to the gym, but there's no real plan. You bounce between machines, do a few sets, and leave wondering if you actually accomplished anything.",
  },
  {
    number: '02',
    title: 'No Time For The Gym',
    description:
      "Between work, family, and everything else, finding time feels impossible. You need a program that fits your life, not the other way around.",
  },
  {
    number: '03',
    title: 'Tried Everything, Nothing Sticks',
    description:
      "You've done the apps, the YouTube workouts, the 30-day challenges. Results come and go. What's missing isn't effort, it's structure and accountability.",
  },
  {
    number: '04',
    title: 'Training Wrong Without Knowing It',
    description:
      "Bad form, imbalanced programming, skipping fundamentals, you could be building on a broken foundation. The right guidance changes everything.",
  },
]

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
}

export default function PainSection() {
  return (
    <section className="py-28 md:py-36 relative bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-20"
        >
          <span className="font-display font-semibold text-sm uppercase tracking-[0.3em] text-brand-orange">
            Sound Familiar?
          </span>
          <h2 className="font-display font-extrabold text-4xl md:text-6xl uppercase tracking-[-0.02em] mt-4 text-brand-navy">
            The Problem Isn&rsquo;t
            <br />
            <span className="text-brand-orange">Your Effort</span>
          </h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {painPoints.map((point) => (
            <motion.div
              key={point.number}
              variants={cardVariants}
              className="group relative bg-brand-offwhite border border-brand-navy/[0.06] rounded-sm p-8 md:p-10 hover:border-brand-orange/30 hover:shadow-[0_4px_24px_rgba(240,139,30,0.08)] transition-all duration-300"
            >
              <span className="font-display font-bold text-6xl text-brand-blue/10 absolute top-6 right-8 group-hover:text-brand-blue/20 transition-colors duration-300">
                {point.number}
              </span>
              <h3 className="font-display font-bold text-xl md:text-2xl uppercase tracking-tight text-brand-navy mb-4">
                {point.title}
              </h3>
              <p className="text-brand-slate font-body leading-[1.7] text-sm">
                {point.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 bg-brand-orange/10 border border-brand-orange/20 rounded-sm p-8 text-center"
        >
          <p className="font-display font-bold text-lg md:text-xl uppercase tracking-wide text-brand-navy">
            It&rsquo;s not about working harder, {' '}
            <span className="text-brand-orange">it&rsquo;s about working right.</span>
          </p>
        </motion.div>
      </div>
    </section>
  )
}
