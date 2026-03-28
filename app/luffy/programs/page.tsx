'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useMemo } from 'react'

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] },
  }),
}

const programs = [
  {
    name: 'Lean Muscle Builder',
    description: 'Progressive hypertrophy-focused program for building lean muscle mass',
    duration: '12 weeks',
    phases: 3,
    clients: ['Marcus Johnson', 'Tanya Bell'],
    status: 'active',
    type: 'Hypertrophy',
    split: 'Upper/Lower + Legs & Core',
    daysPerWeek: 5,
  },
  {
    name: 'Fat Loss Kickstart',
    description: 'High-intensity fat loss program combining strength and metabolic conditioning',
    duration: '8 weeks',
    phases: 2,
    clients: ['Sarah Kim', 'Chris Okafor', 'Mia Chen'],
    status: 'active',
    type: 'Fat Loss',
    split: 'Full Body / Push-Pull',
    daysPerWeek: 4,
  },
  {
    name: 'Strength Foundations',
    description: 'Beginner-friendly strength program focused on compound lifts and form mastery',
    duration: '6 weeks',
    phases: 2,
    clients: ['David Reeves', 'Andre Williams'],
    status: 'active',
    type: 'Strength',
    split: 'Full Body 3x/wk',
    daysPerWeek: 3,
  },
  {
    name: 'Athletic Performance',
    description: 'Sport-specific training for power, agility, and athletic conditioning',
    duration: '10 weeks',
    phases: 3,
    clients: ['Jasmine Torres'],
    status: 'active',
    type: 'Performance',
    split: 'Sport-Specific Periodization',
    daysPerWeek: 5,
  },
  {
    name: 'Post-Rehab Return',
    description: 'Gentle return-to-training program for clients recovering from injury',
    duration: '6 weeks',
    phases: 2,
    clients: [],
    status: 'template',
    type: 'Rehab',
    split: 'Full Body / Mobility',
    daysPerWeek: 3,
  },
  {
    name: 'Competition Prep',
    description: 'Peaking and tapering program for physique or strength competitions',
    duration: '16 weeks',
    phases: 4,
    clients: [],
    status: 'template',
    type: 'Competition',
    split: 'PPL + Posing Practice',
    daysPerWeek: 6,
  },
]

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

function getTypeColor(type: string) {
  const map: Record<string, string> = {
    Hypertrophy: 'bg-[#F08B1E]/15 text-[#F08B1E]',
    'Fat Loss': 'bg-emerald-500/15 text-emerald-400',
    Strength: 'bg-[#2E6AB0]/15 text-[#2E6AB0]',
    Performance: 'bg-purple-500/15 text-purple-400',
    Rehab: 'bg-amber-500/15 text-amber-400',
    Competition: 'bg-red-500/15 text-red-400',
  }
  return map[type] || 'bg-white/[0.06] text-white/50'
}

type Tab = 'programs' | 'library'

