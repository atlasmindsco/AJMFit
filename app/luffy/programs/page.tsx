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

type Level = 'Beginner' | 'Intermediate' | 'Advanced'

interface ProgramLevel {
  level: Level
  duration: string
  phases: number
  daysPerWeek: number
  split: string
  clients: string[]
  /** Intensity techniques available at this level */
  intensityTechniques?: string[]
}

interface Program {
  name: string
  description: string
  type: string
  icon: 'muscle' | 'strength' | 'shred' | 'back' | 'legs' | 'chest' | 'shoulders'
  levels: ProgramLevel[]
}

const programs: Program[] = [
  {
    name: 'Muscle Builder',
    description: 'Bro split hypertrophy program — 2 body parts per day, gym & dumbbell focused',
    type: 'Hypertrophy',
    icon: 'muscle',
    levels: [
      {
        level: 'Beginner',
        duration: '8 weeks',
        phases: 2,
        daysPerWeek: 5,
        split: 'Bro Split — Chest/Tri, Back/Bi, Shoulders/Abs, Legs, Arms',
        clients: ['David Reeves'],
      },
      {
        level: 'Intermediate',
        duration: '10 weeks',
        phases: 3,
        daysPerWeek: 5,
        split: 'Bro Split — Chest/Tri, Back/Bi, Shoulders/Traps, Legs/Abs, Arms',
        clients: ['Marcus Johnson', 'Tanya Bell'],
      },
      {
        level: 'Advanced',
        duration: '12 weeks',
        phases: 4,
        daysPerWeek: 6,
        split: 'Bro Split — Chest/Front Delt, Back/Rear Delt, Shoulders/Traps, Quads/Calves, Hams/Glutes, Arms/Abs',
        clients: ['Chris Okafor'],
        intensityTechniques: ['Drop Sets', 'Rest-Pause Sets'],
      },
    ],
  },
  {
    name: 'Strength Builder',
    description: 'Compound-focused strength program to build raw power and functional strength',
    type: 'Strength',
    icon: 'strength',
    levels: [
      {
        level: 'Beginner',
        duration: '6 weeks',
        phases: 2,
        daysPerWeek: 3,
        split: 'Full Body 3x/wk',
        clients: ['Andre Williams'],
      },
      {
        level: 'Intermediate',
        duration: '10 weeks',
        phases: 3,
        daysPerWeek: 4,
        split: 'Upper / Lower + Heavy Day',
        clients: ['Sarah Kim', 'Jasmine Torres'],
      },
      {
        level: 'Advanced',
        duration: '12 weeks',
        phases: 4,
        daysPerWeek: 5,
        split: 'Conjugate / Westside',
        clients: [],
        intensityTechniques: ['Rest-Pause Sets'],
      },
    ],
  },
  {
    name: 'Shred Program',
    description: 'High-intensity fat loss program combining strength training and metabolic conditioning',
    type: 'Fat Loss',
    icon: 'shred',
    levels: [
      {
        level: 'Beginner',
        duration: '6 weeks',
        phases: 2,
        daysPerWeek: 3,
        split: 'Full Body + Cardio Finishers',
        clients: ['Mia Chen'],
      },
      {
        level: 'Intermediate',
        duration: '8 weeks',
        phases: 3,
        daysPerWeek: 4,
        split: 'Push-Pull + HIIT Days',
        clients: ['Sarah Kim', 'Chris Okafor'],
      },
      {
        level: 'Advanced',
        duration: '10 weeks',
        phases: 4,
        daysPerWeek: 5,
        split: 'PPL + 2x Conditioning',
        clients: [],
        intensityTechniques: ['Drop Sets', 'Rest-Pause Sets'],
      },
    ],
  },
  {
    name: 'Back Focus',
    description: 'PPL program with extra back volume — build width, thickness, and a stronger posterior chain',
    type: 'Hypertrophy',
    icon: 'back',
    levels: [
      {
        level: 'Beginner',
        duration: '8 weeks',
        phases: 2,
        daysPerWeek: 4,
        split: 'Pull (Back Heavy) / Push / Legs / Pull (Back Width)',
        clients: [],
      },
      {
        level: 'Intermediate',
        duration: '10 weeks',
        phases: 3,
        daysPerWeek: 5,
        split: 'Pull (Thickness) / Push / Legs / Pull (Width) / Upper',
        clients: [],
      },
      {
        level: 'Advanced',
        duration: '12 weeks',
        phases: 4,
        daysPerWeek: 6,
        split: 'Pull (Thickness) / Push / Legs / Pull (Width) / Push / Legs (Deadlift)',
        clients: [],
        intensityTechniques: ['Drop Sets', 'Rest-Pause Sets'],
      },
    ],
  },
  {
    name: 'Leg Focus',
    description: 'PPL program with extra leg volume — quads, hamstrings, glutes, and calves priority',
    type: 'Hypertrophy',
    icon: 'legs',
    levels: [
      {
        level: 'Beginner',
        duration: '8 weeks',
        phases: 2,
        daysPerWeek: 4,
        split: 'Legs (Quad) / Push / Pull / Legs (Ham & Glutes)',
        clients: [],
      },
      {
        level: 'Intermediate',
        duration: '10 weeks',
        phases: 3,
        daysPerWeek: 5,
        split: 'Legs (Quad) / Push / Pull / Legs (Ham & Glutes) / Upper',
        clients: [],
      },
      {
        level: 'Advanced',
        duration: '12 weeks',
        phases: 4,
        daysPerWeek: 6,
        split: 'Legs (Quad) / Push / Pull / Legs (Ham & Glutes) / Push / Pull',
        clients: [],
        intensityTechniques: ['Drop Sets', 'Rest-Pause Sets'],
      },
    ],
  },
  {
    name: 'Chest & Arms Focus',
    description: 'PPL program with extra chest and arm volume — build a bigger pressing foundation',
    type: 'Hypertrophy',
    icon: 'chest',
    levels: [
      {
        level: 'Beginner',
        duration: '8 weeks',
        phases: 2,
        daysPerWeek: 4,
        split: 'Push (Chest Heavy) / Pull / Legs / Arms',
        clients: [],
      },
      {
        level: 'Intermediate',
        duration: '10 weeks',
        phases: 3,
        daysPerWeek: 5,
        split: 'Push (Chest Heavy) / Pull / Legs / Push (Incline) / Arms',
        clients: [],
      },
      {
        level: 'Advanced',
        duration: '12 weeks',
        phases: 4,
        daysPerWeek: 6,
        split: 'Push (Chest Heavy) / Pull / Legs / Push (Incline) / Arms / Pull',
        clients: [],
        intensityTechniques: ['Drop Sets', 'Rest-Pause Sets'],
      },
    ],
  },
  {
    name: 'Shoulder Focus',
    description: 'PPL program with extra delt volume — build capped shoulders and a wider frame',
    type: 'Hypertrophy',
    icon: 'shoulders',
    levels: [
      {
        level: 'Beginner',
        duration: '8 weeks',
        phases: 2,
        daysPerWeek: 4,
        split: 'Push (Shoulder Heavy) / Pull / Legs / Shoulders & Arms',
        clients: [],
      },
      {
        level: 'Intermediate',
        duration: '10 weeks',
        phases: 3,
        daysPerWeek: 5,
        split: 'Push (Shoulder Heavy) / Pull / Legs / Shoulders / Arms',
        clients: [],
      },
      {
        level: 'Advanced',
        duration: '12 weeks',
        phases: 4,
        daysPerWeek: 6,
        split: 'Push (Shoulder Heavy) / Pull / Legs / Shoulders / Push / Arms',
        clients: [],
        intensityTechniques: ['Drop Sets', 'Rest-Pause Sets'],
      },
    ],
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
    Hypertrophy: 'bg-[#F76B16]/15 text-[#F76B16]',
    'Fat Loss': 'bg-emerald-500/15 text-emerald-400',
    Strength: 'bg-[#1A7BFF]/15 text-[#1A7BFF]',
  }
  return map[type] || 'bg-white/[0.06] text-white/50'
}

