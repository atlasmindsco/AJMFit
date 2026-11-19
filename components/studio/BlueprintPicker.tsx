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
 * How long they have been training. The only answer that changes what the
 * rest of the picker offers, which is why it is asked first.
 */
type Experience = 'new' | 'returning' | 'consistent'

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
  onBuildOwn,
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
  /**
   * Leave the ready-made flow and build a program by hand.
   *
   * This existed before as grey text under the card, which is to say it did
   * not exist: the split step can be four options tall, so on a phone the way
   * out was below the fold at the exact moment someone decides none of these
   * is what they want. It belongs inside the card, at every step, because
   * "none of these" can happen at any of them — including the day counts that
   * never show a split choice at all.
   */
  onBuildOwn?: () => void
}) {
  /**
   * How long they have been training, asked here rather than inferred.
   *
   * The `beginner` prop above reads an onboarding answer, and Blueprint
   * clients never fill in onboarding — the table has no rows in it at all. So
   * the beginner flow, which caps the week at three or four days and keeps
   * the sprinting and jumping tracks out of sight, had never once run: every
   * client who ever picked a program was treated as experienced, including
   * somebody who had never touched a barbell.
   *
   * One question fixes that, and it is the one question whose answer actually
   * changes what somebody is offered. The prop still seeds it, so if
   * onboarding ever does say, this does not ask again.
   */
  const [experience, setExperience] = useState<Experience | null>(beginner ? 'new' : null)
  const isNew = experience === 'new'

  // Beginners start on Location because Goal is decided for them.
  const [step, setStep] = useState(beginner ? 1 : 0)
  const [goal, setGoal] = useState<BlueprintGoal | null>(beginner ? 'muscle' : null)
  const [location, setLocation] = useState<BlueprintLocation | null>(null)
  const [days, setDays] = useState<number | null>(null)
  const [splitKey, setSplitKey] = useState<string | null>(null)
  const [trainingDays, setTrainingDays] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const goals: BlueprintGoal[] = ['muscle', 'strength', 'lean_out']
  const locations: BlueprintLocation[] = ['home', 'gym']
  const dayChoices = isNew ? [3, 4] : [2, 3, 4, 5, 6]

  const splitsForDays = days ? splitsFor(days, goal, isNew) : []
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
        // Empty means they skipped it, and null tells the reminder to stay
        // silent rather than guess.
        // `experience` is not used to choose the program — the picker has
        // already done that by capping the days and hiding the advanced
        // tracks. It is stored because the progression engine scales load
        // increments by training age and, until now, had nothing to read:
        // every client was treated as a beginner and told to add 10 lb to
        // their squat after one good session.
        body: JSON.stringify({
          goal,
          location,
          days,
          splitKey: chosenSplit,
          trainingDays: trainingDays.length ? trainingDays : null,
          experience,
        }),
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
      <span className={`font-display font-bold text-base ${active ? 'text-white' : 'text-ink'}`}>{title}</span>
      {sub && <span className="block text-ink-3 text-xs font-body mt-0.5">{sub}</span>}
    </button>
  )

  // Beginners never see the Goal step, so labels and dots shift by one.
  const firstStep = isNew ? 1 : 0
  const steps = [
    'About you',
    ...(isNew ? [] : ['Goal']),
    'Location',
    'Days',
    ...(needsSplitChoice ? ['Choose Split'] : []),
  ]
  /* "About you" sits in front of the numbered steps, so the lit dot is that
     one until it is answered and everything shifts along by one after. */
  const dotIndex = experience === null ? 0 : step - firstStep + 1

  const summary = (title: string) => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-card bg-white/[0.03] border border-white/[0.08] p-4 mb-5"
    >
      <p className="text-ink-4 text-2xs font-display font-bold uppercase tracking-[0.15em]">Your program</p>
      <p className="text-white font-display font-bold text-base mt-1">{title}</p>
      <p className="text-ink-3 text-xs font-body mt-1">
        {GOAL_LABELS[goal!]} · {LOCATION_LABELS[location!].toLowerCase()} · {days} days a week
      </p>
    </motion.div>
  )

  /**
   * Which days of the week they intend to train.
   *
   * A program here is a rotation, not a calendar, which is the right model —
   * but it means the app has never known which DAYS someone trains, so a
   * workout reminder would be guessing. Asked here because the client is
   * already choosing between a 4-day and a 5-day split, so it is one more tap
   * in context rather than a settings screen they will never open.
   *
   * Optional on purpose. Skipping it means no workout reminder, which is
   * better than a wrong one four days a week.
   */
  const dayPicker = () => {
    const names = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    const full = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const toggle = (d: number) =>
      setTrainingDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)))
    return (
      <div className="mb-5">
        <p className="text-ink-2 text-sm font-body mb-1">Which days will you train?</p>
        <p className="text-ink-3 text-xs font-body mb-3">
          Optional. We&rsquo;ll remind you on those days and stay quiet on the rest.
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {names.map((n, d) => {
            const on = trainingDays.includes(d)
            return (
              <button
                key={d}
                onClick={() => toggle(d)}
                aria-label={full[d]}
                aria-pressed={on}
                className={`py-3 rounded-control border font-display font-bold text-sm transition-all duration-150 active:scale-95 ${
                  on
                    ? 'bg-brand-blue/[0.15] border-brand-blue/50 text-white'
                    : 'bg-white/[0.03] border-white/[0.08] text-ink-3 hover:bg-white/[0.06]'
                }`}
              >
                {n}
              </button>
            )
          })}
        </div>
        {days !== null && trainingDays.length > 0 && trainingDays.length !== days && (
          <p className="text-state-warning/80 text-xs font-body mt-2">
            You picked a {days}-day program and {trainingDays.length}{' '}
            {trainingDays.length === 1 ? 'day' : 'days'}. That&rsquo;s fine &mdash; the program just rotates at your pace.
          </p>
        )}
      </div>
    )
  }

  const startButton = (disabled: boolean) => (
    <>
      {dayPicker()}
      <button
        onClick={start}
        disabled={disabled || submitting}
        className="w-full py-4 bg-brand-orange text-white text-sm font-display font-bold uppercase tracking-[0.12em] rounded-card hover:bg-brand-orangedark active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
      >
        {submitting ? 'Setting up…' : 'Start Training'}
      </button>
    </>
  )

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <span className="inline-block text-2xs font-display font-bold px-2.5 py-1 rounded bg-brand-orange/15 text-brand-orange uppercase tracking-wide">
          Blueprint
        </span>
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight mt-3">
          {firstName ? `Let's get you set up, ${firstName}` : "Let's set up your program"}
        </h1>
        <p className="text-ink-3 text-sm font-body mt-1">
          Answer {isNew ? 'three' : 'four'} questions to get your program
        </p>
        <p className="text-ink-4 text-xs font-body mt-2.5">
          {isNew
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
                i < dotIndex ? "bg-state-success" : i === dotIndex ? "bg-brand-blue" : "bg-white/15"
              }`}
            />
          </div>
        ))}
      </div>

      <div className="bg-surface-raised rounded-card border border-white/[0.10] p-6">
        <AnimatePresence mode="wait">
          {/* FIRST — how long they have been training.
              Asked before anything else because it is the only answer that
              changes what the rest of the picker offers: a first-timer is
              capped at three or four days and never shown the sprinting and
              jumping tracks. Three options, no numbers, no "training age" —
              people know which of these they are. */}
          {experience === null && (
            <motion.div key="experience" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h2 className="font-display font-bold text-white text-lg mb-4">
                Where are you starting from?
              </h2>
              <div className="space-y-2.5">
                <Option
                  active={false}
                  onClick={() => {
                    setExperience('new')
                    // Muscle is the right default starting out, and it saves
                    // a first-timer a question they have no basis to answer.
                    setGoal('muscle')
                    setStep(1)
                  }}
                  title="New to lifting"
                  sub="Never trained, or only a handful of times"
                />
                <Option
                  active={false}
                  onClick={() => {
                    setExperience('returning')
                    setStep(0)
                  }}
                  title="Coming back after a break"
                  sub="Trained before, been away a while"
                />
                <Option
                  active={false}
                  onClick={() => {
                    setExperience('consistent')
                    setStep(0)
                  }}
                  title="Training already"
                  sub="In the gym regularly and want a better plan"
                />
              </div>
            </motion.div>
          )}

          {/* STEP 0 — goal */}
          {experience !== null && step === 0 && (
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
          {experience !== null && step === 1 && (
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
          {experience !== null && step === 2 && (
            <motion.div key="days" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h2 className="font-display font-bold text-white text-lg mb-2">How many days a week?</h2>
              <p className="text-ink-3 text-xs font-body mb-4">
                Pick what you can actually keep to. Consistency beats the perfect split.
              </p>
              {/* Said at the moment of the decision, and only when it applies.
                  The picker has a beginner mode that caps this at 3 or 4 days,
                  and it has never run for anybody: it keys off an onboarding
                  answer, and Blueprint clients do not fill in onboarding — the
                  table is empty. So every client, including somebody who has
                  never lifted, is offered six days with nothing said.
                  This is not a gate. Someone who wants six days can have six
                  days; they should just know what they are choosing. */}
              {days !== null && days >= 5 && (
                <p className="text-ink-2 text-xs font-body mb-4 px-3 py-2.5 rounded-control bg-white/[0.04] border border-white/[0.08] leading-relaxed">
                  {days} days is a serious commitment. If you are new to lifting or coming back
                  after time off, three or four is where most people stick &mdash; and you can
                  always move up.
                </p>
              )}
              <div className={`grid gap-2 mb-5 ${isNew ? "grid-cols-2" : "grid-cols-5"}`}>
                {dayChoices.map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setDays(d)
                      setSplitKey(null)
                      if (splitsFor(d, goal, isNew).length > 1) setStep(3)
                    }}
                    className={`py-4 rounded-card border font-display font-extrabold text-xl transition-all duration-200 active:scale-[0.97] ${
                      days === d
                        ? 'bg-brand-blue/[0.12] border-brand-blue/50 text-white'
                        : 'bg-white/[0.03] border-white/[0.08] text-ink-2 hover:bg-white/[0.06]'
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
          {experience !== null && step === 3 && needsSplitChoice && (
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

        {/* Build your own — always available, whatever step and whatever day
            count. Dashed so it never reads as a fourth split to choose
            between, but a full-width target rather than a line of small text,
            because the point is that it is findable. */}
        {onBuildOwn && !submitting && (
          <div className="mt-5 pt-5 border-t border-white/[0.08]">
            <button
              onClick={onBuildOwn}
              className="w-full text-left px-5 py-4 rounded-card border border-dashed border-white/[0.18] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.30] active:scale-[0.99] transition-all duration-200"
            >
              <span className="font-display font-bold text-base text-ink">
                None of these? Build your own
              </span>
              <span className="block text-ink-3 text-xs font-body mt-0.5">
                Choose your own exercises, sets and reps — any number of days.
              </span>
            </button>
          </div>
        )}

        {/* Back */}
        {experience !== null && !submitting && (
          <button
            onClick={() => {
              if (step === 3) {
                setStep(2)
                setSplitKey(null)
              } else if (step === firstStep) {
                // Back off the first numbered step reopens "about you".
                // Clearing the goal matters: it was set for them when they
                // said they were new, and leaving it would mean changing
                // that answer silently kept a goal they never chose.
                setExperience(null)
                setGoal(null)
                setStep(0)
              } else {
                setStep((s) => Math.max(firstStep, s - 1))
              }
            }}
            className="mt-4 flex items-center gap-1.5 text-ink-3 hover:text-ink-2 transition-colors duration-200"
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
