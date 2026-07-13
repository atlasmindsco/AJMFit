'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GOAL_LABELS,
  LOCATION_LABELS,
  SPLIT_LABEL,
  type BlueprintGoal,
  type BlueprintLocation,
} from '@/lib/blueprint'

/**
 * Blueprint self-serve program picker. Shown on /studio/programs when a
 * Blueprint client has no assigned program. Three quick taps — goal → location
 * → days — then assigns the matching pre-made program and calls onDone.
 */
export default function BlueprintPicker({
  firstName,
  onDone,
}: {
  firstName?: string
  onDone: (programId: string) => void
}) {
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState<BlueprintGoal | null>(null)
  const [location, setLocation] = useState<BlueprintLocation | null>(null)
  const [days, setDays] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const goals: BlueprintGoal[] = ['muscle', 'strength', 'lean_out']
  const locations: BlueprintLocation[] = ['home', 'gym']
  const dayChoices = [3, 4, 5, 6]

  const start = async () => {
    if (!goal || !location || !days) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/studio/blueprint/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, location, days }),
      })
      const data = (await res.json()) as { ok?: boolean; programId?: string; error?: string }
      if (!res.ok || !data.ok || !data.programId) throw new Error(data.error || 'Could not set up your program.')
      onDone(data.programId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
      setSubmitting(false)
    }
  }

  const Option = ({
    active,
    onClick,
    title,
    sub,
  }: {
    active: boolean
    onClick: () => void
    title: string
    sub?: string
  }) => (
    <button
      onClick={onClick}
      className={`w-full text-left px-5 py-4 rounded-xl border transition-all duration-200 active:scale-[0.99] ${
        active
          ? 'bg-[#1A7BFF]/[0.12] border-[#1A7BFF]/50'
          : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.14]'
      }`}
    >
      <span className={`font-display font-bold text-base ${active ? 'text-white' : 'text-white/80'}`}>{title}</span>
      {sub && <span className="block text-white/40 text-xs font-body mt-0.5">{sub}</span>}
    </button>
  )

  const steps = ['Goal', 'Location', 'Days']

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <span className="inline-block text-[10px] font-display font-bold px-2.5 py-1 rounded bg-[#F76B16]/15 text-[#F76B16] uppercase tracking-wide">
          Blueprint
        </span>
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight mt-3">
          {firstName ? `Let's get you set up, ${firstName}` : "Let's set up your program"}
        </h1>
        <p className="text-white/40 text-sm font-body mt-1">
          Three quick questions and you&rsquo;re training — no waiting.
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
                i < step ? 'bg-[#22C55E]' : i === step ? 'bg-[#1A7BFF]' : 'bg-white/15'
              }`}
            />
          </div>
        ))}
      </div>

      <div className="bg-[#1C1C1C] rounded-2xl border border-white/[0.10] p-6">
        <AnimatePresence mode="wait">
          {/* STEP 0 — goal */}
          {step === 0 && (
            <motion.div key="goal" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h2 className="font-display font-bold text-white text-lg mb-4">What&rsquo;s your main goal?</h2>
              <div className="space-y-2.5">
                {goals.map((g) => (
                  <Option
                    key={g}
                    active={goal === g}
                    onClick={() => {
                      setGoal(g)
                      setStep(1)
                    }}
                    title={GOAL_LABELS[g]}
                    sub={
                      g === 'muscle'
                        ? 'Moderate reps, build size'
                        : g === 'strength'
                        ? 'Heavy, low reps, get strong'
                        : 'Higher reps + conditioning'
                    }
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 1 — location */}
          {step === 1 && (
            <motion.div key="loc" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h2 className="font-display font-bold text-white text-lg mb-4">Where will you train?</h2>
              <div className="space-y-2.5">
                {locations.map((l) => (
                  <Option
                    key={l}
                    active={location === l}
                    onClick={() => {
                      setLocation(l)
                      setStep(2)
                    }}
                    title={LOCATION_LABELS[l]}
                    sub={l === 'home' ? 'Dumbbells + bodyweight' : 'Full equipment'}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 2 — days + confirm */}
          {step === 2 && (
            <motion.div key="days" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h2 className="font-display font-bold text-white text-lg mb-4">How many days a week?</h2>
              <div className="grid grid-cols-4 gap-2.5 mb-5">
                {dayChoices.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`py-4 rounded-xl border font-display font-extrabold text-xl transition-all duration-200 active:scale-[0.97] ${
                      days === d
                        ? 'bg-[#1A7BFF]/[0.12] border-[#1A7BFF]/50 text-white'
                        : 'bg-white/[0.03] border-white/[0.08] text-white/70 hover:bg-white/[0.06]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>

              {days && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 mb-5">
                  <p className="text-white/30 text-[10px] font-display font-bold uppercase tracking-[0.15em]">Your recommended split</p>
                  <p className="text-white font-display font-bold text-base mt-1">{SPLIT_LABEL[days]}</p>
                  <p className="text-white/40 text-xs font-body mt-1">
                    {GOAL_LABELS[goal!]} · {LOCATION_LABELS[location!].toLowerCase()}
                  </p>
                </motion.div>
              )}

              {error && <p className="text-red-400 text-sm font-body mb-3">{error}</p>}

              <button
                onClick={start}
                disabled={!days || submitting}
                className="w-full py-4 bg-[#1A7BFF] text-white text-sm font-display font-bold uppercase tracking-[0.12em] rounded-xl hover:bg-[#0F5FE0] active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
              >
                {submitting ? 'Setting up…' : 'Start Training'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back */}
        {step > 0 && !submitting && (
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="mt-4 flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span className="text-xs font-display font-semibold uppercase tracking-wide">Back</span>
          </button>
        )}
      </div>
    </div>
  )
}
