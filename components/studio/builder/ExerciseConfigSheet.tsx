'use client'

/**
 * Sets, reps and rest — all taps, no keyboard.
 *
 * Rep RANGES rather than single numbers, because double progression needs a
 * range to work with: a client who enters "10" gets an engine that can only
 * ever tell them to add weight. Custom is there for the 5x5 crowd.
 *
 * No RIR target, no tempo, no percentage of 1RM. RIR is asked after a set,
 * which is where it belongs; tempo is a column no program uses; and no 1RM is
 * recorded, so a percentage field could not be computed from anything.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { REP_PRESETS, REST_PRESETS } from '@/lib/builder-rules'
import type { BuilderExercise } from '@/lib/custom-program'

const restLabel = (s: number) => (s === 0 ? 'None' : s < 60 ? `${s}s` : s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)}m ${s % 60}s`)

export default function ExerciseConfigSheet({
  exercise,
  onSave,
  onClose,
}: {
  exercise: BuilderExercise
  onSave: (next: BuilderExercise) => void
  onClose: () => void
}) {
  const [sets, setSets] = useState(exercise.sets)
  const [reps, setReps] = useState(exercise.reps)
  const [rest, setRest] = useState(exercise.restSeconds)
  const [notes, setNotes] = useState(exercise.notes ?? '')
  const [customReps, setCustomReps] = useState(!REP_PRESETS.includes(exercise.reps))

  const commit = () => {
    onSave({ ...exercise, sets, reps: reps.trim() || '8-12', restSeconds: rest, notes: notes.trim() || null })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[78] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="relative w-full sm:max-w-sm max-h-[85vh] overflow-y-auto bg-surface-raised border-t sm:border border-white/[0.12] rounded-t-card sm:rounded-card px-5 py-5"
        role="dialog"
        aria-label={`Configure ${exercise.exerciseName}`}
      >
        <p className="font-display font-extrabold text-lg text-white tracking-tight">{exercise.exerciseName}</p>

        <p className="text-white/35 text-2xs font-display font-bold uppercase tracking-wide mt-5 mb-2">Sets</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSets((s) => Math.max(1, s - 1))}
            className="w-12 h-12 rounded-control bg-white/[0.06] text-white font-display font-bold text-xl active:scale-95 transition-transform duration-150"
            aria-label="Fewer sets"
          >
            &minus;
          </button>
          <span className="flex-1 text-center font-display font-extrabold text-3xl text-white tabular-nums">{sets}</span>
          <button
            onClick={() => setSets((s) => Math.min(10, s + 1))}
            className="w-12 h-12 rounded-control bg-white/[0.06] text-white font-display font-bold text-xl active:scale-95 transition-transform duration-150"
            aria-label="More sets"
          >
            +
          </button>
        </div>

        <p className="text-white/35 text-2xs font-display font-bold uppercase tracking-wide mt-5 mb-2">Reps</p>
        <div className="flex flex-wrap gap-1.5">
          {REP_PRESETS.map((r) => (
            <button
              key={r}
              onClick={() => { setReps(r); setCustomReps(false) }}
              className={`px-3.5 py-2.5 rounded-control text-sm font-body transition-colors duration-150 ${
                !customReps && reps === r ? 'bg-brand-blue text-white' : 'bg-white/[0.05] text-white/60 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
          <button
            onClick={() => setCustomReps(true)}
            className={`px-3.5 py-2.5 rounded-control text-sm font-body transition-colors duration-150 ${
              customReps ? 'bg-brand-blue text-white' : 'bg-white/[0.05] text-white/60 hover:text-white'
            }`}
          >
            Other
          </button>
        </div>
        {customReps && (
          <input
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="e.g. 5, or 20 min"
            className="mt-2 w-full px-3 py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-base font-body placeholder:text-white/25 focus:outline-none focus:border-brand-blue/50"
          />
        )}

        <p className="text-white/35 text-2xs font-display font-bold uppercase tracking-wide mt-5 mb-2">Rest between sets</p>
        <div className="flex flex-wrap gap-1.5">
          {REST_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => setRest(s)}
              className={`px-3.5 py-2.5 rounded-control text-sm font-body transition-colors duration-150 ${
                rest === s ? 'bg-brand-blue text-white' : 'bg-white/[0.05] text-white/60 hover:text-white'
              }`}
            >
              {restLabel(s)}
            </button>
          ))}
        </div>

        <details className="mt-5">
          <summary className="text-white/40 text-xs font-body cursor-pointer">Add a note</summary>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. pause at the bottom"
            className="mt-2 w-full px-3 py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-base font-body placeholder:text-white/25 focus:outline-none focus:border-brand-blue/50"
          />
        </details>

        <button
          onClick={commit}
          className="w-full mt-6 py-3.5 rounded-control bg-brand-blue text-white text-sm font-display font-bold uppercase tracking-[0.12em] hover:bg-brand-bluedark active:scale-[0.98] transition-all duration-200"
        >
          Done
        </button>
      </motion.div>
    </div>
  )
}
