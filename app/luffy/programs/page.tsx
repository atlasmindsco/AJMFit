'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useMemo } from 'react'
import { fadeInAdmin as fadeIn } from '@/lib/animations'
import ProgramLibrary from '@/components/admin/ProgramLibrary'


interface ExerciseDB {
  id: string
  name: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  equipment: string
  level: string
  category: string
  images: string[]
}

const MUSCLE_FILTERS = [
  'All', 'chest', 'shoulders', 'lats', 'middle back', 'lower back', 'traps',
  'biceps', 'triceps', 'forearms', 'abdominals', 'quadriceps', 'hamstrings',
  'glutes', 'calves', 'adductors', 'abductors', 'neck',
]

const EQUIPMENT_FILTERS = [
  'All', 'barbell', 'dumbbell', 'cable', 'machine', 'body only', 'bands',
  'kettlebells', 'e-z curl bar', 'exercise ball', 'foam roll', 'medicine ball',
]

type Tab = 'programs' | 'library'

export default function ProgramsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('programs')

  // Exercise library state
  const [exerciseDB, setExerciseDB] = useState<ExerciseDB[]>([])
  const [libLoading, setLibLoading] = useState(false)
  const [libSearch, setLibSearch] = useState('')
  const [libMuscle, setLibMuscle] = useState('All')
  const [libEquipment, setLibEquipment] = useState('All')
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDB | null>(null)
  const [showEndImage, setShowEndImage] = useState(false)

  // Auto-cycle between start/end images in modal
  useEffect(() => {
    if (!selectedExercise?.images[1]) return
    setShowEndImage(false)
    const interval = setInterval(() => setShowEndImage((p) => !p), 2500)
    return () => clearInterval(interval)
  }, [selectedExercise])

  useEffect(() => {
    if (activeTab === 'library' && exerciseDB.length === 0) {
      setLibLoading(true)
      fetch('/exercises/exercises.json')
        .then((res) => res.json())
        .then((data: ExerciseDB[]) => {
          setExerciseDB(data)
          setLibLoading(false)
        })
        .catch(() => setLibLoading(false))
    }
  }, [activeTab, exerciseDB.length])

  const filteredExercises = useMemo(() => {
    let list = exerciseDB
    if (libMuscle !== 'All') {
      list = list.filter((ex) => ex.primaryMuscles.includes(libMuscle))
    }
    if (libEquipment !== 'All') {
      list = list.filter((ex) => ex.equipment === libEquipment)
    }
    if (libSearch.trim()) {
      const q = libSearch.trim().toLowerCase()
      list = list.filter(
        (ex) =>
          ex.name.toLowerCase().includes(q) ||
          ex.primaryMuscles.some((m) => m.includes(q)) ||
          ex.equipment.includes(q)
      )
    }
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [exerciseDB, libMuscle, libEquipment, libSearch])

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display font-extrabold text-3xl uppercase tracking-tight text-white"
          >
            Programs
          </motion.h1>
          <p className="text-white/40 font-body text-sm mt-1">
            Build programs and browse the exercise library
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('programs')}
            className={`px-4 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition-all duration-200 ${
              activeTab === 'programs' ? 'bg-[#F76B16] text-white' : 'bg-white/[0.04] text-white/40 hover:text-white/70'
            }`}
          >
            Programs
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`px-4 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition-all duration-200 ${
              activeTab === 'library' ? 'bg-[#F76B16] text-white' : 'bg-white/[0.04] text-white/40 hover:text-white/70'
            }`}
          >
            Exercise Library
          </button>
        </div>
      </div>

      {activeTab === 'programs' ? (
        <ProgramLibrary />
      ) : (
        /* Exercise Library, Full Database */
        <div className="space-y-4">
          {/* Search + Filters */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-4">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder="Search 873 exercises..."
                value={libSearch}
                onChange={(e) => setLibSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg font-body text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#F76B16]/40 transition-colors duration-200"
              />
            </div>

            {/* Muscle filter */}
            <div>
              <p className="text-white/25 text-[10px] font-display uppercase tracking-wide mb-2">Muscle Group</p>
              <div className="flex flex-wrap gap-1.5">
                {MUSCLE_FILTERS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setLibMuscle(m)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-display font-semibold uppercase tracking-wide transition-all duration-150 capitalize ${
                      libMuscle === m
                        ? 'bg-[#F76B16] text-white'
                        : 'bg-white/[0.04] text-white/30 hover:text-white/60'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Equipment filter */}
            <div>
              <p className="text-white/25 text-[10px] font-display uppercase tracking-wide mb-2">Equipment</p>
              <div className="flex flex-wrap gap-1.5">
                {EQUIPMENT_FILTERS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setLibEquipment(e)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-display font-semibold uppercase tracking-wide transition-all duration-150 capitalize ${
                      libEquipment === e
                        ? 'bg-[#1A7BFF] text-white'
                        : 'bg-white/[0.04] text-white/30 hover:text-white/60'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-white/20 text-xs font-body">{filteredExercises.length} exercises</p>
          </div>

          {/* Loading */}
          {libLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-white/10 border-t-[#F76B16] rounded-full animate-spin" />
            </div>
          )}

          {/* Exercise grid */}
          {!libLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredExercises.slice(0, 60).map((ex, i) => (
                <motion.button
                  key={ex.id}
                  custom={i % 12}
                  variants={fadeIn}
                  initial="hidden"
                  animate="visible"
                  onClick={() => { setSelectedExercise(ex); setShowEndImage(false) }}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-left hover:border-white/[0.12] hover:bg-white/[0.05] transition-all duration-150 flex items-center gap-3 group"
                >
                  <div className="w-14 h-14 rounded-lg bg-white/[0.04] border border-white/[0.06] overflow-hidden shrink-0">
                    {ex.images[0] && (
                      <img
                        src={ex.images[0]}
                        alt={ex.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-body font-semibold text-sm truncate group-hover:text-[#F76B16] transition-colors duration-150">
                      {ex.name}
                    </p>
                    <p className="text-white/30 text-[11px] font-body capitalize truncate">
                      {ex.primaryMuscles.join(', ')}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] font-display font-semibold uppercase tracking-wide text-[#F76B16]/70 bg-[#F76B16]/10 px-1.5 py-0.5 rounded">
                        {ex.level}
                      </span>
                      <span className="text-[9px] font-display font-semibold uppercase tracking-wide text-white/25 bg-white/[0.04] px-1.5 py-0.5 rounded capitalize">
                        {ex.equipment}
                      </span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          {!libLoading && filteredExercises.length > 60 && (
            <p className="text-center text-white/20 text-xs font-body py-4">
              Showing 60 of {filteredExercises.length}, use search or filters to narrow down
            </p>
          )}

          {/* Exercise Detail Modal */}
          <AnimatePresence>
            {selectedExercise && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setSelectedExercise(null)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-[#1B2D50] border border-white/[0.08] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] w-full max-w-lg max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="sticky top-0 bg-[#1B2D50]/95 backdrop-blur-sm border-b border-white/[0.06] px-5 py-3.5 flex items-center justify-between z-10">
                    <h2 className="font-display font-extrabold text-base text-white capitalize leading-tight pr-4">
                      {selectedExercise.name}
                    </h2>
                    <button
                      onClick={() => setSelectedExercise(null)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white/25 hover:text-white hover:bg-white/[0.06] transition-all duration-200 shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Images */}
                  <div className="bg-white/[0.03] px-6 py-8 flex items-center justify-center relative">
                    {selectedExercise.images.length > 0 ? (
                      <div className="relative max-h-[260px] w-full flex items-center justify-center">
                        <img
                          src={selectedExercise.images[0]}
                          alt={`${selectedExercise.name}, start`}
                          className="max-h-[260px] object-contain rounded-lg transition-opacity duration-[1500ms]"
                          style={{ opacity: showEndImage && selectedExercise.images[1] ? 0 : 1 }}
                        />
                        {selectedExercise.images[1] && (
                          <img
                            src={selectedExercise.images[1]}
                            alt={`${selectedExercise.name}, end`}
                            className="max-h-[260px] object-contain rounded-lg absolute inset-0 m-auto transition-opacity duration-[1500ms]"
                            style={{ opacity: showEndImage ? 1 : 0 }}
                          />
                        )}
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/50 rounded text-[9px] font-display font-semibold text-white/80 uppercase tracking-[0.1em]">
                          {showEndImage && selectedExercise.images[1] ? 'End' : 'Start'}
                        </div>
                      </div>
                    ) : (
                      <div className="w-40 h-40 rounded-xl bg-white/[0.03] flex items-center justify-center">
                        <span className="font-body text-xs text-white/20">No image</span>
                      </div>
                    )}
                  </div>

                  {selectedExercise.images.length > 1 && (
                    <p className="text-center text-[10px] font-body text-white/20 -mt-4 mb-2">
                      Auto-cycling start / end position
                    </p>
                  )}

                  <div className="px-6 pb-6 space-y-5">
                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2 py-1 bg-[#F76B16]/15 text-[#F76B16] font-display font-semibold text-[10px] uppercase tracking-[0.1em] rounded-md">
                        {selectedExercise.level}
                      </span>
                      <span className="px-2 py-1 bg-[#1A7BFF]/15 text-[#1A7BFF] font-display font-semibold text-[10px] uppercase tracking-[0.1em] rounded-md">
                        {selectedExercise.category}
                      </span>
                      <span className="px-2 py-1 bg-white/[0.06] text-white/40 font-display font-semibold text-[10px] uppercase tracking-[0.1em] rounded-md">
                        {selectedExercise.equipment}
                      </span>
                    </div>

                    {/* Muscles */}
                    <div className="flex items-start gap-5">
                      <div className="flex-1">
                        <p className="text-[10px] font-display font-semibold uppercase tracking-[0.14em] text-white/25 mb-1">Primary</p>
                        <p className="font-display font-bold text-sm text-[#F76B16] capitalize">{selectedExercise.primaryMuscles.join(', ')}</p>
                      </div>
                      {selectedExercise.secondaryMuscles.length > 0 && (
                        <div className="flex-1">
                          <p className="text-[10px] font-display font-semibold uppercase tracking-[0.14em] text-white/25 mb-1">Secondary</p>
                          <p className="font-body text-sm text-white/50 capitalize">{selectedExercise.secondaryMuscles.join(', ')}</p>
                        </div>
                      )}
                    </div>

                    {/* Instructions */}
                    {selectedExercise.instructions.length > 0 && (
                      <div>
                        <h4 className="font-display font-bold text-xs uppercase tracking-[0.12em] text-white/30 mb-3">Instructions</h4>
                        <ol className="space-y-2.5">
                          {selectedExercise.instructions.map((step, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="shrink-0 w-5 h-5 rounded-full bg-[#F76B16]/15 text-[#F76B16] flex items-center justify-center text-[10px] font-display font-bold mt-0.5">
                                {i + 1}
                              </span>
                              <p className="font-body text-[13px] text-white/60 leading-relaxed">{step}</p>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
