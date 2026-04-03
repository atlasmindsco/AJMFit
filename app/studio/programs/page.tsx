'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useMemo } from 'react'
import MuscleMap from '@/components/exercises/MuscleMap'

/* ── Types ── */
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

interface ProgramExercise {
  name: string
  sets: number
  reps: string
  rest: string
  series: string
}

type ProgramView = 'preview' | 'workout' | 'exercise'

/* ── Muscle name mapping: ExerciseDB → MuscleMap keys ── */
const MUSCLE_MAP: Record<string, string> = {
  chest: 'pectorals',
  quadriceps: 'quads',
  'lower back': 'spine',
  'middle back': 'upper back',
  shoulders: 'delts',
  neck: 'levator scapulae',
  abdominals: 'abs',
}

function toMuscleMapKey(dbMuscle: string): string {
  return MUSCLE_MAP[dbMuscle.toLowerCase()] || dbMuscle.toLowerCase()
}

/* ── Current Program ── */
const currentProgram = {
  name: 'Muscle Builder',
  level: 'Intermediate',
  phase: 'Phase 2 — Hypertrophy',
  weeks: { current: 5, total: 10 },
  startDate: 'Feb 3, 2026',
  coach: 'Anthony M.',
}

/* ── Weekly Split ── */
const weeklyPlan = [
  {
    day: 'Monday',
    name: 'Chest',
    muscles: 'Chest, Shoulders, Triceps',
    primaryMuscle: 'chest',
    duration: '~55 min',
    completed: true,
    exercises: [
      { name: 'Barbell Bench Press', sets: 4, reps: '8-10', rest: '90s', series: 'A' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', rest: '75s', series: 'B' },
      { name: 'Overhead Press', sets: 3, reps: '8-10', rest: '90s', series: 'C' },
      { name: 'Lateral Raises', sets: 3, reps: '12-15', rest: '60s', series: 'D1' },
      { name: 'Tricep Pushdowns', sets: 3, reps: '12-15', rest: '60s', series: 'D2' },
    ],
  },
  {
    day: 'Tuesday',
    name: 'Legs',
    muscles: 'Quads, Hamstrings, Glutes, Calves',
    primaryMuscle: 'quadriceps',
    duration: '~60 min',
    completed: true,
    exercises: [
      { name: 'Barbell Squat', sets: 4, reps: '6-8', rest: '120s', series: 'A' },
      { name: 'Romanian Deadlift', sets: 3, reps: '8-10', rest: '90s', series: 'B' },
      { name: 'Leg Press', sets: 3, reps: '10-12', rest: '90s', series: 'C' },
      { name: 'Walking Lunges', sets: 3, reps: '12 each', rest: '75s', series: 'D' },
      { name: 'Calf Raises', sets: 4, reps: '15-20', rest: '45s', series: 'E' },
    ],
  },
  {
    day: 'Wednesday',
    name: 'Active Recovery',
    muscles: 'Mobility & Cardio',
    primaryMuscle: '',
    duration: '~40 min',
    completed: true,
    exercises: [
      { name: 'Foam Rolling', sets: 1, reps: '10 min', rest: '--', series: 'A' },
      { name: 'Dynamic Stretching', sets: 1, reps: '10 min', rest: '--', series: 'B' },
      { name: 'Light Cardio (Walk/Bike)', sets: 1, reps: '20-30 min', rest: '--', series: 'C' },
    ],
  },
  {
    day: 'Thursday',
    name: 'Back',
    muscles: 'Back, Biceps, Rear Delts',
    primaryMuscle: 'lats',
    duration: '~55 min',
    completed: false,
    exercises: [
      { name: 'Pull-Ups (Weighted)', sets: 4, reps: '6-8', rest: '90s', series: 'A' },
      { name: 'Barbell Row', sets: 4, reps: '8-10', rest: '90s', series: 'B' },
      { name: 'Seated Cable Row', sets: 3, reps: '10-12', rest: '75s', series: 'C' },
      { name: 'Face Pulls', sets: 3, reps: '15-20', rest: '60s', series: 'D1' },
      { name: 'Barbell Curls', sets: 3, reps: '10-12', rest: '60s', series: 'D2' },
    ],
  },
  {
    day: 'Friday',
    name: 'Shoulders',
    muscles: 'Glutes, Hamstrings, Abs',
    primaryMuscle: 'delts',
    duration: '~50 min',
    completed: false,
    exercises: [
      { name: 'Hip Thrusts', sets: 4, reps: '8-10', rest: '90s', series: 'A' },
      { name: 'Front Squat', sets: 3, reps: '8-10', rest: '90s', series: 'B' },
      { name: 'Leg Curl', sets: 3, reps: '10-12', rest: '75s', series: 'C' },
      { name: 'Cable Woodchops', sets: 3, reps: '12 each', rest: '60s', series: 'D1' },
      { name: 'Plank Hold', sets: 3, reps: '45-60s', rest: '45s', series: 'D2' },
    ],
  },
  {
    day: 'Saturday',
    name: 'Rest Day',
    muscles: 'Recovery',
    primaryMuscle: '',
    duration: '',
    completed: false,
    exercises: [],
  },
  {
    day: 'Sunday',
    name: 'Rest Day',
    muscles: 'Recovery',
    primaryMuscle: '',
    duration: '',
    completed: false,
    exercises: [],
  },
]

/* ── Personal Records (per exercise) ── */
interface PRRecord {
  weight: number     // lbs
  reps: number
  date: string       // when PR was set
  previous?: number  // previous PR weight for comparison
}

const exercisePRs: Record<string, PRRecord> = {
  'Barbell Bench Press':   { weight: 185, reps: 8, date: 'Mar 26', previous: 175 },
  'Incline Dumbbell Press':{ weight: 65,  reps: 10, date: 'Mar 19', previous: 60 },
  'Overhead Press':        { weight: 115, reps: 8, date: 'Mar 12', previous: 110 },
  'Lateral Raises':        { weight: 25,  reps: 14, date: 'Mar 26' },
  'Tricep Pushdowns':      { weight: 60,  reps: 15, date: 'Mar 19' },
  'Barbell Squat':         { weight: 225, reps: 6, date: 'Mar 25', previous: 215 },
  'Romanian Deadlift':     { weight: 185, reps: 10, date: 'Mar 18', previous: 175 },
  'Leg Press':             { weight: 360, reps: 10, date: 'Mar 25', previous: 340 },
  'Walking Lunges':        { weight: 50,  reps: 12, date: 'Mar 11' },
  'Calf Raises':           { weight: 80,  reps: 18, date: 'Mar 25' },
  'Pull-Ups (Weighted)':   { weight: 25,  reps: 8, date: 'Mar 22', previous: 20 },
  'Barbell Row':           { weight: 165, reps: 10, date: 'Mar 22', previous: 155 },
  'Seated Cable Row':      { weight: 140, reps: 12, date: 'Mar 15' },
  'Face Pulls':            { weight: 40,  reps: 18, date: 'Mar 22' },
  'Barbell Curls':         { weight: 75,  reps: 10, date: 'Mar 15', previous: 70 },
  'Hip Thrusts':           { weight: 225, reps: 10, date: 'Mar 8', previous: 205 },
  'Front Squat':           { weight: 155, reps: 8, date: 'Mar 8', previous: 145 },
  'Leg Curl':              { weight: 100, reps: 12, date: 'Mar 1' },
  'Cable Woodchops':       { weight: 35,  reps: 12, date: 'Mar 1' },
}

/* ── Exercise Alternatives (same muscle group substitutions) ── */
const exerciseAlternatives: Record<string, string[]> = {
  'Barbell Bench Press':    ['Dumbbell Bench Press', 'Machine Chest Press', 'Push-Ups'],
  'Incline Dumbbell Press': ['Incline Barbell Press', 'Incline Machine Press', 'Low Cable Fly'],
  'Overhead Press':         ['Dumbbell Shoulder Press', 'Machine Shoulder Press', 'Landmine Press'],
  'Lateral Raises':         ['Cable Lateral Raise', 'Machine Lateral Raise', 'Resistance Band Lateral Raise'],
  'Tricep Pushdowns':       ['Overhead Tricep Extension', 'Dumbbell Kickbacks', 'Close-Grip Push-Ups'],
  'Barbell Squat':          ['Goblet Squat', 'Leg Press', 'Smith Machine Squat'],
  'Romanian Deadlift':      ['Dumbbell Romanian Deadlift', 'Good Mornings', 'Cable Pull-Through'],
  'Leg Press':              ['Hack Squat', 'Bulgarian Split Squat', 'Goblet Squat'],
  'Walking Lunges':         ['Reverse Lunges', 'Step-Ups', 'Split Squat'],
  'Calf Raises':            ['Seated Calf Raise', 'Leg Press Calf Raise', 'Single-Leg Calf Raise'],
  'Pull-Ups (Weighted)':    ['Lat Pulldown', 'Assisted Pull-Up Machine', 'Resistance Band Pull-Ups'],
  'Barbell Row':            ['Dumbbell Row', 'T-Bar Row', 'Cable Row'],
  'Seated Cable Row':       ['Dumbbell Row', 'Machine Row', 'Resistance Band Row'],
  'Face Pulls':             ['Reverse Pec Deck', 'Band Pull-Aparts', 'Rear Delt Fly'],
  'Barbell Curls':          ['Dumbbell Curls', 'Cable Curls', 'Hammer Curls'],
  'Hip Thrusts':            ['Glute Bridge', 'Cable Pull-Through', 'Machine Hip Extension'],
  'Front Squat':            ['Goblet Squat', 'Zercher Squat', 'Leg Press (High Foot)'],
  'Leg Curl':               ['Nordic Curl', 'Dumbbell Leg Curl', 'Stability Ball Curl'],
  'Cable Woodchops':        ['Dumbbell Woodchops', 'Medicine Ball Rotations', 'Pallof Press'],
  'Plank Hold':             ['Dead Bug', 'Ab Wheel Rollout', 'Hollow Body Hold'],
}

/* ── Exercise Log History ── */
const recentLogs = [
  { date: 'Mar 26', workout: 'Chest', topSet: 'Bench Press — 185 lbs x 8', prs: 1 },
  { date: 'Mar 25', workout: 'Legs', topSet: 'Squat — 225 lbs x 6', prs: 0 },
  { date: 'Mar 24', workout: 'Active Recovery', topSet: '30 min walk + stretch', prs: 0 },
  { date: 'Mar 22', workout: 'Back', topSet: 'Pull-Ups — BW+25 x 8', prs: 1 },
]

/* ── Fuzzy name matching ── */
const EXERCISE_ALIASES: Record<string, string> = {
  'lateral raises': 'side lateral raise',
  'lateral raise': 'side lateral raise',
  'tricep pushdowns': 'triceps pushdown',
  'tricep pushdown': 'triceps pushdown',
  'walking lunges': 'bodyweight walking lunge',
  'calf raises': 'standing dumbbell calf raise',
  'pull-ups': 'pullups',
  'pull-ups (weighted)': 'pullups',
  'face pulls': 'face pull',
  'hip thrusts': 'barbell hip thrust',
  'cable woodchops': 'standing cable wood chop',
  'plank hold': 'plank',
  'barbell curls': 'barbell curl',
  'overhead press': 'standing military press',
  'barbell row': 'bent over barbell row',
  'seated cable row': 'seated cable rows',
  'leg curl': 'seated leg curl',
  'front squat': 'front barbell squat',
}

function normalizeExName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

function findExerciseMatch(programName: string, db: ExerciseDB[]): ExerciseDB | null {
  const norm = normalizeExName(programName)
  const exact = db.find((ex) => normalizeExName(ex.name) === norm)
  if (exact) return exact
  const alias = EXERCISE_ALIASES[norm]
  if (alias) {
    const aliasNorm = normalizeExName(alias)
    const aliasMatch = db.find((ex) => normalizeExName(ex.name) === aliasNorm)
    if (aliasMatch) return aliasMatch
    const partialAlias = db.find((ex) => normalizeExName(ex.name).includes(aliasNorm))
    if (partialAlias) return partialAlias
  }
  const containsMatch = db.find((ex) => normalizeExName(ex.name).includes(norm))
  if (containsMatch) return containsMatch
  const reverseMatch = db.find((ex) => norm.includes(normalizeExName(ex.name)))
  if (reverseMatch) return reverseMatch
  const words = norm.split(' ').filter((w) => w.length > 2)
  let bestMatch: ExerciseDB | null = null
  let bestScore = 0
  for (const ex of db) {
    const exNorm = normalizeExName(ex.name)
    const score = words.filter((w) => exNorm.includes(w)).length
    if (score > bestScore && score >= 1) {
      bestScore = score
      bestMatch = ex
    }
  }
  return bestMatch
}

/* ── Group exercises by series ── */
interface SeriesGroup {
  label: string
  isSuperset: boolean
  exercises: { exercise: ProgramExercise; seriesPrefix: string }[]
}

function groupBySeries(exercises: ProgramExercise[]): SeriesGroup[] {
  const groups: SeriesGroup[] = []
  const seen = new Set<string>()

  for (const ex of exercises) {
    const baseLetter = ex.series.replace(/[0-9]/g, '')
    if (seen.has(baseLetter)) continue
    seen.add(baseLetter)

    const members = exercises.filter((e) => e.series.replace(/[0-9]/g, '') === baseLetter)
    const isSuperset = members.length > 1

    groups.push({
      label: isSuperset
        ? members.map((m) => m.series).join('/') + ' SERIES'
        : `${baseLetter} SERIES`,
      isSuperset,
      exercises: members.map((m) => ({ exercise: m, seriesPrefix: m.series })),
    })
  }

  return groups
}

/* ── Animation variants ── */
const slideIn = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, x: -40, transition: { duration: 0.2 } },
}

