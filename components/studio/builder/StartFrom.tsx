'use client'

/**
 * Where a program comes from.
 *
 * Three doors, in the order they are worth taking. Copying the program you are
 * already following is the one that works: a handful of swaps instead of
 * twenty-five decisions, something that trains properly from the first second,
 * and history that carries over because it keys on exercise name. Starting
 * from nothing is last on purpose — it is the honest option for someone who
 * knows what they want, and the wrong default for everyone else.
 *
 * The blank path does not open a blank week. It asks how many days, offers the
 * splits the library actually ships at that count, and hands back a named,
 * empty week. Naming the week is the part of programming that wants a
 * convention rather than a preference, and "Day 1" through "Day 5" tells
 * nobody what goes in them.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { DAY_COUNT_CHOICES, templatesFor, type BuilderTemplate } from '@/lib/builder-templates'
import type { LibraryProgram } from '@/lib/custom-program'

type Step = 'door' | 'pickLibrary' | 'dayCount' | 'split'

export default function StartFrom({
  followingName,
  followingId,
  atLimit,
  onCopy,
  onScratch,
  onCancel,
  loadLibrary,
}: {
  /** The program they are on, if any. */
  followingName: string | null
  followingId: string | null
  /** True when they already hold the maximum number of programs. */
  atLimit: boolean
  onCopy: (programId: string) => void
  onScratch: (template: BuilderTemplate | null, days: number) => void
  onCancel: () => void
  loadLibrary: () => Promise<LibraryProgram[]>
}) {
  const [step, setStep] = useState<Step>('door')
  const [library, setLibrary] = useState<LibraryProgram[] | null>(null)
  const [days, setDays] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (step !== 'pickLibrary' || library) return
    setLoading(true)
    loadLibrary()
      .then(setLibrary)
      .catch(() => setLibrary([]))
      .finally(() => setLoading(false))
  }, [step, library, loadLibrary])

  const Door = ({
    title,
    sub,
    onClick,
    primary = false,
    disabled = false,
  }: {
    title: string
    sub: string
    onClick: () => void
    primary?: boolean
    disabled?: boolean
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-5 py-4 rounded-card border transition-all duration-200 active:scale-[0.99] disabled:opacity-40 ${
        primary
          ? 'bg-brand-orange/[0.12] border-brand-orange/40 hover:bg-brand-orange/[0.18]'
          : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.14]'
      }`}
    >
      <span className={`font-display font-bold text-base ${primary ? 'text-white' : 'text-white/85'}`}>{title}</span>
      <span className="block text-white/40 text-xs font-body mt-1 leading-relaxed">{sub}</span>
    </button>
  )

  const Back = ({ to, label }: { to: Step; label: string }) => (
    <button
      onClick={() => setStep(to)}
      className="text-white/40 hover:text-white/70 text-xs font-display font-semibold uppercase tracking-wide mb-4 transition-colors duration-200"
    >
      &lsaquo; {label}
    </button>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto pb-24">
      {/* ------------------------------------------------------------ door */}
      {step === 'door' && (
        <>
          <h2 className="font-display font-extrabold text-2xl text-white tracking-tight">Build your own</h2>
          <p className="text-white/45 text-sm font-body mt-1.5 mb-6 leading-relaxed">
            Your program, your exercises. Everything else keeps working &mdash; your logs, your weights, your
            progression targets.
          </p>

          {atLimit && (
            <p className="text-state-warning/90 text-xs font-body mb-4">
              You&rsquo;re holding the maximum number of programs. Delete one from My programs to build another.
            </p>
          )}

          <div className="space-y-2.5">
            {followingId && (
              <Door
                primary
                title="Start from the one I&rsquo;m on"
                sub={`Copy ${followingName ?? 'your current program'} and change what you like. Easiest, and it trains properly straight away.`}
                onClick={() => onCopy(followingId)}
                disabled={atLimit}
              />
            )}
            <Door
              title="Start from another AJM Fit program"
              sub="Pick any of the programs in the library as your starting point."
              onClick={() => setStep('pickLibrary')}
              disabled={atLimit}
            />
            <Door
              title="Start from scratch"
              sub="Choose how many days you train, then build each one yourself."
              onClick={() => setStep('dayCount')}
              disabled={atLimit}
            />
          </div>

          <button
            onClick={onCancel}
            className="w-full mt-5 py-3 text-white/40 hover:text-white/70 text-xs font-display font-bold uppercase tracking-wide transition-colors duration-200"
          >
            Never mind
          </button>
        </>
      )}

      {/* ---------------------------------------------------- pick library */}
      {step === 'pickLibrary' && (
        <>
          <Back to="door" label="Back" />
          <h2 className="font-display font-extrabold text-xl text-white tracking-tight">Which program?</h2>
          <p className="text-white/45 text-sm font-body mt-1 mb-5">
            You&rsquo;ll get your own copy. The original stays exactly as it is.
          </p>

          {loading && <p className="text-white/30 text-sm font-body py-8 text-center">Loading&hellip;</p>}

          {library && library.length === 0 && !loading && (
            <p className="text-white/30 text-sm font-body py-8 text-center">
              Couldn&rsquo;t load the library. Try again in a moment.
            </p>
          )}

          <div className="space-y-2">
            {(library ?? []).map((p) => (
              <button
                key={p.id}
                onClick={() => onCopy(p.id)}
                className="w-full text-left px-4 py-3.5 rounded-card bg-surface-raised border border-white/[0.10] hover:border-white/[0.18] transition-colors duration-200 active:scale-[0.99]"
              >
                <span className="block text-white text-sm font-display font-bold leading-snug">{p.name}</span>
                <span className="block text-white/35 text-xs font-body mt-1">
                  {p.days_per_week ? `${p.days_per_week} days a week` : 'Flexible'}
                  {p.split ? ` · ${p.split}` : ''}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* -------------------------------------------------------- day count */}
      {step === 'dayCount' && (
        <>
          <Back to="door" label="Back" />
          <h2 className="font-display font-extrabold text-xl text-white tracking-tight">
            How many days a week?
          </h2>
          <p className="text-white/45 text-sm font-body mt-1 mb-5">
            Be honest about what you&rsquo;ll actually do. You can change this later.
          </p>

          <div className="grid grid-cols-5 gap-2">
            {DAY_COUNT_CHOICES.map((n) => (
              <button
                key={n}
                onClick={() => {
                  setDays(n)
                  const options = templatesFor(n)
                  if (options.length <= 1) onScratch(options[0] ?? null, n)
                  else setStep('split')
                }}
                className="py-5 rounded-card bg-white/[0.04] border border-white/[0.08] text-white font-display font-extrabold text-xl hover:bg-white/[0.08] hover:border-white/[0.16] active:scale-95 transition-all duration-150"
              >
                {n}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ------------------------------------------------------------ split */}
      {step === 'split' && days && (
        <>
          <Back to="dayCount" label="Back" />
          <h2 className="font-display font-extrabold text-xl text-white tracking-tight">
            How do you want to split it?
          </h2>
          <p className="text-white/45 text-sm font-body mt-1 mb-5">
            This just names your {days} days. You choose every exercise.
          </p>

          <div className="space-y-2.5">
            {templatesFor(days).map((t) => (
              <button
                key={t.key}
                onClick={() => onScratch(t, days)}
                className="w-full text-left px-5 py-4 rounded-card bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.14] transition-all duration-200 active:scale-[0.99]"
              >
                <span className="font-display font-bold text-base text-white/85">{t.label}</span>
                <span className="block text-white/40 text-xs font-body mt-0.5">{t.sub}</span>
                <span className="block text-white/30 text-2xs font-body mt-1.5">{t.dayNames.join(' · ')}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </motion.div>
  )
}
