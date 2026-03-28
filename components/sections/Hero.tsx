'use client'

import { useRef, useState } from 'react'
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
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isMuted, setIsMuted] = useState(true)

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted
      setIsMuted(videoRef.current.muted)
    }
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden grain-overlay bg-brand-offwhite">
      {/* Background video */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover object-[center_20%] opacity-[0.65]"
      >
        <source src="/hero-video.mp4" type="video/mp4" />
      </video>
      {/* Overlay gradients on top of video */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-offwhite/70 via-white/50 to-blue-50/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(46,106,176,0.08),transparent)]" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-white to-transparent" />

      {/* Sound toggle */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.6 }}
        onClick={toggleMute}
        className="absolute bottom-10 right-6 md:right-10 z-30 w-10 h-10 flex items-center justify-center rounded-full bg-brand-navy/20 backdrop-blur-sm border border-brand-navy/10 hover:bg-brand-navy/30 transition-colors duration-200"
        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
      >
        {isMuted ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B2D50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B2D50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </motion.button>

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