function getLevelColor(level: Level) {
  const map: Record<Level, string> = {
    Beginner: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    Intermediate: 'bg-[#F76B16]/15 text-[#F76B16] border-[#F76B16]/20',
    Advanced: 'bg-red-500/15 text-red-400 border-red-500/20',
  }
  return map[level]
}

function getLevelDot(level: Level) {
  const map: Record<Level, string> = {
    Beginner: 'bg-emerald-400',
    Intermediate: 'bg-[#F76B16]',
    Advanced: 'bg-red-400',
  }
  return map[level]
}

type Tab = 'programs' | 'library'

export default function ProgramsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('programs')
  const [expandedProgram, setExpandedProgram] = useState<number | null>(null)
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null)

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

  const totalClients = programs.reduce((sum, p) => sum + p.levels.reduce((s, l) => s + l.clients.length, 0), 0)

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
            {programs.length} programs &middot; {totalClients} active clients
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
        <div className="space-y-6">
          {programs.map((prog, i) => {
            const totalProgramClients = prog.levels.reduce((s, l) => s + l.clients.length, 0)
            const isExpanded = expandedProgram === i

            return (
              <motion.div
                key={prog.name}
                custom={i}
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden"
              >
                {/* Program Header */}
                <button
                  onClick={() => setExpandedProgram(isExpanded ? null : i)}
                  className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors duration-200"
                >
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-12 h-12 rounded-xl bg-[#F76B16]/10 flex items-center justify-center shrink-0">
                      {prog.icon === 'muscle' && (
                        <svg className="w-5 h-5 text-[#F76B16]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                      )}
                      {prog.icon === 'strength' && (
                        <svg className="w-5 h-5 text-[#F76B16]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {prog.icon === 'shred' && (
                        <svg className="w-5 h-5 text-[#F76B16]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18z" />
                        </svg>
                      )}
                      {/* Back icon — rows/lats */}
                      {prog.icon === 'back' && (
                        <svg className="w-5 h-5 text-[#F76B16]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6m-7.5 3V6.75A2.25 2.25 0 0 1 6.75 4.5h10.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25H6.75a2.25 2.25 0 0 1-2.25-2.25Z" />
                        </svg>
                      )}
                      {/* Legs icon */}
                      {prog.icon === 'legs' && (
                        <svg className="w-5 h-5 text-[#F76B16]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-1.5a1.125 1.125 0 0 1-1.125-1.125V17.25m5.25 0h-5.25m5.25 0a3 3 0 0 0 .966-5.839 4.5 4.5 0 0 0-7.716-3.093M8.25 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-1.5a1.125 1.125 0 0 1-1.125-1.125V17.25m5.25 0H3m5.25 0a3 3 0 0 0-.966-5.839 4.5 4.5 0 0 0-3.284-3.093" />
                        </svg>
                      )}
                      {/* Chest icon */}
                      {prog.icon === 'chest' && (
                        <svg className="w-5 h-5 text-[#F76B16]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                        </svg>
                      )}
                      {/* Shoulders icon */}
                      {prog.icon === 'shoulders' && (
                        <svg className="w-5 h-5 text-[#F76B16]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l7.5-7.5 7.5 7.5m-15 6l7.5-7.5 7.5 7.5" />
                        </svg>
                      )}
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
                    <div className="hidden sm:flex items-center gap-3">
                      {prog.levels.map((l) => (
                        <span key={l.level} className={`text-[9px] font-display font-bold px-2 py-0.5 rounded ${getLevelColor(l.level)}`}>
                          {l.level}
                        </span>
                      ))}
                    </div>
                    <div className="hidden sm:block text-right">
                      <p className="text-white/60 text-sm font-display font-bold">{totalProgramClients}</p>
                      <p className="text-white/20 text-[10px] font-body">clients</p>
                    </div>
                    <svg className={`w-4 h-4 text-white/20 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Level Cards */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-0 border-t border-white/[0.04]">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                      {prog.levels.map((lvl) => {
                        const levelKey = `${prog.name}-${lvl.level}`
                        const isLevelExpanded = expandedLevel === levelKey

                        return (
                          <div
                            key={lvl.level}
                            className={`bg-white/[0.03] border rounded-xl overflow-hidden transition-colors duration-200 ${
                              isLevelExpanded ? 'border-white/[0.12]' : 'border-white/[0.06]'
                            }`}
                          >
                            <button
                              onClick={() => setExpandedLevel(isLevelExpanded ? null : levelKey)}
                              className="w-full p-4 text-left hover:bg-white/[0.02] transition-colors duration-200"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${getLevelDot(lvl.level)}`} />
                                  <span className="text-white font-display font-bold text-sm">{lvl.level}</span>
                                </div>
                                <span className={`text-[9px] font-display font-bold px-2 py-0.5 rounded ${getLevelColor(lvl.level)}`}>
                                  {lvl.clients.length} client{lvl.clients.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-white/25 text-[10px] font-display uppercase tracking-wide">Duration</span>
                                  <span className="text-white/60 text-xs font-body">{lvl.duration}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-white/25 text-[10px] font-display uppercase tracking-wide">Phases</span>
                                  <span className="text-white/60 text-xs font-body">{lvl.phases}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-white/25 text-[10px] font-display uppercase tracking-wide">Days/Week</span>
                                  <span className="text-white/60 text-xs font-body">{lvl.daysPerWeek}x</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-white/25 text-[10px] font-display uppercase tracking-wide">Split</span>
                                  <span className="text-white/60 text-xs font-body text-right">{lvl.split}</span>
                                </div>
                                {lvl.intensityTechniques && lvl.intensityTechniques.length > 0 && (
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="text-white/25 text-[10px] font-display uppercase tracking-wide">Techniques</span>
                                    <div className="flex flex-wrap gap-1 justify-end">
                                      {lvl.intensityTechniques.map((t) => (
                                        <span key={t} className="text-[9px] font-display font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </button>

                            {isLevelExpanded && lvl.clients.length > 0 && (
                              <div className="px-4 pb-4 border-t border-white/[0.04]">
                                <p className="text-white/25 text-[10px] font-display uppercase tracking-wide mt-3 mb-2">Assigned Clients</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {lvl.clients.map((c) => (
                                    <span key={c} className="bg-white/[0.04] text-white/50 text-[11px] font-body px-2.5 py-1 rounded-lg">
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )
          })}
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
                  <div className="bg-white/[0.03] px-6 py-8 flex items-center justify-center relative">
                    {selectedExercise.images.length > 0 ? (
                      <div className="relative max-h-[260px] w-full flex items-center justify-center">
                        <img
                          src={selectedExercise.images[0]}
                          alt={`${selectedExercise.name} — start`}
                          className="max-h-[260px] object-contain rounded-lg transition-opacity duration-[1500ms]"
                          style={{ opacity: showEndImage && selectedExercise.images[1] ? 0 : 1 }}
                        />
                        {selectedExercise.images[1] && (
                          <img
                            src={selectedExercise.images[1]}
                            alt={`${selectedExercise.name} — end`}
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
