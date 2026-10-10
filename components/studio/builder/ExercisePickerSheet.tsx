'use client'

/**
 * Choosing from 873 exercises without it feeling like 873.
 *
 * The filters are the taxonomy the library already carries — primary muscle,
 * equipment, mechanic, category — with one grouping layer over the seventeen
 * muscles, because nobody thinks "middle back" when they want to pick a row.
 * No new categories were invented.
 *
 * Adding keeps the sheet open. Three exercises should be three taps, not three
 * round trips through a closing animation.
 */
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  filterLibrary,
  MUSCLE_GROUPS,
  EQUIPMENT_FILTERS,
  TYPE_FILTERS,
  type LibraryExercise,
} from '@/lib/builder-rules'

export default function ExercisePickerSheet({
  library,
  alreadyAdded,
  openOnGroup,
  onAdd,
  onClose,
}: {
  library: LibraryExercise[]
  /** Names already in this day, so a duplicate is obvious rather than silent. */
  alreadyAdded: string[]
  openOnGroup: string | null
  onAdd: (exercise: LibraryExercise) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<string | null>(openOnGroup)
  const [equipment, setEquipment] = useState('any')
  const [type, setType] = useState('any')
  const [justAdded, setJustAdded] = useState<string[]>([])

  const results = useMemo(
    () => filterLibrary(library, { search, group, equipment, type }),
    [library, search, group, equipment, type]
  )
  const added = new Set([...alreadyAdded, ...justAdded])

  // 873 rows would jank the scroll on a phone. Nobody scrolls past 60 without
  // filtering, and the count below tells them to.
  const shown = results.slice(0, 60)

  const add = (ex: LibraryExercise) => {
    onAdd(ex)
    setJustAdded((prev) => [...prev, ex.name])
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="relative w-full h-[88vh] sm:h-[80vh] sm:max-w-md bg-surface-raised border-t sm:border border-white/[0.12] rounded-t-card sm:rounded-card flex flex-col overflow-hidden"
        role="dialog"
        aria-label="Add an exercise"
      >
        <div className="px-4 pt-4 pb-3 border-b border-white/[0.08] shrink-0 space-y-3">
          <div className="flex items-center gap-3">
            <p className="font-display font-bold text-white text-sm flex-1">Add an exercise</p>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-control bg-white/[0.08] text-white/70 text-2xs font-display font-bold uppercase tracking-wide hover:text-white active:scale-95 transition-all duration-150"
            >
              Done
            </button>
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search 873 exercises"
            className="w-full px-3 py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-base font-body placeholder:text-white/25 focus:outline-none focus:border-brand-blue/50"
          />

          {/* Six buttons over seventeen muscles. */}
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
            {MUSCLE_GROUPS.map((g) => {
              const on = group === g.key
              return (
                <button
                  key={g.key}
                  onClick={() => setGroup(on ? null : g.key)}
                  className={`shrink-0 px-3 py-2 rounded-control text-xs font-display font-bold transition-colors duration-150 ${
                    on ? 'bg-brand-blue text-white' : 'bg-white/[0.05] text-white/50 hover:text-white/80'
                  }`}
                >
                  {g.label}
                </button>
              )
            })}
          </div>

          <div className="flex gap-2">
            <select
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              className="flex-1 min-w-0 px-2.5 py-2 rounded-control bg-white/[0.04] border border-white/[0.08] text-white/80 text-xs font-body focus:outline-none focus:border-brand-blue/50"
            >
              {EQUIPMENT_FILTERS.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex-1 min-w-0 px-2.5 py-2 rounded-control bg-white/[0.04] border border-white/[0.08] text-white/80 text-xs font-body focus:outline-none focus:border-brand-blue/50"
            >
              {TYPE_FILTERS.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-white/40 text-sm font-body">Nothing matches that.</p>
              <p className="text-white/25 text-xs font-body mt-1">
                Try fewer filters. If it genuinely isn&rsquo;t here, tell Anthony and he&rsquo;ll add it.
              </p>
            </div>
          ) : (
            <>
              {shown.map((ex) => {
                const on = added.has(ex.name)
                return (
                  <button
                    key={ex.name}
                    onClick={() => add(ex)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/[0.04] hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors duration-150"
                  >
                    <div className="w-12 h-12 rounded-control overflow-hidden bg-[#0A0A0A] shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {/* Absolute URLs from the library file — see
                          lib/exercise-images.ts for why they are not local.
                          A missing image leaves the dark square, which is
                          quieter than a broken-image glyph. */}
                      {ex.images?.[0] && (
                        <img src={ex.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                      )}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block text-white text-sm font-body truncate">{ex.name}</span>
                      <span className="block text-white/35 text-2xs font-body capitalize">
                        {ex.primaryMuscles[0]} &middot; {ex.equipment} &middot; {ex.mechanic ?? ex.category}
                      </span>
                    </span>
                    {on ? (
                      <span className="shrink-0 text-state-success text-2xs font-display font-bold uppercase tracking-wide">
                        Added
                      </span>
                    ) : (
                      <span className="shrink-0 w-8 h-8 rounded-full bg-brand-blue/15 text-brand-blue flex items-center justify-center font-display font-bold text-lg">
                        +
                      </span>
                    )}
                  </button>
                )
              })}
              {results.length > shown.length && (
                <p className="px-4 py-4 text-white/30 text-xs font-body text-center">
                  Showing {shown.length} of {results.length}. Narrow it down to see the rest.
                </p>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
