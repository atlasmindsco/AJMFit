'use client'

/**
 * The review: what the program looks like, and anything worth saying about it.
 *
 * It never blocks. "Save anyway" is always the primary button, present and
 * enabled no matter what the check found, because a client who wants an
 * arms-only week is allowed to have one and a coaching app that argues with
 * them is worse than one that stays quiet. The findings are here so nobody
 * ends up with a week that quietly does nothing for their back without having
 * been told once.
 *
 * The volume bars are the other half, and arguably the more useful one: five
 * seconds of looking tells you more about a week than five paragraphs. They
 * are sets per group, primary muscle only — counting secondaries would credit
 * a bench press to shoulders and triceps, after which nothing ever looks
 * undertrained.
 */
import { motion } from 'framer-motion'
import { MUSCLE_GROUPS } from '@/lib/builder-rules'
import type { Finding, Volume } from '@/lib/program-health'

export default function ProgramReview({
  findings,
  volume,
  trainingDays,
  saving,
  activate,
  onSave,
  onBack,
}: {
  findings: Finding[]
  volume: Volume
  trainingDays: number
  saving: boolean
  /** Whether saving from here also makes this the program they train. */
  activate: boolean
  onSave: () => void
  onBack: () => void
}) {
  const warns = findings.filter((f) => f.severity === 'warn')
  const notes = findings.filter((f) => f.severity === 'note')
  const peak = Math.max(1, ...MUSCLE_GROUPS.map((g) => volume.setsByGroup[g.key] ?? 0))

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-brand-navy/60 backdrop-blur-sm" onClick={onBack} aria-hidden="true" />
      <motion.div
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="relative w-full sm:max-w-md max-h-[90vh] flex flex-col bg-surface-raised border-t sm:border border-white/[0.12] rounded-t-card sm:rounded-card overflow-hidden"
        role="dialog"
        aria-label="Review your program"
      >
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.08] shrink-0">
          <p className="font-display font-extrabold text-xl text-white tracking-tight">Your week</p>
          <p className="text-white/40 text-xs font-body mt-1">
            {trainingDays} training {trainingDays === 1 ? 'day' : 'days'} &middot; {volume.totalSets} sets
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* ── The shape of the week ── */}
          <p className="text-white/35 text-2xs font-display font-bold uppercase tracking-wide mb-3">
            Sets per muscle group
          </p>
          <div className="space-y-2">
            {MUSCLE_GROUPS.map((group) => {
              const sets = volume.setsByGroup[group.key] ?? 0
              const days = volume.daysByGroup[group.key]?.length ?? 0
              return (
                <div key={group.key} className="flex items-center gap-3">
                  <span className="w-[4.5rem] shrink-0 text-white/55 text-xs font-body">{group.label}</span>
                  <span className="flex-1 h-5 rounded bg-white/[0.04] overflow-hidden">
                    <span
                      className={`block h-full rounded transition-all duration-300 ${
                        sets === 0 ? 'bg-state-warning/50' : 'bg-brand-blue/70'
                      }`}
                      style={{ width: sets === 0 ? '3px' : `${Math.max(6, (sets / peak) * 100)}%` }}
                    />
                  </span>
                  <span className="w-[5.5rem] shrink-0 text-right text-white/35 text-2xs font-body tabular-nums">
                    {sets === 0 ? 'none' : `${sets} over ${days} ${days === 1 ? 'day' : 'days'}`}
                  </span>
                </div>
              )
            })}
          </div>

          {/* ── Anything worth saying ── */}
          {findings.length === 0 ? (
            <p className="text-state-success/80 text-sm font-body mt-6 px-3.5 py-3 rounded-control bg-state-success/[0.07] border border-state-success/20">
              Nothing to flag. All six groups covered and the week is balanced.
            </p>
          ) : (
            <div className="mt-6 space-y-2">
              {warns.map((f, i) => (
                <div
                  key={`${f.code}-${i}`}
                  className="px-3.5 py-3 rounded-control bg-state-warning/[0.08] border border-state-warning/25"
                >
                  <p className="text-state-warning text-sm font-display font-bold leading-snug">{f.title}</p>
                  {f.detail && <p className="text-white/50 text-xs font-body mt-1 leading-relaxed">{f.detail}</p>}
                </div>
              ))}
              {notes.map((f, i) => (
                <div
                  key={`${f.code}-${i}`}
                  className="px-3.5 py-3 rounded-control bg-white/[0.03] border border-white/[0.08]"
                >
                  <p className="text-white/75 text-sm font-body leading-snug">{f.title}</p>
                  {f.detail && <p className="text-white/35 text-xs font-body mt-1 leading-relaxed">{f.detail}</p>}
                </div>
              ))}
            </div>
          )}

          <p className="text-white/25 text-2xs font-body mt-5 leading-relaxed">
            None of this stops you saving. It&rsquo;s your program &mdash; this is just a second pair of eyes.
          </p>
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-white/[0.08] flex gap-2">
          <button
            onClick={onBack}
            className="px-5 py-3.5 rounded-control bg-white/[0.06] text-white/70 text-sm font-display font-bold uppercase tracking-wide hover:bg-white/[0.10] active:scale-[0.98] transition-all duration-200"
          >
            Keep editing
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-3.5 rounded-control bg-brand-orange text-white text-sm font-display font-bold uppercase tracking-wide hover:bg-brand-orangedark active:scale-[0.98] transition-all duration-200 disabled:opacity-40"
          >
            {saving
              ? 'Saving…'
              : warns.length > 0
                ? activate
                  ? 'Save & start anyway'
                  : 'Save anyway'
                : activate
                  ? 'Save & start'
                  : 'Save'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
