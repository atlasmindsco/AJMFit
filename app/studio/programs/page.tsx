'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useMemo } from 'react'

/* ── Animation ── */
const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] },
  }),
}

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
}

/* ── Current Program ── */
const currentProgram = {
  name: 'Lean Muscle Builder',
  phase: 'Phase 2 — Hypertrophy',
  weeks: { current: 5, total: 12 },
  startDate: 'Feb 3, 2026',
  coach: 'Anthony M.',
}

/* ── Weekly Split ── */
const weeklyPlan = [
  {
    day: 'Monday',
    name: 'Upper Body Push',
    muscles: 'Chest, Shoulders, Triceps',
    exercises: [
      { name: 'Barbell Bench Press', sets: 4, reps: '8-10', rest: '90s' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', rest: '75s' },
      { name: 'Overhead Press', sets: 3, reps: '8-10', rest: '90s' },
      { name: 'Lateral Raises', sets: 3, reps: '12-15', rest: '60s' },
      { name: 'Tricep Pushdowns', sets: 3, reps: '12-15', rest: '60s' },
    ],
  },
  {
    day: 'Tuesday',
    name: 'Lower Body',
    muscles: 'Quads, Hamstrings, Glutes, Calves',
    exercises: [
      { name: 'Barbell Squat', sets: 4, reps: '6-8', rest: '120s' },
      { name: 'Romanian Deadlift', sets: 3, reps: '8-10', rest: '90s' },
      { name: 'Leg Press', sets: 3, reps: '10-12', rest: '90s' },
      { name: 'Walking Lunges', sets: 3, reps: '12 each', rest: '75s' },
      { name: 'Calf Raises', sets: 4, reps: '15-20', rest: '45s' },
    ],
  },
  {
    day: 'Wednesday',
    name: 'Active Recovery',
    muscles: 'Mobility & Cardio',
    exercises: [
      { name: 'Foam Rolling', sets: 1, reps: '10 min', rest: '--' },
      { name: 'Dynamic Stretching', sets: 1, reps: '10 min', rest: '--' },
      { name: 'Light Cardio (Walk/Bike)', sets: 1, reps: '20-30 min', rest: '--' },
    ],
  },
  {
    day: 'Thursday',
    name: 'Upper Body Pull',
    muscles: 'Back, Biceps, Rear Delts',
    exercises: [
      { name: 'Pull-Ups (Weighted)', sets: 4, reps: '6-8', rest: '90s' },
      { name: 'Barbell Row', sets: 4, reps: '8-10', rest: '90s' },
      { name: 'Seated Cable Row', sets: 3, reps: '10-12', rest: '75s' },
      { name: 'Face Pulls', sets: 3, reps: '15-20', rest: '60s' },
      { name: 'Barbell Curls', sets: 3, reps: '10-12', rest: '60s' },
    ],
  },
  {
    day: 'Friday',
    name: 'Legs & Core',
    muscles: 'Glutes, Hamstrings, Abs',
    exercises: [
      { name: 'Hip Thrusts', sets: 4, reps: '8-10', rest: '90s' },
      { name: 'Front Squat', sets: 3, reps: '8-10', rest: '90s' },
      { name: 'Leg Curl', sets: 3, reps: '10-12', rest: '75s' },
      { name: 'Cable Woodchops', sets: 3, reps: '12 each', rest: '60s' },
      { name: 'Plank Hold', sets: 3, reps: '45-60s', rest: '45s' },
    ],
  },
  {
    day: 'Saturday',
    name: 'Rest Day',
    muscles: 'Recovery',
    exercises: [],
  },
  {
    day: 'Sunday',
    name: 'Rest Day',
    muscles: 'Recovery',
    exercises: [],
  },
]

/* ── Exercise Log History ── */
const recentLogs = [
  { date: 'Mar 26', workout: 'Upper Body Push', topSet: 'Bench Press — 185 lbs x 8', prs: 1 },
  { date: 'Mar 25', workout: 'Lower Body', topSet: 'Squat — 225 lbs x 6', prs: 0 },
  { date: 'Mar 24', workout: 'Active Recovery', topSet: '30 min walk + stretch', prs: 0 },
  { date: 'Mar 22', workout: 'Upper Body Pull', topSet: 'Pull-Ups — BW+25 x 8', prs: 1 },
]

/* ── Fuzzy name matching ── */

// Common aliases: program name → database name
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
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function findExerciseMatch(programName: string, db: ExerciseDB[]): ExerciseDB | null {
  const norm = normalizeExName(programName)

  // 1. Exact match
  const exact = db.find((ex) => normalizeExName(ex.name) === norm)
  if (exact) return exact

  // 2. Alias lookup
  const alias = EXERCISE_ALIASES[norm]
  if (alias) {
    const aliasNorm = normalizeExName(alias)
    const aliasMatch = db.find((ex) => normalizeExName(ex.name) === aliasNorm)
    if (aliasMatch) return aliasMatch
    // Try partial alias match
    const partialAlias = db.find((ex) => normalizeExName(ex.name).includes(aliasNorm))
    if (partialAlias) return partialAlias
  }

  // 3. DB name contains program name (e.g. "Bench Press" matches "Barbell Bench Press - Medium Grip")
  const containsMatch = db.find((ex) => normalizeExName(ex.name).includes(norm))
  if (containsMatch) return containsMatch

  // 4. Program name contains DB name
  const reverseMatch = db.find((ex) => norm.includes(normalizeExName(ex.name)))
  if (reverseMatch) return reverseMatch

  // 5. Scored word overlap — at least 1 significant word must match
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

/* ── Exercise Detail Panel ── */
function ExerciseDetail({ exercise, dbMatch }: { exercise: ProgramExercise; dbMatch: ExerciseDB | null }) {
  const [showEnd, setShowEnd] = useState(false)

  // Auto-cycle between start and end images
  useEffect(() => {
    if (!dbMatch?.images[1]) return
    const interval = setInterval(() => setShowEnd((p) => !p), 2500)
    return () => clearInterval(interval)
  }, [dbMatch])

  if (!dbMatch) {
    return (
      <div className="px-4 py-3 bg-[#F4F6F9] border-t border-[#1B2D50]/[0.04]">
        <p className="text-[#64748B] text-xs font-body">No exercise details available.</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <div className="px-4 py-4 bg-[#F4F6F9] border-t border-[#1B2D50]/[0.04]">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Images — auto-cycles between start/end every 1.8s */}
          {dbMatch.images.length > 0 && (
            <div
              className="relative w-full sm:w-48 h-40 rounded-lg overflow-hidden bg-white border border-[#1B2D50]/[0.06] shrink-0"
            >
              <img
                src={dbMatch.images[0]}
                alt={`${dbMatch.name} — start`}
                className="absolute inset-0 w-full h-full object-contain p-1 transition-opacity duration-[1500ms]"
                style={{ opacity: showEnd && dbMatch.images[1] ? 0 : 1 }}
              />
              {dbMatch.images[1] && (
                <img
                  src={dbMatch.images[1]}
                  alt={`${dbMatch.name} — end`}
                  className="absolute inset-0 w-full h-full object-contain p-1 transition-opacity duration-[1500ms]"
                  style={{ opacity: showEnd ? 1 : 0 }}
                />
              )}
              <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-[#1B2D50]/60 rounded text-[8px] font-display font-semibold text-white/80 uppercase tracking-wide">
                {showEnd && dbMatch.images[1] ? 'End' : 'Start'}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              <span className="px-1.5 py-0.5 bg-[#F08B1E]/10 text-[#F08B1E] font-display font-semibold text-[9px] uppercase tracking-wide rounded">
                {dbMatch.level}
              </span>
              <span className="px-1.5 py-0.5 bg-[#2E6AB0]/10 text-[#2E6AB0] font-display font-semibold text-[9px] uppercase tracking-wide rounded">
                {dbMatch.category}
              </span>
              <span className="px-1.5 py-0.5 bg-[#1B2D50]/[0.05] text-[#1B2D50]/50 font-display font-semibold text-[9px] uppercase tracking-wide rounded">
                {dbMatch.equipment}
              </span>
            </div>

            <div className="flex gap-4">
              <div>
                <p className="text-[9px] font-display font-semibold uppercase tracking-wide text-[#1B2D50]/30">Primary</p>
                <p className="text-xs font-body text-[#F08B1E] font-semibold capitalize">{dbMatch.primaryMuscles.join(', ')}</p>
              </div>
              {dbMatch.secondaryMuscles.length > 0 && (
                <div>
                  <p className="text-[9px] font-display font-semibold uppercase tracking-wide text-[#1B2D50]/30">Secondary</p>
                  <p className="text-xs font-body text-[#1B2D50]/50 capitalize">{dbMatch.secondaryMuscles.join(', ')}</p>
                </div>
              )}
            </div>

            {dbMatch.instructions.length > 0 && (
              <div>
                <p className="text-[9px] font-display font-semibold uppercase tracking-wide text-[#1B2D50]/30 mb-1">How to perform</p>
                <ol className="space-y-1">
                  {dbMatch.instructions.slice(0, 3).map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 w-4 h-4 rounded-full bg-[#F08B1E]/10 text-[#F08B1E] flex items-center justify-center text-[8px] font-display font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-[11px] font-body text-[#1B2D50]/60 leading-relaxed">{step}</p>
                    </li>
                  ))}
                  {dbMatch.instructions.length > 3 && (
                    <li className="text-[10px] font-body text-[#1B2D50]/30 pl-6">
                      +{dbMatch.instructions.length - 3} more steps
                    </li>
                  )}
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function ProgramsPage() {
  const [selectedDay, setSelectedDay] = useState(0)
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)
  const [exerciseDB, setExerciseDB] = useState<ExerciseDB[]>([])

  const selected = weeklyPlan[selectedDay]
  const progressPct = (currentProgram.weeks.current / currentProgram.weeks.total) * 100

  // Load exercise database
  useEffect(() => {
    fetch('/exercises/exercises.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: ExerciseDB[]) => {
        console.log('[ExerciseDB] Loaded', data.length, 'exercises')
        setExerciseDB(data)
      })
      .catch((err) => console.error('[ExerciseDB] Failed to load:', err))
  }, [])

  // Pre-match exercises for the selected day
  const matchedExercises = useMemo(() => {
    const matches = new Map<string, ExerciseDB | null>()
    for (const ex of selected.exercises) {
      matches.set(ex.name, findExerciseMatch(ex.name, exerciseDB))
    }
    return matches
  }, [selected, exerciseDB])

  return (
    <div>
      {/* Program Overview Card */}
      <motion.div
        custom={0}
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        className="bg-white rounded-xl border border-[#1B2D50]/[0.06] p-6 mb-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="font-display font-extrabold text-xl text-[#1B2D50] tracking-tight">
              {currentProgram.name}
            </h1>
            <p className="text-[#64748B] text-sm font-body mt-1">
              {currentProgram.phase} &middot; Coach: {currentProgram.coach}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[#1B2D50] font-display font-bold text-sm">
              Week {currentProgram.weeks.current} / {currentProgram.weeks.total}
            </p>
            <p className="text-[#64748B] text-xs font-body">Started {currentProgram.startDate}</p>
          </div>
        </div>
        <div className="w-full h-3 bg-[#E5E7EB] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#2E6AB0] rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-[#64748B] text-xs font-body mt-2">{Math.round(progressPct)}% complete</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: Weekly Split */}
        <div className="lg:col-span-8 space-y-4">
          <motion.div
            custom={1}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-xl border border-[#1B2D50]/[0.06]"
          >
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06]">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Weekly Split</h2>
            </div>

            {/* Day tabs */}
            <div className="flex overflow-x-auto border-b border-[#1B2D50]/[0.06]">
              {weeklyPlan.map((day, i) => (
                <button
                  key={day.day}
                  onClick={() => {
                    setSelectedDay(i)
                    setExpandedExercise(null)
                  }}
                  className={`px-4 py-3 text-xs font-display font-bold uppercase tracking-wide whitespace-nowrap transition-all duration-200 border-b-2 ${
                    i === selectedDay
                      ? 'text-[#2E6AB0] border-[#2E6AB0]'
                      : 'text-[#64748B] border-transparent hover:text-[#1B2D50]'
                  }`}
                >
                  {day.day.slice(0, 3)}
                </button>
              ))}
            </div>

            {/* Selected day content */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display font-bold text-[#1B2D50]">{selected.name}</h3>
                  <p className="text-[#64748B] text-xs font-body">{selected.muscles}</p>
                </div>
                {selected.exercises.length > 0 && (
                  <span className="bg-[#2E6AB0]/10 text-[#2E6AB0] text-xs font-display font-bold px-3 py-1 rounded-lg">
                    {selected.exercises.length} exercises
                  </span>
                )}
              </div>

              {selected.exercises.length > 0 ? (
                <div className="space-y-2">
                  {selected.exercises.map((ex, i) => {
                    const isExpanded = expandedExercise === ex.name
                    const dbMatch = matchedExercises.get(ex.name) ?? null
                    const hasMatch = dbMatch !== null

                    return (
                      <div
                        key={i}
                        className={`rounded-lg border transition-all duration-200 group ${
                          isExpanded
                            ? 'border-[#2E6AB0]/20 shadow-[0_2px_12px_rgba(27,45,80,0.06)]'
                            : hasMatch
                              ? 'border-[#1B2D50]/[0.04] hover:border-[#2E6AB0]/15'
                              : 'border-[#1B2D50]/[0.04]'
                        }`}
                      >
                        <button
                          onClick={() => hasMatch && setExpandedExercise(isExpanded ? null : ex.name)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-150 ${
                            isExpanded
                              ? 'bg-[#EEF1F6]'
                              : hasMatch
                                ? 'bg-[#FAFBFD] hover:bg-[#F0F3F8] cursor-pointer'
                                : 'bg-[#FAFBFD]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Thumbnail from DB if matched */}
                            {hasMatch && dbMatch!.images[0] ? (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 border border-[#1B2D50]/[0.06] overflow-hidden shrink-0">
                                <img
                                  src={dbMatch!.images[0]}
                                  alt={ex.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-[#2E6AB0]/10 flex items-center justify-center shrink-0">
                                <span className="text-[#2E6AB0] text-xs font-display font-bold">{i + 1}</span>
                              </div>
                            )}
                            <div className="text-left">
                              <div className="flex items-center gap-1.5">
                                <p className={`font-body font-semibold text-sm ${hasMatch ? 'text-[#1B2D50] group-hover:text-[#2E6AB0]' : 'text-[#1B2D50]'}`}>{ex.name}</p>
                                {hasMatch && (
                                  <svg
                                    className={`w-3.5 h-3.5 text-[#2E6AB0]/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                  </svg>
                                )}
                              </div>
                              <p className="text-[#64748B] text-xs font-body">
                                {ex.sets} sets &times; {ex.reps}
                              </p>
                            </div>
                          </div>
                          <span className="text-[#64748B] text-xs font-body">Rest: {ex.rest}</span>
                        </button>

                        <AnimatePresence>
                          {isExpanded && <ExerciseDetail exercise={ex} dbMatch={dbMatch} />}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-10">
                  <span className="text-4xl mb-3 block">😴</span>
                  <p className="text-[#64748B] text-sm font-body">Rest day — recover and recharge</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* RIGHT: Log History + Coach Notes */}
        <div className="lg:col-span-4 space-y-4">
          {/* Recent Workout Logs */}
          <motion.div
            custom={2}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-xl border border-[#1B2D50]/[0.06]"
          >
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06]">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Recent Logs</h2>
            </div>
            <div className="p-5 space-y-3">
              {recentLogs.map((log) => (
                <div key={log.date} className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#FAFBFD] border border-[#1B2D50]/[0.06] flex items-center justify-center shrink-0">
                    <span className="text-[#64748B] text-[10px] font-display font-bold">{log.date}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-body font-semibold text-[#1B2D50] text-sm">{log.workout}</p>
                    <p className="text-[#64748B] text-xs font-body truncate">{log.topSet}</p>
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
          <motion.div
            custom={3}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-xl border border-[#1B2D50]/[0.06]"
          >
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06]">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Coach Notes</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-[#2E6AB0]/[0.04] border border-[#2E6AB0]/10">
                <p className="text-[#1B2D50] text-sm font-body leading-relaxed">
                  &ldquo;Great progress on bench — you&apos;re ready to push to 190 next week. Keep rest times strict on accessories.&rdquo;
                </p>
                <p className="text-[#64748B] text-xs font-body mt-2">— Anthony, Mar 26</p>
              </div>
              <div className="p-3 rounded-lg bg-[#F08B1E]/[0.04] border border-[#F08B1E]/10">
                <p className="text-[#1B2D50] text-sm font-body leading-relaxed">
                  &ldquo;Focus on mind-muscle connection during pull-ups. Slow the eccentric to 3 seconds.&rdquo;
                </p>
                <p className="text-[#64748B] text-xs font-body mt-2">— Anthony, Mar 22</p>
              </div>
            </div>
          </motion.div>

          {/* Program History */}
          <motion.div
            custom={4}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-xl border border-[#1B2D50]/[0.06]"
          >
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06]">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Past Programs</h2>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-body font-semibold text-[#1B2D50] text-sm">Fat Loss Kickstart</p>
                  <p className="text-[#64748B] text-xs font-body">8 weeks &middot; Completed</p>
                </div>
                <span className="text-emerald-500 text-xs font-display font-bold">100%</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-body font-semibold text-[#1B2D50] text-sm">Strength Foundations</p>
                  <p className="text-[#64748B] text-xs font-body">6 weeks &middot; Completed</p>
                </div>
                <span className="text-emerald-500 text-xs font-display font-bold">100%</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
