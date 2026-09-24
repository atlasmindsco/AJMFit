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
  const pct = Math.round((doneCount / steps.length) * 100)

  return (
    <div className="bg-surface-raised rounded-card border border-white/[0.10] p-5 mb-6">
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <h2 className="font-display font-bold text-white text-sm">Getting you set up</h2>
        <span className="text-white/35 text-xs font-body tabular-nums">
          {doneCount} of {steps.length}
        </span>
      </div>

      <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden mb-4">
        <div className="h-full bg-brand-orange transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <ul className="space-y-1.5">
        {steps.map((s) => {
          const isNext = s === next
          const row = (
            <div
              className={`flex items-start gap-3 px-3 py-2.5 rounded-control transition-colors duration-200 ${
                isNext && !s.coach ? 'bg-brand-orange/[0.10] border border-brand-orange/25' : ''
              }`}
            >
              <span
                className={`mt-0.5 w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-2xs font-bold ${
                  s.done ? 'bg-state-success text-white' : 'border border-white/20 text-transparent'
                }`}
              >
                ✓
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-body ${s.done ? 'text-white/35 line-through' : 'text-white/85'}`}>
                  {s.label}
                </p>
                {!s.done && s.hint && <p className="text-white/35 text-xs font-body mt-0.5">{s.hint}</p>}
                {!s.done && s.coach && (
                  <p className="text-brand-blue text-xs font-body mt-0.5">Waiting on Anthony — nothing for you to do here.</p>
                )}
              </div>
            </div>
          )
          return (
            <li key={s.label}>
              {s.done || s.coach || !s.href ? row : <Link href={s.href}>{row}</Link>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