const slideBack = {
  initial: { opacity: 0, x: -40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, x: 40, transition: { duration: 0.2 } },
}

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] },
  }),
}

export default function ProgramsPage() {
  const [view, setView] = useState<ProgramView>('preview')
  const [previewTab, setPreviewTab] = useState<'overview' | 'program'>('overview')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [exerciseDB, setExerciseDB] = useState<ExerciseDB[]>([])
  const [imagePreview, setImagePreview] = useState<Record<string, boolean>>({})
  const [expandedWorkoutExercise, setExpandedWorkoutExercise] = useState<string | null>(null)
  const [setLogs, setSetLogs] = useState<Record<string, { weight: string; reps: string }[]>>({})
  const [swapMenuOpen, setSwapMenuOpen] = useState<string | null>(null)
  const [swappedExercises, setSwappedExercises] = useState<Record<string, string>>({})

  const selected = selectedDay !== null ? weeklyPlan[selectedDay] : null
  const progressPct = (currentProgram.weeks.current / currentProgram.weeks.total) * 100

  // Load exercise database
  useEffect(() => {
    fetch('/exercises/exercises.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: ExerciseDB[]) => setExerciseDB(data))
      .catch((err) => console.error('[ExerciseDB] Failed to load:', err))
  }, [])

  // Pre-match exercises for the selected day
  const matchedExercises = useMemo(() => {
    const matches = new Map<string, ExerciseDB | null>()
    if (selected) {
      for (const ex of selected.exercises) {
        matches.set(ex.name, findExerciseMatch(ex.name, exerciseDB))
      }
    }
    return matches
  }, [selected, exerciseDB])

  // Get first matched image for day card thumbnails
  const getDayThumbnail = (dayIndex: number) => {
    const day = weeklyPlan[dayIndex]
    if (day.exercises.length === 0) return null
    for (const ex of day.exercises) {
      const match = findExerciseMatch(ex.name, exerciseDB)
      if (match?.images[0]) return match.images[0]
    }
    return null
  }

  // Auto-cycle image for a given exercise name
  useEffect(() => {
    const interval = setInterval(() => {
      setImagePreview((prev) => {
        const next = { ...prev }
        for (const key of Object.keys(next)) {
          next[key] = !next[key]
        }
        return next
      })
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  const selectedExerciseData = selected?.exercises.find((e) => e.name === selectedExercise) ?? null
  const selectedExerciseDB = selectedExercise ? matchedExercises.get(selectedExercise) ?? null : null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* MAIN CONTENT */}
      <div className="lg:col-span-8">
        {/* Program Header */}
        <div className="bg-[#1C1C1C] rounded-xl border border-white/[0.10] p-6 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-extrabold text-xl text-white tracking-tight">
                  {currentProgram.name}
                </h1>
                <span className="text-[10px] font-display font-bold px-2 py-0.5 rounded bg-[#22C55E]/15 text-[#22C55E]">
                  {currentProgram.level}
                </span>
              </div>
              <p className="text-white/40 text-sm font-body mt-1">
                {currentProgram.phase} &middot; Coach: {currentProgram.coach}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white font-display font-bold text-sm">
                Week {currentProgram.weeks.current} / {currentProgram.weeks.total}
              </p>
              <p className="text-white/30 text-xs font-body">Started {currentProgram.startDate}</p>
            </div>
          </div>
          <div className="w-full h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3B82F6] rounded-full transition-[width] duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-white/30 text-xs font-body mt-2">{Math.round(progressPct)}% complete</p>
        </div>

        {/* View Content */}
        <AnimatePresence mode="wait">
          {/* ════════ VIEW 1: PROGRAM PREVIEW ════════ */}
          {view === 'preview' && (
            <motion.div key="preview" {...slideBack}>
              <div className="bg-[#1C1C1C] rounded-xl border border-white/[0.10] overflow-hidden">
                {/* Overview / Program toggle */}
                <div className="flex items-center border-b border-white/[0.10]">
                  <button
                    onClick={() => setPreviewTab('overview')}
                    className={`flex-1 px-5 py-3.5 text-xs font-display font-bold uppercase tracking-wide transition-colors duration-200 ${
                      previewTab === 'overview'
                        ? 'text-white bg-white/[0.04] border-b-2 border-[#3B82F6]'
                        : 'text-white/30 hover:text-white/50'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setPreviewTab('program')}
                    className={`flex-1 px-5 py-3.5 text-xs font-display font-bold uppercase tracking-wide transition-colors duration-200 ${
                      previewTab === 'program'
                        ? 'text-white bg-white/[0.04] border-b-2 border-[#3B82F6]'
                        : 'text-white/30 hover:text-white/50'
                    }`}
                  >
                    Program
                  </button>
                </div>

                {/* ── Overview tab content ── */}
                {previewTab === 'overview' && (
                  <div className="p-5 space-y-5">
                    {/* Quick stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white/[0.06] border border-white/[0.10] rounded-xl p-4 text-center">
                        <p className="text-white font-display font-extrabold text-2xl tracking-tight">
                          {weeklyPlan.filter((d) => d.exercises.length > 0).length}
                        </p>
                        <p className="text-white/30 text-[10px] font-display font-bold uppercase tracking-wide mt-1">Training Days</p>
                      </div>
                      <div className="bg-white/[0.06] border border-white/[0.10] rounded-xl p-4 text-center">
                        <p className="text-white font-display font-extrabold text-2xl tracking-tight">
                          {weeklyPlan.reduce((sum, d) => sum + d.exercises.length, 0)}
                        </p>
                        <p className="text-white/30 text-[10px] font-display font-bold uppercase tracking-wide mt-1">Total Exercises</p>
                      </div>
                      <div className="bg-white/[0.06] border border-white/[0.10] rounded-xl p-4 text-center">
                        <p className="text-[#22C55E] font-display font-extrabold text-2xl tracking-tight">
                          {weeklyPlan.filter((d) => d.completed).length}/{weeklyPlan.filter((d) => d.exercises.length > 0).length}
                        </p>
                        <p className="text-white/30 text-[10px] font-display font-bold uppercase tracking-wide mt-1">Completed</p>
                      </div>
                    </div>

                    {/* Program details */}
                    <div className="space-y-3">
                      <h3 className="text-white/25 text-[10px] font-display font-bold uppercase tracking-[0.15em]">Program Details</h3>
                      {[
                        { label: 'Program', value: currentProgram.name },
                        { label: 'Phase', value: currentProgram.phase },
                        { label: 'Level', value: currentProgram.level },
                        { label: 'Coach', value: currentProgram.coach },
                        { label: 'Started', value: currentProgram.startDate },
                        { label: 'Duration', value: `${currentProgram.weeks.total} weeks` },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-4 py-2.5 border-b border-white/[0.06] last:border-0">
                          <span className="text-white/50 text-sm font-body shrink-0">{item.label}</span>
                          <span className="text-white font-body font-semibold text-sm text-right">{item.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Weekly split summary */}
                    <div className="space-y-2">
                      <h3 className="text-white/25 text-[10px] font-display font-bold uppercase tracking-[0.15em]">Weekly Split</h3>
                      {weeklyPlan.filter((d) => d.exercises.length > 0).map((day) => {
                        const dayIndex = weeklyPlan.indexOf(day)
                        return (
                          <button
                            key={day.day}
                            onClick={() => { setSelectedDay(dayIndex); setView('workout') }}
                            className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] transition-colors duration-200 text-left group"
                          >
                            <span className="text-white/40 text-xs font-body w-10 shrink-0">{day.day.slice(0, 3)}</span>
                            <span className="text-white font-body font-semibold text-sm shrink-0 group-hover:text-[#3B82F6] transition-colors duration-200">{day.name}</span>
                            <span className="text-white/30 text-xs font-body ml-auto text-right">{day.muscles}</span>
                            {day.completed ? (
                              <div className="w-5 h-5 rounded-full bg-[#22C55E] flex items-center justify-center shrink-0">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              </div>
                            ) : (
                              <svg className="w-4 h-4 text-white/20 group-hover:text-white/40 shrink-0 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                              </svg>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* CTA to view program */}
                    <button
                      onClick={() => setPreviewTab('program')}
                      className="w-full py-3.5 bg-[#3B82F6] text-white text-sm font-display font-bold uppercase tracking-[0.12em] rounded-xl hover:bg-[#2563EB] active:scale-[0.98] transition-transform duration-200"
                    >
                      View Program
                    </button>
                  </div>
                )}

                {/* ── Program tab content ── */}
                {previewTab === 'program' && (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-display font-bold text-white text-sm">Program Preview</h2>
                    </div>

                    <div className="space-y-2">
                      {weeklyPlan.map((day, i) => {
                        const isRest = day.exercises.length === 0
                        const thumb = getDayThumbnail(i)

                        return (
                          <motion.button
                            key={day.day}
                            custom={i}
                            variants={fadeIn}
                            initial="hidden"
                            animate="visible"
                            onClick={() => {
                              if (!isRest) {
                                setSelectedDay(i)
                                setView('workout')
                              }
                            }}
                            className={`w-full flex items-center gap-4 p-3 rounded-xl text-left group ${
                              isRest
                                ? 'bg-[#1A1A1A] border border-white/[0.06] cursor-default'
                                : 'bg-[#222] border border-white/[0.10] hover:bg-[#222] hover:border-white/[0.12] cursor-pointer'
                            }`}
                          >
                            {/* Thumbnail or rest icon */}
                            {isRest ? (
                              <div className="w-14 h-14 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                                <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                                </svg>
                              </div>
                            ) : (
                              <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-[#0A0A0A] shrink-0">
                                {thumb ? (
                                  <>
                                    <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors duration-200" />
                                  </>
                                ) : (
                                  <div className="w-full h-full bg-white/[0.04]" />
                                )}
                                {/* Play button overlay */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                                    <svg className="w-3 h-3 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M8 5v14l11-7z" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className={`font-display font-bold text-sm ${isRest ? 'text-white/30' : 'text-white group-hover:text-[#3B82F6]'} transition-colors duration-200`}>
                                {day.name}
                              </p>
                              <p className="text-white/30 text-xs font-body">
                                Day {i + 1}{day.duration ? ` \u2022 ${day.duration}` : ''}
                              </p>
                            </div>

                            {/* Status */}
                            {day.completed ? (
                              <div className="w-7 h-7 rounded-full bg-[#22C55E] flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              </div>
                            ) : !isRest ? (
                              <svg className="w-5 h-5 text-white/20 group-hover:text-white/40 shrink-0 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                              </svg>
                            ) : null}
                          </motion.button>
                        )
                      })}
                    </div>

                    {/* Today's workout CTA */}
                    {(() => {
                      const todayIndex = weeklyPlan.findIndex((d) => !d.completed && d.exercises.length > 0)
                      if (todayIndex === -1) return null
                      return (
                        <button
                          onClick={() => { setSelectedDay(todayIndex); setView('workout') }}
                          className="w-full mt-4 py-3.5 bg-[#3B82F6] text-white text-sm font-display font-bold uppercase tracking-[0.12em] rounded-xl hover:bg-[#2563EB] active:scale-[0.98] transition-transform duration-200"
                        >
                          Continue — {weeklyPlan[todayIndex].name}
                        </button>
                      )
                    })()}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ════════ VIEW 2: WORKOUT OVERVIEW ════════ */}
          {view === 'workout' && selected && (
            <motion.div key="workout" {...slideIn}>
              <div className="bg-[#1C1C1C] rounded-xl border border-white/[0.10] overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/[0.10]">
                  <button
                    onClick={() => { setView('preview'); setSelectedDay(null) }}
                    className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors duration-200 mb-3"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                    <span className="text-xs font-display font-semibold uppercase tracking-wide">Back to Program</span>
                  </button>
                  <h2 className="font-display font-bold text-lg text-white">Workout Overview</h2>
                  <p className="text-white/40 text-xs font-body mt-0.5">{selected.muscles}</p>
                </div>

                {/* Series-grouped exercises */}
                <div className="p-4 space-y-4">
                  {groupBySeries(selected.exercises).map((group) => (
                    <div key={group.label}>
                      {/* Series header */}
                      <div className="flex items-center justify-between mb-2.5">
                        <p className="text-white/25 text-[10px] font-display font-bold uppercase tracking-[0.15em]">
                          {group.label}
                        </p>
                        {group.isSuperset && (
                          <span className="text-[#22C55E] text-[10px] font-display font-bold uppercase tracking-wide">
                            Superset
                          </span>
                        )}
                      </div>

                      {/* Exercises in series */}
                      <div className="space-y-2">
                        {group.exercises.map(({ exercise, seriesPrefix }) => {
                          const swapKey = `${selectedDay}-${exercise.name}`
                          const displayName = swappedExercises[swapKey] ?? exercise.name
                          const isSwapped = displayName !== exercise.name
                          const alternatives = exerciseAlternatives[exercise.name] ?? []
                          const showSwapMenu = swapMenuOpen === exercise.name
                          const dbMatch = matchedExercises.get(exercise.name) ?? null
                          const showEnd = imagePreview[exercise.name] ?? false
                          const isOpen = expandedWorkoutExercise === exercise.name
                          const logKey = `${selectedDay}-${exercise.name}`
                          const currentLogs = setLogs[logKey] ?? Array.from({ length: exercise.sets }, () => ({ weight: '', reps: '' }))
                          const pr = exercisePRs[exercise.name] ?? null
                          // Check if any entered set beats the PR
                          const bestEnteredWeight = Math.max(0, ...currentLogs.map((l) => (l.weight && l.reps ? Number(l.weight) : 0)))
                          const isNewPR = pr ? bestEnteredWeight > pr.weight : bestEnteredWeight > 0

                          return (
                            <div key={exercise.name} className="rounded-xl bg-[#222] border border-white/[0.10] overflow-hidden transition-colors duration-200">
                              {/* Exercise row */}
                              <div className="flex items-center gap-3 p-3">
                                {/* Thumbnail — tap for exercise detail */}
                                <button
                                  onClick={() => {
                                    if (dbMatch) {
                                      setSelectedExercise(exercise.name)
                                      setView('exercise')
                                    }
                                  }}
                                  className="relative w-14 h-14 rounded-lg overflow-hidden bg-[#0A0A0A] shrink-0"
                                >
                                  {dbMatch?.images[0] ? (
                                    <>
                                      <img
                                        src={dbMatch.images[showEnd && dbMatch.images[1] ? 1 : 0]}
                                        alt=""
                                        className="w-full h-full object-cover transition-opacity duration-[1200ms]"
                                        loading="lazy"
                                      />
                                      <div className="absolute inset-0 bg-black/20" />
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                                          <svg className="w-3 h-3 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                          </svg>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <span className="text-white/20 text-xs font-display font-bold">{seriesPrefix}</span>
                                    </div>
                                  )}
                                </button>

                                {/* Info — tap to expand log */}
                                <button
                                  onClick={() => setExpandedWorkoutExercise(isOpen ? null : exercise.name)}
                                  className="flex-1 min-w-0 text-left"
                                >
                                  <div className="flex items-center gap-1.5">
                                    {group.isSuperset && (
                                      <span className="text-[#22C55E] text-[10px] font-display font-bold">{seriesPrefix}</span>
                                    )}
                                    <p className="font-body font-semibold text-white text-sm truncate">{displayName}</p>
                                    {isSwapped && (
                                      <span className="text-[9px] font-display font-bold px-1.5 py-0.5 rounded bg-[#3B82F6]/15 text-[#3B82F6] shrink-0">
                                        Swapped
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-white/35 text-xs font-body">
                                      Reps: {exercise.reps} &middot; {exercise.sets} sets
                                    </p>
                                    {pr && (
                                      <span className="text-[9px] font-display font-bold px-1.5 py-0.5 rounded bg-[#F59E0B]/15 text-[#F59E0B] flex items-center gap-0.5">
                                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M5 3h14l-1.5 5H6.5L5 3Zm1.5 5v2a5.5 5.5 0 0 0 11 0V8h-11ZM12 16a5.5 5.5 0 0 1-5.08-3.39A6.5 6.5 0 0 0 12 15.5a6.5 6.5 0 0 0 5.08-2.89A5.5 5.5 0 0 1 12 16Zm0 2a1 1 0 0 1 1 1v2h-2v-2a1 1 0 0 1 1-1Z" />
                                        </svg>
                                        PR: {pr.weight} lbs
                                      </span>
                                    )}
                                  </div>
                                </button>

                                {/* Right side — expand toggle */}
                                <button
                                  onClick={() => setExpandedWorkoutExercise(isOpen ? null : exercise.name)}
                                  className="text-right shrink-0 flex flex-col items-end"
                                >
                                  <p className="text-[#F08B1E] text-xs font-display font-bold">
                                    {exercise.sets}X / Rest
                                  </p>
                                  <svg className={`w-4 h-4 text-white/20 mt-0.5 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                  </svg>
                                </button>
                              </div>

                              {/* Expandable set logger */}
                              <AnimatePresence>
                                {isOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                    className="overflow-hidden"
                                  >
                                    <div className="px-3 pb-3 pt-1 border-t border-white/[0.06]">
                                      {/* PR banner */}
                                      {pr && (
                                        <div className={`flex items-center justify-between rounded-lg px-3 py-2 mt-2 mb-2 ${isNewPR ? 'bg-[#F59E0B]/15 border border-[#F59E0B]/30' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
                                          <div className="flex items-center gap-2">
                                            <svg className={`w-4 h-4 ${isNewPR ? 'text-[#F59E0B]' : 'text-white/30'}`} viewBox="0 0 24 24" fill="currentColor">
                                              <path d="M5 3h14l-1.5 5H6.5L5 3Zm1.5 5v2a5.5 5.5 0 0 0 11 0V8h-11ZM12 16a5.5 5.5 0 0 1-5.08-3.39A6.5 6.5 0 0 0 12 15.5a6.5 6.5 0 0 0 5.08-2.89A5.5 5.5 0 0 1 12 16Zm0 2a1 1 0 0 1 1 1v2h-2v-2a1 1 0 0 1 1-1Z" />
                                            </svg>
                                            {isNewPR ? (
                                              <span className="text-[#F59E0B] text-[11px] font-display font-bold uppercase tracking-wide">
                                                New PR!
                                              </span>
                                            ) : (
                                              <span className="text-white/40 text-[11px] font-display font-bold uppercase tracking-wide">
                                                Current PR
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-right">
                                            <span className={`text-sm font-display font-bold ${isNewPR ? 'text-[#F59E0B]' : 'text-white/60'}`}>
                                              {isNewPR ? `${bestEnteredWeight} lbs` : `${pr.weight} lbs × ${pr.reps}`}
                                            </span>
                                            <span className="text-white/20 text-[10px] font-body ml-2">{pr.date}</span>
                                          </div>
                                        </div>
                                      )}

                                      {/* Column headers */}
                                      <div className="grid grid-cols-[32px_1fr_1fr_36px] gap-2 mb-2 mt-2">
                                        <span className="text-white/20 text-[10px] font-display font-bold uppercase tracking-wide text-center">Set</span>
                                        <span className="text-white/20 text-[10px] font-display font-bold uppercase tracking-wide">Weight (lbs)</span>
                                        <span className="text-white/20 text-[10px] font-display font-bold uppercase tracking-wide">Reps</span>
                                        <span />
                                      </div>

                                      {/* Set rows */}
                                      {currentLogs.map((log, si) => {
                                        const filled = log.weight !== '' && log.reps !== ''
                                        const setWeight = Number(log.weight) || 0
                                        const setBeatsPR = filled && pr ? setWeight > pr.weight : filled && setWeight > 0
                                        return (
                                          <div key={si} className={`grid grid-cols-[32px_1fr_1fr_36px] gap-2 mb-1.5 items-center rounded-lg px-1 py-0.5 ${setBeatsPR ? 'bg-[#F59E0B]/[0.06]' : ''}`}>
                                            <span className={`text-xs font-display font-bold text-center ${setBeatsPR ? 'text-[#F59E0B]' : 'text-white/30'}`}>{si + 1}</span>
                                            <input
                                              type="number"
                                              inputMode="numeric"
                                              placeholder="—"
                                              value={log.weight}
                                              onChange={(e) => {
                                                const updated = [...currentLogs]
                                                updated[si] = { ...updated[si], weight: e.target.value }
                                                setSetLogs((prev) => ({ ...prev, [logKey]: updated }))
                                              }}
                                              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-sm font-body text-center placeholder:text-white/15 focus:outline-none focus:border-[#3B82F6]/50 transition-colors duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <input
                                              type="number"
                                              inputMode="numeric"
                                              placeholder="—"
                                              value={log.reps}
                                              onChange={(e) => {
                                                const updated = [...currentLogs]
                                                updated[si] = { ...updated[si], reps: e.target.value }
                                                setSetLogs((prev) => ({ ...prev, [logKey]: updated }))
                                              }}
                                              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-sm font-body text-center placeholder:text-white/15 focus:outline-none focus:border-[#3B82F6]/50 transition-colors duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <div className="flex items-center justify-center">
                                              {setBeatsPR ? (
                                                <div className="w-6 h-6 rounded-full bg-[#F59E0B]/20 flex items-center justify-center">
                                                  <svg className="w-3.5 h-3.5 text-[#F59E0B]" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M5 3h14l-1.5 5H6.5L5 3Zm1.5 5v2a5.5 5.5 0 0 0 11 0V8h-11ZM12 16a5.5 5.5 0 0 1-5.08-3.39A6.5 6.5 0 0 0 12 15.5a6.5 6.5 0 0 0 5.08-2.89A5.5 5.5 0 0 1 12 16Zm0 2a1 1 0 0 1 1 1v2h-2v-2a1 1 0 0 1 1-1Z" />
                                                  </svg>
                                                </div>
                                              ) : filled ? (
                                                <div className="w-6 h-6 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
                                                  <svg className="w-3.5 h-3.5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                                  </svg>
                                                </div>
                                              ) : (
                                                <div className="w-6 h-6 rounded-full bg-white/[0.04] border border-white/[0.08]" />
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}

                                      {/* Target reminder */}
                                      <p className="text-white/20 text-[10px] font-body mt-2 text-center">
                                        Target: {exercise.reps} reps &middot; Rest: {exercise.rest}
                                      </p>

                                      {/* Swap exercise button */}
                                      {alternatives.length > 0 && (
                                        <div className="mt-3 relative">
                                          <button
                                            onClick={() => setSwapMenuOpen(showSwapMenu ? null : exercise.name)}
                                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.10] transition-colors duration-200"
                                          >
                                            <svg className="w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                            </svg>
                                            <span className="text-white/40 text-[10px] font-display font-bold uppercase tracking-wide">
                                              {isSwapped ? 'Change Substitute' : 'Swap Exercise'}
                                            </span>
                                          </button>

                                          {/* Swap dropdown */}
                                          <AnimatePresence>
                                            {showSwapMenu && (
                                              <motion.div
                                                initial={{ opacity: 0, y: -4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -4 }}
                                                transition={{ duration: 0.15 }}
                                                className="absolute bottom-full left-0 right-0 mb-1 bg-[#1A1A1A] border border-white/[0.10] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden z-20"
                                              >
                                                <div className="px-3 py-2 border-b border-white/[0.06]">
                                                  <p className="text-white/25 text-[9px] font-display font-bold uppercase tracking-[0.15em]">
                                                    Equipment not available? Pick a substitute:
                                                  </p>
                                                </div>
                                                {alternatives.map((alt) => (
                                                  <button
                                                    key={alt}
                                                    onClick={() => {
                                                      setSwappedExercises((prev) => ({ ...prev, [swapKey]: alt }))
                                                      setSwapMenuOpen(null)
                                                    }}
                                                    className={`w-full px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors duration-150 flex items-center justify-between ${
                                                      displayName === alt ? 'bg-white/[0.04]' : ''
                                                    }`}
                                                  >
                                                    <span className="text-white/70 text-sm font-body">{alt}</span>
                                                    {displayName === alt && (
                                                      <svg className="w-4 h-4 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                                      </svg>
                                                    )}
                                                  </button>
                                                ))}
                                                {isSwapped && (
                                                  <button
                                                    onClick={() => {
                                                      setSwappedExercises((prev) => {
                                                        const next = { ...prev }
                                                        delete next[swapKey]
                                                        return next
                                                      })
                                                      setSwapMenuOpen(null)
                                                    }}
                                                    className="w-full px-3 py-2.5 text-left border-t border-white/[0.06] hover:bg-white/[0.04] transition-colors duration-150"
                                                  >
                                                    <span className="text-[#F08B1E] text-sm font-body font-semibold">Reset to Original</span>
                                                  </button>
                                                )}
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Start Workout button */}
                <div className="p-4 pt-0">
                  <button className="w-full py-4 bg-[#3B82F6] text-white text-sm font-display font-bold uppercase tracking-[0.12em] rounded-xl hover:bg-[#2563EB] active:scale-[0.98] transition-transform duration-200">
                    Start Workout
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════ VIEW 3: EXERCISE DETAIL ════════ */}
          {view === 'exercise' && selectedExerciseData && (
            <motion.div key="exercise" {...slideIn}>
              <div className="bg-[#1C1C1C] rounded-xl border border-white/[0.10] overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/[0.10]">
                  <button
                    onClick={() => { setView('workout'); setSelectedExercise(null) }}
                    className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors duration-200 mb-3"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                    <span className="text-xs font-display font-semibold uppercase tracking-wide">Back to Workout</span>
                  </button>
                  <h2 className="font-display font-extrabold text-xl text-white tracking-tight">
                    {selectedExerciseData.name}
                  </h2>

                  {/* Muscle tags */}
                  {selectedExerciseDB && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {selectedExerciseDB.primaryMuscles.map((m) => (
                        <span key={m} className="px-2.5 py-1 rounded-md bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-display font-bold uppercase tracking-wide capitalize">
                          {m}
                        </span>
                      ))}
                      {selectedExerciseDB.secondaryMuscles.map((m) => (
                        <span key={m} className="px-2.5 py-1 rounded-md bg-white/[0.06] text-white/50 text-[10px] font-display font-bold uppercase tracking-wide capitalize">
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-5 space-y-6">
                  {/* Exercise image */}
                  {selectedExerciseDB?.images[0] && (
                    <ExerciseImageCycler images={selectedExerciseDB.images} name={selectedExerciseDB.name} />
                  )}

                  {/* Setup section */}
                  {selectedExerciseDB && (
                    <div>
                      <h3 className="text-white/25 text-[10px] font-display font-bold uppercase tracking-[0.15em] mb-3">Setup</h3>
                      <div className="grid grid-cols-3 gap-3">
                        <SetupCard icon="equipment" label="Equipment" value={selectedExerciseDB.equipment} />
                        <SetupCard icon="level" label="Level" value={selectedExerciseDB.level} />
                        <SetupCard icon="category" label="Type" value={selectedExerciseDB.category} />
                      </div>
                    </div>
                  )}

                  {/* Target muscles with MuscleMap */}
                  {selectedExerciseDB && (
                    <div>
                      <h3 className="text-white/25 text-[10px] font-display font-bold uppercase tracking-[0.15em] mb-3">Target</h3>
                      <div className="flex flex-col sm:flex-row gap-4 items-start">
                        <div className="w-full sm:w-48 shrink-0">
                          <MuscleMap
                            target={toMuscleMapKey(selectedExerciseDB.primaryMuscles[0] || '')}
                            secondaryMuscles={selectedExerciseDB.secondaryMuscles.map(toMuscleMapKey)}
                            size="sm"
                            theme="dark"
                          />
                        </div>
                        <div className="flex-1 space-y-3">
                          {selectedExerciseDB.primaryMuscles.map((m) => (
                            <div key={m} className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-[#22C55E]/10 flex items-center justify-center shrink-0">
                                <div className="w-4 h-4 rounded-sm bg-[#22C55E]" />
                              </div>
                              <div>
                                <p className="text-white font-body font-semibold text-sm capitalize">{m}</p>
                                <p className="text-[#22C55E] text-[10px] font-display font-bold uppercase tracking-wide">Primary</p>
                              </div>
                            </div>
                          ))}
                          {selectedExerciseDB.secondaryMuscles.map((m) => (
                            <div key={m} className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-[#EAB308]/10 flex items-center justify-center shrink-0">
                                <div className="w-4 h-4 rounded-sm bg-[#EAB308]/60" />
                              </div>
                              <div>
                                <p className="text-white/70 font-body font-semibold text-sm capitalize">{m}</p>
                                <p className="text-white/30 text-[10px] font-display font-bold uppercase tracking-wide">Secondary</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Instructions */}
                  {selectedExerciseDB && selectedExerciseDB.instructions.length > 0 && (
                    <div>
                      <h3 className="text-white/25 text-[10px] font-display font-bold uppercase tracking-[0.15em] mb-3">Instructions</h3>
                      <ol className="space-y-3">
                        {selectedExerciseDB.instructions.map((step, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-[#22C55E]/10 text-[#22C55E] flex items-center justify-center text-[10px] font-display font-bold mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-white/60 text-sm font-body leading-relaxed">{step}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SIDEBAR */}
      <div className="lg:col-span-4 space-y-4">
        {/* Recent Workout Logs */}
        <motion.div custom={0} variants={fadeIn} initial="hidden" animate="visible" className="bg-[#1C1C1C] rounded-xl border border-white/[0.10]">
          <div className="px-5 py-4 border-b border-white/[0.10]">
            <h2 className="font-display font-bold text-sm text-white">Recent Logs</h2>
          </div>
          <div className="p-5 space-y-3">
            {recentLogs.map((log) => (
              <div key={log.date} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.10] flex items-center justify-center shrink-0">
                  <span className="text-white/40 text-[10px] font-display font-bold">{log.date}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-body font-semibold text-white text-sm">{log.workout}</p>
                  <p className="text-white/40 text-xs font-body truncate">{log.topSet}</p>
                  {log.prs > 0 && (
                    <span className="inline-block mt-1 text-[10px] font-display font-bold text-[#F08B1E] bg-[#F08B1E]/10 px-2 py-0.5 rounded">
                      {log.prs} PR
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Coach Notes */}
        <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="bg-[#1C1C1C] rounded-xl border border-white/[0.10]">
          <div className="px-5 py-4 border-b border-white/[0.10]">
            <h2 className="font-display font-bold text-sm text-white">Coach Notes</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="p-3 rounded-lg bg-white/[0.06] border border-white/[0.10]">
              <p className="text-white/70 text-sm font-body leading-relaxed">
                &ldquo;Great progress on bench — you&apos;re ready to push to 190 next week. Keep rest times strict on accessories.&rdquo;
              </p>
              <p className="text-white/30 text-xs font-body mt-2">— Anthony, Mar 26</p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.06] border border-white/[0.10]">
              <p className="text-white/70 text-sm font-body leading-relaxed">
                &ldquo;Focus on mind-muscle connection during pull-ups. Slow the eccentric to 3 seconds.&rdquo;
              </p>
              <p className="text-white/30 text-xs font-body mt-2">— Anthony, Mar 22</p>
            </div>
          </div>
        </motion.div>

        {/* Past Programs */}
        <motion.div custom={2} variants={fadeIn} initial="hidden" animate="visible" className="bg-[#1C1C1C] rounded-xl border border-white/[0.10]">
          <div className="px-5 py-4 border-b border-white/[0.10]">
            <h2 className="font-display font-bold text-sm text-white">Past Programs</h2>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body font-semibold text-white text-sm">Fat Loss Kickstart</p>
                <p className="text-white/40 text-xs font-body">8 weeks &middot; Completed</p>
              </div>
              <span className="text-emerald-400 text-xs font-display font-bold">100%</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body font-semibold text-white text-sm">Strength Foundations</p>
                <p className="text-white/40 text-xs font-body">6 weeks &middot; Completed</p>
              </div>
              <span className="text-emerald-400 text-xs font-display font-bold">100%</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function ExerciseImageCycler({ images, name }: { images: string[]; name: string }) {
  const [showEnd, setShowEnd] = useState(false)

  useEffect(() => {
    if (!images[1]) return
    const interval = setInterval(() => setShowEnd((p) => !p), 2500)
    return () => clearInterval(interval)
  }, [images])

  return (
    <div className="relative w-full h-56 rounded-xl overflow-hidden bg-[#0A0A0A] border border-white/[0.10]">
      <img
        src={images[0]}
        alt={`${name} — start`}
        className="absolute inset-0 w-full h-full object-contain p-2 transition-opacity duration-[1500ms]"
        style={{ opacity: showEnd && images[1] ? 0 : 1 }}
      />
      {images[1] && (
        <img
          src={images[1]}
          alt={`${name} — end`}
          className="absolute inset-0 w-full h-full object-contain p-2 transition-opacity duration-[1500ms]"
          style={{ opacity: showEnd ? 1 : 0 }}
        />
      )}
      <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 rounded-md text-[9px] font-display font-semibold text-white/70 uppercase tracking-wide backdrop-blur-sm">
        {showEnd && images[1] ? 'End' : 'Start'}
      </div>
    </div>
  )
}

function SetupCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/[0.06] border border-white/[0.10]">
      <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
        {icon === 'equipment' && (
          <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
          </svg>
        )}
        {icon === 'level' && (
          <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
        )}
        {icon === 'category' && (
          <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
          </svg>
        )}
      </div>
      <div className="text-center">
        <p className="text-white/25 text-[9px] font-display font-bold uppercase tracking-wide">{label}</p>
        <p className="text-white text-xs font-body font-semibold capitalize mt-0.5">{value}</p>
      </div>
    </div>
  )
}
