'use client'

/**
 * The builder: a week of days, and a day of exercises.
 *
 * Two screens rather than a wizard. Building a week is iterative — people jump
 * between days and come back — so the week view is a home you return to, with
 * save always available, rather than step four of seven.
 *
 * A half-built program saves. Someone who adds two days on the bus and three
 * that evening must not lose the two, and a builder that only saves at the end
 * is one you cannot use in the gaps, which on a phone is when it will mostly
 * be used.
 */
import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import ExercisePickerSheet from './ExercisePickerSheet'
import ExerciseConfigSheet from './ExerciseConfigSheet'
import {
  canSave,
  defaultPrescription,
  defaultRestSeconds,
  dominantGroup,
  estimateMinutes,
  type LibraryExercise,
} from '@/lib/builder-rules'
import type { BuilderDay, BuilderExercise, BuilderProgram } from '@/lib/custom-program'

export default function ProgramBuilder({
  initial,
  library,
  saving,
  editing = false,
  onSave,
  onCancel,
}: {
  initial: BuilderProgram
  library: LibraryExercise[]
  saving: boolean
  /**
   * Editing a saved program rather than building a new one. Only then can a
   * day have history behind it, and only then is renaming worth a word.
   */
  editing?: boolean
  onSave: (program: BuilderProgram, activate: boolean) => void
  onCancel: () => void
}) {
  const [program, setProgram] = useState<BuilderProgram>(initial)
  const [openDay, setOpenDay] = useState<number | null>(null)
  const [picking, setPicking] = useState(false)
  const [configuring, setConfiguring] = useState<number | null>(null)

  const byName = useMemo(() => {
    const m = new Map(library.map((e) => [e.name, e]))
    return (n: string) => m.get(n) ?? null
  }, [library])

  const block = canSave(program)
  const day = openDay != null ? program.days[openDay] : null

  const setDay = (index: number, next: BuilderDay) =>
    setProgram((p) => ({ ...p, days: p.days.map((d, i) => (i === index ? next : d)) }))

  const addExercise = (ex: LibraryExercise) => {
    if (openDay == null) return
    const p = defaultPrescription(ex)
    const added: BuilderExercise = {
      exerciseName: ex.name,
      sets: p.sets,
      reps: p.reps,
      restSeconds: defaultRestSeconds(ex),
      notes: null,
    }
    setDay(openDay, { ...program.days[openDay], exercises: [...program.days[openDay].exercises, added] })
  }

  const move = (from: number, to: number) => {
    if (openDay == null || !day) return
    if (to < 0 || to >= day.exercises.length) return
    const next = [...day.exercises]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setDay(openDay, { ...day, exercises: next })
  }

  /* ---------------------------------------------------------------- day view */
  if (day && openDay != null) {
    const minutes = estimateMinutes(day.exercises)
    return (
      <div className="max-w-xl mx-auto pb-24">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setOpenDay(null)}
            className="text-white/40 hover:text-white/70 text-xs font-display font-semibold uppercase tracking-wide transition-colors duration-200"
          >
            &lsaquo; My week
          </button>
        </div>

        <input
          value={day.name}
          onChange={(e) => setDay(openDay, { ...day, name: e.target.value })}
          placeholder="Name this day"
          className="w-full px-3 py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-lg font-display font-bold placeholder:text-white/25 focus:outline-none focus:border-brand-blue/50"
        />
        {/* Workout rows store the day's NAME, so a rename without a migration
            would orphan every session logged under the old one. It does
            migrate — saying so is what stops the rename feeling risky. */}
        {editing && day.key && (
          <p className="text-white/30 text-2xs font-body mt-1.5 mb-4">
            Rename it freely &mdash; your logged sessions come with it.
          </p>
        )}
        {!(editing && day.key) && <div className="mb-4" />}

        {day.exercises.length === 0 ? (
          <p className="text-white/30 text-sm font-body text-center py-10">
            Nothing here yet. Add your first exercise.
          </p>
        ) : (
          <div className="space-y-2">
            {day.exercises.map((ex, i) => (
              <div key={`${ex.exerciseName}-${i}`} className="rounded-card bg-surface-raised border border-white/[0.10] px-3.5 py-3">
                <div className="flex items-start gap-3">
                  <span className="text-white/25 text-xs font-display font-bold mt-1 w-4 shrink-0">{i + 1}</span>
                  <button
                    onClick={() => setConfiguring(i)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <span className="block text-white text-sm font-body">{ex.exerciseName}</span>
                    <span className="block text-white/40 text-xs font-body mt-0.5">
                      {ex.sets} &times; {ex.reps} &middot; {ex.restSeconds === 0 ? 'no rest' : `${ex.restSeconds}s rest`}
                    </span>
                  </button>
                  {/* Move buttons as well as the obvious drag, because
                      drag-and-drop on a scrolling phone list is genuinely
                      awkward and these cost nothing. */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => move(i, i - 1)}
                      disabled={i === 0}
                      className="w-7 h-6 rounded bg-white/[0.05] text-white/50 text-xs disabled:opacity-20 active:scale-95 transition-all duration-150"
                      aria-label="Move up"
                    >
                      &uarr;
                    </button>
                    <button
                      onClick={() => move(i, i + 1)}
                      disabled={i === day.exercises.length - 1}
                      className="w-7 h-6 rounded bg-white/[0.05] text-white/50 text-xs disabled:opacity-20 active:scale-95 transition-all duration-150"
                      aria-label="Move down"
                    >
                      &darr;
                    </button>
                  </div>
                  <button
                    onClick={() => setDay(openDay, { ...day, exercises: day.exercises.filter((_, j) => j !== i) })}
                    className="w-7 h-7 rounded-full bg-white/[0.05] text-white/35 hover:text-state-danger shrink-0 active:scale-95 transition-all duration-150"
                    aria-label={`Remove ${ex.exerciseName}`}
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setPicking(true)}
          className="w-full mt-3 py-3.5 rounded-card bg-brand-blue/[0.12] border border-brand-blue/30 text-brand-blue text-sm font-display font-bold uppercase tracking-wide hover:bg-brand-blue/20 active:scale-[0.99] transition-all duration-200"
        >
          + Add exercise
        </button>

        {day.exercises.length > 0 && (
          <p className="text-white/30 text-xs font-body text-center mt-3">
            {day.exercises.length} {day.exercises.length === 1 ? 'exercise' : 'exercises'} &middot; roughly {minutes} min
          </p>
        )}

        <AnimatePresence>
          {picking && (
            <ExercisePickerSheet
              library={library}
              alreadyAdded={day.exercises.map((e) => e.exerciseName)}
              openOnGroup={dominantGroup(day.exercises.map((e) => e.exerciseName), byName)}
              onAdd={addExercise}
              onClose={() => setPicking(false)}
            />
          )}
          {configuring != null && day.exercises[configuring] && (
            <ExerciseConfigSheet
              exercise={day.exercises[configuring]}
              onSave={(next) =>
                setDay(openDay, {
                  ...day,
                  exercises: day.exercises.map((e, j) => (j === configuring ? next : e)),
                })
              }
              onClose={() => setConfiguring(null)}
            />
          )}
        </AnimatePresence>
      </div>
    )
  }

  /* --------------------------------------------------------------- week view */
  return (
    <div className="max-w-xl mx-auto pb-28">
      <input
        value={program.name}
        onChange={(e) => setProgram((p) => ({ ...p, name: e.target.value }))}
        placeholder="Name your program"
        className="w-full px-3 py-3 mb-4 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-lg font-display font-bold placeholder:text-white/25 focus:outline-none focus:border-brand-blue/50"
      />

      <div className="space-y-2">
        {program.days.map((d, i) => (
          <div
            key={d.key ?? `new-${i}`}
            className="flex items-center gap-2 px-4 py-3.5 rounded-card bg-surface-raised border border-white/[0.10] hover:border-white/[0.18] transition-colors duration-200"
          >
            <button onClick={() => setOpenDay(i)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
              <span className="text-white/25 text-xs font-display font-bold w-5 shrink-0">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-white text-sm font-display font-bold truncate">{d.name || `Day ${i + 1}`}</span>
                <span className="block text-white/35 text-xs font-body mt-0.5">
                  {d.exercises.length === 0
                    ? 'Rest day — tap to add exercises'
                    : `${d.exercises.length} ${d.exercises.length === 1 ? 'exercise' : 'exercises'} · roughly ${estimateMinutes(d.exercises)} min`}
                </span>
              </span>
            </button>
            {/* Copying a 6-day program when you train four times a week should
                not mean deleting thirty exercises one at a time. */}
            {program.days.length > 1 && (
              <button
                onClick={() => setProgram((p) => ({ ...p, days: p.days.filter((_, j) => j !== i) }))}
                className="w-7 h-7 rounded-full bg-white/[0.05] text-white/30 hover:text-state-danger shrink-0 active:scale-95 transition-all duration-150"
                aria-label={`Remove ${d.name || `day ${i + 1}`}`}
              >
                &times;
              </button>
            )}
            <span className="text-white/20 shrink-0" aria-hidden="true">&rsaquo;</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => setProgram((p) => ({ ...p, days: [...p.days, { name: `Day ${p.days.length + 1}`, exercises: [] }] }))}
        disabled={program.days.length >= 7}
        className="w-full mt-2 py-3 rounded-card bg-white/[0.04] border border-white/[0.07] text-white/45 text-xs font-display font-bold uppercase tracking-wide hover:text-white/70 disabled:opacity-30 transition-colors duration-200"
      >
        + Add a day
      </button>

      {!block.ok && <p className="text-state-warning/90 text-xs font-body mt-4 text-center">{block.reason}</p>}

      <div className="flex gap-2 mt-5">
        <button
          onClick={onCancel}
          className="px-5 py-3.5 rounded-control bg-white/[0.06] text-white/70 text-sm font-display font-bold uppercase tracking-wide hover:bg-white/[0.10] active:scale-[0.98] transition-all duration-200"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(program, false)}
          disabled={!block.ok || saving}
          className="flex-1 py-3.5 rounded-control bg-white/[0.06] text-white text-sm font-display font-bold uppercase tracking-wide hover:bg-white/[0.10] active:scale-[0.98] transition-all duration-200 disabled:opacity-40"
        >
          Save
        </button>
        <button
          onClick={() => onSave(program, true)}
          disabled={!block.ok || saving}
          className="flex-1 py-3.5 rounded-control bg-brand-orange text-white text-sm font-display font-bold uppercase tracking-wide hover:bg-brand-orangedark active:scale-[0.98] transition-all duration-200 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save & start'}
        </button>
      </div>
    </div>
  )
}
