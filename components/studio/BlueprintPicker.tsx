'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GOAL_LABELS,
  LOCATION_LABELS,
  splitsFor,
  type BlueprintGoal,
  type BlueprintLocation,
} from '@/lib/blueprint'

/**
 * Blueprint self-serve program picker. Shown on /studio/programs when a
 * Blueprint client has no assigned program. Goal → location → days, then a
 * split choice at any day count that offers more than one.
 *
 * The split step used to be hardcoded to 5 days, with a separate "emphasis"
 * step for 4 days whose options pointed at programs that were never seeded.
 * Both are gone; the step is now driven by SPLIT_OPTIONS, so a day count with
 * two real splits offers them and one with a single split skips the question.
 */
export default function BlueprintPicker({
  firstName,
  onDone,
  beginner = false,
}: {
  firstName?: string
  onDone: (programId: string) => void
  /**
   * First-timer flow: skips the goal question (muscle is the right default
   * when starting out) and caps the week at 3-4 days. This used to be a
   * separate BeginnerPicker component that duplicated the whole location and
   * days flow, which meant every fix had to be made twice.
   */
  beginner?: boolean
}) {
  // Beginners start on Location because Goal is decided for them.
  const [step, setStep] = useState(beginner ? 1 : 0)
  const [goal, setGoal] = useState<BlueprintGoal | null>(beginner ? 'muscle' : null)
  const [location, setLocation] = useState<BlueprintLocation | null>(null)
  const [days, setDays] = useState<number | null>(null)
  const [splitKey, setSplitKey] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const goals: BlueprintGoal[] = ['muscle', 'strength', 'lean_out']
  const locations: BlueprintLocation[] = ['home', 'gym']
  const dayChoices = beginner ? [3, 4] : [2, 3, 4, 5, 6]

  const splitsForDays = days ? splitsFor(days, goal, beginner) : []
  const needsSplitChoice = splitsForDays.length > 1
  const chosenSplit = splitKey ?? splitsForDays[0]?.key ?? null

  const start = async () => {
    if (!goal || !location || !days) return
    if (needsSplitChoice && !splitKey) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/studio/blueprint/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, location, days, splitKey: chosenSplit }),
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
      className={`w-full text-left px-5 py-4 rounded-card border transition-all duration-200 active:scale-[0.99] ${
        active
          ? 'bg-brand-blue/[0.12] border-brand-blue/50'
          : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.14]'
      }`}
    >
      <span className={`font-display font-bold text-base ${active ? 'text-white' : 'text-white/80'}`}>{title}</span>
      {sub && <span className="block text-white/40 text-xs font-body mt-0.5">{sub}</span>}
    </button>
  )

  // Beginners never see the Goal step, so labels and dots shift by one.
  const firstStep = beginner ? 1 : 0
  const steps = [
    ...(beginner ? [] : ['Goal']),
    'Location',
    'Days',
    ...(needsSplitChoice ? ['Choose Split'] : []),
  ]

  const summary = (title: string) => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-card bg-white/[0.03] border border-white/[0.08] p-4 mb-5"
    >
      <p className="text-white/30 text-[10px] font-display font-bold uppercase tracking-[0.15em]">Your program</p>
      <p className="text-white font-display font-bold text-base mt-1">{title}</p>
      <p className="text-white/40 text-xs font-body mt-1">
        {GOAL_LABELS[goal!]} · {LOCATION_LABELS[location!].toLowerCase()} · {days} days a week
      </p>
    </motion.div>
  )

  const startButton = (disabled: boolean) => (
    <button
      onClick={start}
      disabled={disabled || submitting}
      className="w-full py-4 bg-brand-orange text-white text-sm font-display font-bold uppercase tracking-[0.12em] rounded-card hover:bg-brand-orangedark active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
    >
      {submitting ? 'Setting up…' : 'Start Training'}
    </button>
  )

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <span className="inline-block text-[10px] font-display font-bold px-2.5 py-1 rounded bg-brand-orange/15 text-brand-orange uppercase tracking-wide">
          Blueprint
        </span>
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight mt-3">
          {firstName ? `Let's get you set up, ${firstName}` : "Let's set up your program"}
        </h1>
        <p className="text-white/40 text-sm font-body mt-1">
          Answer {beginner ? 'two' : 'three'} questions to get your program
        </p>
        <p className="text-white/30 text-xs font-body mt-2.5">
          {beginner
            ? 'Full body and upper/lower splits, 3-4 days a week — the right place to start.'
            : '2-6 days a week • Full Body, Upper/Lower, Torso/Limbs, Push/Pull/Legs, Bro Split, plus hybrid tracks with running and conditioning • Gym or dumbbells at home'}
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
                i < step - firstStep ? 'bg-state-success' : i === step - firstStep ? 'bg-brand-blue' : 'bg-white/15'
              }`}
            />
          </div>
        ))}
      </div>

      <div className="bg-surface-raised rounded-card border border-white/[0.10] p-6">
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

          {/* STEP 2 — days */}
          {step === 2 && (
            <motion.div key="days" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h2 className="font-display font-bold text-white text-lg mb-2">How many days a week?</h2>
              <p className="text-white/40 text-xs font-body mb-4">
                Pick what you can actually keep to. Consistency beats the perfect split.
              </p>
              <div className={`grid gap-2 mb-5 ${beginner ? 'grid-cols-2' : 'grid-cols-5'}`}>
                {dayChoices.map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setDays(d)
                      setSplitKey(null)
                      if (splitsFor(d, goal, beginner).length > 1) setStep(3)
                    }}
                    className={`py-4 rounded-card border font-display font-extrabold text-xl transition-all duration-200 active:scale-[0.97] ${
                      days === d
                        ? 'bg-brand-blue/[0.12] border-brand-blue/50 text-white'
                        : 'bg-white/[0.03] border-white/[0.08] text-white/70 hover:bg-white/[0.06]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>

              {days !== null && !needsSplitChoice && summary(splitsForDays[0]?.label ?? '')}
              {error && <p className="text-state-danger text-sm font-body mb-3">{error}</p>}
              {days !== null && !needsSplitChoice && startButton(false)}
            </motion.div>
          )}

          {/* STEP 3 — split choice, at any day count with more than one */}
          {step === 3 && needsSplitChoice && (
            <motion.div key="split" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h2 className="font-display font-bold text-white text-lg mb-4">Which {days}-day split?</h2>
              <div className="space-y-2.5 mb-5">
                {splitsForDays.map((opt) => (
                  <Option
                    key={opt.key}
                    active={splitKey === opt.key}
                    onClick={() => setSplitKey(opt.key)}
                    title={opt.label}
                    sub={opt.sub}
                  />
                ))}
              </div>

              {splitKey && summary(splitsForDays.find((o) => o.key === splitKey)?.label ?? '')}
              {error && <p className="text-state-danger text-sm font-body mb-3">{error}</p>}
              {startButton(!splitKey)}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back */}
        {step > firstStep && !submitting && (
          <button
            onClick={() => {
              if (step === 3) {
                setStep(2)
                setSplitKey(null)
              } else {
                setStep((s) => Math.max(firstStep, s - 1))
              }
            }}
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