export default function ProgramsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('programs')
  const [expandedProgram, setExpandedProgram] = useState<number | null>(null)

  // Exercise library state
  const [exerciseDB, setExerciseDB] = useState<ExerciseDB[]>([])
  const [libLoading, setLibLoading] = useState(false)
  const [libSearch, setLibSearch] = useState('')
  const [libMuscle, setLibMuscle] = useState('All')
  const [libEquipment, setLibEquipment] = useState('All')
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDB | null>(null)
  const [showEndImage, setShowEndImage] = useState(false)

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

  const activePrograms = programs.filter(p => p.status === 'active')
  const templates = programs.filter(p => p.status === 'template')

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
            {activePrograms.length} active &middot; {templates.length} templates
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('programs')}
            className={`px-4 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition-all duration-200 ${
              activeTab === 'programs' ? 'bg-[#F08B1E] text-white' : 'bg-white/[0.04] text-white/40 hover:text-white/70'
            }`}
          >
            Programs
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`px-4 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition-all duration-200 ${
              activeTab === 'library' ? 'bg-[#F08B1E] text-white' : 'bg-white/[0.04] text-white/40 hover:text-white/70'
            }`}
          >
            Exercise Library
          </button>
        </div>
      </div>

      {activeTab === 'programs' ? (
        <div className="space-y-8">
          {/* Active Programs */}
          <div>
            <h2 className="text-white/30 text-[11px] font-display uppercase tracking-[0.2em] mb-4">Active Programs</h2>
            <div className="space-y-3">
              {activePrograms.map((prog, i) => (
                <motion.div
                  key={prog.name}
                  custom={i}
                  variants={fadeIn}
                  initial="hidden"
                  animate="visible"
                  className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedProgram(expandedProgram === i ? null : i)}
                    className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors duration-200"
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="w-12 h-12 rounded-xl bg-[#F08B1E]/10 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-[#F08B1E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-body font-semibold text-sm">{prog.name}</p>
                          <span className={`text-[10px] font-display font-bold px-2 py-0.5 rounded ${getTypeColor(prog.type)}`}>
                            {prog.type}
                          </span>
                        </div>
                        <p className="text-white/30 text-xs font-body mt-0.5">{prog.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="hidden sm:block text-right">
                        <p className="text-white/60 text-sm font-display font-bold">{prog.clients.length}</p>
                        <p className="text-white/20 text-[10px] font-body">clients</p>
                      </div>
                      <svg className={`w-4 h-4 text-white/20 transition-transform duration-200 ${expandedProgram === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </button>

                  {expandedProgram === i && (
                    <div className="px-5 pb-5 pt-0 border-t border-white/[0.04]">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 mb-4">
                        <div>
                          <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">Duration</p>
                          <p className="text-white/70 text-sm font-body mt-1">{prog.duration}</p>
                        </div>
                        <div>
                          <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">Phases</p>
                          <p className="text-white/70 text-sm font-body mt-1">{prog.phases} phases</p>
                        </div>
                        <div>
                          <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">Split</p>
                          <p className="text-white/70 text-sm font-body mt-1">{prog.split}</p>
                        </div>
                        <div>
                          <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">Training Days</p>
                          <p className="text-white/70 text-sm font-body mt-1">{prog.daysPerWeek}x / week</p>
                        </div>
                      </div>
                      {prog.clients.length > 0 && (
                        <div>
                          <p className="text-white/25 text-[10px] font-display uppercase tracking-wide mb-2">Assigned Clients</p>
                          <div className="flex flex-wrap gap-2">
                            {prog.clients.map((c) => (
                              <span key={c} className="bg-white/[0.04] text-white/50 text-xs font-body px-3 py-1.5 rounded-lg">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Templates */}
          <div>
            <h2 className="text-white/30 text-[11px] font-display uppercase tracking-[0.2em] mb-4">Templates</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.map((prog, i) => (
                <motion.div
                  key={prog.name}
                  custom={i + activePrograms.length}
                  variants={fadeIn}
                  initial="hidden"
                  animate="visible"
                  className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-white font-body font-semibold text-sm">{prog.name}</p>
                    <span className={`text-[10px] font-display font-bold px-2 py-0.5 rounded ${getTypeColor(prog.type)}`}>
                      {prog.type}
                    </span>
                  </div>
                  <p className="text-white/30 text-xs font-body mb-3">{prog.description}</p>
                  <div className="flex items-center gap-4 text-xs text-white/25 font-body">
                    <span>{prog.duration}</span>
                    <span>{prog.phases} phases</span>
                    <span>{prog.daysPerWeek}x/wk</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Exercise Library — Full Database */
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
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg font-body text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#F08B1E]/40 transition-colors duration-200"
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
                        ? 'bg-[#F08B1E] text-white'
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
                        ? 'bg-[#2E6AB0] text-white'
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
              <div className="w-8 h-8 border-2 border-white/10 border-t-[#F08B1E] rounded-full animate-spin" />
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
                    <p className="text-white font-body font-semibold text-sm truncate group-hover:text-[#F08B1E] transition-colors duration-150">
                      {ex.name}
                    </p>
                    <p className="text-white/30 text-[11px] font-body capitalize truncate">
                      {ex.primaryMuscles.join(', ')}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] font-display font-semibold uppercase tracking-wide text-[#F08B1E]/70 bg-[#F08B1E]/10 px-1.5 py-0.5 rounded">
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
              Showing 60 of {filteredExercises.length} — use search or filters to narrow down
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
                  <div
                    className="bg-white/[0.03] px-6 py-8 flex items-center justify-center relative"
                    onMouseEnter={() => setShowEndImage(true)}
                    onMouseLeave={() => setShowEndImage(false)}
                  >
                    {selectedExercise.images.length > 0 ? (
                      <div className="relative max-h-[260px] w-full flex items-center justify-center">
                        <img
                          src={selectedExercise.images[0]}
                          alt={`${selectedExercise.name} — start`}
                          className="max-h-[260px] object-contain rounded-lg transition-opacity duration-300"
                          style={{ opacity: showEndImage && selectedExercise.images[1] ? 0 : 1 }}
                        />
                        {selectedExercise.images[1] && (
                          <img
                            src={selectedExercise.images[1]}
                            alt={`${selectedExercise.name} — end`}
                            className="max-h-[260px] object-contain rounded-lg absolute inset-0 m-auto transition-opacity duration-300"
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
                      Hover image to see end position
                    </p>
                  )}

                  <div className="px-6 pb-6 space-y-5">
                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2 py-1 bg-[#F08B1E]/15 text-[#F08B1E] font-display font-semibold text-[10px] uppercase tracking-[0.1em] rounded-md">
                        {selectedExercise.level}
                      </span>
                      <span className="px-2 py-1 bg-[#2E6AB0]/15 text-[#2E6AB0] font-display font-semibold text-[10px] uppercase tracking-[0.1em] rounded-md">
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
                        <p className="font-display font-bold text-sm text-[#F08B1E] capitalize">{selectedExercise.primaryMuscles.join(', ')}</p>
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
                              <span className="shrink-0 w-5 h-5 rounded-full bg-[#F08B1E]/15 text-[#F08B1E] flex items-center justify-center text-[10px] font-display font-bold mt-0.5">
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
