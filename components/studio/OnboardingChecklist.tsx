'use client'

import Link from 'next/link'

export interface ChecklistState {
  intakeDone: boolean
  startingStatsDone: boolean
  nutritionDone: boolean
  welcomeCallBooked: boolean
  programAssigned: boolean
}

interface Step {
  label: string
  done: boolean
  href?: string
  /** Waiting on the coach, not the client — shown but not actionable. */
  coach?: boolean
  hint?: string
}

/**
 * Setup checklist for coached clients.
 *
 * The sequence has a step in the middle that the client cannot complete —
 * the coach assigning their program. Without something saying so, a client who
 * has finished everything they can do is left staring at a dashboard with no
 * program and no explanation, which reads as the app being broken.
 *
 * Progress photos are deliberately absent. They belong in check-ins, and
 * making them a setup step is where onboarding stops for a lot of people.
 */
export default function OnboardingChecklist({ state }: { state: ChecklistState }) {
  const steps: Step[] = [
    { label: 'Account created', done: true },
    { label: 'Tell Anthony about you', done: state.intakeDone, href: '/studio/onboarding', hint: 'About 8 minutes' },
    { label: 'Record starting stats', done: state.startingStatsDone, href: '/studio/progress', hint: 'Weight, and waist if you have a tape' },
    { label: 'Set nutrition targets', done: state.nutritionDone, href: '/studio/setup-nutrition' },
    { label: 'Book your welcome call', done: state.welcomeCallBooked, href: '/studio/schedule' },
    { label: 'Anthony builds your program', done: state.programAssigned, coach: true, hint: 'He does this after your call' },
  ]

  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null

  const next = steps.find((s) => !s.done)
  if (!next) return null

  /*
   * ONE STEP, NOT SIX.
   *
   * This used to list the whole sequence with a progress bar: six rows, five
   * of them things you had not done, on the screen of a product somebody had
   * just paid for. A list of outstanding homework is a strange first
   * impression, and only one row of it was ever actionable anyway — the rest
   * were either finished or not yet reachable.
   *
   * The count stays, small, because "2 of 6" answers how much is left without
   * spelling out what it is.
   */
  const row = (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-ink-3 text-caption font-display font-bold uppercase tracking-[0.15em]">
          Next, to get you set up
        </p>
        <p className="font-display font-bold text-white text-base mt-1">{next.label}</p>
        {next.coach ? (
          <p className="text-brand-blue text-label font-body mt-1">
            Waiting on Anthony &mdash; nothing for you to do here.
          </p>
        ) : (
          next.hint && <p className="text-ink-3 text-label font-body mt-1">{next.hint}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span className="text-ink-4 text-label font-body tabular-nums">
          {doneCount} of {steps.length}
        </span>
        {!next.coach && next.href && (
          <p className="text-brand-orange text-label font-display font-bold uppercase tracking-[0.12em] mt-1">
            Start &rarr;
          </p>
        )}
      </div>
    </div>
  )

  const shell = 'block bg-surface-raised rounded-card border border-white/[0.10] p-5 mb-6'

  return next.coach || !next.href ? (
    <div className={shell}>{row}</div>
  ) : (
    <Link href={next.href} className={`${shell} hover:border-white/[0.18] transition-colors duration-200`}>
      {row}
    </Link>
  )
}
