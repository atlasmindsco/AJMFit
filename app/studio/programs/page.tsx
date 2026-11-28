'use client'

import Link from 'next/link'
import TravelSwitch from '@/components/studio/TravelSwitch'
import { useSessionChrome } from '@/components/studio/SessionChrome'
import { pickDay } from '@/lib/active-workout'
import Image from 'next/image'
import { sessionTotals, prHeadline, recordDetail, encouragement } from '@/lib/session-summary'
import { durationLabel } from '@/lib/coach-training'
import ShareSheet from '@/components/studio/ShareSheet'
import { filterLibrary, MUSCLE_GROUPS, EQUIPMENT_FILTERS } from '@/lib/builder-rules'
import { groupForMuscle, rankForSwap, resultsHeading } from '@/lib/swap-search'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import MuscleMap from '@/components/exercises/MuscleMap'
import { fadeIn } from '@/lib/animations'
import { getCurrentUserId } from '@/lib/current-user'
import {
  startWorkout as dbStartWorkout,
  endWorkout as dbEndWorkout,
  saveSet as dbSaveSet,
  upsertPR as dbUpsertPR,
  fetchPRs as dbFetchPRs,
  type PRRow,
  saveSwap as dbSaveSwap,
  removeSwap as dbRemoveSwap,
  fetchSwaps as dbFetchSwaps,
  fetchInProgressWorkout as dbFetchInProgressWorkout,
  fetchWorkoutHistory as dbFetchWorkoutHistory,
  autoCloseStaleWorkouts as dbAutoCloseStaleWorkouts,
  fetchLastSets as dbFetchLastSets,
  fetchExerciseHistory as dbFetchExerciseHistory,
  fetchTimedHistory as dbFetchTimedHistory,
  fetchTrainedDays as dbFetchTrainedDays,
  type SwapReason,
  type ExerciseSession,
  type LastSet,
  type WorkoutHistoryRow,
} from '@/lib/workout'
import { rotationState } from '@/lib/rotation'
import { fetchBodyMetrics, saveBodyMetric, latestBodyWeight } from '@/lib/body-metrics'
import { localDate } from '@/lib/dates'
import {
  HOME_PLACE,
  placeToQuery,
  queryToPlace,
  samePlace,
  type TrainPlace,
} from '@/lib/train-url'
import ProgramBuilder from '@/components/studio/builder/ProgramBuilder'
import StartFrom from '@/components/studio/builder/StartFrom'
import {
  loadIntoBuilder,
  saveCustomProgram,
  activateCustomProgram,
  fetchMyCustomPrograms,
  fetchLibraryPrograms,
  deleteCustomProgram,
  duplicateCustomProgram,
  renameCustomProgram,
  MAX_CUSTOM_PROGRAMS,
  type BuilderProgram,
  type CustomProgramRow,
} from '@/lib/custom-program'
import { emptyWeek, genericWeek, type BuilderTemplate } from '@/lib/builder-templates'
import { alertRestOver, primeRestAudio, primeRestNotifications } from '@/lib/rest-alert'
import { enqueue, flushQueue, queueSize } from '@/lib/set-queue'
import { acquireWakeLock, releaseWakeLock, hasWakeLock } from '@/lib/wake-lock'
import { judgeSet, type RecordHit } from '@/lib/records'
import { cuesFor } from '@/lib/cues'
import { boxPlaceholder, canLogSet, toLog } from '@/lib/set-entry'
import { restSecondsAfterSet } from '@/lib/supersets'
import { isHold, parseHoldSeconds, HOLD_PRESETS, holdLabel } from '@/lib/holds'
import { supabase } from '@/lib/supabase'
import { submitFeedback } from '@/lib/feedback'
import { normaliseLibraryImages } from '@/lib/exercise-images'
import BlueprintPicker from '@/components/studio/BlueprintPicker'
import EmptyState from '@/components/ui/EmptyState'
import { loadAssignedProgram, type BlueprintGoal, type BlueprintLocation, type PlanDay, type PlanProgram } from '@/lib/blueprint'
import {
  PROGRESSION,
  experienceFrom,
  experienceKnown,
  isBodyweightMovement,
  loadLabel,
  nextTarget,
  parseRepRange,
  sessionFatigue,
  type ExperienceLevel,
  type ProgressionGoal,
} from '@/lib/progression'
import { fetchMyOnboarding, fetchTrainingExperience, fetchHasBench } from '@/lib/onboarding'
import { fetchMyTier } from '@/lib/scheduling'
import {
  completeBlock,
  fetchAssignmentStart,
  fetchMyBlock,
  fetchMyProgram,
  gatherReviewInputs,
  type Assignment,
} from '@/lib/programs'
import { blockProgress, buildReview, recommendNextBlock, type BlockReview } from '@/lib/blocks'
import {
  canComponentProgress,
  explosiveGuidance,
  inferTimedRole,
  isExplosiveMovement,
  isTimedPrescription,
  parsePrescribedDuration,
  timedTarget,
  type TimedRole,
} from '@/lib/conditioning'

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
  // Present on every record in exercises.json and what keeps a substitution
  // faithful to the movement it replaces.
  force?: string | null
  mechanic?: string | null
}

interface ProgramExercise {
  name: string
  sets: number
  reps: string
  rest: string
  series: string
  /** Reps to leave in the tank, when the program says. Mirrors PlanExercise. */
  targetRir?: number | null
  /** The exercise this replaced, when the client said they have no bench. */
  swappedFrom?: string | null
  /** A note Anthony attached to this slot. Mirrors PlanExercise. */
  note?: string | null
}

type IntensityTechnique = 'dropset' | 'restpause' | 'partial'

/**
 * Tap a number box, get the whole number selected.
 *
 * The other half of the prefilled-input problem. A box showing a suggestion is
 * empty underneath, so typing just works — but a set you already logged holds
 * a real value, and editing 135 to 145 should not mean picking the caret out
 * of the middle of it either.
 *
 * select() rather than setSelectionRange(), which throws on type="number" in
 * Chrome and Safari. Deferred a frame because iOS places its own caret after
 * the focus handler runs and would otherwise undo this immediately.
 */
const selectAllOnFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  const el = e.currentTarget
  if (!el.value) return
  requestAnimationFrame(() => {
    try {
      el.select()
    } catch {
      /* Some browsers refuse selection on number inputs. Caret stays put. */
    }
  })
}

const TECHNIQUE_META: Record<IntensityTechnique, { label: string; color: string; ring: string; bg: string; border: string; text: string; hint: string }> = {
  dropset: {
    label: 'Drop Set',
    color: '#EF4444',
    ring: 'ring-technique-drop/30',
    bg: 'bg-technique-drop/[0.06]',
    border: 'border-technique-drop/15',
    text: 'text-technique-drop',
    hint: 'After your last working set, immediately reduce weight and rep to failure.',
  },
  restpause: {
    label: 'Rest-Pause',
    color: '#C084FC',
    ring: 'ring-technique-restpause/30',
    bg: 'bg-technique-restpause/[0.06]',
    border: 'border-technique-restpause/15',
    text: 'text-technique-restpause',
    hint: 'After your last working set, rest 10-15s, then rep to failure. Keep the weight.',
  },
  partial: {
    label: 'Partials',
    color: '#F59E0B',
    ring: 'ring-technique-partial/30',
    bg: 'bg-technique-partial/[0.06]',
    border: 'border-technique-partial/15',
    text: 'text-technique-partial',
    hint: 'After your last working set, drop the ROM to half reps. Pump until you physically cannot move.',
  },
}

type ProgramView = 'preview' | 'workout' | 'exercise' | 'builder' | 'myPrograms' | 'startFrom'

interface SetRow {
  weight: string
  reps: string
  /** False while the numbers are only a suggestion. */
  logged: boolean
}

const emptyRow = (): SetRow => ({ weight: '', reps: '', logged: false })

/* ── Current Program ──
 * Self-guided sample routine. A personalized program is generated for each
 * client later (AI builder, trainer-assisted). Until then this is a labeled
 * starter routine to train + log against, not presented as a coach-assigned plan. */
/**
 * Placeholder shape held until the client's real program resolves.
 *
 * This deliberately contains no exercises. It previously held a complete fake
 * program — "Self-Guided Training", Barbell Bench Press, Barbell Squat — which
 * rendered immediately on mount because the page had no loading state, so every
 * client saw a program that was not theirs before their own arrived, and a
 * coached client with nothing assigned never saw anything else.
 */
/**
 * Sessions a block needs before its end is worth interrupting someone about.
 * Below this there is nothing to review, only an absence to notice — and the
 * coach dashboard already notices absences.
 */
const MIN_SESSIONS_FOR_REVIEW = 4

const EMPTY_PROGRAM = {
  name: '',
  level: '',
  phase: '',
  weeks: { current: 1, total: 1 },
  startDate: '',
  coach: '',
}

const EMPTY_WEEKLY_PLAN: PlanDay[] = []

/* ── Personal Records (per exercise) ── */
interface PRRecord {
  weight: number     // lbs
  reps: number
  date: string       // when PR was set
  previous?: number  // previous PR weight for comparison
}

/* Real PRs come from the DB (dbPRs); no demo PRs are shown to clients. */

/* ── Exercise Alternatives (same muscle group substitutions) ── */
/**
 * Curated swaps, keyed by the exact names the program library prescribes.
 *
 * The previous version keyed on names the library never uses — 'Barbell Bench
 * Press' where it prescribes 'Barbell Bench Press - Medium Grip', 'Overhead
 * Press' where it prescribes 'Standing Military Press'. Only 4 of 65
 * prescribed exercises matched, so almost every swap fell through to the
 * algorithm. 46 of the alternatives it named did not exist in
 * exercises.json either, so they could not resolve to a demo or an image.
 *
 * Every name below is verified against public/exercises/exercises.json. This
 * map only needs to cover cases where judgement beats the scored fallback —
 * mostly where one muscle tag covers two different jobs (lateral vs rear delt).
 */
const exerciseAlternatives: Record<string, string[]> = {
  // Presses — keep a loadable compound, never drop to a fly
  'Barbell Bench Press - Medium Grip': ['Dumbbell Bench Press', 'Barbell Incline Bench Press - Medium Grip', 'Decline Dumbbell Bench Press'],
  'Barbell Incline Bench Press - Medium Grip': ['Incline Dumbbell Press', 'Dumbbell Bench Press', 'Barbell Bench Press - Medium Grip'],
  'Incline Dumbbell Press': ['Barbell Incline Bench Press - Medium Grip', 'Dumbbell Bench Press', 'Arnold Dumbbell Press'],
  'Dumbbell Bench Press': ['Incline Dumbbell Press', 'Decline Dumbbell Bench Press', 'Dumbbell Flyes'],
  'Standing Military Press': ['Dumbbell Shoulder Press', 'Arnold Dumbbell Press', 'Dumbbell One-Arm Shoulder Press'],
  'Dumbbell Shoulder Press': ['Arnold Dumbbell Press', 'Dumbbell One-Arm Shoulder Press', 'Standing Military Press'],
  // Delts — muscle tag alone cannot tell lateral from rear, so these are pinned
  'Cable Seated Lateral Raise': ['Side Lateral Raise', 'Dumbbell Raise', 'Side Laterals to Front Raise'],
  'Dumbbell Raise': ['Side Lateral Raise', 'Side Laterals to Front Raise', 'Arnold Dumbbell Press'],
  'Face Pull': ['Bent Over Dumbbell Rear Delt Raise With Head On Bench', 'Dumbbell Lying Rear Lateral Raise', 'Seated Cable Rows'],
  // Pulls
  'Bent Over Barbell Row': ['One-Arm Dumbbell Row', 'Bent Over Two-Dumbbell Row', 'Seated Cable Rows'],
  'Seated Cable Rows': ['One-Arm Dumbbell Row', 'Bent Over Two-Dumbbell Row', 'Bent Over Barbell Row'],
  'One-Arm Dumbbell Row': ['Bent Over Two-Dumbbell Row', 'Seated Cable Rows', 'Dumbbell Incline Row'],
  'Wide-Grip Lat Pulldown': ['Pullups', 'Chin-Up', 'Close-Grip Front Lat Pulldown'],
  'Pullups': ['Chin-Up', 'Wide-Grip Lat Pulldown', 'V-Bar Pullup'],
  'Chin-Up': ['Pullups', 'Wide-Grip Lat Pulldown', 'Close-Grip Front Lat Pulldown'],
  // Lower
  'Barbell Squat': ['Leg Press', 'Dumbbell Squat', 'Barbell Full Squat'],
  'Dumbbell Squat': ['Split Squat with Dumbbells', 'Dumbbell Lunges', 'Bodyweight Squat'],
  'Leg Press': ['Barbell Squat', 'Barbell Hack Squat', 'Dumbbell Lunges'],
  'Romanian Deadlift': ['Stiff-Legged Dumbbell Deadlift', 'Good Morning', 'Barbell Deadlift'],
  'Barbell Deadlift': ['Romanian Deadlift', 'Stiff-Legged Dumbbell Deadlift', 'Barbell Hip Thrust'],
  'Stiff-Legged Dumbbell Deadlift': ['Romanian Deadlift', 'Floor Glute-Ham Raise', 'Good Morning'],
  'Barbell Hip Thrust': ['Butt Lift (Bridge)', 'Single Leg Glute Bridge', 'Romanian Deadlift'],
  'Lying Leg Curls': ['Seated Leg Curl', 'Floor Glute-Ham Raise', 'Single Leg Glute Bridge'],
  'Seated Leg Curl': ['Lying Leg Curls', 'Floor Glute-Ham Raise', 'Stiff-Legged Dumbbell Deadlift'],
  'Standing Calf Raises': ['Seated Calf Raise', 'Standing Dumbbell Calf Raise', 'Calf Raise On A Dumbbell'],
  'Seated Calf Raise': ['Standing Calf Raises', 'Standing Dumbbell Calf Raise', 'Calf Raise On A Dumbbell'],
  // Arms
  'Barbell Curl': ['Dumbbell Bicep Curl', 'EZ-Bar Curl', 'Hammer Curls'],
  'Dumbbell Bicep Curl': ['Hammer Curls', 'Barbell Curl', 'Concentration Curls'],
  'Triceps Pushdown': ['EZ-Bar Skullcrusher', 'Decline Dumbbell Triceps Extension', 'Dumbbell One-Arm Triceps Extension'],
  'EZ-Bar Skullcrusher': ['Triceps Pushdown', 'Decline Dumbbell Triceps Extension', 'Dumbbell One-Arm Triceps Extension'],
  // Core
  'Plank': ['Air Bike', 'Dead Bug', 'Standing Cable Wood Chop'],
}

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


export default function ProgramsPage() {
  const [view, setView] = useState<ProgramView>('preview')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [exerciseDB, setExerciseDB] = useState<ExerciseDB[]>([])
  const [expandedWorkoutExercise, setExpandedWorkoutExercise] = useState<string | null>(null)
  /**
   * One row per set.
   *
   * `logged` is the change that makes prefilling possible. A set used to count
   * as done the moment both boxes held something, so filling the numbers in
   * advance would have marked every set complete on load, started the rest
   * timer and written the lot to the database. Separating "what we suggest"
   * from "what you did" means the row can arrive filled in and still be
   * waiting for the client to confirm it.
   */
  const [setLogs, setSetLogs] = useState<Record<string, SetRow[]>>({})
  const [swappedExercises, setSwappedExercises] = useState<Record<string, string>>({})

  // Rest timer
  const [restTimers, setRestTimers] = useState<Record<string, number>>({}) // per-exercise custom rest in seconds
  /**
   * `next` is what the client is resting FOR.
   *
   * The bar counted down and said nothing about why. "01:27" alone makes you
   * open the card to remember what is coming, which is the one thing a rest
   * timer exists to save you from — the whole point is that you can put the
   * phone down.
   */
  const [activeTimer, setActiveTimer] = useState<{
    key: string
    remaining: number
    total: number
    endsAt: number
    next: { name: string; set: string } | null
  } | null>(null)
  const [editingRest, setEditingRest] = useState<string | null>(null)
  const [workoutStartTime, setWorkoutStartTime] = useState<Record<number, number>>({}) // day index → unix ms
  const [workoutElapsed, setWorkoutElapsed] = useState(0) // seconds, ticks for active workout
  const [intensityOn, setIntensityOn] = useState<Record<string, boolean>>({}) // exercise key → toggle
  const [intensityChoice, setIntensityChoice] = useState<Record<string, IntensityTechnique>>({}) // exercise key → selected technique
  const [intensityLogs, setIntensityLogs] = useState<Record<string, { weight: string; done: boolean }[]>>({}) // exercise key → 2 intensity set logs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  /**
   * When the current rest ends, where the ticking interval can see it.
   *
   * The interval used to close over a const deadline, which was fine while
   * rest was fixed and wrong the moment it could be extended: +30s would have
   * updated the number on screen and the alert would still have fired at the
   * original time. A ref is read fresh on every tick.
   */
  const restEndsAtRef = useRef<number>(0)
  /*
   * Strength sets no longer need a save debounce or a PR debounce.
   *
   * Both existed because a set wrote itself on every keystroke: typing "165"
   * fired three saves whose order was not guaranteed, and three personal-record
   * checks that each sent their own email. Logging is now one deliberate tap,
   * so there is exactly one write with exactly the numbers the client
   * confirmed. Timed slots still type free-form, so they keep theirs.
   */
  /** A debounce for timed slots: typing "25" should not write 2 then 25. */
  const timedSaveRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  // Weight already announced per exercise, so one record sends one email.
  const prNotifiedRef = useRef<Record<string, number>>({})

  // Persistence
  const [userId, setUserId] = useState<string | null>(null)
  const [workoutIds, setWorkoutIds] = useState<Record<number, string>>({}) // day index → DB workout id
  const [dbPRs, setDbPRs] = useState<Record<string, PRRecord>>({}) // overrides hardcoded demo PRs when present
  /**
   * Recent records as a list, for the sidebar.
   *
   * Lives here rather than on the home screen. A list of your last six
   * records is reference material you go and look at, not an answer to
   * "what am I doing today" — and this is the tab you are on when you
   * wonder about it.
   */
  const [prList, setPrList] = useState<PRRow[]>([])

  // ── Assigned program + Blueprint self-serve picker ──
  const [weeklyPlan, setWeeklyPlan] = useState<PlanDay[]>(EMPTY_WEEKLY_PLAN)
  /** Where the client is in the rotation. -1 until the program loads. */
  const [todayIndex, setTodayIndex] = useState(-1)
  /** The program open in the builder, and which saved program it edits. */
  const [builderDraft, setBuilderDraft] = useState<BuilderProgram | null>(null)
  const [builderEditingId, setBuilderEditingId] = useState<string | null>(null)
  const [builderSaving, setBuilderSaving] = useState(false)
  /**
   * A write that failed, said out loud.
   *
   * Every save on this screen used to fail into console.error. The builder's
   * catch block logged and stopped: the spinner ended, the screen did not
   * move, the draft stayed on screen looking unsaved-or-maybe-saved, and the
   * client had no way to tell which. Nothing a client cannot see in the app
   * counts as having told them.
   */
  const [writeError, setWriteError] = useState<string | null>(null)
  /**
   * True when the builder holds changes that are not saved yet.
   *
   * Reported up by the builder because only it knows what has been typed.
   * The page needs it because leaving can start in three different places:
   * the builder's own Cancel, the Back link above it, and the phone's back
   * gesture — and all three used to discard the work in silence.
   */
  const [builderDirty, setBuilderDirty] = useState(false)
  /**
   * Whether they have already recorded a bodyweight today.
   *
   * Decides whether the finish-a-workout screen offers the weigh-in. Nobody
   * in the product's history has ever logged a weight, because the only place
   * that asked was behind a More menu, under an empty chart, as a form of six
   * fields. Asking here costs one tap at a moment they are already standing
   * still, and ignoring it costs nothing.
   */
  const [weighedToday, setWeighedToday] = useState(true)
  /**
   * Held while we ask about unsaved work: what to do if they say discard.
   *
   * A function rather than a destination, because the three ways out of the
   * builder land in three different places — the week, the chooser they came
   * from, or wherever the back gesture was heading.
   */
  const [leaveGuard, setLeaveGuard] = useState<{ discard: () => void } | null>(null)
  /** Saving the client's active swaps into their own program. */
  const [keepingSwaps, setKeepingSwaps] = useState(false)
  /** How many exercises the last such save changed, for the confirmation. */
  const [keptSwaps, setKeptSwaps] = useState<number | null>(null)
  /**
   * The draft exactly as it was loaded, kept so a save can tell which days
   * were renamed and carry their workout history across.
   */
  const [builderOriginal, setBuilderOriginal] = useState<BuilderProgram | null>(null)
  /** Set after a save that moved history, so the client is told rather than left guessing. */
  const [builderMoved, setBuilderMoved] = useState<number | null>(null)
  /** The program being renamed in place on My programs. */
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [myPrograms, setMyPrograms] = useState<CustomProgramRow[]>([])
  /** The program currently loaded, so it can be copied into the builder. */
  const [assignedProgramId, setAssignedProgramId] = useState<string | null>(null)
  /** 'custom' when the client built the program they are on themselves. */
  const [programSource, setProgramSource] = useState<string | null>(null)
  /** Set while the End Workout prompt is open, carrying the session tally. */
  const [confirmEnd, setConfirmEnd] = useState<{ logged: number; planned: number } | null>(null)
  /** Sets written down but not yet saved to the server. */
  const [pendingSets, setPendingSets] = useState(0)
  /** Which exercise the client is on, while a session is running. */
  const [focusIndex, setFocusIndex] = useState(0)
  /** Exercises the client chose to skip this session. */
  const [skipped, setSkipped] = useState<Record<string, boolean>>({})
  /** Exercise name whose demonstration sheet is open over the session. */
  const [demoFor, setDemoFor] = useState<string | null>(null)
  /** Exercise whose swap sheet is open, if any. */
  const [swapFor, setSwapFor] = useState<string | null>(null)
  /** Miles typed against a timed slot, keyed like timedLogs. */
  const [distanceLogs, setDistanceLogs] = useState<Record<string, string>>({})
  /** Records set during this session, for the completion screen. */
  const [sessionRecordList, setSessionRecords] = useState<Array<{ exerciseName: string } & RecordHit>>([])
  const [currentProgram, setCurrentProgram] = useState<PlanProgram>(EMPTY_PROGRAM)
  const [showPicker, setShowPicker] = useState(false)
  const [isBeginnerFlow, setIsBeginnerFlow] = useState(false)
  const [programLocation, setProgramLocation] = useState<BlueprintLocation | null>(null)
  const [programGoal, setProgramGoal] = useState<BlueprintGoal | null>(null)
  const [hasAssigned, setHasAssigned] = useState(false)
  // Gates the whole page. Without this the placeholder program rendered while
  // the real one was still in flight.
  const [loading, setLoading] = useState(true)
  // What this client did last time on each exercise, shown while they log.
  const [lastSets, setLastSets] = useState<Record<string, LastSet[]>>({})
  /** Last six sessions per exercise. One session cannot tell a stall from a bad day. */
  const [exHistory, setExHistory] = useState<Record<string, ExerciseSession[]>>({})
  const [level, setLevel] = useState<ExperienceLevel>('beginner')
  /** Whether onboarding actually told us the training age, or we defaulted. */
  const [levelKnown, setLevelKnown] = useState(false)
  /**
   * Treat someone as a beginner for the purpose of HIDING things only when we
   * were told they are one. All nine clients have null experience answers, so
   * gating on level alone took drop sets away from the entire platform.
   */
  const treatAsBeginner = levelKnown && level === 'beginner'
  const [rirByExercise, setRirByExercise] = useState<Record<string, number>>({})
  /** Used only to spot a client typing their own weight into a load field. */
  const [bodyWeightLb, setBodyWeightLb] = useState<number | null>(null)
  /** The training block this client is in. Null until loaded, or if they have no program. */
  const [block, setBlock] = useState<Assignment | null>(null)
  const [blockReview, setBlockReview] = useState<BlockReview | null>(null)
  const [reviewDismissed, setReviewDismissed] = useState(false)
  /** Past runs, rows and intervals. Lifting history cannot carry these: they have no load. */
  const [timedHistory, setTimedHistory] = useState<Record<string, Array<{ date: string; durationSeconds: number | null; distanceMi: number | null }>>>({})
  /** Minutes typed into a timed slot, keyed like setLogs. */
  const [timedLogs, setTimedLogs] = useState<Record<string, string>>({})

  // Workout history (Recent Logs) + PR celebration
  const [history, setHistory] = useState<WorkoutHistoryRow[]>([])
  /* Has anything been logged for today?
     Read from history rather than a flag set when a session ends, so it is
     still right after a reload, and on a second visit later the same
     evening. */
  const trainedToday = history.some((w) => w.date === localDate() && w.ended_at)
  /* Is the next-up card showing its exercise list? Collapsed by default. */
  const [peek, setPeek] = useState(false)
  const [prCelebration, setPrCelebration] = useState<{ name: string; weight: number } | null>(null)
  // Shown after End Workout. Finishing a session used to clear the screen with
  // no acknowledgement at all — the one behaviour the product most wants to
  // reinforce got less feedback than logging a single set.
  const [workoutSummary, setWorkoutSummary] = useState<{
    dayName: string
    seconds: number
    sets: number
    reps: number
    volume: number
    /** Set when several lifts came in under last time. */
    fatigue: string | null
    /** Lifts that beat last session, in plain words. */
    improvements: string[]
    /** Records set today. */
    records: Array<{ exerciseName: string } & RecordHit>
    /** The next training day in the rotation. */
    nextUp: string | null
    /**
     * Two moments that only happen once, and were passing unmarked.
     *
     * `firstEver` is the first session a client ever finishes — the thing the
     * whole product is trying to get them to do, and the app said nothing
     * about it. `weekDone` is every training day in the rotation completed.
     *
     * Both are deliberately one line inside the summary they already see
     * rather than a separate celebration. A screen that has to be dismissed
     * is a toll, and a week of training is not a surprise worth stopping
     * somebody for.
     */
    firstEver: boolean
    weekDone: boolean
  } | null>(null)
  const loadHistory = useCallback((uid: string) => {
    dbFetchWorkoutHistory(uid, 12)
      .then(setHistory)
      .catch((e) => console.error('[History] load failed', e))
  }, [])

  /**
   * Load the program and work out where in it the client actually is.
   *
   * `completed` used to arrive hardcoded false on every day, so the ticks never
   * appeared, the overview tile read 0/N forever, and "today" was permanently
   * Day 1. The history to answer this was always in the database; nothing read
   * it. Rotation failures are swallowed: a client whose history will not load
   * should still get their program, just without the ticks.
   */
  const applyLoadedProgram = useCallback(async (programId: string, uid: string | null) => {
    // What they own. Undefined means never asked, which equipment.ts
    // reads as "has it" — so nothing changes for anyone who picked a
    // program before the question existed.
    const bench = uid ? await fetchHasBench(uid).catch(() => null) : null
    const loaded = await loadAssignedProgram(programId, { bench: bench ?? undefined })
    if (!loaded) return

    let plan = loaded.weeklyPlan
    let today = plan.findIndex((d) => d.exercises.length > 0)
    if (uid) {
      try {
        // Bounded to this program's own life. Day names repeat across the
        // library — "Upper A" is in eleven of the sixty-eight — so without the
        // boundary a previous program's sessions can close out this one's lap.
        const since = await fetchAssignmentStart(uid, programId)
        const trained = await dbFetchTrainedDays(uid, 60, since)
        const state = rotationState(
          plan.map((d) => d.name),
          plan.map((d) => d.exercises.length > 0),
          trained
        )
        plan = plan.map((d) => ({ ...d, completed: state.completed.has(d.name) }))
        today = state.todayIndex
      } catch (err) {
        console.error('[Rotation] Failed to read history:', err)
      }
    }

    setWeeklyPlan(plan)
    setTodayIndex(today)
    setAssignedProgramId(programId)
    setCurrentProgram(loaded.program)
    setProgramLocation(loaded.location)
    setProgramGoal(loaded.goal)
    setProgramSource(loaded.source)
    setHasAssigned(true)
  }, [])

  const handlePickerDone = useCallback(async (programId: string) => {
    await applyLoadedProgram(programId, await getCurrentUserId())
    setShowPicker(false)
  }, [applyLoadedProgram])

  // On load: render the client's assigned program; if a Blueprint member has
  // none yet, show the pick-your-program flow (simplified for beginners).
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const id = await getCurrentUserId()
        if (!active || !id) return
        const [tier, program, onboarding, trainingExperience] = await Promise.all([
          fetchMyTier(id),
          fetchMyProgram(id),
          fetchMyOnboarding(id),
          fetchTrainingExperience(id).catch(() => null),
        ])
        if (!active) return

        // Training age decides how big a load jump is and how many flat
        // sessions count as a stall. Every program in the library is stamped
        // "All Levels"; the answer is in onboarding and was never read.
        /* Their weigh-in first, the intake form second.
           This used to read onboarding alone, and Blueprint clients never
           fill that in — so the weight was always null, the bodyweight guard
           always declined, and one client is currently being told to add 5 lb
           to a glute bridge he logs at his own bodyweight. The end of a
           workout asks for a weigh-in now, which is where this comes from. */
        const weighed = await latestBodyWeight(id).catch(() => null)
        const cw = Number(onboarding?.answers?.currentWeight)
        if (weighed != null) setBodyWeightLb(weighed)
        else if (Number.isFinite(cw) && cw > 0) setBodyWeightLb(cw)

        // The block this client is in. If it has run its eight weeks and has
        // not been reviewed yet, build the review now — this is the moment the
        // product has never had, where a program actually finishes.
        const b = await fetchMyBlock(id)
        if (!active) return
        setBlock(b)
        if (b && !b.completed_at) {
          const prog = blockProgress(b.assigned_at, b.block_weeks)
          if (prog.isComplete) {
            const inputs = await gatherReviewInputs(id, b.assigned_at)
            if (!active) return
            const review = buildReview({ blockWeeks: b.block_weeks, ...inputs })

            // Close it either way, but only INTERRUPT someone who actually
            // trained. Two clients carry assignments from July, before blocks
            // existed, with zero sessions logged against them — opening the app
            // to a "Block complete, 8 weeks done" celebration of nothing would
            // make the feature look broken and would read as sarcasm. Their
            // inactivity already reaches Anthony through the at-risk status,
            // which is the right channel for it.
            completeBlock(b.id, review).catch((err) =>
              console.error('[Block] Failed to record completion:', err)
            )
            setBlock({ ...b, completed_at: new Date().toISOString(), review })
            if (review.sessions >= MIN_SESSIONS_FOR_REVIEW) setBlockReview(review)
          }
        }

        /* The picker's answer first, the coach's intake form second.
           Both say the same kind of thing, and one of them is actually
           filled in: no client has ever answered it, so until the picker
           started asking, this resolved to 'beginner' for every client in
           the app — 5 lb on the bar and 10 on the squat after a single
           good session, for somebody two years in. */
        const saidExperience = trainingExperience ?? onboarding?.answers?.experience
        setLevel(experienceFrom(saidExperience, onboarding?.answers?.yearsTraining))
        setLevelKnown(experienceKnown(saidExperience, onboarding?.answers?.yearsTraining))

        if (program) {
          await applyLoadedProgram(program.id, id)
        } else if (tier === 'blueprint') {
          // Detect if beginner: 0-1 years of experience or 'new' status
          const yearsTraining = onboarding?.answers?.yearsTraining
          const experience = onboarding?.answers?.experience
          const isNewUser = experience === 'new' || yearsTraining === '0'
          setIsBeginnerFlow(isNewUser)
          setShowPicker(true)
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [applyLoadedProgram])

  // Same-muscle alternatives for the swap menu. Falls back to the exercise DB
  // (honoring a home client's dumbbell/bodyweight constraint) when there's no
  // hardcoded list for a given exercise.
  const getAlternatives = useCallback((name: string): string[] => {
    const hard = exerciseAlternatives[name]
    if (hard && hard.length) return hard

    const src = findExerciseMatch(name, exerciseDB)
    const primary = src?.primaryMuscles?.[0]
    if (!src || !primary) return []

    const homeEq = new Set(['dumbbell', 'body only'])
    const commonEq = new Set(['dumbbell', 'barbell', 'body only', 'cable', 'machine'])
    // A swap has to keep doing the job of the slot it replaces. Matching on
    // primary muscle alone offered Cable Crossover in place of Barbell Bench —
    // same muscle, but an isolation movement standing in for the loadable
    // compound the program is built around. force and mechanic keep the
    // movement pattern; category keeps a plyometric out of a strength slot.
    const srcCategory = src.category === 'strength' || src.category === 'powerlifting' ? null : src.category
    const srcSecondary = new Set(src.secondaryMuscles ?? [])

    const scored = exerciseDB
      .filter((e) => {
        if (normalizeExName(e.name) === normalizeExName(name)) return false
        if (e.primaryMuscles?.[0] !== primary) return false
        if (src.force && e.force !== src.force) return false
        if (src.mechanic && e.mechanic !== src.mechanic) return false
        if (srcCategory ? e.category !== srcCategory : !(e.category === 'strength' || e.category === 'powerlifting'))
          return false
        if (programLocation === 'home' && !homeEq.has(e.equipment)) return false
        return true
      })
      .map((e) => {
        let score = 0
        if (e.equipment === src.equipment) score += 3
        if (commonEq.has(e.equipment)) score += 2
        if (e.level === src.level) score += 2
        if (e.level === 'expert' && src.level !== 'expert') score -= 5
        for (const m of e.secondaryMuscles ?? []) if (srcSecondary.has(m)) score += 1
        return { name: e.name, score }
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

    return scored.slice(0, 6).map((e) => e.name)
  }, [exerciseDB, programLocation])

  const parseRestSeconds = (rest: string): number => {
    const match = rest.match(/(\d+)/)
    if (!match) return 60
    const val = parseInt(match[1])
    if (rest.includes('min')) return val * 60
    return val
  }

  const formatDuration = (sec: number): string => {
    const m = Math.round(sec / 60)
    if (m < 1) return '<1m'
    if (m < 60) return `${m}m`
    return `${Math.floor(m / 60)}h ${m % 60}m`
  }
  const formatHistoryDate = (w: WorkoutHistoryRow): string => {
    const iso = w.date ? `${w.date}T00:00:00` : (w.ended_at ?? '')
    const d = iso ? new Date(iso) : null
    return d && !isNaN(d.getTime())
      ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : ''
  }

  /**
   * Rest countdown, driven by a deadline rather than by a counter.
   *
   * The old version decremented `remaining` once a second and trusted the
   * result. A phone screen sleeps about thirty seconds into a ninety-second
   * rest, and a backgrounded tab's intervals are throttled or suspended
   * outright on iOS — so the number the client came back to was simply wrong,
   * usually by most of the rest. Storing when the rest ENDS and subtracting
   * from the clock each tick means a sleeping phone costs nothing: the timer is
   * correct the instant the screen comes back, because it was never counting.
   */
  const startRestTimer = useCallback((
    exerciseKey: string,
    seconds: number,
    next: { name: string; set: string } | null = null
  ) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const endsAt = Date.now() + seconds * 1000
    restEndsAtRef.current = endsAt
    setActiveTimer({ key: exerciseKey, remaining: seconds, total: seconds, endsAt, next })
    timerRef.current = setInterval(() => {
      // Read from the ref, not a captured const: addRestTime moves it.
      const left = Math.ceil((restEndsAtRef.current - Date.now()) / 1000)
      if (left <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = null
        alertRestOver()
        setActiveTimer(null)
        return
      }
      setActiveTimer((prev) => (prev ? { ...prev, remaining: left } : prev))
    }, 500)
  }, [])

  /**
   * Another thirty seconds.
   *
   * Needing longer after a hard set is not an edge case, it is what training
   * heavy is. The only route before this was the per-exercise rest setting,
   * which is the wrong depth for a thirty-second decision — so people opened
   * their phone's own timer instead, and once they have done that they are in
   * another app.
   *
   * Moves the DEADLINE rather than a counter, which is the whole reason the
   * timer survives a sleeping phone.
   */
  const addRestTime = useCallback((seconds: number) => {
    setActiveTimer((prev) => {
      if (!prev) return prev
      const endsAt = prev.endsAt + seconds * 1000
      restEndsAtRef.current = endsAt
      return {
        ...prev,
        endsAt,
        total: prev.total + seconds,
        remaining: Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)),
      }
    })
  }, [])

  const stopRestTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setActiveTimer(null)
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const selected = selectedDay !== null ? weeklyPlan[selectedDay] : null

  /**
   * Open the builder on a copy of a program.
   *
   * The same code path serves "customise the one I'm following" and "edit my
   * own": loadIntoBuilder reads any program the client can see, so copying an
   * AJM Fit program and editing a custom one are one operation with a
   * different programId.
   */
  const openBuilder = async (sourceProgramId: string | null, editingId: string | null) => {
    try {
      let draft: BuilderProgram
      if (sourceProgramId) {
        // Day keys only when editing. A copy shares its day names with the
        // original, and treating a rename on the copy as a rename of those
        // names would rewrite history belonging to a program the client is not
        // editing — see loadIntoBuilder.
        const loaded = await loadIntoBuilder(sourceProgramId, { keepKeys: Boolean(editingId) })
        if (!loaded) return
        draft = editingId ? loaded : { ...loaded, name: `${loaded.name} (my version)`.slice(0, 80) }
      } else {
        draft = { name: 'My program', days: genericWeek(4) }
      }
      setBuilderDraft(draft)
      setBuilderOriginal(editingId ? draft : null)
      setBuilderEditingId(editingId)
      setBuilderMoved(null)
      setView('builder')
    } catch (err) {
      console.error('[Builder] Could not open:', err)
    }
  }

  /**
   * Open the fork screen.
   *
   * Loads the client's programs first so the limit is known before the doors
   * are offered: finding out you are at the cap after choosing a split and
   * filling three days would be the worst possible moment to be told.
   */
  const openStartFrom = async () => {
    if (userId) {
      try {
        setMyPrograms(await fetchMyCustomPrograms(userId))
      } catch (err) {
        console.error('[Builder] Could not list programs:', err)
      }
    }
    setView('startFrom')
  }

  /**
   * Save a rename, or quietly drop it.
   *
   * A blank name is treated as a cancel rather than an error: the field is
   * already the only thing on screen, and refusing to close it over an empty
   * string would trap someone who tapped Rename by mistake.
   */
  const commitRename = async () => {
    const pending = renaming
    if (!pending || !userId) { setRenaming(null); return }
    const name = pending.name.trim().slice(0, 80)
    setRenaming(null)
    const current = myPrograms.find((p) => p.id === pending.id)?.name
    if (!name || name === current) return
    try {
      await renameCustomProgram(pending.id, name)
      setMyPrograms(await fetchMyCustomPrograms(userId))
      // The header shows the name of the program they are ON, so it goes stale
      // the moment that is the one being renamed.
      if (assignedProgramId === pending.id) {
        setCurrentProgram((prev) => (prev ? { ...prev, name } : prev))
      }
    } catch (err) {
      console.error('[Builder] Rename failed:', err)
    }
  }

  /**
   * "I searched for this and the library had nothing."
   *
   * Goes to the same feedback table as the feedback button, so it lands on
   * Anthony's dashboard beside everything else rather than in a new inbox
   * nobody checks. The page is tagged so he can tell an exercise request from
   * a bug report at a glance.
   */
  const requestExercise = async (term: string) => {
    let name = ''
    if (userId) {
      const { data } = await supabase
        .from('users')
        .select('name')
        .eq('id', userId)
        .maybeSingle<{ name: string }>()
      name = data?.name ?? ''
    }
    await submitFeedback({
      userId,
      name,
      page: 'exercise-request',
      message: `Couldn't find "${term}" in the exercise library.`,
    })
  }

  /** The from-scratch path: a named, empty week at the chosen day count. */
  const openBlankBuilder = (template: BuilderTemplate | null, days: number) => {
    setBuilderDraft({
      name: 'My program',
      days: template ? emptyWeek(template) : genericWeek(days),
    })
    setBuilderOriginal(null)
    setBuilderEditingId(null)
    setBuilderMoved(null)
    setView('builder')
  }

  const handleBuilderSave = async (program: BuilderProgram, activate: boolean) => {
    if (!userId) return
    setBuilderSaving(true)
    try {
      const { programId: id, sessionsMoved } = await saveCustomProgram({
        userId,
        program,
        programId: builderEditingId ?? undefined,
        original: builderOriginal ?? undefined,
      })
      setBuilderMoved(sessionsMoved > 0 ? sessionsMoved : null)
      if (activate) {
        // Editing the program they are already training is a continuation,
        // not a switch: keep their place in the block. Starting a different
        // program is a new block and week one is honest.
        await activateCustomProgram(userId, id, {
          continueBlock: id === assignedProgramId,
        })
        await applyLoadedProgram(id, userId)
        setSelectedDay(null)
        // A Blueprint client with no program yet reaches the builder from the
        // picker screen, and the picker outranks everything in the render
        // order — leave this set and they land back on it having just built
        // and started a program.
        setShowPicker(false)
        setView('preview')
      } else {
        setMyPrograms(await fetchMyCustomPrograms(userId))
        setView('myPrograms')
      }
      setBuilderDraft(null)
      setBuilderOriginal(null)
      setBuilderEditingId(null)
      setBuilderDirty(false)
      // A rename on the program they are ON changes which day is today, and
      // the loaded plan is now stale against it.
      if (!activate && assignedProgramId === id) await applyLoadedProgram(id, userId)
      setWriteError(null)
    } catch (err) {
      console.error('[Builder] Save failed:', err)
      // The draft is deliberately left on screen. It is the only copy of
      // their work, and clearing the view to show an error would throw away
      // the thing the error is about.
      setWriteError(
        'Could not save your program. Your changes are still here — check your connection and try Save again.'
      )
    } finally {
      setBuilderSaving(false)
    }
  }

  /**
   * Turn the swaps a client is training with into part of their own program.
   *
   * THE GAP THIS CLOSES. A swap and a program were two different kinds of
   * thing with no bridge between them. Swapping is how anyone actually
   * customises a day — you are standing in the gym, the rack is taken, you
   * pick something else — but a swap is a per-exercise overlay, it reverts
   * unless the client finds the permanence control, and even a permanent one
   * is never part of the program they can see, name, or come back to. The
   * builder could save a program but knew nothing about the swaps. So the way
   * people customise and the way the app stores a customisation never met,
   * and a rebuilt day looked like it had been thrown away.
   *
   * Applied by exercise NAME, across every day. That is how swaps are already
   * stored and reapplied — globally per client, not per day — so honouring
   * the same rule here is what makes the saved program match what they have
   * been training rather than a per-day subset of it.
   *
   * The swap rows are deleted afterwards. Once the substitute IS the
   * prescription, a swap off the original is an overlay with nothing left to
   * overlay, and leaving it means "undo swap" silently does nothing.
   */
  const keepSwapsInProgram = async () => {
    if (!userId || !assignedProgramId || keepingSwaps) return
    setKeepingSwaps(true)
    setWriteError(null)
    try {
      // key is `${dayIndex}-${exerciseName}`; the index never contains '-'.
      const swapByName = new Map<string, string>()
      for (const key of Object.keys(swappedExercises)) {
        const name = key.slice(key.indexOf('-') + 1)
        const alt = swappedExercises[key]
        if (name && alt) swapByName.set(name, alt)
      }
      if (swapByName.size === 0) return

      const mine = await fetchMyCustomPrograms(userId)
      const editingOwn = mine.some((p) => p.id === assignedProgramId)

      // keepKeys only when editing their own program: the day ids are what
      // carry logged sessions across a rename. A copy of an AJM Fit program
      // has no history of its own to carry.
      const draft = await loadIntoBuilder(assignedProgramId, { keepKeys: editingOwn })
      if (!draft) throw new Error('Could not read your program.')

      let changed = 0
      const days = draft.days.map((d) => ({
        ...d,
        exercises: d.exercises.map((ex) => {
          const alt = swapByName.get(ex.exerciseName)
          if (!alt) return ex
          changed += 1
          return { ...ex, exerciseName: alt }
        }),
      }))
      if (changed === 0) throw new Error('Those exercises are no longer in this program.')

      const { programId: savedId } = await saveCustomProgram({
        userId,
        program: {
          name: editingOwn ? draft.name : `${draft.name} (my version)`,
          days,
        },
        programId: editingOwn ? assignedProgramId : undefined,
        original: editingOwn ? draft : undefined,
      })

      // Always a continuation. Nothing about their week changed except which
      // movements are in it, and sending someone back to week one for saving
      // a substitution is the bug this whole change exists to stop.
      await activateCustomProgram(userId, savedId, { continueBlock: true })

      // Clear the overlays now that the program carries them.
      const names: string[] = []
      swapByName.forEach((_alt, name) => names.push(name))
      await Promise.all(names.map((n) => dbRemoveSwap(userId, n).catch(() => {})))
      setSwappedExercises({})

      await applyLoadedProgram(savedId, userId)
      setMyPrograms(await fetchMyCustomPrograms(userId))
      setKeptSwaps(changed)
    } catch (err) {
      console.error('[Keep swaps] Failed:', err)
      setWriteError(
        err instanceof Error && err.message.startsWith('Those exercises')
          ? err.message
          : 'Could not save these changes to your program. Nothing was changed — your swaps are still in place, so try again.'
      )
    } finally {
      setKeepingSwaps(false)
    }
  }

  const openMyPrograms = async () => {
    if (!userId) return
    try {
      setMyPrograms(await fetchMyCustomPrograms(userId))
    } catch (err) {
      console.error('[Builder] Could not list programs:', err)
    }
    setView('myPrograms')
  }

  /** True while this day's workout is running. */
  const sessionActive = selectedDay !== null && Boolean(workoutStartTime[selectedDay])

  /* Tell the layout to put the chat bubble and the feedback button away for
     the whole workout screen, not just a running set.
     It used to key off `sessionActive`, on the reasoning that browsing a day's
     exercises is reading and does not need the screen stripped. That premise
     was wrong: the workout view carries the weight and reps boxes at the
     bottom of every expanded card, started or not. So before Start Workout the
     feedback pill sat on the left of them and Chea's 56px bubble on the right,
     both over the inputs. `view` is the honest condition — this screen is for
     training on, and nothing of ours belongs on top of it. */
  const { setSessionActive, refreshActive } = useSessionChrome()
  useEffect(() => {
    setSessionActive(view === 'workout')
    // Leaving the Train tab mid-session must not leave the rest of the app
    // stripped, so the flag is cleared on the way out either way.
    return () => setSessionActive(false)
  }, [view, setSessionActive])

  /**
   * How many distinct exercises the client is currently training away from
   * their program. Counted by name, not by key: a swap applies to every day
   * the exercise appears in, so the same substitution showing up on three
   * days is one change, not three.
   */
  const activeSwapCount = useMemo(() => {
    const names = new Set<string>()
    for (const key of Object.keys(swappedExercises)) {
      const name = key.slice(key.indexOf('-') + 1)
      if (name) names.add(name)
    }
    return names.size
  }, [swappedExercises])

  /** How far through each exercise the client is, for the progress strip. */
  const exerciseProgress = (selected?.exercises ?? []).map((ex) => {
    const key = `${selectedDay}-${ex.name}`
    const rows = setLogs[key] ?? []
    const timed = isTimedPrescription(ex.reps)
    const done = timed ? ((timedLogs[key] ?? '') !== '' ? 1 : 0) : rows.filter((r) => r.logged).length
    const total = timed ? 1 : ex.sets
    return { name: ex.name, done, total, complete: done >= total, skipped: Boolean(skipped[key]) }
  })

  /**
   * One exercise at a time while training, the whole list while browsing.
   *
   * Reuses the same card either way rather than growing a second copy of the
   * set logger — the only difference is how many of them are on screen.
   */
  const sessionGroups =
    sessionActive && selected && selected.exercises[focusIndex]
      ? [
          {
            label: '',
            isSuperset: false,
            exercises: [
              {
                exercise: selected.exercises[focusIndex],
                seriesPrefix: selected.exercises[focusIndex].series,
              },
            ],
          },
        ]
      : groupBySeries(selected?.exercises ?? [])

  /** Move to the next exercise that still needs doing, else just the next one. */
  const goToExercise = (i: number) => {
    if (!selected) return
    const clamped = Math.max(0, Math.min(selected.exercises.length - 1, i))
    setFocusIndex(clamped)
    setExpandedWorkoutExercise(selected.exercises[clamped].name)
    stopRestTimer()
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /**
   * Save a set, and keep it if the write fails.
   *
   * Every call used to end in `.catch(console.error)`, which on a weak gym
   * connection meant the set was gone — while its row still showed the green
   * tick, because that tick reads local state rather than the write. Nothing
   * about this changes the happy path; it only stops a failure being silent.
   */
  const saveSetSafely = useCallback(async (slot: string, payload: Parameters<typeof dbSaveSet>[0]) => {
    try {
      await dbSaveSet(payload)
      // A success means the connection is back, so anything held goes now.
      if (queueSize() > 0) {
        const { remaining } = await flushQueue((p) => dbSaveSet(p as Parameters<typeof dbSaveSet>[0]))
        setPendingSets(remaining)
      }
    } catch (err) {
      console.error('[Set save] Queued after failure:', err)
      setPendingSets(enqueue(slot, payload))
    }
  }, [])

  /**
   * Make sure a session is running, and hand back the id to write sets against.
   *
   * WHY THIS EXISTS. Logging a set did not require a session. The rows, the
   * tick and the "Log set 1" button are all on screen before Start Workout is
   * tapped, and tapping them did three things, two of them wrong:
   *
   *   - the set was NOT saved. `commitSet` writes against
   *     `workoutIds[selectedDay]`, which only exists once a workout row has
   *     been created, so the write was skipped — while the row still showed
   *     the green tick, because the tick reads local state.
   *   - the rest timer DID start, and was invisible. The countdown only
   *     renders inside the pinned session bar, and that bar is gated on
   *     `workoutStartTime[selectedDay]`. So the client logged a set, the
   *     timer ran, and nothing appeared. That is the "the rest timer doesn't
   *     count down" report, and the timer was never the problem.
   *   - nothing told them any of this had happened.
   *
   * Starting on the first logged set rather than refusing the tap: nobody
   * opens a workout, logs a set, and did not mean to train. The Start Workout
   * button stays, because it is also what primes the audio context and asks
   * for notification permission at a moment the browser will allow it.
   *
   * Deliberately lighter than the button. It does not touch focus, skipped
   * exercises or which card is expanded — the client is already standing in
   * the middle of the session and must not be moved.
   */
  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (selectedDay === null || !selected) return null
    if (workoutStartTime[selectedDay]) return workoutIds[selectedDay] ?? null

    // Before the await, so it still counts as being inside the tap.
    primeRestAudio()
    void primeRestNotifications()
    const day = selectedDay
    setWorkoutStartTime((prev) => ({ ...prev, [day]: Date.now() }))
    setWorkoutElapsed(0)

    if (!userId) return null
    try {
      const wid = await dbStartWorkout({
        userId,
        dayName: selected.name,
        programName: currentProgram.name,
        programPhase: currentProgram.phase,
      })
      setWorkoutIds((prev) => ({ ...prev, [day]: wid }))
      // So the resume bar knows about it the moment they open Food.
      refreshActive()
      return wid
    } catch (err) {
      console.error('[Workout] Auto-start failed:', err)
      return null
    }
  }, [selectedDay, selected, workoutStartTime, workoutIds, userId, currentProgram, refreshActive])

  /**
   * Count what has actually been logged, so End Workout can say so.
   *
   * Luis tapped Food mid-session, came back, and ended a workout he had not
   * finished. The session resumes correctly now, but ending one is still a
   * single unguarded tap on a full-width button that clears the screen and
   * stamps the end time. Naming the gap is what makes the prompt worth
   * reading: "End anyway?" is ignorable, "12 of 18 sets" is not.
   */
  const tallySession = () => {
    let logged = 0
    let planned = 0
    for (const ex of selected?.exercises ?? []) {
      if (isTimedPrescription(ex.reps)) continue
      planned += ex.sets
      for (const row of setLogs[`${selectedDay}-${ex.name}`] ?? []) {
        if (row.logged) logged++
      }
    }
    return { logged, planned }
  }

  const finishWorkout = async () => {
    if (selectedDay === null) return
    const elapsed = workoutElapsed
    const workoutId = workoutIds[selectedDay]

    /* Tally the session before the logs are cleared.
       The counting rules live in sessionTotals and are pinned in
       verify-session-summary, because what counts is not obvious — an
       unticked row is a plan rather than a fact, and a bodyweight set is
       reps with no load.
       Intensity sets are left out of the totals, and not by preference:
       intensityLogs records a weight and whether it was reached, and never a
       rep count, so there is no honest number to add. */
    const countedRows = (selected?.exercises ?? []).flatMap(
      (ex) => setLogs[`${selectedDay}-${ex.name}`] ?? []
    )
    const totals = sessionTotals(countedRows)
    const doneSets = totals.sets
    const volume = totals.volume
    // Several lifts down on the same day is a recovery
    // signal, not a programming one, and it is visible in
    // data already collected — the app simply never looked
    // across exercises before.
    const todayTops: Record<string, { topWeight: number; topReps: number }> = {}
    for (const ex of selected?.exercises ?? []) {
      const key = `${selectedDay}-${ex.name}`
      const name = swappedExercises[key] ?? ex.name
      const rows = setLogs[key] ?? []
      let tw = 0, tr = 0
      for (const r of rows) {
        const w = Number(r.weight), rp = Number(r.reps)
        if (r.logged && !isNaN(w) && !isNaN(rp) && w > tw) { tw = w; tr = rp }
      }
      if (tw > 0) todayTops[name] = { topWeight: tw, topReps: tr }
    }
    const fatigue = sessionFatigue(todayTops, exHistory)

    // Did anything actually go up today?
    //
    // The most reinforcing thing the app can show, and the comparison was
    // already made on every exercise during the session — it just never
    // survived to the end of it.
    const improvements: string[] = []
    for (const ex of selected?.exercises ?? []) {
      const key = `${selectedDay}-${ex.name}`
      const name = swappedExercises[key] ?? ex.name
      const todayTop = todayTops[name]
      if (!todayTop) continue
      const prevSession = (exHistory[name] ?? [])[0]
      if (!prevSession || prevSession.topWeight <= 0) continue
      if (todayTop.topWeight > prevSession.topWeight) {
        improvements.push(`${name}: ${todayTop.topWeight} lb, up from ${prevSession.topWeight}`)
      } else if (todayTop.topWeight === prevSession.topWeight && todayTop.topReps > prevSession.topReps) {
        improvements.push(`${name}: ${todayTop.topReps} reps at ${todayTop.topWeight} lb, up from ${prevSession.topReps}`)
      }
    }

    /* What they train next, so the session closes with a loop rather than a
       full stop. The day just finished counts towards the rotation.
       Kept as an INDEX as well as a name, because Done now moves the week on
       to it — see the rotation advance further down. */
    const nextIndex = (() => {
      if (!selected || selectedDay === null) return -1
      for (let step = 1; step <= weeklyPlan.length; step++) {
        const i = (selectedDay + step) % weeklyPlan.length
        if (weeklyPlan[i].exercises.length > 0) return i
      }
      return -1
    })()
    const nextUp = nextIndex >= 0 ? weeklyPlan[nextIndex].name : null

    // Counted before the history reloads, so "first ever" means first before
    // this one rather than first including it.
    const finishedBefore = history.filter((w) => w.ended_at).length
    // Every training day in the rotation ticked off, this one included. The
    // plan's `completed` flags are set from logged sessions, so the day just
    // finished is the only one not yet reflected in them.
    const trainingDays = weeklyPlan.filter((d) => d.exercises.length > 0)
    const weekDone =
      trainingDays.length > 0 &&
      trainingDays.every((d) => d.completed || weeklyPlan.indexOf(d) === selectedDay)

    setWorkoutSummary({
      firstEver: finishedBefore === 0 && doneSets > 0,
      weekDone: weekDone && doneSets > 0,
      dayName: selected?.name ?? 'Session',
      seconds: elapsed,
      sets: doneSets,
      reps: totals.reps,
      volume: Math.round(volume),
      fatigue: fatigue.text,
      improvements,
      records: sessionRecordList,
      nextUp,
    })
    setSessionRecords([])

    /* Move the week on.
       The "Today — Upper / Start Upper" banner at the top of the program is
       driven by todayIndex, which is worked out from logged history when the
       program loads and was never recalculated after a session. So finishing
       Upper and going back to the week showed Upper again, with a filled
       button offering to do it a second time.
       Advanced locally rather than by re-reading the rotation: the write that
       would change the answer is the session just saved, and waiting on a
       round trip to find out what to train next is a spinner where a name
       should be. The next load recomputes it from the database as usual. */
    const finishedDay = selectedDay
    setWeeklyPlan((prev) => prev.map((d, i) => (i === finishedDay ? { ...d, completed: true } : d)))
    if (nextIndex >= 0) setTodayIndex(nextIndex)

    setWorkoutStartTime((prev) => {
      const next = { ...prev }
      delete next[selectedDay]
      return next
    })
    setWorkoutIds((prev) => {
      const next = { ...prev }
      delete next[selectedDay]
      return next
    })
    setWorkoutElapsed(0)
    stopRestTimer()

    // Clear this day's logged sets from the screen.
    //
    // Ending a session used to leave every set sitting
    // there fully filled in, so the screen still looked
    // live. A client who wanted to carry on pressed
    // Start again and re-entered work that was already
    // saved, and because saveSet scopes its "already
    // exists?" check to the workout id, every one of
    // those became a NEW row against the new session
    // rather than an update. That is how one workout
    // became two with the sets counted twice.
    const clearDay = <T,>(prev: Record<string, T>) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${selectedDay}-`)) delete next[key]
      }
      return next
    }
    setSetLogs(clearDay)
    // Intensity sets save through the same per-workout
    // path, so leaving them on screen duplicates too.
    setIntensityLogs(clearDay)

    if (workoutId) {
      try {
        await dbEndWorkout(workoutId, elapsed)
        if (userId) loadHistory(userId)
        // Clear the resume bar. Leaving it up after a finished session is the
        // same failure as not showing it during a live one, in reverse.
        refreshActive()
        /* Tell the coach, but only ever once, and only on the first one.
           The server decides whether this is their first — the client just
           says a session ended. Fire and forget: a notification must never
           be able to affect the workout somebody just finished. */
        fetch('/api/studio/first-workout-notify', { method: 'POST' }).catch(() => {})
      } catch (err) {
        console.error('[Workout] Failed to end:', err)
      }
    }
  }

  // Load exercise database
  useEffect(() => {
    fetch('/exercises/exercises.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: ExerciseDB[]) => setExerciseDB(normaliseLibraryImages(data)))
      .catch((err) => console.error('[ExerciseDB] Failed to load:', err))
  }, [])

  // Hydrate from Supabase: user id, PRs, swaps
  useEffect(() => {
    let active = true
    void getCurrentUserId().then((id) => {
    if (!active || !id) return
    setUserId(id)

    // Close any session left open from a previous day, then load history.
    dbAutoCloseStaleWorkouts(id).finally(() => loadHistory(id))

    dbFetchLastSets(id)
      .then(setLastSets)
      .catch((err) => console.error('[Last sets] Failed to load:', err))

    dbFetchExerciseHistory(id)
      .then(setExHistory)
      .catch((err) => console.error('[Exercise history] Failed to load:', err))

    dbFetchTimedHistory(id)
      .then(setTimedHistory)
      .catch((err) => console.error('[Timed history] Failed to load:', err))

    dbFetchPRs(id)
      .then((rows) => {
        const map: Record<string, PRRecord> = {}
        for (const row of rows) {
          map[row.exercise_name] = {
            weight: Number(row.weight),
            reps: row.reps,
            date: new Date(row.set_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            previous: row.previous_weight ? Number(row.previous_weight) : undefined,
          }
        }
        setDbPRs(map)
        // The same rows as a list, newest first. The map above answers "is
        // this a record" during a session; this answers "what have I done",
        // which is a different question and wants a different shape.
        setPrList(
          rows
            .slice()
            .sort((a, b) => +new Date(b.set_at) - +new Date(a.set_at))
            .slice(0, 6)
        )
      })
      .catch((err) => console.error('[PRs] Failed to load:', err))

    })
    return () => {
      active = false
    }
  }, [])

  /**
   * Restore swaps and any workout already in progress.
   *
   * Kept separate from the effect above because both need weeklyPlan to be
   * loaded: they locate the day by matching its name. Run on mount they saw an
   * empty plan, found nothing, and silently gave up — which is why a session
   * appeared to vanish when the app was closed and reopened. The sets were
   * always in the database; nothing was reading them back.
   */
  /* ── Where you are, written in the address bar ──────────────────────────
     This tab holds six screens and used to switch between them with a
     variable in memory, so the address never changed. The phone therefore
     thought all six were one page: the back gesture left the tab entirely
     rather than going back a screen, and a reload dropped you at the week.
     Both are fixed by telling the browser where you are and then listening
     to it, which is work it already knows how to do. */

  /** The place the address currently describes, so we only write on a change. */
  const placeRef = useRef<TrainPlace>(HOME_PLACE)
  /** Set while applying a back/forward, so we do not push what we just popped. */
  const poppingRef = useRef(false)
  const placeRestoredRef = useRef(false)
  /** Read by the popstate listener, which must not go stale between renders. */
  const guardRef = useRef({ dirty: false, view: 'preview' as typeof view })
  useEffect(() => {
    guardRef.current = { dirty: builderDirty, view }
  }, [builderDirty, view])
  /**
   * Let the next back through without asking.
   *
   * Set when the client has already answered the question. A ref rather than
   * state because `history.back()` fires popstate before React re-renders, so
   * anything held in state would still read as unanswered.
   */
  const bypassGuardRef = useRef(false)

  const applyPlace = useCallback(
    (p: TrainPlace) => {
      const dayOk = p.day !== null && Boolean(weeklyPlan[p.day]?.exercises.length)
      let v = p.view
      // Two screens cannot be drawn from an address alone: a day that is not
      // in this program any more, and the builder once its draft is gone (a
      // reload loses it, and restoring an empty builder shows a blank page).
      if ((v === 'workout' || v === 'exercise') && !dayOk) v = 'preview'
      if (v === 'builder' && !builderDraft) v = 'preview'
      setView(v)
      setSelectedDay(v === 'workout' || v === 'exercise' ? p.day : null)
      setSelectedExercise(v === 'exercise' ? p.exercise : null)
    },
    [weeklyPlan, builderDraft]
  )

  // Restore from the address once the week has loaded, then normalise it —
  // the dashboard's "Start Workout" link arrives as ?day=2, which means the
  // same thing as ?view=workout&day=2 and should read that way afterwards.
  useEffect(() => {
    if (placeRestoredRef.current || weeklyPlan.length === 0) return
    placeRestoredRef.current = true
    const p = queryToPlace(window.location.search)
    applyPlace(p)
    placeRef.current = p
    window.history.replaceState(null, '', window.location.pathname + placeToQuery(p))
  }, [weeklyPlan, applyPlace])

  // State changed → write it down. One effect rather than touching all 23
  // places that switch screen.
  useEffect(() => {
    if (!placeRestoredRef.current) return
    const place: TrainPlace = {
      view,
      day: selectedDay,
      exercise: selectedExercise,
    }
    const wasPop = poppingRef.current
    poppingRef.current = false
    if (samePlace(place, placeRef.current)) return
    placeRef.current = place
    // A back or forward already moved the address; pushing here would add a
    // second entry and make one back press take two.
    if (wasPop) return
    window.history.pushState(null, '', window.location.pathname + placeToQuery(place))
  }, [view, selectedDay, selectedExercise])

  // Back or forward → go where the address says.
  useEffect(() => {
    const onPop = () => {
      const next = queryToPlace(window.location.search)
      const bypassed = bypassGuardRef.current
      bypassGuardRef.current = false
      // Leaving a half-built program by the back gesture. The browser has
      // already moved, so put the entry back and ask before letting it go —
      // losing the work with no warning is the thing this change exists to
      // stop. On Discard we drop the draft and press back again for real,
      // rather than applying the destination by hand: the browser owns the
      // address, and faking the move here would leave it saying "builder"
      // on a screen showing the week.
      if (
        !bypassed &&
        guardRef.current.view === 'builder' &&
        guardRef.current.dirty &&
        next.view !== 'builder'
      ) {
        window.history.pushState(null, '', window.location.pathname + placeToQuery(placeRef.current))
        setLeaveGuard({
          discard: () => {
            dropBuilderDraft()
            bypassGuardRef.current = true
            window.history.back()
          },
        })
        return
      }
      poppingRef.current = true
      applyPlace(next)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [applyPlace])

  /** Forget the draft. Does not navigate — the caller decides where to go. */
  const dropBuilderDraft = useCallback(() => {
    setBuilderDraft(null)
    setBuilderOriginal(null)
    setBuilderEditingId(null)
    setBuilderDirty(false)
    setLeaveGuard(null)
  }, [])

  /**
   * The Back link above the builder.
   *
   * Goes back through the browser rather than setting the screen directly, so
   * it lands wherever they actually came from — the week, or the chooser —
   * and leaves no dead-end entry behind. Back should mean back.
   */
  const leaveBuilderBack = useCallback(() => {
    dropBuilderDraft()
    bypassGuardRef.current = true
    window.history.back()
  }, [dropBuilderDraft])

  /** Every way out of the builder goes through here. */
  const askBeforeLeavingBuilder = useCallback(
    (discard: () => void) => {
      if (builderDirty) setLeaveGuard({ discard })
      else discard()
    },
    [builderDirty]
  )

  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current || !userId || weeklyPlan.length === 0) return
    restoredRef.current = true
    const id = userId

    dbFetchSwaps(id)
      .then((rows) => {
        // Swaps are scoped per day in UI (key = `${dayIndex}-${exerciseName}`), but stored
        // globally per user. Apply the same swap to every day where that exercise appears.
        const map: Record<string, string> = {}
        weeklyPlan.forEach((day, dayIdx) => {
          for (const ex of day.exercises) {
            const match = rows.find((r) => r.original_exercise_name === ex.name)
            if (match) map[`${dayIdx}-${ex.name}`] = match.swapped_exercise_name
          }
        })
        setSwappedExercises(map)
      })
      .catch((err) => console.error('[Swaps] Failed to load:', err))

    // Only the latest row is needed: one weigh-in per client per day.
    fetchBodyMetrics(id, 1)
      .then((rows) => setWeighedToday(rows[0]?.recorded_on === localDate()))
      .catch(() => setWeighedToday(true))

    // Rehydrate an in-progress workout if one exists
    dbFetchInProgressWorkout(id)
      .then((data) => {
        // The dashboard's ?day= deep link used to be honoured here. It is now
        // read with every other part of the address by the restore effect
        // above, which also covers a reload from any of the six screens.
        if (!data) return
        const { workout, sets } = data

        /* Which day is this?
           It used to be `findIndex(d => d.name === workout.day_name)` and a
           bare `return` on -1 — no error, no log, nothing on screen, and the
           workout still open in the database. A client on a customised
           program only had to rename a day between starting and coming back.
           pickDay tries the name, then identifies the day by the exercises
           actually logged in the session, which survive a rename. */
        const dayIdx = pickDay(
          workout.day_name ?? '',
          weeklyPlan.map((d) => ({ name: d.name, exercises: d.exercises.map((e) => e.name) })),
          Array.from(new Set(sets.filter((s) => !s.is_intensity_set).map((s) => s.exercise_name)))
        )
        if (dayIdx === -1) {
          /* Genuinely unmatchable: the program it belongs to is gone. The
             session is NOT discarded — the resume bar in the layout is still
             showing it, with the day it was started as and a way to end it.
             Said out loud here because a silent -1 is what caused this. */
          console.warn(
            `[In-progress workout] "${workout.day_name}" matches no day in the current plan ` +
              `(${weeklyPlan.length} days, ${sets.length} sets logged). Left open for the resume bar.`
          )
          return
        }

        setWorkoutIds((prev) => ({ ...prev, [dayIdx]: workout.id }))
        setWorkoutStartTime((prev) => ({ ...prev, [dayIdx]: new Date(workout.started_at).getTime() }))

        // Group sets by exercise
        const workingByExercise: Record<string, SetRow[]> = {}
        const intensityByExercise: Record<string, { weight: string; done: boolean }[]> = {}
        const techniqueByExercise: Record<string, IntensityTechnique> = {}

        for (const set of sets) {
          const key = `${dayIdx}-${set.exercise_name}`
          if (set.is_intensity_set) {
            if (!intensityByExercise[key]) intensityByExercise[key] = [{ weight: '', done: false }, { weight: '', done: false }]
            const idx = set.set_number - 1
            if (idx >= 0 && idx < intensityByExercise[key].length) {
              intensityByExercise[key][idx] = {
                weight: set.weight !== null ? String(set.weight) : '',
                done: set.completed,
              }
            }
            if (set.intensity_technique) techniqueByExercise[key] = set.intensity_technique
          } else {
            if (!workingByExercise[key]) workingByExercise[key] = []
            // Grow array as needed
            while (workingByExercise[key].length < set.set_number) {
              workingByExercise[key].push(emptyRow())
            }
            workingByExercise[key][set.set_number - 1] = {
              weight: set.weight !== null ? String(set.weight) : '',
              reps: set.reps !== null ? String(set.reps) : '',
              // A row that came back from the database is something the client
              // did, not something being suggested to them.
              logged: set.completed,
            }
          }
        }

        setSetLogs(workingByExercise)
        setIntensityLogs(intensityByExercise)
        setIntensityChoice(techniqueByExercise)
        // Turn intensity on for every exercise that has intensity sets
        const onMap: Record<string, boolean> = {}
        for (const key of Object.keys(intensityByExercise)) onMap[key] = true
        setIntensityOn(onMap)

        // Jump to the in-progress workout view, landing on the first exercise
        // that still has sets left rather than back at the top.
        const day = weeklyPlan[dayIdx]
        const resumeAt = day.exercises.findIndex((ex) => {
          const rows = workingByExercise[`${dayIdx}-${ex.name}`] ?? []
          return rows.filter((r) => r.logged).length < ex.sets
        })
        setFocusIndex(resumeAt === -1 ? 0 : resumeAt)
        setSelectedDay(dayIdx)
        setView('workout')
      })
      .catch((err) => console.error('[In-progress workout] Failed to load:', err))
  }, [userId, weeklyPlan])

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

  /* The exercise thumbnails used to flip between the start and end position
     every 2.5 seconds, on one interval that ran for as long as the tab was
     open, on every screen, whether or not a thumbnail was visible.
     Two reasons it is gone. It costs battery on a page somebody has open for
     an hour with the screen held awake — which is what this page does. And
     movement in the corner of the eye during a working set is the cheapest
     possible way to spend somebody's attention: the demo is a tap away in
     the header for anyone who actually wants to see the movement.
     The thumbnail now shows the start position and holds still. The separate
     start/end toggle on the exercise DETAIL page is untouched — there, the
     movement is the point and the client went looking for it. */

  /**
   * Push held sets whenever the connection looks alive again.
   *
   * `online` covers the obvious case; the interval covers the one that
   * actually happens in a gym, where the phone still claims to be online over
   * a single bar and requests simply time out.
   */
  useEffect(() => {
    setPendingSets(queueSize())
    const flush = async () => {
      if (queueSize() === 0) return
      const { remaining } = await flushQueue((p) => dbSaveSet(p as Parameters<typeof dbSaveSet>[0]))
      setPendingSets(remaining)
    }
    window.addEventListener('online', flush)
    const id = setInterval(flush, 20000)
    return () => {
      window.removeEventListener('online', flush)
      clearInterval(id)
    }
  }, [])

  // Tick elapsed time while a workout is active
  const activeWorkoutStartedAt = selectedDay !== null ? workoutStartTime[selectedDay] ?? null : null

  /**
   * Hold the screen awake for the length of the session.
   *
   * Re-acquired on visibility change because the browser silently drops the
   * lock whenever the tab is hidden — a trip to the Food tab and back would
   * otherwise leave the phone sleeping between sets again.
   */
  useEffect(() => {
    if (!activeWorkoutStartedAt) return
    void acquireWakeLock()
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !hasWakeLock()) void acquireWakeLock()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void releaseWakeLock()
    }
  }, [activeWorkoutStartedAt])
  useEffect(() => {
    if (!activeWorkoutStartedAt) return
    const tick = () => setWorkoutElapsed(Math.floor((Date.now() - activeWorkoutStartedAt) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [activeWorkoutStartedAt])

  const selectedExerciseData = selected?.exercises.find((e) => e.name === selectedExercise) ?? null
  const selectedExerciseDB = selectedExercise ? matchedExercises.get(selectedExercise) ?? null : null

  // Nothing is rendered until we know what this client's program actually is.
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
      </div>
    )
  }

  /* A failed write, on screen rather than in the console. Rendered in every
     branch that can produce one, which is both places the builder appears
     plus the main view that owns the swap sheet. */
  const errorBanner = writeError ? (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-control bg-state-danger/[0.10] border border-state-danger/30 px-4 py-3"
    >
      <span className="text-state-danger text-body font-body leading-relaxed flex-1">{writeError}</span>
      <button
        onClick={() => setWriteError(null)}
        aria-label="Dismiss"
        className="text-state-danger/70 hover:text-state-danger text-label font-display font-bold shrink-0 mt-0.5"
      >
        ✕
      </button>
    </div>
  ) : null

  /* Asked once, only when there is something to lose.
     Two options, no third. "Keep editing" is the safe one, so it gets the
     filled button under the thumb; discarding is deliberately the quieter of
     the two, because that tap cannot be undone. */
  const unsavedSheet = leaveGuard ? (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-center">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={() => setLeaveGuard(null)}
        aria-hidden="true"
      />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="relative w-full sm:max-w-sm bg-surface-raised border-t sm:border border-white/[0.12] sm:rounded-card rounded-t-card px-5 pt-5 pb-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        role="dialog"
        aria-modal="true"
        aria-label="Unsaved changes"
      >
        <h2 className="font-display font-extrabold text-xl text-white tracking-tight">
          You have unsaved changes
        </h2>
        <p className="text-ink-2 text-body font-body mt-1.5 leading-relaxed">
          Leave now and this program goes back to how it was.
        </p>
        <button
          onClick={() => setLeaveGuard(null)}
          className="w-full mt-5 py-3.5 rounded-control bg-brand-orange text-white text-label font-display font-bold uppercase tracking-[0.12em] hover:bg-brand-orangedark active:scale-[0.98] transition-all duration-200"
        >
          Keep editing
        </button>
        <button
          onClick={() => leaveGuard.discard()}
          className="w-full mt-2 py-3 rounded-control text-ink-3 hover:text-white text-body font-body transition-colors duration-200"
        >
          Discard changes
        </button>
      </motion.div>
    </div>
  ) : null

  /* The builder, for a client who has no program to anchor it to.
     Four of thirteen users had no route to it at all: both screens below
     return before `view` is consulted, so the fork living inside the main
     layout was unreachable for anyone without a program.
     It has to cover the whole flow, not just the fork. The first version
     matched only view === 'startFrom', so the moment one of those clients
     picked a door and `view` became 'builder' they fell straight back
     through to the picker — the builder was unreachable one click in. */
  if ((showPicker || !hasAssigned) && (view === 'startFrom' || view === 'builder')) {
    return (
      <div className="py-8">
        {errorBanner}
        <AnimatePresence>{unsavedSheet}</AnimatePresence>
        {view === 'builder' && builderDraft ? (
          <ProgramBuilder
            initial={builderDraft}
            library={exerciseDB}
            saving={builderSaving}
            editing={Boolean(builderEditingId)}
            /* Always activates: this is the builder reached from the picker,
               by someone who has no program yet. Saving without starting is a
               choice that only makes sense when you already have one to keep
               training, so the button says what will happen instead of
               offering a second one that did the same thing. */
            onSave={(program) => void handleBuilderSave(program, true)}
            saveLabel="Start training"
            onRequestExercise={requestExercise}
            onDirtyChange={setBuilderDirty}
            onCancel={() =>
              askBeforeLeavingBuilder(() => {
                setBuilderDraft(null)
                setBuilderDirty(false)
                setLeaveGuard(null)
                void openStartFrom()
              })
            }
          />
        ) : (
          <StartFrom
            followingId={null}
            followingName={null}
            atLimit={myPrograms.length >= MAX_CUSTOM_PROGRAMS}
            savedCount={myPrograms.length}
            loadLibrary={fetchLibraryPrograms}
            onCopy={(id) => openBuilder(id, null)}
            onScratch={openBlankBuilder}
            onPickReadyMade={showPicker ? () => setView('preview') : undefined}
            onMyPrograms={openMyPrograms}
            onCancel={() => setView('preview')}
          />
        )}
      </div>
    )
  }

  // Blueprint member with no program yet → pick-your-program flow.
  if (showPicker) {
    return (
      <div className="py-8">
        {/* The way out lives inside the picker now. It used to be grey text
            under the card, which on a phone sits below four splits' worth of
            options — out of sight at the moment someone decides none of them
            fits. Same route, somewhere it can actually be seen. */}
        <BlueprintPicker
          onDone={handlePickerDone}
          beginner={isBeginnerFlow}
          onBuildOwn={() => { setBuilderMoved(null); void openStartFrom() }}
        />
      </div>
    )
  }

  // Loaded, but this client has no program and is not in the picker flow —
  // a coached client waiting on Anthony to assign one. Previously this fell
  // through to the placeholder and showed a program that did not exist.
  if (!hasAssigned) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
        <EmptyState
          title="No program assigned yet"
          line="Coach Anthony is putting yours together. He'll message you when it's ready."
          actionLabel="Message Anthony"
          actionHref="/studio/messages"
        />
        {/* Waiting is not the only option. Two coached clients have sat on
            this screen with no program — one of them for 168 days. */}
        <button
          onClick={() => { setBuilderMoved(null); void openStartFrom() }}
          className="text-ink-3 hover:text-ink-2 text-label font-display font-bold uppercase tracking-wide transition-colors duration-200"
        >
          Or build your own in the meantime
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {errorBanner && <div className="lg:col-span-12">{errorBanner}</div>}
      <AnimatePresence>{unsavedSheet}</AnimatePresence>
      <AnimatePresence>
        {prCelebration && (
          <PRCelebration
            name={prCelebration.name}
            weight={prCelebration.weight}
            onDone={() => setPrCelebration(null)}
          />
        )}
      </AnimatePresence>
      {/* Pinned session bar.
          The clock, the rest countdown and End lived at the bottom of a list
          of six exercises — so during a 90-second rest the client either
          scrolled to find the timer or did without it. This sits above the
          bottom nav wherever they have scrolled to.

          "Above the bottom nav" was not what 76px bought. It cleared the tab
          bar's CONTENT and nothing else: the nav is `bottom-0` plus
          `pb-[env(safe-area-inset-bottom)]`, so on any phone with a home
          indicator it stands about 98px tall. This sat at 76px, behind it,
          with the same z-index and earlier in the DOM. Roughly 22px went
          under the nav — the bottom edge of +30s and Skip, the two controls
          the bar exists for.

          The breakpoint was wrong too. The nav is `md:hidden`, so between
          640px and 768px `sm:bottom-4` put this behind a nav still on
          screen. */}
      {view === 'workout' && selectedDay !== null && (workoutStartTime[selectedDay] || activeTimer) && (
        <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-4 left-0 right-0 z-50 px-4 pointer-events-none">
          <div className="mx-auto max-w-lg pointer-events-auto flex items-center gap-2 rounded-card bg-surface-overlay/95 backdrop-blur border border-white/[0.12] shadow-[0_8px_30px_rgba(0,0,0,0.5)] px-3 py-2.5">
            {activeTimer ? (
              <>
                {/* 36px ring, 18px digits. You cannot read that from a rack
                    with the phone on the floor, which is where it is during
                    the rest it is timing. */}
                <div className="relative w-12 h-12 shrink-0">
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
                    <circle
                      cx="18" cy="18" r="15" fill="none"
                      stroke="#1A7BFF"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeDasharray={`${(activeTimer.remaining / activeTimer.total) * 94.25} 94.25`}
                      className="transition-[stroke-dasharray] duration-500 ease-linear"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-brand-blueink text-caption font-display font-bold uppercase tracking-wide">Rest</p>
                  <p className="text-white font-display font-bold text-metric leading-none tabular-nums">
                    {Math.floor(activeTimer.remaining / 60)}:{(activeTimer.remaining % 60).toString().padStart(2, '0')}
                  </p>
                  {/* What the rest is FOR. Without it the bar is a number,
                      and knowing the number is not the same as being able to
                      put the phone down — which is the only reason to have a
                      rest timer in an app rather than on a clock. */}
                  {activeTimer.next && (
                    <p className="text-ink-3 text-caption font-body truncate mt-0.5">
                      <span className="text-ink-4">Next </span>
                      {activeTimer.next.name}
                      <span className="text-ink-4"> &middot; {activeTimer.next.set}</span>
                    </p>
                  )}
                </div>
                {/* Another thirty seconds, where the countdown already is.
                    The only way to rest longer used to be the per-exercise
                    rest setting, which is the wrong depth for a thirty-second
                    decision — so people opened their phone's own timer, and
                    once they have done that they are in another app.
                    48px, because this is tapped between heavy sets with
                    shaking hands — the taplg step, not the ordinary one. */}
                <button
                  onClick={() => addRestTime(30)}
                  className="shrink-0 h-taplg px-base rounded-control bg-white/[0.08] text-ink-2 text-caption font-display font-bold uppercase tracking-wide hover:text-white active:scale-95 transition-all duration-150"
                  aria-label="Add thirty seconds to this rest"
                >
                  +30s
                </button>
                <button
                  onClick={stopRestTimer}
                  className="shrink-0 h-taplg px-base rounded-control bg-white/[0.08] text-ink-2 text-caption font-display font-bold uppercase tracking-wide hover:text-white active:scale-95 transition-all duration-150"
                >
                  Skip
                </button>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2 shrink-0 ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-state-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-state-success" />
                </span>
                <div className="min-w-0">
                  <p className="text-ink-3 text-caption font-display font-bold uppercase tracking-wide">Training</p>
                  <p className="text-white font-display font-bold text-lg leading-none tabular-nums">
                    {Math.floor(workoutElapsed / 3600) > 0 && `${Math.floor(workoutElapsed / 3600)}:`}
                    {Math.floor((workoutElapsed % 3600) / 60).toString().padStart(2, '0')}:
                    {(workoutElapsed % 60).toString().padStart(2, '0')}
                  </p>
                </div>
                {pendingSets > 0 && (
                  <span className="ml-2 px-2 py-1 rounded-control bg-state-warning/15 text-state-warning text-caption font-body shrink-0">
                    {pendingSets} syncing
                  </span>
                )}
                <button
                  onClick={() => setConfirmEnd(tallySession())}
                  className="ml-auto px-4 py-2 rounded-control bg-white/[0.08] text-ink-2 text-caption font-display font-bold uppercase tracking-wide hover:bg-white/[0.12] hover:text-white active:scale-95 transition-all duration-150"
                >
                  End
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {swapFor && selected && (
          <SwapSheet
            exerciseName={swapFor}
            current={swappedExercises[`${selectedDay}-${swapFor}`] ?? swapFor}
            alternatives={getAlternatives(swapFor)}
            /* The whole library, and the exercise being replaced so the
               search can open on its muscle group and rank by it. */
            library={exerciseDB}
            source={findExerciseMatch(swapFor, exerciseDB)}
            isSwapped={Boolean(swappedExercises[`${selectedDay}-${swapFor}`])}
            onClose={() => setSwapFor(null)}
            onReset={() => {
              const key = `${selectedDay}-${swapFor}`
              setSwappedExercises((prev) => {
                const next = { ...prev }
                delete next[key]
                return next
              })
              if (userId) dbRemoveSwap(userId, swapFor).catch((err) => console.error('[Swap remove] Failed:', err))
              setSwapFor(null)
            }}
            onPick={(alt, forever, reason) => {
              setKeptSwaps(null)
              setSwappedExercises((prev) => ({ ...prev, [`${selectedDay}-${swapFor}`]: alt }))
              // A permanent swap is stored to be reapplied. A "just today"
              // swap is ALSO stored when the reason was pain, because that is
              // a coaching signal rather than a preference and it is the one
              // thing here the coach must not miss — but it is written with
              // session_only set, so the coach sees it and the client's
              // program is not quietly rewritten by it.
              if ((forever || reason === 'hurts') && userId) {
                dbSaveSwap(userId, swapFor, alt, reason, !forever).catch((err) => {
                  console.error('[Swap save] Failed:', err)
                  // Only worth saying when they asked for it to last. A
                  // failed one-session swap still holds for this session,
                  // which is all it promised.
                  if (forever) {
                    setWriteError(
                      `Could not save ${alt} as a permanent change. It is swapped for this session only — try again from the swap menu.`
                    )
                  }
                })
              }
              setSwapFor(null)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {demoFor && (
          <DemoSheet
            name={demoFor}
            data={matchedExercises.get(demoFor) ?? null}
            onClose={() => setDemoFor(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmEnd && (
          <ConfirmEnd
            logged={confirmEnd.logged}
            planned={confirmEnd.planned}
            onCancel={() => setConfirmEnd(null)}
            onConfirm={async () => {
              setConfirmEnd(null)
              await finishWorkout()
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {workoutSummary && (
          <WorkoutComplete
            summary={workoutSummary}
            pendingSets={pendingSets}
            askWeight={!weighedToday}
            onWeigh={async (lb) => {
              if (!userId) return
              await saveBodyMetric(userId, { weight_lb: lb })
              setWeighedToday(true)
            }}
            /* Done goes back to the week, not back to the session.
               It used to only clear the summary, which left the client
               standing on the day they had just finished — its set rows now
               emptied, its Start button offering to do it again. A finished
               session should end somewhere that points forward, and the week
               view is where the next day is, marked. */
            onDone={() => {
              setWorkoutSummary(null)
              setSelectedDay(null)
              setView('preview')
              // Instant rather than smooth: the modal has just closed and a
              // long smooth scroll from the bottom of a workout reads as lag.
              window.scrollTo({ top: 0, behavior: 'auto' })
            }}
          />
        )}
        {blockReview && !reviewDismissed && (
          <BlockComplete
            review={blockReview}
            onPickNew={() => {
              setReviewDismissed(true)
              setShowPicker(true)
            }}
            onKeepGoing={() => setReviewDismissed(true)}
          />
        )}
      </AnimatePresence>
      {/* MAIN CONTENT */}
      <div className="lg:col-span-8">
        {/* Program Header */}
        <div className="bg-surface-raised rounded-card border border-white/[0.10] p-6 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-extrabold text-xl text-white tracking-tight">
                  {currentProgram.name}
                </h1>
                <span className="text-caption font-display font-bold px-2 py-0.5 rounded bg-white/10 text-ink-2">
                  {currentProgram.level}
                </span>
              </div>
              <p className="text-ink-3 text-body font-body mt-1 max-w-md">
                Your program. Train and log against it. Swap any exercise you can&rsquo;t do.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* "Edit my program" used to sit here too, beside the badge.
                  Two identical front doors, one of them in the middle of the
                  training flow. Changing the program now lives in one place:
                  the CHANGING MY PROGRAM section at the bottom of this screen.
                  Nothing was removed, it stopped being in two places. */}
              <span className="text-caption font-display font-bold px-2.5 py-1 rounded bg-brand-orange/15 text-brand-orange uppercase tracking-wide">
                Self-Guided
              </span>
            </div>
          </div>
        </div>

        {/* Where you are in the block.
            A program used to have no length, so it had no end and no week
            number — clients sat on one template for weeks without ever being
            told how far through they were or that there was a finish line. */}
        {block && !block.completed_at && (() => {
          const prog = blockProgress(block.assigned_at, block.block_weeks)
          return (
            <div className="bg-surface-raised rounded-card border border-white/[0.10] p-5 mb-4">
              {/* An orange eyebrow, and the two cards below it carry a blue one.
                  Three cards stacked with the same border, the same padding and
                  the same grey label read as one undifferentiated block — a
                  client scanning this screen could not tell which of them was
                  telling them where they are and which was telling them what to
                  do. Colour does that work before any of the words are read:
                  orange is progress, blue is instruction, green is live. The bar
                  below was already orange, so this names what it belongs to
                  rather than introducing a new colour. */}
              <p className="text-brand-orange text-caption font-display font-bold uppercase tracking-[0.18em]">
                Block progress
              </p>
              <div className="flex items-baseline justify-between mb-2.5 mt-1.5">
                <p className="font-display font-bold text-white text-label">
                  Week {prog.week} of {prog.totalWeeks}
                </p>
                <p className="text-ink-3 text-caption font-body">
                  {prog.isFinalWeek
                    ? 'Final week — results at the end'
                    : `${prog.daysLeft} days to go`}
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-orange transition-[width] duration-500"
                  style={{ width: `${Math.round(prog.fraction * 100)}%` }}
                />
              </div>
            </div>
          )
        })()}

        {/* How to progress. The library prescribes sets and reps but never said
            how this week should differ from last week, which is the difference
            between a program and a list of workouts. */}
        {(() => {
          const p = PROGRESSION[(programGoal ?? 'muscle') as ProgressionGoal]
          /* Blue, because these two are the only coaching on the screen.
             They were the same grey as every other label in the product,
             which made the one piece of guidance here look like metadata —
             and a client who reads it as metadata never reads it. Blue is
             already what this app uses for "the app is telling you
             something": the Today eyebrow, the primary button, the active
             exercise border. #1A7BFF on #1C1C1C reads at 5.2:1, which clears
             AA for this size. */
          const item = (label: string, body: string) => (
            <div>
              <p className="text-brand-blueink text-caption font-display font-bold uppercase tracking-[0.15em]">{label}</p>
              <p className="text-ink-2 text-label font-body mt-1 leading-relaxed">{body}</p>
            </div>
          )
          return (
            <div className="bg-surface-raised rounded-card border border-white/[0.10] p-5 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {item('How to progress', p.rule)}
              {item('How hard to push', p.effort)}
            </div>
          )
        })()}

        {/* View Content */}
        <AnimatePresence mode="wait">
          {/* ════════ VIEW 1: PROGRAM PREVIEW ════════ */}
          {view === 'preview' && (
            <motion.div key="preview" {...slideBack}>
              {/* TODAY.
                  The Train tab used to land on a brochure: two sub-tabs called
                  Overview and Program, neither of which is where anybody wants
                  to be. They want the day. It is now the first thing on the
                  screen and the only filled button. */}
              {todayIndex >= 0 && weeklyPlan[todayIndex] && weeklyPlan[todayIndex].exercises.length > 0 && (
                <div className="bg-surface-raised rounded-card border border-brand-blue/30 p-6 mb-4">
                  {/* "Today" is wrong thirty seconds after they finished
                      today's session, which is now exactly where Done lands
                      them. Once something is logged for today, the same
                      banner is the NEXT one — so it says so, and the button
                      below it stops reading as a second helping. */}
                  <p className="text-brand-blueink text-caption font-display font-bold uppercase tracking-[0.18em]">
                    {trainedToday ? 'Next up' : 'Today'}
                  </p>
                  <p className="font-display font-extrabold text-2xl text-white mt-1.5 leading-tight">
                    {weeklyPlan[todayIndex].name}
                  </p>
                  <p className="text-ink-2 text-body font-body mt-1.5">
                    {weeklyPlan[todayIndex].muscles}
                    <span className="text-ink-3">
                      {' · '}
                      {weeklyPlan[todayIndex].exercises.length} exercises
                      {weeklyPlan[todayIndex].duration ? ` · ${weeklyPlan[todayIndex].duration}` : ''}
                    </span>
                  </p>
                  {/* What is in it, without leaving the page.
                      Opening the day already showed this, and that is a
                      navigation away from the week for a question — "what am
                      I actually in for" — that is usually asked in passing,
                      often the evening before. Collapsed by default so the
                      page keeps its shape for anybody not asking it.
                      Names only, with the prescription. No thumbnails: this
                      is a glance, and eight images is a different screen. */}
                  <button
                    onClick={() => setPeek((v) => !v)}
                    aria-expanded={peek}
                    className="w-full mt-4 min-h-tap flex items-center gap-2 text-ink-3 text-label font-body hover:text-ink-2 transition-colors duration-200"
                  >
                    <span>{peek ? 'Hide exercises' : "What's in it"}</span>
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${peek ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                    </svg>
                  </button>

                  <AnimatePresence initial={false}>
                    {peek && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        {weeklyPlan[todayIndex].exercises.map((ex, i) => {
                          // The substitute, where they have one — otherwise the
                          // card would promise a movement the session replaces.
                          const shown = swappedExercises[`${todayIndex}-${ex.name}`] ?? ex.name
                          return (
                            <li
                              key={`${ex.name}-${i}`}
                              className="flex items-baseline justify-between gap-3 py-2 border-b border-white/[0.06] last:border-b-0"
                            >
                              <span className="text-ink text-label font-body min-w-0">{shown}</span>
                              <span className="text-ink-4 text-caption font-body tabular-nums shrink-0">
                                {ex.sets} &times; {ex.reps}
                              </span>
                            </li>
                          )
                        })}
                      </motion.ul>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={() => { setSelectedDay(todayIndex); setView('workout') }}
                    className="w-full mt-5 py-4 bg-brand-blue text-white text-base font-display font-bold uppercase tracking-[0.1em] rounded-control hover:bg-brand-bluedark active:scale-[0.98] transition-transform duration-200"
                  >
                    Start {weeklyPlan[todayIndex].name}
                  </button>
                </div>
              )}

              {/* THE WEEK.
                  One list, not two. Overview and Program were two versions of
                  the same week — a plain list with stat tiles above it, and
                  this one with thumbnails and rest days. This is the better
                  one, so it is the only one. */}
              {/* ─── USING MY PROGRAM ───
                  Everything above this line and down to the end of the week is
                  read-and-tap: what the program is, where you are in it, and
                  which session is next. Nothing here changes the plan.
                  Changing it is a separate section at the bottom, under its
                  own rule, because a client opening this screen to train
                  should never be one mis-tap from rebuilding their week. */}
              <p className="text-ink-4 text-caption font-display font-bold uppercase tracking-[0.18em] mb-2">
                Using my program
              </p>
              <div className="bg-surface-raised rounded-card border border-white/[0.10] overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.10] flex items-center justify-between">
                  <h2 className="font-display font-bold text-white text-heading">Your week</h2>
                  <span className="text-ink-4 text-caption font-display font-bold uppercase tracking-wide">
                    {weeklyPlan.filter((d) => d.completed).length} of{' '}
                    {weeklyPlan.filter((d) => d.exercises.length > 0).length} done
                  </span>
                </div>
                <div className="p-4">
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
                            className={`w-full flex items-center gap-4 p-3 rounded-card text-left group ${
                              isRest
                                ? 'bg-surface-overlay border border-white/[0.06] cursor-default'
                                : workoutStartTime[i]
                                  // The row carries the green too, not just the
                                  // badge. A badge is read after the row has
                                  // been found; a border is what finds it.
                                  ? 'bg-[#222] border border-state-success/40 cursor-pointer'
                                  : 'bg-[#222] border border-white/[0.10] hover:bg-[#222] hover:border-white/[0.12] cursor-pointer'
                            }`}
                          >
                            {/* Thumbnail or rest icon */}
                            {isRest ? (
                              <div className="w-14 h-14 rounded-control bg-white/[0.04] flex items-center justify-center shrink-0">
                                <svg className="w-6 h-6 text-ink-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                                </svg>
                              </div>
                            ) : (
                              <div className="relative w-14 h-14 rounded-control overflow-hidden bg-[#0A0A0A] shrink-0">
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
                              <div className="flex items-center gap-1.5">
                                <p className={`font-display font-bold text-label ${isRest ? 'text-ink-4' : 'text-white group-hover:text-brand-blueink'} transition-colors duration-200`}>
                                  {day.name}
                                </p>
                                {/* GREEN MEANS LIVE RIGHT NOW.
                                    A session left open had no mark anywhere on
                                    this list. The week showed a blue "Today"
                                    and a green tick for done, and a day with
                                    a workout actually running looked exactly
                                    like a day that had not been started — so
                                    the way back into it was to guess. Two of
                                    fifteen clients in production have had a
                                    session sitting open for over a week.
                                    It takes precedence over "Today", because
                                    which day it is matters less than the fact
                                    that one of them is mid-set.

                                    AND IT IGNORES `completed`, WHICH IS THE
                                    WHOLE POINT. The first version read
                                    `&& !day.completed`, which looks like
                                    sensible tidiness and silently switched the
                                    badge off for the only shape of session
                                    that actually goes stale: sets logged, Done
                                    never pressed. A day counts as completed the
                                    moment anything is logged against it, so
                                    both of the week-old open sessions in
                                    production are marked done AND still
                                    running. That is exactly the client this
                                    indicator exists for, and the first version
                                    showed them nothing. Caught by looking at
                                    the real screen, not by reading the code —
                                    the logic reads fine. */}
                                {!isRest && Boolean(workoutStartTime[i]) ? (
                                  <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-state-success/15 text-state-success text-badge font-display font-bold uppercase tracking-wide shrink-0">
                                    <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-state-success opacity-75" />
                                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-state-success" />
                                    </span>
                                    In progress
                                  </span>
                                ) : i === todayIndex ? (
                                  <span className="px-1.5 py-0.5 rounded bg-brand-blue/15 text-brand-blueink text-badge font-display font-bold uppercase tracking-wide shrink-0">
                                    Today
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-ink-4 text-label font-body">
                                Day {i + 1}{day.duration ? ` \u2022 ${day.duration}` : ''}
                              </p>
                            </div>

                            {/* Status.
                                The tick inside the green circle is dark, not
                                white. White on #22C55E measures 2.28:1 — under
                                even the 3:1 WCAG asks of a graphic that
                                carries meaning, and this tick is the only
                                thing on the row saying the day is done. The
                                near-black reads at 8.29:1 against the same
                                green, which is the pattern the gold PR bar
                                already uses. Caught by
                                tools/verify-contrast.ts, not by eye: on a
                                bright screen a white tick looks crisp.

                                A running session outranks the tick. A day is
                                marked completed as soon as anything is logged
                                against it, so a session that was logged and
                                never ended is BOTH — and a green tick reading
                                "done" on a workout that is still running is
                                the app telling the client the opposite of what
                                they need to know. The live dot takes the slot
                                while the session is open and the tick comes
                                back when they press Done. */}
                            {!isRest && workoutStartTime[i] ? (
                              <span className="relative flex h-2.5 w-2.5 shrink-0 mr-1.5" aria-label="Session still running">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-state-success opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-state-success" />
                              </span>
                            ) : day.completed ? (
                              <div className="w-7 h-7 rounded-full bg-state-success flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4 text-surface-base" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              </div>
                            ) : !isRest ? (
                              <svg className="w-5 h-5 text-ink-4 group-hover:text-ink-3 shrink-0 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                              </svg>
                            ) : null}
                          </motion.button>
                        )
                      })}
                    </div>
                </div>
              </div>

              {/* ─── CHANGING MY PROGRAM ───
                  Everything that rewrites the plan, in one place, below the
                  week rather than beside it. Swapping a single exercise is
                  deliberately NOT here: that happens mid-session, from the
                  exercise itself, because a rack being taken is a thing you
                  discover while training. Everything else is a decision you
                  make sitting down. */}
              <p className="text-ink-4 text-caption font-display font-bold uppercase tracking-[0.18em] mt-8 mb-2">
                Changing my program
              </p>

              {/* Travelling, or back from it. Renders nothing unless this exact
                  program has a twin at the other location, so a custom build
                  never shows a button that cannot work. It used to sit up by
                  the program name, which made it look like part of the
                  heading rather than a change you were making. */}
              <TravelSwitch programId={assignedProgramId} onSwitched={() => window.location.reload()} />

              <div className="bg-surface-raised rounded-card border border-white/[0.10] p-5">
                {[
                  { label: 'Program', value: currentProgram.name },
                  { label: 'Type', value: programSource === 'custom' ? 'Built by you' : 'Sample routine' },
                  { label: 'Level', value: currentProgram.level },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4 py-2.5 border-b border-white/[0.06] last:border-0">
                    <span className="text-ink-2 text-body font-body shrink-0">{item.label}</span>
                    <span className="text-white font-body font-semibold text-label text-right">{item.value}</span>
                  </div>
                ))}

                {/* "My programs" sat three levels down — Train, then Change
                    Program, then My programs — so the thing you made and will
                    want again next week was the deepest item in the app. It is
                    one tap from here now. */}
                {/* Which days you train is a property of the plan, not a
                    conversation with your coach — but the only way to set it
                    was /studio/schedule, which lives under Coach. It decides
                    whether Today says "rest day" or offers a session, so a
                    client who never found it got offered a session every day
                    of their life. */}
                <Link
                  href="/studio/schedule"
                  className="flex items-center justify-between gap-4 py-2.5 border-b border-white/[0.06] group"
                >
                  <span className="text-ink-2 text-body font-body shrink-0">Which days I train</span>
                  <span className="text-ink-3 group-hover:text-white text-lg leading-none transition-colors duration-200" aria-hidden="true">
                    &rsaquo;
                  </span>
                </Link>

                {assignedProgramId && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => { setBuilderMoved(null); void openStartFrom() }}
                      className="flex-1 py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-ink-2 text-label font-display font-bold uppercase tracking-wide hover:text-white hover:border-white/[0.16] transition-colors duration-200"
                    >
                      Edit my program
                    </button>
                    <button
                      onClick={openMyPrograms}
                      className="flex-1 py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-ink-2 text-label font-display font-bold uppercase tracking-wide hover:text-white hover:border-white/[0.16] transition-colors duration-200"
                    >
                      My programs
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ════════ VIEW 2: WORKOUT OVERVIEW ════════ */}
          {view === 'workout' && selected && (
            /* Room at the foot for the pinned session bar, which would
               otherwise sit on top of the last exercise. */
            <motion.div key="workout" {...slideIn} className={selectedDay !== null && workoutStartTime[selectedDay] ? 'pb-24' : ''}>
              <div className="bg-surface-raised rounded-card border border-white/[0.10] overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/[0.10]">
                  <button
                    onClick={() => { setView('preview'); setSelectedDay(null) }}
                    className="flex items-center gap-2 text-ink-3 hover:text-ink-2 transition-colors duration-200 mb-3"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                    <span className="text-label font-display font-semibold uppercase tracking-wide">Back to Program</span>
                  </button>
                  <h2 className="font-display font-bold text-lg text-white">Workout Overview</h2>
                  <p className="text-ink-3 text-label font-body mt-0.5">{selected.muscles}</p>
                </div>

                {/* Keep what you changed.
                    Swapping is how people actually customise a day, and until
                    now a swap could never become part of the program — so the
                    work of rebuilding a day had nowhere to live and looked
                    lost the next morning. Shown only when there is something
                    to keep. */}
                {activeSwapCount > 0 && (
                  <div className="mx-4 mt-4 rounded-control bg-brand-blue/[0.08] border border-brand-blue/25 px-4 py-3.5">
                    <p className="text-white text-label font-display font-bold">
                      You&rsquo;ve changed {activeSwapCount}{' '}
                      {activeSwapCount === 1 ? 'exercise' : 'exercises'}
                    </p>
                    <p className="text-ink-2 text-label font-body mt-1 leading-relaxed">
                      Save them into your own program and this is what you&rsquo;ll train next
                      week too. You keep your place in the block and everything you&rsquo;ve
                      logged.
                    </p>
                    <button
                      onClick={() => void keepSwapsInProgram()}
                      disabled={keepingSwaps}
                      className="mt-3 px-3.5 py-2 rounded-control bg-brand-blue text-white text-caption font-display font-bold uppercase tracking-wide hover:bg-brand-blue/85 disabled:opacity-40 active:scale-[0.98] transition-all duration-200"
                    >
                      {keepingSwaps ? 'Saving…' : 'Keep these changes'}
                    </button>
                  </div>
                )}

                {keptSwaps !== null && (
                  <div className="mx-4 mt-4 rounded-control bg-state-success/[0.08] border border-state-success/25 px-4 py-3">
                    <p className="text-state-success text-label font-body leading-relaxed">
                      Saved to your program &mdash; {keptSwaps}{' '}
                      {keptSwaps === 1 ? 'exercise' : 'exercises'} changed for good. Find it
                      any time under My programs.
                    </p>
                  </div>
                )}

                {/* Series-grouped exercises.
                    While a session is running this collapses to the ONE
                    exercise the client is on. Browsing a program and executing
                    one are different jobs that were sharing a screen: the
                    execution screen carried the browse furniture (thumbnails,
                    series headers, every other exercise) and none of the
                    execution furniture (where am I, what is left, what next). */}
                {/* Where am I, and how much is left.
                    The accordion let any exercise be opened at any time, which
                    was fine, but nothing ever said "3 of 6" — after one long
                    expanded card the client had lost their place in the list. */}
                {sessionActive && selected && (
                  <div className="px-4 pt-4">
                    <div className="flex items-center gap-1.5">
                      {exerciseProgress.map((p, i) => (
                        <button
                          key={p.name}
                          onClick={() => goToExercise(i)}
                          className="flex-1 h-1.5 rounded-full transition-colors duration-200"
                          style={{
                            backgroundColor: p.skipped
                              ? 'rgba(255,255,255,0.10)'
                              : p.complete
                                ? '#22C55E'
                                : i === focusIndex
                                  ? '#1A7BFF'
                                  : 'rgba(255,255,255,0.12)',
                          }}
                          aria-label={`${p.name}: ${p.skipped ? 'skipped' : p.complete ? 'done' : `${p.done} of ${p.total} sets`}`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-ink-3 text-caption font-display font-bold uppercase tracking-wide">
                        Exercise {focusIndex + 1} of {selected.exercises.length}
                      </p>
                      <p className="text-ink-4 text-caption font-body">
                        {exerciseProgress.filter((p) => p.complete).length} done
                        {exerciseProgress.some((p) => p.skipped) &&
                          ` · ${exerciseProgress.filter((p) => p.skipped).length} skipped`}
                      </p>
                    </div>
                  </div>
                )}

                <div className="p-4 space-y-4">
                  {sessionGroups.map((group) => (
                    <div key={group.label}>
                      {/* Series header */}
                      <div className="flex items-center justify-between mb-2.5">
                        <p className="text-ink-4 text-caption font-display font-bold uppercase tracking-[0.15em]">
                          {group.label}
                        </p>
                        {group.isSuperset && (
                          <span className="text-state-success text-caption font-display font-bold uppercase tracking-wide">
                            Superset
                          </span>
                        )}
                      </div>

                      {/* What a superset IS, for somebody who does not know.
                          A1, A2 and a green badge tell an experienced lifter
                          everything and a beginner nothing — they cannot tell
                          whether to do all of A1 then all of A2, or alternate.
                          The rest handling already assumes alternating and
                          nothing on screen said so.
                          Shown to beginners only, the same way the form cues
                          are: an experienced lifter does not need telling
                          twice a week forever. */}
                      {group.isSuperset && treatAsBeginner && (
                        <p className="text-ink-3 text-label font-body mb-2.5 leading-relaxed">
                          Do one set of each, back to back, then rest. That&rsquo;s one round.
                        </p>
                      )}

                      {/* Exercises in series */}
                      <div className="space-y-2">
                        {group.exercises.map(({ exercise, seriesPrefix }) => {
                          const swapKey = `${selectedDay}-${exercise.name}`
                          const displayName = swappedExercises[swapKey] ?? exercise.name
                          const isSwapped = displayName !== exercise.name
                          const alternatives = getAlternatives(exercise.name)
                          const dbMatch = matchedExercises.get(exercise.name) ?? null
                          // In a running session the one exercise on screen is
                          // always open: there is nothing to collapse it to.
                          // isOpen is worked out below, once currentLogs exists.
                          const logKey = `${selectedDay}-${exercise.name}`
                          // Where the superset round ends, and therefore where
                          // the rest actually belongs.
                          const lastInGroup =
                            group.exercises[group.exercises.length - 1].exercise.name === exercise.name
                          const intensityEnabled = intensityOn[logKey] ?? false
                          const selectedTechnique = intensityChoice[logKey] ?? null
                          /**
                           * How many sets this exercise has TODAY.
                           *
                           * The prescription, or more if the client has added
                           * some. Derived from the length of the logged array
                           * rather than held in its own piece of state, and
                           * that is the whole trick: the array is what gets
                           * written to the database and what the resume
                           * rehydrate grows back from `set_number`. So an
                           * added set survives leaving the workout, locking
                           * the phone and coming back, without anything
                           * needing to remember that it was added.
                           *
                           * It also keeps the distinction the program cares
                           * about. Nothing is written to the plan: a set
                           * beyond `exercise.sets` is an extra today and the
                           * prescription is unchanged tomorrow, which is
                           * derivable from set_number alone and needed no new
                           * column to say so.
                           */
                          const loggedRowCount = setLogs[logKey]?.length ?? 0
                          const totalSets = Math.max(exercise.sets, loggedRowCount)
                          const extraSets = totalSets - exercise.sets
                          const workingSetCount = intensityEnabled ? Math.max(1, totalSets - 1) : totalSets
                          const fullLogs = setLogs[logKey] ?? Array.from({ length: exercise.sets }, emptyRow)
                          // Ensure backing array always holds every row so data isn't lost when toggling intensity on/off.
                          const backingLogs = fullLogs.length < totalSets
                            ? [...fullLogs, ...Array.from({ length: totalSets - fullLogs.length }, emptyRow)]
                            : fullLogs
                          // A run is not a set of anything. Timed work gets a
                          // duration field instead of weight-by-reps rows, so
                          // the set list is deliberately empty for it.
                          // A plank is held, not repeated — and "60 sec" looks
                          // timed to the check above, which would collapse
                          // three planks into one stopwatch. A hold keeps its
                          // set rows and swaps the rep box for seconds.
                          const hold = isHold(matchedExercises.get(exercise.name) ?? null)
                          const timed = isTimedPrescription(exercise.reps) && !hold
                          // Sprints, jumps and throws are prescribed in reps, so
                          // they reach the set grid and get asked how much weight
                          // they sprinted with. The hybrid athlete on Complete
                          // Athlete logged ONE set across two sessions; three of
                          // his four Day 1 slots are this. No weight column for
                          // these, and a set is done once the efforts are in.
                          const explosive = isExplosiveMovement(displayName)
                          const needsWeight = !explosive
                          const currentLogs = timed ? [] : backingLogs.slice(0, workingSetCount)
                          /**
                           * Open while there is still work in it.
                           *
                           * Every exercise used to stay open for the whole
                           * session, so by the last one a tired client was
                           * scrolling past five finished blocks to reach the
                           * one in front of them — the page is longest exactly
                           * when they have least patience for it.
                           *
                           * A finished exercise folds to its header and reopens
                           * on a tap, which is how a mistyped set still gets
                           * corrected. Timed work has no set rows, so it never
                           * counts as finished and never folds on its own.
                           */
                          const allSetsDone =
                            currentLogs.length > 0 && currentLogs.every((l) => l.logged)
                          const isOpen =
                            expandedWorkoutExercise === exercise.name ||
                            (sessionActive && !allSetsDone) ||
                            (!sessionActive && expandedWorkoutExercise === exercise.name)

                          // Hoisted out of the advice block below so the set
                          // rows can be filled from it. The engine has always
                          // worked this out and then only said it in a sentence.
                          const exerciseHist = exHistory[displayName] ?? []
                          const daysSince = exerciseHist[0]
                            ? Math.max(0, Math.round((Date.now() - Date.parse(exerciseHist[0].date + 'T00:00:00')) / 86400000))
                            : 0
                          const target =
                            timed || explosive
                              ? null
                              : nextTarget(
                                  displayName,
                                  exercise.reps,
                                  {
                                    goal: (programGoal ?? 'muscle') as ProgressionGoal,
                                    level,
                                    daysSinceLast: daysSince,
                                    bodyWeightLb,
                                  },
                                  exerciseHist
                                )
                          const suggested = {
                            weight: target?.suggestedWeight != null ? String(target.suggestedWeight) : '',
                            // An explosive slot has no load, but the prescribed
                            // effort count is still worth putting in the box.
                            // A hold is prescribed in seconds, so the box should
                            // propose seconds. The progression engine reads
                            // "45 sec" as a rep range and would otherwise
                            // suggest adding a rep to a plank.
                            reps: hold
                              ? String(parseHoldSeconds(exercise.reps) ?? '')
                              : explosive
                                ? String(parseRepRange(exercise.reps)?.min ?? '')
                                : target?.suggestedReps != null
                                  ? String(target.suggestedReps)
                                  : '',
                          }
                          /** The set the client is on: the first one not yet confirmed. */
                          const activeSet = currentLogs.findIndex((l) => !l.logged)
                          const currentIntensityLogs = intensityLogs[logKey] ?? Array.from({ length: 2 }, () => ({ weight: '', done: false }))
                          /* Keyed on what they are ACTUALLY lifting, not what
                             the program asked for.
                             PRs are written under `displayName` (the swapped
                             exercise) and were read back under `exercise.name`
                             (the original). So a swapped slot showed the
                             original lift's record: "Barbell Full Squat —
                             PR 155 lbs" directly above "First time here",
                             because the target engine reads the history of the
                             exercise being done and correctly found none.
                             Two names for one row is how an app tells somebody
                             an untrue thing about their own training. */
                          const pr = dbPRs[displayName] ?? null
                          // Check if any entered set beats the PR
                          const bestEnteredWeight = Math.max(0, ...currentLogs.map((l) => (l.logged ? Number(l.weight) || 0 : 0)))
                          // A record needs something to beat. Without the null
                          // guard this read `bestEntered > 0`, so the first time
                          // a client ever did an exercise, every set they logged
                          // came up gold — a trophy for existing.
                          const isNewPR = pr != null && bestEnteredWeight > pr.weight

                          /* WHAT STATE THIS CARD IS IN, AND SHOWING IT.
                             Every exercise card was the same #222 with the same
                             white border whether it was finished, skipped, half
                             logged or never touched. While a session is running
                             that costs nothing, because only the focused
                             exercise is on screen — but browsing a day, which
                             is how a client checks what they did and plans what
                             is left, the list gave no answer to "where did I get
                             to" except opening each card in turn.
                             The progress strip at the top of a live session
                             already uses exactly these three colours for
                             exactly these three states. This is that same
                             language applied to the cards themselves rather
                             than a new one invented for them: green is done,
                             blue is the one you are on, grey is not yet. */
                          const cardState = exerciseProgress.find((p) => p.name === exercise.name)
                          const isFocused = sessionActive && selected?.exercises[focusIndex]?.name === exercise.name
                          const cardTone = cardState?.skipped
                            ? 'bg-[#1E1E1E] border-white/[0.06]'
                            : cardState?.complete
                              ? 'bg-[#222] border-state-success/30'
                              : isFocused
                                ? 'bg-[#222] border-brand-blue/40'
                                : 'bg-[#222] border-white/[0.10]'
                          return (
                            <div key={exercise.name} className={`rounded-card border overflow-hidden transition-colors duration-200 ${cardTone}`}>
                              {/* Exercise row */}
                              <div className="flex items-center gap-3 p-3">
                                {/* Thumbnail, tap for exercise detail */}
                                <button
                                  onClick={() => {
                                    if (dbMatch) {
                                      setSelectedExercise(exercise.name)
                                      setView('exercise')
                                    }
                                  }}
                                  className="relative w-14 h-14 rounded-control overflow-hidden bg-[#0A0A0A] shrink-0"
                                >
                                  {dbMatch?.images[0] ? (
                                    <>
                                      <img
                                        src={dbMatch.images[0]}
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
                                      <span className="text-ink-4 text-label font-display font-bold">{seriesPrefix}</span>
                                    </div>
                                  )}
                                </button>

                                {/* Info, tap to expand log */}
                                <button
                                  onClick={() => setExpandedWorkoutExercise(isOpen ? null : exercise.name)}
                                  className="flex-1 min-w-0 text-left"
                                >
                                  <div className="flex items-center gap-1.5">
                                    {group.isSuperset && (
                                      <span className="text-state-success text-caption font-display font-bold">{seriesPrefix}</span>
                                    )}
                                    {/* The exercise is what the card is ABOUT, and it
                                        was 15px — the same size as the eight other
                                        things around it. First thing the eye should
                                        land on when you look up from the bar. */}
                                    {/* Wraps rather than truncates.
                                        At 15px `truncate` rarely bit; at 20px it cut
                                        nearly every name in the library — "Barbell
                                        Bench …", "Bent Over Barb…", "Dips - Triceps
                                        V…". Making the name the biggest thing on the
                                        card and then hiding which exercise it is was
                                        worse than leaving it small. Two lines at a
                                        tight leading, which is where even the longest
                                        library names land.

                                        Three, measured rather than guessed: of the
                                        873 names in the library, 31% fit one line at
                                        this width, 88% fit two and 98.9% fit three.
                                        Two left "Barbell Bench Press - Medium Grip"
                                        reading "…Medium", and that is the most
                                        common lift in the product. Most names are
                                        short enough that the row does not grow. */}
                                    <p className="font-body font-semibold text-white text-heading leading-tight line-clamp-3 min-w-0">{displayName}</p>
                                    {exercise.swappedFrom && (
                                      <span className="sr-only">
                                        instead of {exercise.swappedFrom}
                                      </span>
                                    )}
                                    {isSwapped && (
                                      <span className="text-badge font-display font-bold px-1.5 py-0.5 rounded bg-brand-blue/15 text-brand-blueink shrink-0">
                                        Swapped
                                      </span>
                                    )}
                                    {/* Changed because of equipment they said
                                        they do not have. Named, never silent:
                                        a client who opens their program and
                                        finds a different exercise with no
                                        explanation has learned that the app
                                        changes things behind their back. */}
                                    {exercise.swappedFrom && (
                                      <span className="text-badge font-display font-bold px-1.5 py-0.5 rounded bg-white/[0.07] text-ink-3 shrink-0">
                                        No bench
                                      </span>
                                    )}
                                    {/* Only once the card is open.
                                        Swapped and No bench say the program is not
                                        what it was, which is worth knowing from the
                                        list. The technique is a setting chosen
                                        inside this card — on a collapsed row it is a
                                        third pill competing with the exercise name
                                        for a reader who has not opened it yet. */}
                                    {isOpen && intensityEnabled && selectedTechnique && (
                                      <span
                                        className={`text-badge font-display font-bold px-1.5 py-0.5 rounded bg-white/5 shrink-0`}
                                        style={{ color: TECHNIQUE_META[selectedTechnique].color, backgroundColor: `${TECHNIQUE_META[selectedTechnique].color}22` }}
                                      >
                                        {TECHNIQUE_META[selectedTechnique].label}
                                      </span>
                                    )}
                                  </div>
                                  {/* Anthony's note on this exercise.
                                      One line, under the name, only where he
                                      wrote one. A coached client is paying for
                                      his attention and the only place his words
                                      could previously land was a message thread
                                      they are not reading between sets. Not a
                                      conversation — coaching must not compete
                                      with execution. */}
                                  {exercise.note && (
                                    <p className="text-brand-blueink text-body font-body mt-1 leading-relaxed">
                                      {exercise.note}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {/* Where you are, in words.
                                        The set number was a numeral in a 24px
                                        column at the left of each row, so
                                        "what set am I on" meant counting
                                        filled circles while out of breath —
                                        the one question on this screen that
                                        could not be answered at a glance.
                                        Only while a session is running: on the
                                        preview it would be a countdown from a
                                        workout nobody has started. */}
                                    {sessionActive && activeSet >= 0 && (
                                      <p className="text-white text-label font-display font-bold shrink-0">
                                        Set {activeSet + 1} of {currentLogs.length}
                                      </p>
                                    )}
                                    {/* The prescription, while the card is shut.
                                        Open, the set rows below are the same
                                        information as five numbered lines with the
                                        rep target in each box, and this becomes a
                                        caption restating what is already on screen
                                        in a larger form. */}
                                    {!isOpen && (
                                      <p className="text-ink-3 text-label font-body">
                                        Reps: {exercise.reps} &middot; {intensityEnabled ? `${workingSetCount} + 2 intensity` : `${totalSets} sets${extraSets > 0 ? ` (${exercise.sets} + ${extraSets})` : ''}`}
                                      </p>
                                    )}
                                    {/* The PR badge is gone, not enlarged.
                                        It duplicated the "Current PR — 155 lbs × 5,
                                        Oct 10" row two lines below, which is better
                                        in every way: dated, says the reps, and
                                        readable. A standing record is reference, and
                                        the decision this card is for is made from
                                        Last and Today. The moment a PR is SET is
                                        news and already has PRCelebration.

                                        It was also 9px with a 10px trophy, and read
                                        the original exercise's record on a swapped
                                        slot until yesterday — so the one thing it
                                        reliably did was state something untrue in
                                        type nobody could read. */}
                                  </div>
                                </button>

                                {/* While training, the two things reached for
                                    mid-session sit in the header: how do I do
                                    this, and the rack is busy. Both were buried
                                    — the demo behind a full page navigation away
                                    from the workout, the swap three scrolls
                                    down inside the card. */}
                                {sessionActive ? (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {dbMatch && (
                                      <button
                                        onClick={() => setDemoFor(exercise.name)}
                                        className="w-9 h-9 rounded-control bg-white/[0.06] flex items-center justify-center text-ink-2 hover:text-white hover:bg-white/[0.10] active:scale-95 transition-all duration-150"
                                        aria-label="How to do this exercise"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                                        </svg>
                                      </button>
                                    )}
                                    {alternatives.length > 0 && (
                                      <button
                                        onClick={() => setSwapFor(exercise.name)}
                                        className="w-9 h-9 rounded-control bg-white/[0.06] flex items-center justify-center text-ink-2 hover:text-white hover:bg-white/[0.10] active:scale-95 transition-all duration-150"
                                        aria-label="Swap this exercise"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setExpandedWorkoutExercise(isOpen ? null : exercise.name)}
                                    className="text-right shrink-0 flex flex-col items-end"
                                  >
                                    {/* How far through this one the client got,
                                        on the collapsed row. The green border
                                        says "finished" from across the list;
                                        this says "three of five", which is the
                                        thing a client actually wants when they
                                        come back to a day they stopped
                                        halfway through. Nothing at all when
                                        nothing has been logged — an untouched
                                        exercise should not carry a status. */}
                                    {cardState && cardState.done > 0 && (
                                      <span
                                        className={`text-badge font-display font-bold uppercase tracking-wide mb-0.5 ${
                                          cardState.complete ? 'text-state-success' : 'text-brand-blueink'
                                        }`}
                                      >
                                        {cardState.complete
                                          ? 'Done'
                                          : `${cardState.done} of ${cardState.total}`}
                                      </span>
                                    )}
                                    <p className="text-brand-orange text-label font-display font-bold">
                                      {intensityEnabled ? `${workingSetCount}+2` : `${totalSets}X`} / Rest
                                    </p>
                                    <svg className={`w-4 h-4 text-ink-4 mt-0.5 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                    </svg>
                                  </button>
                                )}
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
                                      {/* The record, in gold.

                                          Because a record is an achievement.
                                            The label and the trophy were grey, and the
                                            celebration that fires the moment a record
                                            falls was amber — so the app congratulated
                                            you in one colour and then filed the result
                                            in another. A customer noticed and asked for
                                            exactly this: the trophy and the label, gold.

                                            Only those two. The figures stay white
                                            because they are what you read, and a card
                                            where everything is gold has no hierarchy —
                                            it just looks like a warning. */}
                                      {pr && (
                                        <div className={`flex items-center justify-between rounded-control px-3 min-h-tap py-2 mt-2 mb-2 ${isNewPR ? 'bg-brand-gold/[0.12] border border-brand-gold/35' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
                                          <div className="flex items-center gap-2">
                                            <svg className="w-5 h-5 text-brand-gold shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                              <path d="M5 3h14l-1.5 5H6.5L5 3Zm1.5 5v2a5.5 5.5 0 0 0 11 0V8h-11ZM12 16a5.5 5.5 0 0 1-5.08-3.39A6.5 6.5 0 0 0 12 15.5a6.5 6.5 0 0 0 5.08-2.89A5.5 5.5 0 0 1 12 16Zm0 2a1 1 0 0 1 1 1v2h-2v-2a1 1 0 0 1 1-1Z" />
                                            </svg>
                                            <span className="text-brand-gold text-label font-display font-bold uppercase tracking-wide">
                                              {isNewPR ? 'New PR!' : 'Current PR'}
                                            </span>
                                          </div>
                                          <div className="text-right min-w-0">
                                            <span className="text-white text-label font-display font-bold tabular-nums">
                                              {isNewPR ? `${bestEnteredWeight} lbs` : `${pr.weight} lbs × ${pr.reps}`}
                                            </span>
                                            <span className="text-ink-3 text-caption font-body ml-2">{pr.date}</span>
                                          </div>
                                        </div>
                                      )}

                                      {/* Rest time adjuster */}
                                      {(() => {
                                        const restKey = `${selectedDay}-${exercise.name}`
                                        const defaultSec = parseRestSeconds(exercise.rest)
                                        const customSec = restTimers[restKey] ?? defaultSec
                                        const isEditingThis = editingRest === exercise.name

                                        return (
                                          <div className="flex items-center justify-between rounded-control bg-white/[0.03] border border-white/[0.06] px-3 py-2 mt-2 mb-3">
                                            <div className="flex items-center gap-2">
                                              <svg className="w-3.5 h-3.5 text-ink-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                              </svg>
                                              <span className="text-ink-3 text-caption font-display font-bold uppercase tracking-wide">Rest Timer</span>
                                            </div>
                                            {isEditingThis ? (
                                              <div className="flex items-center gap-1.5">
                                                {[30, 45, 60, 90, 120, 180].map((sec) => (
                                                  <button
                                                    key={sec}
                                                    onClick={() => {
                                                      setRestTimers((prev) => ({ ...prev, [restKey]: sec }))
                                                      setEditingRest(null)
                                                    }}
                                                    className={`px-2 py-1 rounded text-caption font-display font-bold transition-colors duration-150 ${
                                                      customSec === sec
                                                        ? 'bg-brand-blue text-white'
                                                        : 'bg-white/[0.04] text-ink-3 hover:text-ink-2'
                                                    }`}
                                                  >
                                                    {sec < 60 ? `${sec}s` : `${sec / 60}m`}
                                                  </button>
                                                ))}
                                              </div>
                                            ) : (
                                              <button
                                                onClick={() => setEditingRest(exercise.name)}
                                                className="flex items-center gap-1.5 text-ink-2 hover:text-ink transition-colors duration-200"
                                              >
                                                <span className="text-label font-display font-bold">{customSec}s</span>
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                                                </svg>
                                              </button>
                                            )}
                                          </div>
                                        )
                                      })()}

                                      {/* Today's target, derived from last session. The library
                                          prescribes sets and reps but never said what to do
                                          differently from one week to the next. */}
                                      {(() => {
                                        // Timed work: a run, a row, an interval.
                                        // Its own model entirely — the lifting
                                        // engine returns nothing for minutes,
                                        // which is why these slots sat at the
                                        // same 20 or 45 minutes forever.
                                        if (timed) {
                                          const prescribed = parsePrescribedDuration(exercise.reps)
                                          const role = inferTimedRole(prescribed, displayName)
                                          const week = block
                                            ? blockProgress(block.assigned_at, block.block_weeks).week
                                            : 1
                                          const tt = timedTarget({
                                            role,
                                            exerciseName: displayName,
                                            prescribedSeconds: prescribed,
                                            history: timedHistory[displayName] ?? [],
                                            weekInBlock: week,
                                            canProgress: canComponentProgress('running', week),
                                          })
                                          const past = timedHistory[displayName] ?? []
                                          const typed = timedLogs[logKey] ?? ''
                                          return (
                                            <>
                                              {past[0]?.durationSeconds != null && (
                                                <p className="text-ink-3 text-caption font-body mb-2">
                                                  <span className="text-ink-4">Last time: </span>
                                                  {Math.round(past[0].durationSeconds / 60)} min
                                                </p>
                                              )}
                                              <div
                                                className={`mb-2 px-base py-snug rounded-control border text-body font-body leading-relaxed ${
                                                  tt.isProgression
                                                    ? 'bg-brand-orange/[0.10] border-brand-orange/30 text-brand-orange'
                                                    : 'bg-white/[0.03] border-white/[0.08] text-ink-2'
                                                }`}
                                              >
                                                {tt.text}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <input
                                                  type="number"
                                                  inputMode="numeric"
                                                  placeholder={
                                                    tt.suggestSeconds
                                                      ? String(Math.round(tt.suggestSeconds / 60))
                                                      : 'min'
                                                  }
                                                  value={typed}
                                                  onFocus={selectAllOnFocus}
                                                  onChange={(e) => {
                                                    const v = e.target.value
                                                    setTimedLogs((prev) => ({ ...prev, [logKey]: v }))
                                                    const m = Number(v)
                                                    if (!userId || !Number.isFinite(m) || m <= 0) return
                                                    if (timedSaveRef.current[logKey]) {
                                                      clearTimeout(timedSaveRef.current[logKey])
                                                    }
                                                    // The session is ensured in the debounce rather
                                                    // than on each keystroke: a run is often the
                                                    // first thing in a day, and this used to read
                                                    // workoutIds before anything had created one,
                                                    // so the minutes were typed and dropped.
                                                    timedSaveRef.current[logKey] = setTimeout(() => {
                                                      void (async () => {
                                                      const wid = (await ensureSession()) ?? (selectedDay !== null ? workoutIds[selectedDay] : null)
                                                      if (!wid) return
                                                      await saveSetSafely(`${logKey}-timed`, {
                                                        workoutId: wid,
                                                        userId,
                                                        exerciseName: displayName,
                                                        originalExerciseName: isSwapped ? exercise.name : null,
                                                        setNumber: 1,
                                                        weight: null,
                                                        reps: null,
                                                        isIntensitySet: false,
                                                        completed: true,
                                                        durationSeconds: Math.round(m * 60),
                                                        distanceMi: Number(distanceLogs[logKey]) || null,
                                                      })
                                                      })()
                                                    }, 500)
                                                  }}
                                                  className="w-24 px-3 py-3 bg-white/[0.04] border border-white/[0.08] rounded-control text-white text-base font-body text-center placeholder:text-ink-4 focus:outline-none focus:border-brand-blue/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                />
                                                <span className="text-ink-3 text-label font-body">
                                                  minutes
                                                </span>
                                              </div>

                                              {/* Distance, optional.
                                                  Without it a run cannot have a
                                                  record at all: these slots are
                                                  prescribed at a fixed 10 or 20
                                                  minutes, so "longest ever" would
                                                  only reward having more time that
                                                  day. Ground covered and the pace
                                                  it was covered at are the things
                                                  that actually improve. */}
                                              {!/stretch|mobility|foam|warm/i.test(displayName) && (
                                                <div className="flex items-center gap-2 mt-2">
                                                  <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    step="0.1"
                                                    placeholder="—"
                                                    value={distanceLogs[logKey] ?? ''}
                                                    onFocus={selectAllOnFocus}
                                                    onChange={(e) => {
                                                      const v = e.target.value
                                                      setDistanceLogs((prev) => ({ ...prev, [logKey]: v }))
                                                      const wid = selectedDay !== null ? workoutIds[selectedDay] : null
                                                      const mins = Number(timedLogs[logKey])
                                                      if (!userId || !wid || !Number.isFinite(mins) || mins <= 0) return
                                                      if (timedSaveRef.current[`${logKey}-d`]) {
                                                        clearTimeout(timedSaveRef.current[`${logKey}-d`])
                                                      }
                                                      timedSaveRef.current[`${logKey}-d`] = setTimeout(() => {
                                                        void saveSetSafely(`${logKey}-timed`, {
                                                          workoutId: wid,
                                                          userId,
                                                          exerciseName: displayName,
                                                          originalExerciseName: isSwapped ? exercise.name : null,
                                                          setNumber: 1,
                                                          weight: null,
                                                          reps: null,
                                                          isIntensitySet: false,
                                                          completed: true,
                                                          durationSeconds: Math.round(mins * 60),
                                                          distanceMi: Number(v) || null,
                                                        })
                                                      }, 500)
                                                    }}
                                                    className="w-24 px-3 py-3 bg-white/[0.04] border border-white/[0.08] rounded-control text-white text-base font-body text-center placeholder:text-ink-4 focus:outline-none focus:border-brand-blue/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    aria-label="Distance in miles, optional"
                                                  />
                                                  <span className="text-ink-3 text-label font-body">
                                                    miles <span className="text-ink-4">(optional)</span>
                                                  </span>
                                                </div>
                                              )}

                                              {/* Pace, the moment both are in. */}
                                              {Number(typed) > 0 && Number(distanceLogs[logKey]) > 0 && (
                                                <p className="text-ink-3 text-caption font-body mt-2">
                                                  {(() => {
                                                    const sec = (Number(typed) * 60) / Number(distanceLogs[logKey])
                                                    return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')} per mile`
                                                  })()}
                                                </p>
                                              )}
                                            </>
                                          )
                                        }

                                        // Sprints and jumps are prescribed in reps, so they
                                        // arrive here rather than in the timed branch. Double
                                        // progression would cheerfully add five pounds to a box
                                        // jump; nothing about that is a good idea.
                                        if (isExplosiveMovement(displayName)) {
                                          return (
                                            <div className="mb-2 px-base py-snug rounded-control border border-white/[0.08] bg-white/[0.03] text-ink-2 text-body font-body leading-relaxed">
                                              {explosiveGuidance(displayName)}
                                            </div>
                                          )
                                        }

                                        const hist = exerciseHist
                                        const t = target
                                        if (!t) return null

                                        // Last session as a LABEL, not a placeholder. The
                                        // previous numbers used to live in the input's grey
                                        // placeholder, styled exactly like the word "lbs" and
                                        // gone the moment a digit was typed — so they vanished
                                        // at the exact moment the client was deciding whether
                                        // last week was hard.
                                        const prevSets = (lastSets[displayName] ?? []).filter(
                                          (s) => s && s.weight != null && s.reps != null
                                        )
                                        const trend = hist.slice(0, 6).reverse()
                                        const trendMax = Math.max(...trend.map((s) => s.topWeight), 1)

                                        return (
                                          <>
                                            {/* LAST and TODAY, at a size you can
                                                read at arm's length.
                                                Both numbers existed before — the
                                                previous session in 10px grey, the
                                                target buried in a sentence — and
                                                both are what the client is
                                                actually deciding between. */}
                                            {/* The two numbers the client is choosing
                                                between, now sized like it. Today is the
                                                decision and gets the metric step; Last
                                                is the evidence for it and sits a clear
                                                two steps below. They were 16px and 15px
                                                — a 1px difference, which is no
                                                difference at arm's length. */}
                                            <div className="mb-2 mt-2 rounded-control bg-white/[0.03] border border-white/[0.07] px-card py-base space-y-tight">
                                              {prevSets.length > 0 && (
                                                <div className="flex items-baseline gap-3">
                                                  <span className="text-ink-4 text-caption font-display font-bold uppercase tracking-wide w-14 shrink-0">Last</span>
                                                  <span className="text-ink-2 text-label font-body tabular-nums">
                                                    {Number(prevSets[0].weight)} lb &middot; {prevSets.map((s) => s.reps).join(', ')}
                                                  </span>
                                                </div>
                                              )}
                                              <div className="flex items-baseline gap-3">
                                                <span className="text-ink-4 text-caption font-display font-bold uppercase tracking-wide w-14 shrink-0">Today</span>
                                                <span className={`text-metric font-display font-bold tabular-nums ${t.addLoad ? 'text-brand-orange' : 'text-white'}`}>
                                                  {/* null means "no suggestion yet", which is not
                                                      the same as "lift your bodyweight". See
                                                      loadLabel — the rule is pinned in
                                                      tools/verify-load-label.ts. */}
                                                  {loadLabel(t.suggestedWeight, displayName)}
                                                  {t.suggestedReps != null && <span className="text-ink-2 font-body text-label"> &times; {exercise.reps}</span>}
                                                </span>
                                                {t.addLoad && (
                                                  <span className="text-brand-orange text-caption font-display font-bold uppercase tracking-wide ml-auto shrink-0">
                                                    &uarr; Up
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            {prevSets.length > 0 && (
                                              <div className="mb-2 flex items-center justify-end gap-3">
                                                {/* Six-session trend. A client who can see their
                                                    bench has been flat for five weeks works out
                                                    the stall before the app has to say it. */}
                                                {trend.length >= 3 && (
                                                  <span
                                                    className="flex items-end gap-[3px] h-5 shrink-0"
                                                    title={trend
                                                      .map((s) => `${s.date}: ${s.topWeight} lbs x ${s.topReps}`)
                                                      .join('\n')}
                                                    aria-label={`Recent top sets: ${trend
                                                      .map((s) => `${s.topWeight} pounds`)
                                                      .join(', ')}`}
                                                  >
                                                    {trend.map((s, i) => (
                                                      <span
                                                        key={i}
                                                        className={`w-[5px] rounded-sm ${
                                                          i === trend.length - 1
                                                            ? 'bg-brand-blue'
                                                            : 'bg-white/25'
                                                        }`}
                                                        style={{
                                                          height: `${Math.max(
                                                            14,
                                                            (s.topWeight / trendMax) * 100
                                                          )}%`,
                                                        }}
                                                      />
                                                    ))}
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                            <div
                                              className={`mb-2 px-base py-snug rounded-control border text-body font-body leading-relaxed ${
                                                t.addLoad
                                                  ? 'bg-brand-orange/[0.10] border-brand-orange/30 text-brand-orange'
                                                  : t.attention
                                                    ? 'bg-state-warning/[0.10] border-state-warning/30 text-state-warning'
                                                    : 'bg-white/[0.03] border-white/[0.08] text-ink-2'
                                              }`}
                                            >
                                              {t.text}
                                            </div>
                                          </>
                                        )
                                      })()}

                                      {/* Cues in front of a beginner, behind a
                                          tap for everyone else.
                                          Disclosed per EXERCISE as well as per
                                          client: an advanced lifter meeting a
                                          Zercher squat for the first time is a
                                          beginner at that movement, and the
                                          history to know that is already loaded. */}
                                      {sessionActive && (() => {
                                        const coaching = cuesFor(displayName)
                                        const firstTime = exerciseHist.length === 0
                                        if (!coaching || !(treatAsBeginner || firstTime)) return null
                                        return (
                                          <div className="mt-2 mb-3 px-3 py-2.5 rounded-control bg-brand-blue/[0.07] border border-brand-blue/20">
                                            <p className="text-brand-blueink text-caption font-display font-bold uppercase tracking-wide mb-1.5">
                                              {firstTime && !treatAsBeginner ? 'First time on this one' : 'Get these right'}
                                            </p>
                                            <ul className="space-y-1">
                                              {coaching.cues.slice(0, 2).map((cue, i) => (
                                                <li key={i} className="text-ink text-label font-body leading-relaxed">{cue}</li>
                                              ))}
                                            </ul>
                                            {treatAsBeginner && (
                                              <p className="text-state-warning/90 text-label font-body leading-relaxed mt-2">
                                                Watch out: {coaching.mistake}
                                              </p>
                                            )}
                                          </div>
                                        )
                                      })()}

                                      {/* Sprints, jumps and throws: tap an effort
                                          as you do it.
                                          Phase 1 got the weight column off these
                                          and left a reps box, which is still the
                                          wrong shape — a box jump set is three
                                          jumps, counted, not a number recalled
                                          and typed with chalk on your hands. The
                                          circles are the set. */}
                                      {explosive && currentLogs.length > 0 && (
                                        <div className="space-y-2.5">
                                          {currentLogs.map((log, si) => {
                                            const prescribed = parseRepRange(exercise.reps)?.min ?? 1
                                            const doneCount = log.logged ? Number(log.reps) || 0 : Number(log.reps) || 0
                                            const setKey = `${logKey}-${si}`
                                            const tapEffort = async (n: number) => {
                                              primeRestAudio()
                                              // A day that opens with a plank or a jump has no
                                              // "Log set" button, so this is the tap that starts
                                              // the session. Without it the first effort of such
                                              // a workout ticked and was never written.
                                              const startedWid = await ensureSession()
                                              // Tapping the effort you are already
                                              // on clears it, so an accidental tap
                                              // costs one more tap, not a retype.
                                              const next = doneCount === n ? n - 1 : n
                                              const updated = [...backingLogs]
                                              updated[si] = { weight: '', reps: next > 0 ? String(next) : '', logged: next >= prescribed }
                                              setSetLogs((prevLogs) => ({ ...prevLogs, [logKey]: updated }))

                                              const wid = startedWid ?? (selectedDay !== null ? workoutIds[selectedDay] : null)
                                              if (userId && wid && next > 0) {
                                                void saveSetSafely(setKey, {
                                                  workoutId: wid,
                                                  userId,
                                                  exerciseName: displayName,
                                                  originalExerciseName: isSwapped ? exercise.name : null,
                                                  setNumber: si + 1,
                                                  weight: null,
                                                  reps: next,
                                                  isIntensitySet: false,
                                                  completed: next >= prescribed,
                                                })
                                              }
                                              if (next >= prescribed && si < currentLogs.length - 1) {
                                                const restKey = `${selectedDay}-${exercise.name}`
                                                const secs = restSecondsAfterSet({
                                                  prescribed: restTimers[restKey] ?? parseRestSeconds(exercise.rest),
                                                  isSuperset: group.isSuperset,
                                                  isLastInGroup: lastInGroup,
                                                })
                                                if (secs > 0) {
                                                  startRestTimer(`${logKey}-set${si}`, secs, {
                                                    name: group.isSuperset && lastInGroup ? group.exercises[0].exercise.name : displayName,
                                                    set: `Set ${si + 2} of ${currentLogs.length}`,
                                                  })
                                                }
                                              }
                                            }
                                            return (
                                              <div key={si} className="flex items-center gap-3">
                                                <span className={`text-label font-display font-bold w-6 shrink-0 ${log.logged ? 'text-state-success' : 'text-ink-4'}`}>
                                                  {si + 1}
                                                </span>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  {Array.from({ length: prescribed }, (_, n) => {
                                                    const on = doneCount > n
                                                    return (
                                                      <button
                                                        key={n}
                                                        onClick={() => void tapEffort(n + 1)}
                                                        className={`w-11 h-11 rounded-full border-2 flex items-center justify-center font-display font-bold text-label transition-all duration-150 active:scale-90 ${
                                                          on
                                                            ? 'bg-state-success/25 border-state-success text-state-success'
                                                            : 'bg-white/[0.03] border-white/[0.12] text-ink-4 hover:border-white/25'
                                                        }`}
                                                        aria-label={`Set ${si + 1}, effort ${n + 1} of ${prescribed}${on ? ', done' : ''}`}
                                                      >
                                                        {on ? (
                                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                                          </svg>
                                                        ) : (
                                                          n + 1
                                                        )}
                                                      </button>
                                                    )
                                                  })}
                                                </div>
                                              </div>
                                            )
                                          })}

                                          {/* Quality, not quantity: the only thing
                                              worth recording about explosive work,
                                              and the thing the coach-only rule in
                                              lib/conditioning.ts is waiting on. */}
                                          {currentLogs.every((l) => l.logged) && (
                                            <div className="flex items-center gap-2 flex-wrap rounded-control bg-white/[0.03] border border-white/[0.07] px-3 py-2.5 mt-1">
                                              <span className="text-ink-2 text-caption font-display font-bold uppercase tracking-wide">
                                                How did they feel?
                                              </span>
                                              {[
                                                { key: 3, label: 'All sharp' },
                                                { key: 1, label: 'Slowed down' },
                                              ].map((q) => (
                                                <button
                                                  key={q.key}
                                                  onClick={() => {
                                                    setRirByExercise((prevR) => ({ ...prevR, [logKey]: q.key }))
                                                    const wid = selectedDay !== null ? workoutIds[selectedDay] : null
                                                    if (!userId || !wid) return
                                                    const lastIdx = currentLogs.length - 1
                                                    void saveSetSafely(`${logKey}-${lastIdx}`, {
                                                      workoutId: wid,
                                                      userId,
                                                      exerciseName: displayName,
                                                      originalExerciseName: isSwapped ? exercise.name : null,
                                                      setNumber: lastIdx + 1,
                                                      weight: null,
                                                      reps: Number(currentLogs[lastIdx]?.reps) || null,
                                                      isIntensitySet: false,
                                                      completed: true,
                                                      rir: q.key,
                                                    })
                                                  }}
                                                  className={`h-11 min-w-11 px-3 rounded-control text-label font-display font-bold transition-colors duration-150 ${
                                                    rirByExercise[logKey] === q.key
                                                      ? 'bg-brand-blue text-white'
                                                      : 'bg-white/[0.04] text-ink-3 hover:text-ink-2'
                                                  }`}
                                                >
                                                  {q.label}
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Column headers.
                                          Timed work has no set rows at all, and
                                          these headers used to render above the
                                          nothing — "SET | WEIGHT (LBS) | REPS"
                                          sitting over a 20-minute row. */}
                                      {!explosive && currentLogs.length > 0 && (
                                        <div className={`grid ${needsWeight ? 'grid-cols-[32px_1fr_1fr_44px]' : 'grid-cols-[32px_1fr_44px]'} gap-2 mb-2`}>
                                          <span className="text-ink-4 text-caption font-display font-bold uppercase tracking-wide text-center">Set</span>
                                          {needsWeight && (
                                            <span className="text-ink-4 text-caption font-display font-bold uppercase tracking-wide">Weight (lbs)</span>
                                          )}
                                          <span className="text-ink-4 text-caption font-display font-bold uppercase tracking-wide">{hold ? 'Seconds' : explosive ? 'Efforts' : 'Reps'}</span>
                                          <span />
                                        </div>
                                      )}

                                      {/* Set rows. Explosive work is counted in
                                          the circles above instead. */}
                                      {(explosive ? [] : currentLogs).map((log, si) => {
                                        const filled = log.logged
                                        // What stands in the box: what the client
                                        // typed, else what we suggest. The
                                        // suggestion is shown dimmed so it never
                                        // passes for something they entered.
                                        // What ticking the set commits: what they typed,
                                        // else the suggestion. The BOX shows only what they
                                        // typed — see lib/set-entry.ts for why.
                                        const weightEntry = { typed: log.weight, suggestion: suggested.weight }
                                        const repsEntry = { typed: log.reps, suggestion: suggested.reps }
                                        const shownWeight = toLog(weightEntry)
                                        const shownReps = toLog(repsEntry)
                                        const isSuggestion = !log.logged && log.weight === '' && log.reps === ''
                                        const isActive = si === activeSet
                                        const canLog = canLogSet(needsWeight ? weightEntry : null, repsEntry)
                                        const setWeight = Number(shownWeight) || 0
                                        const setBeatsPR = filled && pr != null && setWeight > pr.weight
                                        const setTimerKey = `${logKey}-set${si}`
                                        const isLastSet = si === currentLogs.length - 1
                                        const timerActive = activeTimer?.key === setTimerKey

                                        /**
                                         * Typing a number no longer logs the set.
                                         *
                                         * This used to fire the rest timer and a
                                         * database write the instant both boxes
                                         * held something — which is exactly why
                                         * the numbers could not be prefilled.
                                         * Editing now only edits; LOG SET below
                                         * is what commits.
                                         */
                                        const handleLogChange = (field: 'weight' | 'reps', value: string) => {
                                          primeRestAudio()
                                          const updated = [...backingLogs]
                                          // Take the suggestion as the starting
                                          // point for the other field, so editing
                                          // one number does not blank the other.
                                          //
                                          // Editing un-ticks the set. Re-saving on
                                          // each keystroke instead would put back
                                          // the bug this app already fixed once:
                                          // typing "185" fired three writes and
                                          // three PR emails. Changing a number
                                          // means it is not confirmed any more,
                                          // which is both safer and truer.
                                          updated[si] = {
                                            weight: field === 'weight' ? value : shownWeight,
                                            reps: field === 'reps' ? value : shownReps,
                                            logged: false,
                                          }
                                          setSetLogs((prev) => ({ ...prev, [logKey]: updated }))
                                        }

                                        /**
                                         * Confirm the set: tick it, rest, save.
                                         *
                                         * `widOverride` is for the set that STARTS the session.
                                         * `ensureSession` creates the workout row and the id comes
                                         * back from the await, but `workoutIds` is React state and
                                         * will not have it yet in the same tick — so without the
                                         * override the very first set of every workout would be
                                         * ticked and never written.
                                         */
                                        const commitSet = (idx: number, rows: SetRow[], widOverride?: string | null) => {
                                          const row = rows[idx]
                                          const w = needsWeight ? Number(row.weight) || null : null
                                          const r = Number(row.reps) || null

                                          const wid = widOverride ?? (selectedDay !== null ? workoutIds[selectedDay] : null)
                                          if (userId && wid) {
                                            void saveSetSafely(`${logKey}-${idx}`, {
                                              workoutId: wid,
                                              userId,
                                              exerciseName: displayName,
                                              originalExerciseName: isSwapped ? exercise.name : null,
                                              setNumber: idx + 1,
                                              weight: w,
                                              reps: r,
                                              isIntensitySet: false,
                                              completed: true,
                                            })

                                            if (w && r && needsWeight) {
                                              const best = pr ? { weight: pr.weight, reps: pr.reps } : null
                                              // A held exercise has no record here. The rep field is
                                              // seconds on a plank, so "25 lb × 10" is not ten reps,
                                              // it is a ten-second hold — and exercise_prs stores a
                                              // record as weight × reps with nowhere to put a
                                              // duration. Three plank PRs reached production this
                                              // way before the hold fix, one of them a client's most
                                              // recent. A record for a hold is a real feature and
                                              // this is not it.
                                              const hit = hold ? null : judgeSet({ weight: w, reps: r }, best)
                                              if (hit) {
                                                setSessionRecords((prevRecs) => {
                                                  const rest = prevRecs.filter((x) => x.exerciseName !== displayName)
                                                  return [...rest, { exerciseName: displayName, ...hit }]
                                                })
                                              }
                                              // The stored best tracks the heaviest bar, which is
                                              // what the next session's target is built from. A
                                              // rep record at the same weight updates the reps
                                              // beside it so the comparison stays honest.
                                              const beatsStored = !best || w > best.weight || (w === best.weight && r > best.reps)
                                              if (beatsStored) {
                                                dbUpsertPR({ userId, exerciseName: displayName, weight: w, reps: r, workoutId: wid })
                                                  .then(() => {
                                                    setDbPRs((prevPRs) => ({
                                                      ...prevPRs,
                                                      [displayName]: {
                                                        weight: w,
                                                        reps: r,
                                                        previous: best?.weight || undefined,
                                                        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                                                      },
                                                    }))
                                                  })
                                                  .catch((err) => console.error('[PR upsert] Failed:', err))
                                              }
                                              // Interrupt the workout only for the kinds worth it,
                                              // and only once per record.
                                              if (hit?.celebrate && prNotifiedRef.current[displayName] !== hit.value) {
                                                prNotifiedRef.current[displayName] = hit.value
                                                setPrCelebration({ name: displayName, weight: w })
                                                fetch('/api/studio/pr-notify', {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({ exerciseName: displayName, weight: w, reps: r, previousWeight: hit.previous }),
                                                }).catch(() => {})
                                              }
                                            }
                                          }
                                        }

                                        /** The LOG SET button. */
                                        const logThisSet = async () => {
                                          primeRestAudio()
                                          // Starts the session if this is the first set. Awaited,
                                          // because the id it returns is what this set is written
                                          // against — see commitSet.
                                          const wid = await ensureSession()
                                          const updated = [...backingLogs]
                                          updated[si] = { weight: shownWeight, reps: shownReps, logged: true }
                                          setSetLogs((prevLogs) => ({ ...prevLogs, [logKey]: updated }))
                                          commitSet(si, updated, wid)
                                          if (!isLastSet) {
                                            // Zero between superset partners. Resting 90 seconds
                                            // between the two movements you are meant to do back
                                            // to back would make the pairing decorative.
                                            const restKey = `${selectedDay}-${exercise.name}`
                                            const secs = restSecondsAfterSet({
                                              prescribed: restTimers[restKey] ?? parseRestSeconds(exercise.rest),
                                              isSuperset: group.isSuperset,
                                              isLastInGroup: lastInGroup,
                                            })
                                            /* What they are resting FOR. After the last
                                               partner of a superset the next round starts
                                               back at the top of the group, so the name is
                                               the group's first exercise rather than this
                                               one — otherwise the bar would send them to
                                               the movement they just finished. */
                                            if (secs > 0) {
                                              startRestTimer(setTimerKey, secs, {
                                                name: group.isSuperset && lastInGroup ? group.exercises[0].exercise.name : displayName,
                                                set: `Set ${si + 2} of ${currentLogs.length}`,
                                              })
                                            }
                                          }
                                        }


                                        // This set last session, for the hint under the row.
                                        const prev = lastSets[displayName]?.[si]
                                        const prevWeight = prev?.weight != null ? String(Number(prev.weight)) : null
                                        const prevReps = prev?.reps != null ? String(prev.reps) : null

                                        // Bodyweight typed into a load field.
                                        //
                                        // This has already happened: an Inverted Row logged at
                                        // 160 lb and a Floor Glute-Ham Raise at 158, both of them
                                        // the client's own weight, now sitting in their personal
                                        // records. On a movement loaded by the body, a number
                                        // near their bodyweight is almost always the body, not
                                        // added plates. Asked once, never blocked.
                                        const typedWeight = Number(shownWeight)
                                        const bodyweightLooking =
                                          isBodyweightMovement(displayName) &&
                                          bodyWeightLb != null &&
                                          log.weight !== '' &&
                                          Number.isFinite(typedWeight) &&
                                          Math.abs(typedWeight - bodyWeightLb) <= 12

                                        // A suggestion is shown in grey; the
                                        // moment the client touches it or logs
                                        // it, it reads as theirs.
                                        const numberTone = filled
                                          ? 'text-white'
                                          : isSuggestion
                                            ? 'text-ink-3'
                                            : 'text-white'

                                        return (
                                          <div key={si} className={`rounded-control mb-1 ${isActive && !filled ? 'bg-white/[0.04] px-1.5 py-1.5' : ''}`}>
                                            <div className={`grid ${needsWeight ? 'grid-cols-[32px_1fr_1fr_44px]' : 'grid-cols-[32px_1fr_44px]'} gap-2 items-center rounded-control px-1 py-0.5 ${setBeatsPR ? 'bg-brand-gold/[0.08]' : ''}`}>
                                              <span className={`text-label font-display font-bold text-center ${setBeatsPR ? 'text-brand-gold' : 'text-ink-4'}`}>{si + 1}</span>
                                              {/* The suggestion is a PLACEHOLDER, not a value.
                                                  It used to be a real value, which meant tapping
                                                  in put the caret inside "115" and typing gave
                                                  you "1115" or "1151" — you had to select the
                                                  number before you could replace it, on every
                                                  set of every exercise. Alex hit this on his
                                                  first session. As a placeholder it reads the
                                                  same, logs the same (logThisSet still commits
                                                  shownWeight when nothing is typed), and a tap
                                                  puts you in an empty box ready to type. */}
                                              {needsWeight && (
                                                <input
                                                  type="number"
                                                  inputMode="numeric"
                                                  placeholder={boxPlaceholder(weightEntry, prevWeight, 'lbs')}
                                                  value={log.weight}
                                                  onFocus={selectAllOnFocus}
                                                  onChange={(e) => handleLogChange('weight', e.target.value)}
                                                  className={`w-full px-3 py-3 bg-white/[0.04] border border-white/[0.08] rounded-control min-h-taplg text-body font-body text-center focus:outline-none focus:border-brand-blue/50 transition-colors duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${numberTone} ${suggested.weight ? 'placeholder:text-ink-3' : 'placeholder:text-ink-4'}`}
                                                  aria-label={`Set ${si + 1} weight in pounds`}
                                                />
                                              )}
                                              <input
                                                type="number"
                                                inputMode="numeric"
                                                placeholder={boxPlaceholder(repsEntry, prevReps, hold ? 'secs' : explosive ? 'efforts' : 'reps')}
                                                value={log.reps}
                                                onFocus={selectAllOnFocus}
                                                onChange={(e) => handleLogChange('reps', e.target.value)}
                                                className={`w-full px-3 py-3 bg-white/[0.04] border border-white/[0.08] rounded-control min-h-taplg text-body font-body text-center focus:outline-none focus:border-brand-blue/50 transition-colors duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${numberTone} ${suggested.reps ? 'placeholder:text-ink-3' : 'placeholder:text-ink-4'}`}
                                                aria-label={`Set ${si + 1} ${hold ? 'seconds held' : explosive ? 'efforts' : 'reps'}`}
                                              />
                                              <div className="flex items-center justify-center">
                                                {setBeatsPR ? (
                                                  <div className="w-6 h-6 rounded-full bg-brand-gold/20 flex items-center justify-center">
                                                    <svg className="w-3.5 h-3.5 text-brand-gold" viewBox="0 0 24 24" fill="currentColor">
                                                      <path d="M5 3h14l-1.5 5H6.5L5 3Zm1.5 5v2a5.5 5.5 0 0 0 11 0V8h-11ZM12 16a5.5 5.5 0 0 1-5.08-3.39A6.5 6.5 0 0 0 12 15.5a6.5 6.5 0 0 0 5.08-2.89A5.5 5.5 0 0 1 12 16Zm0 2a1 1 0 0 1 1 1v2h-2v-2a1 1 0 0 1 1-1Z" />
                                                    </svg>
                                                  </div>
                                                ) : filled ? (
                                                  <button
                                                    onClick={() => {
                                                      // Un-tick, so a mistyped set
                                                      // can be corrected without
                                                      // hunting for an edit mode.
                                                      const updated = [...backingLogs]
                                                      updated[si] = { ...updated[si], logged: false }
                                                      setSetLogs((prevLogs) => ({ ...prevLogs, [logKey]: updated }))
                                                    }}
                                                    /* 24px circle, 44px hit area. Correcting
                                                       a mistyped set is a two-attempt tap at
                                                       24px with a wet thumb, and the whole
                                                       point of the tick is that fixing a
                                                       mistake is easy. The ring itself stays
                                                       small — the target around it does not
                                                       have to be visible to work. */
                                                    className="w-tap h-tap -m-[10px] rounded-full flex items-center justify-center active:scale-95 transition-transform duration-150"
                                                    aria-label={`Set ${si + 1} logged. Tap to edit.`}
                                                  >
                                                    <span className="w-6 h-6 rounded-full bg-state-success/20 flex items-center justify-center">
                                                      <svg className="w-3.5 h-3.5 text-state-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                                      </svg>
                                                    </span>
                                                  </button>
                                                ) : (
                                                  <div className="w-6 h-6 rounded-full bg-white/[0.04] border border-white/[0.08]" />
                                                )}
                                              </div>
                                            </div>

                                            {/* One tap to log the set in front of you.
                                                This replaces four taps and two typed
                                                numbers per set — roughly 15
                                                interactions a session instead of 60. */}
                                            {isActive && !filled && (
                                              <button
                                                onClick={() => void logThisSet()}
                                                disabled={!canLog}
                                                /* The most-pressed control in the product,
                                                   at 14px in a 40px box. 48px and the label
                                                   step, because this is tapped with shaking
                                                   hands at the end of a heavy set. */
                                                className="w-full mt-snug h-taplg rounded-control bg-brand-blue text-white text-label font-display font-bold uppercase tracking-[0.12em] hover:bg-brand-bluedark active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:active:scale-100"
                                              >
                                                Log set {si + 1}
                                              </button>
                                            )}

                                            {/* One tap for a plank, rather than
                                                a number pad for a round number.
                                                Only on the set being worked on,
                                                so a five-set exercise does not
                                                turn into five rows of buttons. */}
                                            {hold && isActive && !filled && (
                                              <div className="flex flex-wrap gap-1.5 ml-8 mr-10 mt-1.5 mb-1">
                                                {HOLD_PRESETS.map((secs) => (
                                                  <button
                                                    key={secs}
                                                    onClick={() => handleLogChange('reps', String(secs))}
                                                    className={`px-3 py-1.5 rounded-control text-caption font-display font-bold transition-colors duration-150 ${
                                                      shownReps === String(secs)
                                                        ? 'bg-brand-blue text-white'
                                                        : 'bg-white/[0.05] text-ink-2 hover:text-white'
                                                    }`}
                                                  >
                                                    {holdLabel(secs)}
                                                  </button>
                                                ))}
                                              </div>
                                            )}

                                            {bodyweightLooking && (
                                              <p className="ml-8 mr-10 mb-1.5 text-state-warning/80 text-caption font-body">
                                                That looks like your bodyweight. This one is already loaded by you — put ADDED weight here, or 0 if there is none.
                                              </p>
                                            )}

                                            {/* The rest countdown lives in the
                                                pinned bar now, where it is
                                                visible however far the client
                                                has scrolled. */}
                                          </div>
                                        )
                                      })}

                                      {/* A fourth set on a three-set exercise.
                                          There was no way to log one. The rows were
                                          capped at the prescription, so a client who
                                          had another one in them either left it
                                          unrecorded or overwrote a set they had
                                          already done.

                                          Secondary on purpose: Log Set is the thing
                                          being pressed fifteen times a session and
                                          this is the thing being pressed occasionally,
                                          so it is a quiet full-width row rather than
                                          another filled button competing with it.

                                          Nothing is written to the program. The extra
                                          exists in today's session only, and tomorrow
                                          the prescription is what it always was. */}
                                      {!timed && sessionActive && (
                                        <div className="flex items-center gap-2 mt-2">
                                          <button
                                            onClick={() => {
                                              const rows = [...backingLogs]
                                              const last = rows[rows.length - 1]
                                              rows.push({
                                                // Carry the last weight forward: an
                                                // extra set is almost always the same
                                                // load again, and starting from an
                                                // empty box means typing it twice.
                                                // Reps stay empty - that is the part
                                                // nobody can predict.
                                                weight: last?.weight ?? '',
                                                reps: '',
                                                logged: false,
                                              })
                                              setSetLogs((prev) => ({ ...prev, [logKey]: rows }))
                                            }}
                                            className="flex-1 h-tap rounded-control border border-white/[0.10] text-ink-2 text-label font-display font-bold uppercase tracking-wide hover:text-white hover:bg-white/[0.04] active:scale-[0.98] transition-all duration-150"
                                          >
                                            + Add set
                                          </button>

                                          {/* Only an added set, and only an empty one.
                                              Removing something already logged is a
                                              different act and needs asking about; a
                                              row added by mistake and never filled in
                                              is just a tidy-up. */}
                                          {extraSets > 0 && !backingLogs[backingLogs.length - 1]?.logged && (
                                            <button
                                              onClick={() => {
                                                setSetLogs((prev) => ({
                                                  ...prev,
                                                  [logKey]: backingLogs.slice(0, backingLogs.length - 1),
                                                }))
                                              }}
                                              className="h-tap px-card rounded-control border border-white/[0.10] text-ink-4 text-label font-display font-bold uppercase tracking-wide hover:text-state-danger active:scale-[0.98] transition-all duration-150"
                                              aria-label="Remove the set just added"
                                            >
                                              Undo
                                            </button>
                                          )}
                                        </div>
                                      )}

                                      {/* How hard was that?
                                          One optional tap per exercise, not per set. The program
                                          tells everyone to leave reps in reserve and never asks
                                          whether they did, which is why a stall cannot be read:
                                          stuck at 135x9 with three left is an effort problem,
                                          stuck at 135x9 with nothing left is a real plateau, and
                                          without this they are the same row in the database.

                                          Asked when the exercise is FINISHED, not as soon as one
                                          set lands. 2 of 432 sets in production carry a rating:
                                          it appeared mid-exercise, greyed, while the client was
                                          still working, which is the wrong moment to ask and the
                                          wrong weight to ask it at. */}
                                      {!explosive && currentLogs.length > 0 && currentLogs.every((l) => l.logged) && (
                                        <div className="mt-3 flex items-center gap-2 flex-wrap rounded-control bg-white/[0.03] border border-white/[0.07] px-3 py-2.5">
                                          <span className="text-ink-2 text-caption font-display font-bold uppercase tracking-wide">
                                            {treatAsBeginner ? 'Could you have done more?' : 'Reps left in the tank?'}
                                          </span>
                                          {/* What the program actually asked for.
                                              This question has been here a while and only 2 of 432
                                              sets in production carry an answer — which is what a
                                              question with no target gets. The program has always
                                              known the number; it just never said it. */}
                                          {exercise.targetRir != null && (
                                            <span className="text-ink-4 text-caption font-body">
                                              aim for {exercise.targetRir}
                                            </span>
                                          )}
                                          {[0, 1, 2, 3].map((n) => {
                                            const on = rirByExercise[logKey] === n
                                            const isTarget = exercise.targetRir === n && !on
                                            return (
                                              <button
                                                key={n}
                                                onClick={() => {
                                                  setRirByExercise((prev) => ({ ...prev, [logKey]: n }))
                                                  const wid = selectedDay !== null ? workoutIds[selectedDay] : null
                                                  if (!userId || !wid) return
                                                  // Stamp it on the last completed set: the final
                                                  // set is the one whose difficulty means anything.
                                                  const lastIdx = backingLogs.reduce(
                                                    (acc, l, i) => (l.logged ? i : acc),
                                                    -1
                                                  )
                                                  if (lastIdx < 0) return
                                                  const l = backingLogs[lastIdx]
                                                  void saveSetSafely(`${logKey}-${lastIdx}`, {
                                                    workoutId: wid,
                                                    userId,
                                                    exerciseName: displayName,
                                                    originalExerciseName: isSwapped ? exercise.name : null,
                                                    setNumber: lastIdx + 1,
                                                    weight: Number(l.weight) || null,
                                                    reps: Number(l.reps) || null,
                                                    isIntensitySet: false,
                                                    completed: true,
                                                    rir: n,
                                                  })
                                                }}
                                                className={`h-11 min-w-11 px-3 rounded-control text-label font-display font-bold transition-colors duration-150 ${
                                                  on
                                                    ? 'bg-brand-blue text-white'
                                                    : isTarget
                                                      ? 'bg-white/[0.04] text-ink-2 ring-1 ring-brand-blue/40'
                                                      : 'bg-white/[0.04] text-ink-3 hover:text-ink-2'
                                                }`}
                                              >
                                                {n === 0 ? 'Nothing' : n === 3 ? '3+' : n}
                                              </button>
                                            )
                                          })}
                                        </div>
                                      )}

                                      {/* Intensity Technique toggle.
                                          Available to every client. It is opt-in
                                          and defaults to off, so it costs nothing
                                          until someone reaches for it — and a
                                          client deciding whether to take a set to
                                          failure does not need the app deciding
                                          for them.

                                          The only gate is the movement: a drop
                                          set on a box jump or a treadmill walk is
                                          not a thing, and both were being offered
                                          it before Phase 1. */}
                                      {!timed && !explosive && (
                                      <div className="mt-3 rounded-control bg-white/[0.02] border border-white/[0.06] p-3">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <svg className="w-3.5 h-3.5 text-ink-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            <span className="text-ink-2 text-caption font-display font-bold uppercase tracking-wide">Intensity Technique</span>
                                          </div>
                                          <button
                                            onClick={() => {
                                              setIntensityOn((prev) => ({ ...prev, [logKey]: !intensityEnabled }))
                                              if (!intensityEnabled && !selectedTechnique) {
                                                setIntensityChoice((prev) => ({ ...prev, [logKey]: 'dropset' }))
                                              }
                                            }}
                                            role="switch"
                                            aria-checked={intensityEnabled}
                                            aria-label="Toggle intensity technique"
                                            className={`relative inline-flex shrink-0 h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                                              intensityEnabled ? 'bg-brand-orange' : 'bg-white/15'
                                            }`}
                                          >
                                            <span
                                              aria-hidden="true"
                                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                intensityEnabled ? 'translate-x-5' : 'translate-x-0.5'
                                              }`}
                                            />
                                          </button>
                                        </div>

                                        {/* Technique picker, visible when on */}
                                        {intensityEnabled && (
                                          <div className="grid grid-cols-3 gap-1.5 mt-3">
                                            {(['dropset', 'restpause', 'partial'] as IntensityTechnique[]).map((key) => {
                                              const meta = TECHNIQUE_META[key]
                                              const isSelected = selectedTechnique === key
                                              return (
                                                <button
                                                  key={key}
                                                  onClick={() => setIntensityChoice((prev) => ({ ...prev, [logKey]: key }))}
                                                  className={`py-2 px-2 rounded-control text-caption font-display font-bold uppercase tracking-wide transition-all duration-150 border ${
                                                    isSelected ? '' : 'bg-white/[0.03] border-white/[0.06] text-ink-3 hover:text-ink-2 hover:bg-white/[0.05]'
                                                  }`}
                                                  style={
                                                    isSelected
                                                      ? { backgroundColor: `${meta.color}22`, borderColor: `${meta.color}55`, color: meta.color }
                                                      : undefined
                                                  }
                                                >
                                                  {meta.label}
                                                </button>
                                              )
                                            })}
                                          </div>
                                        )}

                                        {/* Intensity set logger */}
                                        {intensityEnabled && selectedTechnique && (
                                          <div className="mt-3 pt-3 border-t border-white/[0.05]">
                                            <p className="text-ink-4 text-caption font-body leading-relaxed mb-3">
                                              {TECHNIQUE_META[selectedTechnique].hint}
                                            </p>
                                            <div className="grid grid-cols-[32px_1fr_40px] gap-2 mb-1.5">
                                              <span className="text-ink-4 text-caption font-display font-bold uppercase tracking-wide text-center">Set</span>
                                              <span className="text-ink-4 text-caption font-display font-bold uppercase tracking-wide">Weight (lbs)</span>
                                              <span className="text-ink-4 text-caption font-display font-bold uppercase tracking-wide text-center">Fail</span>
                                            </div>
                                            {currentIntensityLogs.map((iLog, idx) => {
                                              const meta = TECHNIQUE_META[selectedTechnique]
                                              const handleIntensityChange = (field: 'weight' | 'done', value: string | boolean) => {
                                                const updated = [...currentIntensityLogs]
                                                updated[idx] = { ...updated[idx], [field]: value }
                                                setIntensityLogs((prev) => ({ ...prev, [logKey]: updated }))

                                                // Persist to DB
                                                const wid = selectedDay !== null ? workoutIds[selectedDay] : null
                                                if (userId && wid) {
                                                  const row = updated[idx]
                                                  void saveSetSafely(`${logKey}-int${idx}`, {
                                                    workoutId: wid,
                                                    userId,
                                                    exerciseName: displayName,
                                                    originalExerciseName: isSwapped ? exercise.name : null,
                                                    setNumber: idx + 1,
                                                    weight: Number(row.weight) || null,
                                                    reps: null, // intensity sets are to failure, no rep count
                                                    isIntensitySet: true,
                                                    intensityTechnique: selectedTechnique,
                                                    completed: row.done,
                                                  })
                                                }
                                              }
                                              return (
                                                <div
                                                  key={idx}
                                                  className={`grid grid-cols-[32px_1fr_40px] gap-2 mb-1 items-center rounded-control px-1 py-0.5`}
                                                  style={iLog.done ? { backgroundColor: `${meta.color}15` } : undefined}
                                                >
                                                  <span
                                                    className="text-label font-display font-bold text-center"
                                                    style={{ color: iLog.done ? meta.color : 'rgba(255,255,255,0.3)' }}
                                                  >
                                                    {idx + 1}
                                                  </span>
                                                  <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    placeholder="lbs"
                                                    value={iLog.weight}
                                                    onFocus={selectAllOnFocus}
                                                    onChange={(e) => handleIntensityChange('weight', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-control text-white text-body font-body text-center placeholder:text-white/15 focus:outline-none transition-colors duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    style={{ borderColor: iLog.done ? `${meta.color}55` : undefined }}
                                                  />
                                                  <div className="flex items-center justify-center">
                                                    <button
                                                      onClick={() => handleIntensityChange('done', !iLog.done)}
                                                      className="w-6 h-6 rounded-control border flex items-center justify-center transition-all duration-150"
                                                      style={{
                                                        borderColor: iLog.done ? meta.color : 'rgba(255,255,255,0.1)',
                                                        backgroundColor: iLog.done ? `${meta.color}33` : 'rgba(255,255,255,0.04)',
                                                      }}
                                                      aria-label={iLog.done ? 'Mark incomplete' : 'Mark complete'}
                                                    >
                                                      {iLog.done && (
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={meta.color} strokeWidth={3}>
                                                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                                        </svg>
                                                      )}
                                                    </button>
                                                  </div>
                                                </div>
                                              )
                                            })}
                                            <p className="text-ink-4 text-caption font-body mt-2 text-center">
                                              To failure, check when complete
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                      )}

                                      {/* Target reminder.
                                          Rendered unconditionally, so a 20-minute
                                          row session read "Target: 20 min reps". */}
                                      {!timed && (
                                        <p className="text-ink-4 text-caption font-body mt-2 text-center">
                                          Target: {exercise.reps}{hold ? '' : explosive ? ' efforts' : ' reps'}
                                        </p>
                                      )}

                                      {/* While training, swapping lives in the
                                          exercise header — it used to sit below
                                          the sets, the RIR row and the whole
                                          intensity block, three scrolls into an
                                          expanded card, at the exact moment the
                                          client is standing at an occupied rack.
                                          Browsing keeps a plain button here. */}
                                      {!sessionActive && alternatives.length > 0 && (
                                        <button
                                          onClick={() => setSwapFor(exercise.name)}
                                          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-control bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.10] transition-colors duration-200"
                                        >
                                          <svg className="w-3.5 h-3.5 text-ink-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                          </svg>
                                          <span className="text-ink-3 text-caption font-display font-bold uppercase tracking-wide">
                                            {isSwapped ? 'Change substitute' : 'Swap exercise'}
                                          </span>
                                        </button>
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

                {/* Moving through the session.
                    Finishing an exercise used to mean scrolling, collapsing it
                    and finding the next one. Skip is explicit so the
                    progression engine can tell "chose not to do this" from
                    "never came back to it". */}
                {sessionActive && selected && (
                  <div className="px-4 pb-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => goToExercise(focusIndex - 1)}
                        disabled={focusIndex === 0}
                        className="px-card h-taplg rounded-control bg-white/[0.06] text-ink-2 text-label font-display font-bold uppercase tracking-wide hover:bg-white/[0.10] active:scale-[0.98] transition-all duration-200 disabled:opacity-30 disabled:active:scale-100"
                      >
                        Back
                      </button>
                      {focusIndex < selected.exercises.length - 1 ? (
                        <button
                          onClick={() => goToExercise(focusIndex + 1)}
                          className="flex-1 min-w-0 px-card h-taplg rounded-control bg-brand-blue text-white text-label font-display font-bold uppercase tracking-wide hover:bg-brand-bluedark active:scale-[0.98] transition-all duration-200"
                        >
                          <span className="block truncate">
                            Next: {swappedExercises[`${selectedDay}-${selected.exercises[focusIndex + 1].name}`] ?? selected.exercises[focusIndex + 1].name}
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmEnd(tallySession())}
                          className="flex-1 px-card h-taplg rounded-control bg-brand-orange text-white text-label font-display font-bold uppercase tracking-wide hover:bg-brand-orangedark active:scale-[0.98] transition-all duration-200"
                        >
                          Finish Workout
                        </button>
                      )}
                    </div>
                    {!exerciseProgress[focusIndex]?.complete && (
                      <button
                        onClick={() => {
                          const key = `${selectedDay}-${selected.exercises[focusIndex].name}`
                          setSkipped((prev) => ({ ...prev, [key]: true }))
                          if (focusIndex < selected.exercises.length - 1) goToExercise(focusIndex + 1)
                        }}
                        className="w-full h-tap text-ink-4 text-caption font-display font-bold uppercase tracking-wide hover:text-ink-2 transition-colors duration-200"
                      >
                        Skip this exercise
                      </button>
                    )}
                  </div>
                )}

                {/* Start / End Workout button */}
                <div className="p-4 pt-0">
                  {selectedDay !== null && workoutStartTime[selectedDay] ? (
                    <div className="space-y-2">
                      {/* The clock and End also live in the pinned bar; this
                          stays for anyone who scrolls to the bottom expecting
                          to find it where it has always been. */}

                      {/* Say it when a set has not reached the server.
                          The green tick on a set row is local state, so without
                          this the screen looks identical whether the write
                          landed or vanished. */}
                      {pendingSets > 0 && (
                        <div className="flex items-center gap-2 rounded-card bg-state-warning/10 border border-state-warning/25 px-4 py-2.5">
                          <span className="w-2 h-2 rounded-full bg-state-warning shrink-0" />
                          <p className="text-state-warning text-caption font-body">
                            {pendingSets} {pendingSets === 1 ? 'set is' : 'sets are'} saved on this phone and waiting for signal. Keep
                            training — they&rsquo;ll sync on their own.
                          </p>
                        </div>
                      )}
                      <button
                        onClick={() => setConfirmEnd(tallySession())}
                        className="w-full py-4 bg-white/[0.04] border border-white/[0.08] text-ink-2 text-label font-display font-bold uppercase tracking-[0.12em] rounded-card hover:bg-white/[0.06] hover:text-white active:scale-[0.98] transition-all duration-200"
                      >
                        End Workout
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        if (selectedDay === null || !selected) return
                        // Must happen inside the tap. A browser will not open an
                        // audio context from a timer callback, so priming it
                        // anywhere else means the rest beep never sounds.
                        primeRestAudio()
                        void primeRestNotifications()
                        setWorkoutStartTime((prev) => ({ ...prev, [selectedDay]: Date.now() }))
                        setWorkoutElapsed(0)
                        setFocusIndex(0)
                        setSkipped({})
                        const firstExercise = selected.exercises[0]
                        if (firstExercise) setExpandedWorkoutExercise(firstExercise.name)

                        // Persist workout if user is identified
                        if (userId) {
                          try {
                            const wid = await dbStartWorkout({
                              userId,
                              dayName: selected.name,
                              programName: currentProgram.name,
                              programPhase: currentProgram.phase,
                            })
                            setWorkoutIds((prev) => ({ ...prev, [selectedDay]: wid }))
                          } catch (err) {
                            console.error('[Workout] Failed to create:', err)
                          }
                        }
                      }}
                      className="w-full py-4 bg-brand-blue text-white text-label font-display font-bold uppercase tracking-[0.12em] rounded-card hover:bg-brand-bluedark active:scale-[0.98] transition-transform duration-200"
                    >
                      Start Workout
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════ VIEW 4: PROGRAM BUILDER ════════ */}
          {/* ════════ VIEW 6: WHERE A PROGRAM COMES FROM ════════ */}
          {view === 'startFrom' && (
            <motion.div key="startFrom" {...slideIn}>
              <StartFrom
                followingId={assignedProgramId}
                followingName={currentProgram?.name ?? null}
                atLimit={myPrograms.length >= MAX_CUSTOM_PROGRAMS}
                savedCount={myPrograms.length}
                loadLibrary={fetchLibraryPrograms}
                onCopy={(id) => openBuilder(id, null)}
                onScratch={openBlankBuilder}
                onPickReadyMade={() => { setView('preview'); setShowPicker(true) }}
                onMyPrograms={openMyPrograms}
                onCancel={() => setView('preview')}
              />
            </motion.div>
          )}

          {view === 'builder' && builderDraft && (
            <motion.div key="builder" {...slideIn}>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => askBeforeLeavingBuilder(leaveBuilderBack)}
                  className="text-ink-3 hover:text-ink-2 text-label font-display font-semibold uppercase tracking-wide transition-colors duration-200"
                >
                  ‹ Back
                </button>
              </div>
              <ProgramBuilder
                initial={builderDraft}
                library={exerciseDB}
                saving={builderSaving}
                editing={Boolean(builderEditingId)}
                /* Editing the program you are training is a save, full stop —
                   you are already on it, so there is nothing to "start".
                   Anything else saves to My programs, where Use starts it.
                   Starting a program is one named action in one place rather
                   than a second button on every save. */
                onSave={(program) =>
                  void handleBuilderSave(program, builderEditingId === assignedProgramId)
                }
                saveLabel={builderEditingId === assignedProgramId ? 'Save' : 'Save to my programs'}
                onRequestExercise={requestExercise}
                onDirtyChange={setBuilderDirty}
                onCancel={() => askBeforeLeavingBuilder(leaveBuilderBack)}
              />
            </motion.div>
          )}

          {/* ════════ VIEW 5: MY PROGRAMS ════════ */}
          {view === 'myPrograms' && (
            <motion.div key="myPrograms" {...slideIn}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <button
                  onClick={() => setView('preview')}
                  className="text-ink-3 hover:text-ink-2 text-label font-display font-semibold uppercase tracking-wide transition-colors duration-200"
                >
                  ‹ Back
                </button>
                <span className="text-ink-4 text-caption font-body">
                  {myPrograms.length} of {MAX_CUSTOM_PROGRAMS}
                </span>
              </div>

              <h2 className="font-display font-extrabold text-xl text-white tracking-tight mb-4">My programs</h2>

              {/* Renaming a day moves its logged sessions across, because the
                  rotation matches them by name. Silence here would look like
                  the history had been lost. */}
              {builderMoved !== null && (
                <p className="text-state-success/90 text-label font-body mb-4 px-3.5 py-2.5 rounded-control bg-state-success/[0.08] border border-state-success/20">
                  Saved. {builderMoved} logged {builderMoved === 1 ? 'session' : 'sessions'} moved across to the
                  renamed {builderMoved === 1 ? 'day' : 'days'}, so nothing is lost.
                </p>
              )}

              {myPrograms.length === 0 ? (
                <p className="text-ink-4 text-body font-body text-center py-10">
                  Nothing saved yet. Customize the program you&rsquo;re on, or build one from scratch.
                </p>
              ) : (
                <div className="space-y-2">
                  {myPrograms.map((p) => (
                    <div key={p.id} className="rounded-card bg-surface-raised border border-white/[0.10] px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="min-w-0 flex-1">
                          {renaming?.id === p.id ? (
                            // Inline, not a modal: renaming is one field and a
                            // dialog for one field is a dialog too many.
                            <input
                              autoFocus
                              value={renaming.name}
                              onChange={(e) => setRenaming({ id: p.id, name: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') void commitRename(); if (e.key === 'Escape') setRenaming(null) }}
                              onBlur={() => void commitRename()}
                              className="w-full px-2.5 py-1.5 rounded-control bg-white/[0.06] border border-brand-blue/40 text-white text-body font-display font-bold focus:outline-none"
                              aria-label="Program name"
                            />
                          ) : (
                            <span className="block text-white text-label font-display font-bold truncate">{p.name}</span>
                          )}
                          <span className="block text-ink-3 text-label font-body mt-0.5">
                            {p.days_per_week ?? 0} {p.days_per_week === 1 ? 'day' : 'days'} a week
                          </span>
                        </span>
                        <button
                          onClick={() => openBuilder(p.id, p.id)}
                          className="shrink-0 px-3 py-2 rounded-control bg-white/[0.06] text-ink-2 text-caption font-display font-bold uppercase tracking-wide hover:text-white active:scale-95 transition-all duration-150"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (!userId) return
                            try {
                              // Re-picking the program they are already on is
                              // not a switch and must not restart the block.
                              await activateCustomProgram(userId, p.id, {
                                continueBlock: p.id === assignedProgramId,
                              })
                              await applyLoadedProgram(p.id, userId)
                              setSelectedDay(null)
                              setShowPicker(false)
                              setView('preview')
                              setWriteError(null)
                            } catch (err) {
                              // This throws when the current assignment could
                              // not be closed, which would otherwise leave the
                              // client on two programs at once. Unhandled, the
                              // button simply did nothing and said nothing.
                              console.error('[Use program] Failed:', err)
                              setWriteError(
                                `Could not start "${p.name}". You are still on your current program — try again.`
                              )
                            }
                          }}
                          className="shrink-0 px-3 py-2 rounded-control bg-brand-blue text-white text-caption font-display font-bold uppercase tracking-wide hover:bg-brand-bluedark active:scale-95 transition-all duration-150"
                        >
                          Use
                        </button>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <button
                          onClick={() => { setRenaming({ id: p.id, name: p.name }); }}
                          className="text-ink-4 hover:text-ink-2 text-caption font-body transition-colors duration-150"
                        >
                          Rename
                        </button>
                        {/* Try a variation without losing what works: duplicate
                            the 5-day, cut it to 4, keep both. A duplicate is a
                            program, not a switch — nothing changes about what
                            they are training until they hit Use. */}
                        <button
                          onClick={async () => {
                            if (!userId || myPrograms.length >= MAX_CUSTOM_PROGRAMS) return
                            await duplicateCustomProgram(userId, p.id)
                            setMyPrograms(await fetchMyCustomPrograms(userId))
                          }}
                          disabled={myPrograms.length >= MAX_CUSTOM_PROGRAMS}
                          className="text-ink-4 hover:text-ink-2 disabled:opacity-40 text-caption font-body transition-colors duration-150"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={async () => {
                            if (!userId) return
                            await deleteCustomProgram(p.id)
                            setMyPrograms(await fetchMyCustomPrograms(userId))
                          }}
                          className="text-ink-4 hover:text-state-danger text-caption font-body transition-colors duration-150"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setView('startFrom')}
                disabled={myPrograms.length >= MAX_CUSTOM_PROGRAMS}
                className="w-full mt-4 py-3.5 rounded-card bg-white/[0.04] border border-white/[0.08] text-ink-2 text-label font-display font-bold uppercase tracking-wide hover:text-white disabled:opacity-30 transition-colors duration-200"
              >
                + Build another
              </button>
              {myPrograms.length >= MAX_CUSTOM_PROGRAMS && (
                <p className="text-ink-4 text-label font-body text-center mt-2">
                  Delete one to make room.
                </p>
              )}
            </motion.div>
          )}

          {/* ════════ VIEW 3: EXERCISE DETAIL ════════ */}
          {view === 'exercise' && selectedExerciseData && (
            <motion.div key="exercise" {...slideIn}>
              <div className="bg-surface-raised rounded-card border border-white/[0.10] overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/[0.10]">
                  <button
                    onClick={() => { setView('workout'); setSelectedExercise(null) }}
                    className="flex items-center gap-2 text-ink-3 hover:text-ink-2 transition-colors duration-200 mb-3"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                    <span className="text-label font-display font-semibold uppercase tracking-wide">Back to Workout</span>
                  </button>
                  <h2 className="font-display font-extrabold text-xl text-white tracking-tight">
                    {selectedExerciseData.name}
                  </h2>

                  {/* Muscle tags */}
                  {selectedExerciseDB && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {selectedExerciseDB.primaryMuscles.map((m) => (
                        <span key={m} className="px-2.5 py-1 rounded-control bg-brand-orange/15 text-brand-orange text-caption font-display font-bold uppercase tracking-wide capitalize">
                          {m}
                        </span>
                      ))}
                      {selectedExerciseDB.secondaryMuscles.map((m) => (
                        <span key={m} className="px-2.5 py-1 rounded-control bg-brand-blue/15 text-brand-blueink text-caption font-display font-bold uppercase tracking-wide capitalize">
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
                      <h3 className="text-ink-4 text-caption font-display font-bold uppercase tracking-[0.15em] mb-3">Setup</h3>
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
                      <h3 className="text-ink-4 text-caption font-display font-bold uppercase tracking-[0.15em] mb-3">Target</h3>
                      <div className="flex flex-col sm:flex-row gap-4 items-start">
                        <div className="w-full sm:w-48 shrink-0">
                          <MuscleMap
                            target={selectedExerciseDB.primaryMuscles[0] || ''}
                            secondaryMuscles={selectedExerciseDB.secondaryMuscles}
                            size="sm"
                            theme="dark"
                          />
                        </div>
                        <div className="flex-1 space-y-3">
                          {selectedExerciseDB.primaryMuscles.map((m) => (
                            <div key={m} className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-control bg-brand-orange/10 flex items-center justify-center shrink-0">
                                <div className="w-4 h-4 rounded-control bg-brand-orange" />
                              </div>
                              <div>
                                <p className="text-white font-body font-semibold text-label capitalize">{m}</p>
                                <p className="text-brand-orange text-caption font-display font-bold uppercase tracking-wide">Primary</p>
                              </div>
                            </div>
                          ))}
                          {selectedExerciseDB.secondaryMuscles.map((m) => (
                            <div key={m} className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-control bg-brand-blue/10 flex items-center justify-center shrink-0">
                                <div className="w-4 h-4 rounded-control bg-brand-blue" />
                              </div>
                              <div>
                                <p className="text-ink-2 font-body font-semibold text-label capitalize">{m}</p>
                                <p className="text-brand-blueink text-caption font-display font-bold uppercase tracking-wide">Secondary</p>
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
                      <h3 className="text-ink-4 text-caption font-display font-bold uppercase tracking-[0.15em] mb-3">Instructions</h3>
                      <ol className="space-y-3">
                        {selectedExerciseDB.instructions.map((step, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-state-success/10 text-state-success flex items-center justify-center text-caption font-display font-bold mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-ink-2 text-body font-body leading-relaxed">{step}</p>
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
        {/* Personal records.
            Moved off the home screen, which should answer one question —
            what am I doing today — and was answering eight. This is the
            screen you are on when you wonder what you have lifted. */}
        {prList.length > 0 && (
          <motion.div custom={0} variants={fadeIn} initial="hidden" animate="visible" className="bg-surface-raised rounded-card border border-white/[0.10]">
            <div className="px-5 py-4 border-b border-white/[0.10]">
              <h2 className="font-display font-bold text-heading text-white">Personal Records</h2>
            </div>
            <div className="p-4 space-y-2">
              {prList.map((pr) => (
                <div
                  key={pr.exercise_name + pr.set_at}
                  className="flex items-center justify-between gap-3 rounded-control bg-white/[0.03] border border-white/[0.06] px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-white text-body font-body font-semibold truncate">{pr.exercise_name}</p>
                    <p className="text-ink-3 text-label font-body mt-0.5">
                      {new Date(pr.set_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {pr.previous_weight ? ` · up from ${Number(pr.previous_weight)} lbs` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-display font-extrabold text-white text-label tabular-nums">
                    {Number(pr.weight)}
                    <span className="text-ink-3 text-label font-body"> lbs × {pr.reps}</span>
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recent Workout Logs */}
        <motion.div custom={0} variants={fadeIn} initial="hidden" animate="visible" className="bg-surface-raised rounded-card border border-white/[0.10]">
          <div className="px-5 py-4 border-b border-white/[0.10] flex items-center justify-between">
            <h2 className="font-display font-bold text-heading text-white">Workout History</h2>
            {history.length > 0 && (
              <span className="text-ink-4 text-caption font-display font-bold uppercase tracking-wide">
                {history.length} logged
              </span>
            )}
          </div>
          <div className="p-4">
            {history.length === 0 ? (
              <p className="text-ink-3 text-body font-body leading-relaxed px-1">
                Your logged workouts will show up here. Start a session above and log your sets to build your history.
              </p>
            ) : (
              <ul className="space-y-2">
                {history.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between gap-3 rounded-control bg-white/[0.03] border border-white/[0.06] px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-white text-body font-body font-semibold truncate">{w.day_name}</p>
                      <p className="text-ink-3 text-label font-body mt-0.5">
                        {formatHistoryDate(w)} &middot; {w.set_count} {w.set_count === 1 ? 'set' : 'sets'}
                        {w.duration_seconds ? ` · ${formatDuration(w.duration_seconds)}` : ''}
                      </p>
                    </div>
                    {/* Volume sits in its own right-hand column rather than on
                        the end of the meta line, and the reason is the list
                        rather than the row: right-aligned, the figures stack
                        into a column you can run your eye down, which is the
                        only way a history list answers "am I moving more than
                        I was". On the end of the sentence it would be a fourth
                        clause nobody reads.
                        Absent on a bodyweight session — the row says nothing
                        rather than claiming a zero. */}
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {w.ended_at ? (
                        <span className="text-badge font-display font-bold uppercase tracking-wide text-state-success bg-state-success/10 px-2 py-0.5 rounded-full">
                          Done
                        </span>
                      ) : (
                        <span className="text-badge font-display font-bold uppercase tracking-wide text-state-warning bg-state-warning/10 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                      {w.volume > 0 && (
                        <span className="text-ink-2 text-caption font-display font-bold tabular-nums">
                          {w.volume.toLocaleString()} <span className="text-ink-4">lb</span>
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>

        {/* Your Coach */}
        <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="bg-surface-raised rounded-card border border-white/[0.10]">
          <div className="px-5 py-4 border-b border-white/[0.10]">
            <h2 className="font-display font-bold text-heading text-white">Your Coach</h2>
          </div>
          <div className="p-5">
            <p className="text-ink-3 text-body font-body leading-relaxed">
              A personalized program built around your goals is on the way. In the meantime, follow this sample routine and message Coach Anthony anytime.
            </p>
            <a
              href="/studio/messages"
              className="mt-4 inline-block text-brand-blueink text-label font-display font-bold uppercase tracking-wide hover:underline"
            >
              Message Coach →
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

/* ── PR Celebration — confetti + trophy badge when a client beats a record ── */
function PRCelebration({ name, weight, onDone }: { name: string; weight: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3400)
    return () => clearTimeout(t)
  }, [onDone])

  const colors = ['#F59E0B', '#F76B16', '#1A7BFF', '#22C55E', '#EF4444', '#A855F7']
  const pieces = Array.from({ length: 48 }, (_, i) => i)

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center overflow-hidden">
      {pieces.map((i) => {
        const left = Math.random() * 100
        const delay = Math.random() * 0.35
        const duration = 1.8 + Math.random() * 1.6
        const size = 7 + Math.random() * 9
        return (
          <motion.div
            key={i}
            initial={{ y: '-12vh', opacity: 1, rotate: 0 }}
            animate={{ y: '112vh', x: (Math.random() - 0.5) * 240, rotate: Math.random() * 900, opacity: [1, 1, 0.9, 0] }}
            transition={{ duration, delay, ease: 'easeIn' }}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: 0,
              width: size,
              height: size * 0.45,
              backgroundColor: colors[i % colors.length],
              borderRadius: 2,
            }}
          />
        )
      })}
      <motion.div
        initial={{ scale: 0.3, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 15 }}
        className="relative text-center px-9 py-7 rounded-card bg-surface-raised border-2 border-brand-gold/50 shadow-[0_10px_60px_rgba(212,175,55,0.35)]"
      >
        <button
          onClick={onDone}
          className="absolute top-3 right-3 w-8 h-8 rounded-control bg-white/[0.08] hover:bg-white/[0.14] active:scale-[0.92] transition-all duration-200 flex items-center justify-center text-ink-2 hover:text-white/90 pointer-events-auto"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <motion.div
          className="text-5xl mb-1"
          animate={{ rotate: [0, -12, 12, -8, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 0.8, delay: 0.15 }}
        >
          🏆
        </motion.div>
        <p className="font-display font-extrabold text-2xl uppercase tracking-tight text-brand-gold">New PR!</p>
        <p className="text-white font-body font-semibold text-label mt-1">{name}</p>
        <p className="text-ink-2 font-display font-bold text-lg mt-0.5">{weight} lbs</p>
      </motion.div>
    </div>
  )
}

function ExerciseImageCycler({ images, name }: { images: string[]; name: string }) {
  const [showEnd, setShowEnd] = useState(false)

  useEffect(() => {
    if (!images[1]) return
    const interval = setInterval(() => setShowEnd((p) => !p), 2500)
    return () => clearInterval(interval)
  }, [images])

  return (
    <div className="relative w-full h-56 rounded-card overflow-hidden bg-[#0A0A0A] border border-white/[0.10]">
      <img
        src={images[0]}
        alt={`${name}, start`}
        className="absolute inset-0 w-full h-full object-contain p-2 transition-opacity duration-[1500ms]"
        style={{ opacity: showEnd && images[1] ? 0 : 1 }}
      />
      {images[1] && (
        <img
          src={images[1]}
          alt={`${name}, end`}
          className="absolute inset-0 w-full h-full object-contain p-2 transition-opacity duration-[1500ms]"
          style={{ opacity: showEnd ? 1 : 0 }}
        />
      )}
      <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 rounded-control text-badge font-display font-semibold text-ink-2 uppercase tracking-wide backdrop-blur-sm">
        {showEnd && images[1] ? 'End' : 'Start'}
      </div>
    </div>
  )
}

function SetupCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-card bg-white/[0.06] border border-white/[0.10]">
      <div className="w-10 h-10 rounded-control bg-white/[0.06] flex items-center justify-center">
        {icon === 'equipment' && (
          <svg className="w-5 h-5 text-ink-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
          </svg>
        )}
        {icon === 'level' && (
          <svg className="w-5 h-5 text-ink-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
        )}
        {icon === 'category' && (
          <svg className="w-5 h-5 text-ink-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
          </svg>
        )}
      </div>
      <div className="text-center">
        <p className="text-ink-4 text-badge font-display font-bold uppercase tracking-wide">{label}</p>
        <p className="text-white text-label font-body font-semibold capitalize mt-0.5">{value}</p>
      </div>
    </div>
  )
}

/**
 * Shown when a client finishes a session. Deliberately quieter than
 * PRCelebration — confetti should stay special to a record — but showing up
 * is the habit worth reinforcing, and it previously got no acknowledgement at
 * all.
 */
/**
 * The end of a block.
 *
 * Before this there was nothing here at all: a program ran until the client
 * chose something else, and eight weeks of work produced no moment where
 * anybody looked at what had happened. Every number on this screen comes from
 * sets they already logged — the value is entirely in putting them in one
 * place at the one moment a client is ready to think about what is next.
 */
function BlockComplete({
  review,
  onPickNew,
  onKeepGoing,
}: {
  review: BlockReview
  onPickNew: () => void
  onKeepGoing: () => void
}) {
  const next = recommendNextBlock(review)
  const movers = review.lifts.filter((l) => l.change !== 0).slice(0, 5)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/75 overflow-y-auto py-8">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="w-full max-w-md px-7 py-8 rounded-card bg-surface-raised border border-brand-orange/40 shadow-[0_10px_60px_rgba(247,107,22,0.25)]"
      >
        <p className="text-brand-orange text-caption font-display font-bold uppercase tracking-[0.2em]">
          Plan complete
        </p>
        <h2 className="font-display font-extrabold text-2xl text-white tracking-tight mt-2 mb-4">
          {review.weeks} weeks done
        </h2>

        <p className="text-ink-2 text-body font-body leading-relaxed mb-5">{review.headline}</p>

        <div className="flex items-start gap-3 mb-5">
          {[
            [String(review.sessions), review.sessions === 1 ? 'Session' : 'Sessions'],
            [String(review.perWeek), 'Per week'],
            [String(review.improved), review.improved === 1 ? 'Lift up' : 'Lifts up'],
          ].map(([value, label]) => (
            <div key={label} className="flex-1">
              <p className="font-display font-extrabold text-xl text-white tabular-nums">{value}</p>
              <p className="text-ink-3 text-caption font-display font-bold uppercase tracking-[0.15em] mt-0.5">
                {label}
              </p>
            </div>
          ))}
        </div>

        {movers.length > 0 && (
          <div className="rounded-control border border-white/[0.08] divide-y divide-white/[0.06] mb-5">
            {movers.map((l) => (
              <div key={l.exercise} className="flex items-center justify-between px-3.5 py-2.5 gap-3">
                <span className="text-ink-2 text-label font-body truncate">{l.exercise}</span>
                <span
                  className={`shrink-0 text-label font-body font-semibold tabular-nums ${
                    l.change > 0 ? 'text-state-success' : 'text-state-warning'
                  }`}
                >
                  {l.first} → {l.last} lbs
                </span>
              </div>
            ))}
          </div>
        )}

        {review.weightChangeLb !== null && review.weightChangeLb !== 0 && (
          <p className="text-ink-3 text-label font-body mb-5">
            Bodyweight {review.weightChangeLb > 0 ? 'up' : 'down'}{' '}
            {Math.abs(review.weightChangeLb)} lbs across the block.
          </p>
        )}

        <div className="rounded-control bg-brand-blue/[0.08] border border-brand-blue/25 px-4 py-3.5 mb-6">
          <p className="font-display font-bold text-white text-label">{next.title}</p>
          <p className="text-ink-2 text-label font-body leading-relaxed mt-1">{next.detail}</p>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={onPickNew}
            className="flex-1 py-3.5 bg-brand-orange text-white text-label font-display font-bold uppercase tracking-[0.12em] rounded-control hover:bg-brand-orangedark active:scale-[0.98] transition-all duration-200"
          >
            Choose next
          </button>
          <button
            onClick={onKeepGoing}
            className="flex-1 py-3.5 bg-white/[0.06] text-ink-2 text-label font-display font-bold uppercase tracking-[0.12em] rounded-control hover:bg-white/[0.12] transition-colors duration-200"
          >
            Keep this one
          </button>
        </div>
      </motion.div>
    </div>
  )
}

/**
 * Swapping an exercise, at the moment it is actually needed.
 *
 * The alternatives themselves were never the problem — the engine matches on
 * movement pattern and equipment and is good. What was wrong was that the
 * button lived three scrolls down inside an expanded card, and that every swap
 * was saved globally and permanently. Two swaps have ever been saved in
 * production, which is not the same as two swaps ever being wanted.
 */
function SwapSheet({
  exerciseName,
  current,
  alternatives,
  library,
  source,
  isSwapped,
  onClose,
  onReset,
  onPick,
}: {
  exerciseName: string
  current: string
  alternatives: string[]
  /** All 873, for the second tab. */
  library: ExerciseDB[]
  /** The exercise being replaced, for the opening filter and the ranking. */
  source: ExerciseDB | null
  isSwapped: boolean
  onClose: () => void
  onReset: () => void
  onPick: (alt: string, forever: boolean, reason: SwapReason | null) => void
}) {
  const [reason, setReason] = useState<'busy' | 'missing' | 'hurts' | null>(null)

  /**
   * Recommended, or the whole library.
   *
   * The recommendations were never the problem — they match on primary
   * muscle, force, mechanic and category, so a cable crossover never stands
   * in for a bench press. The problem was that a list of six is a dead end
   * when the thing you want is the seventh, and the only answer the app had
   * was a list you had already read.
   *
   * Recommended stays the default and stays first. "All" is the escape
   * hatch, and the two are labelled so nobody has to guess which one they
   * are looking at — one is the engine's opinion, the other is the library.
   */
  const [tab, setTab] = useState<'recommended' | 'all'>('recommended')
  const [search, setSearch] = useState('')
  // Opens on the muscle group of the exercise being replaced, which puts the
  // plausible answers on screen before anything is typed. One tap clears it.
  const [group, setGroup] = useState<string | null>(() => groupForMuscle(source?.primaryMuscles?.[0]))
  const [equipment, setEquipment] = useState('any')

  const searching = search.trim().length > 0
  const results = useMemo(
    () =>
      rankForSwap(filterLibrary(library, { search, group, equipment, type: 'any' }), {
        equipment: source?.equipment,
        mechanic: source?.mechanic,
        primaryMuscle: source?.primaryMuscles?.[0],
        excludeName: exerciseName,
      }),
    [library, search, group, equipment, source, exerciseName]
  )
  // 873 rows janks the scroll on a phone, and nobody reads past 40 without
  // narrowing. The count below says how many were left out.
  const shown = results.slice(0, 40)
  /**
   * The chosen alternative, held rather than committed.
   *
   * THIS SHEET USED TO COMMIT ON TAP. Picking an alternative fired the swap
   * and closed the sheet immediately — and the "use this every time" checkbox
   * sat BELOW the list of alternatives, so the control that decided whether
   * the change survived the night was underneath the button that ended the
   * conversation. You could only reach it by noticing it before choosing.
   * Practically nobody did, every swap defaulted to one session, and clients
   * who carefully rebuilt a day came back the next morning to the original
   * program. That is the "my customization disappeared" report.
   *
   * So: tap selects, and the decision that matters is made by its own named
   * button. No default, because there is no sensible default between "the
   * squat rack is busy" and "I am never doing this movement".
   */
  const [chosen, setChosen] = useState<string | null>(null)

  const reasons: Array<{ key: 'busy' | 'missing' | 'hurts'; label: string }> = [
    { key: 'busy', label: "It's busy" },
    { key: 'missing', label: 'Not here' },
    { key: 'hurts', label: "Doesn't feel right" },
  ]

  return (
    <div className="fixed inset-0 z-[68] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="relative w-full sm:max-w-sm max-h-[85vh] overflow-y-auto bg-surface-raised border-t sm:border border-white/[0.12] sm:rounded-card rounded-t-card px-5 py-5"
        role="dialog"
        aria-label={`Swap ${exerciseName}`}
      >
        <p className="text-ink-3 text-caption font-display font-bold uppercase tracking-[0.15em]">Swap</p>
        <h2 className="font-display font-extrabold text-xl text-white tracking-tight mt-1">{exerciseName}</h2>

        <p className="text-ink-3 text-caption font-display font-bold uppercase tracking-wide mt-5 mb-2">Why?</p>
        <div className="flex gap-1.5 flex-wrap">
          {reasons.map((r) => (
            <button
              key={r.key}
              onClick={() => setReason(r.key)}
              className={`px-3 py-2 rounded-control text-label font-body transition-colors duration-150 ${
                reason === r.key ? 'bg-brand-blue text-white' : 'bg-white/[0.06] text-ink-2 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Pain is a coaching signal, not a UI event. It is stored even for a
            one-session swap, and it now reaches the coach's own list rather
            than asking the client to go and write a message about it — which
            is a step most people skip, by quietly avoiding the movement
            instead. */}
        {reason === 'hurts' && (
          <p className="mt-3 px-3 py-2.5 rounded-control bg-state-warning/[0.10] border border-state-warning/25 text-state-warning text-label font-body leading-relaxed">
            Swap it for today &mdash; Coach Anthony will see that this one didn&rsquo;t feel right. If it is sharp
            pain, or it is still there next session, message him so he can look at it properly.
          </p>
        )}

        {/* Recommended first and by default. The second tab is for when the
            answer is not in the first six — the rack is busy, the machine is
            taken, and a list you have already read is not a second answer. */}
        <div className="flex gap-1.5 mt-5 mb-3">
          {([
            ['recommended', 'Recommended'],
            ['all', 'All exercises'],
          ] as Array<['recommended' | 'all', string]>).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`flex-1 h-tap rounded-control text-caption font-display font-bold uppercase tracking-wide transition-colors duration-150 ${
                tab === key ? 'bg-white/[0.12] text-white' : 'bg-white/[0.04] text-ink-3 hover:text-ink-2'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'recommended' ? (
          <div className="space-y-1.5">
            {alternatives.length === 0 && (
              <p className="text-ink-3 text-label font-body py-2">
                Nothing matched this movement closely enough to recommend. Try All exercises.
              </p>
            )}
            {alternatives.map((alt) => {
              const picked = chosen ? chosen === alt : current === alt
              return (
                <button
                  key={alt}
                  onClick={() => setChosen(alt)}
                  aria-pressed={picked}
                  className={`w-full px-3.5 min-h-taplg py-3 rounded-control text-left flex items-center justify-between gap-3 transition-colors duration-150 ${
                    picked ? 'bg-brand-blue/15 border border-brand-blue/30' : 'bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="text-white text-label font-body">{alt}</span>
                  {picked && (
                    <svg className="w-4 h-4 text-brand-blueink shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${library.length} exercises`}
              className="w-full px-3 min-h-taplg py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-body font-body placeholder:text-ink-4 focus:outline-none focus:border-brand-blue/50"
              aria-label="Search exercises"
            />

            {/* Six buttons over seventeen muscles — the same grouping the
                program builder uses, from lib/builder-rules. Nothing new was
                invented and the two cannot drift, because there is only one
                of them. */}
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 py-2.5">
              {MUSCLE_GROUPS.map((g) => {
                const on = group === g.key
                return (
                  <button
                    key={g.key}
                    onClick={() => setGroup(on ? null : g.key)}
                    aria-pressed={on}
                    className={`shrink-0 px-3 h-tap rounded-control text-caption font-display font-bold transition-colors duration-150 ${
                      on ? 'bg-brand-blue text-white' : 'bg-white/[0.05] text-ink-2 hover:text-ink'
                    }`}
                  >
                    {g.label}
                  </button>
                )
              })}
            </div>

            {/* One control, not a second row of chips. Equipment is the thing
                most people are swapping BECAUSE of, so it has to be reachable
                — but two rows of filters above a list is how a search starts
                feeling like a form. */}
            <select
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              className="w-full px-3 h-tap rounded-control bg-white/[0.04] border border-white/[0.08] text-ink text-body font-body focus:outline-none focus:border-brand-blue/50"
              aria-label="Equipment"
            >
              {EQUIPMENT_FILTERS.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>

            <p className="text-ink-4 text-caption font-body mt-3 mb-1.5">
              {resultsHeading(results.length, searching)}
              {results.length > shown.length && ` · showing ${shown.length}`}
            </p>

            <div className="space-y-1.5">
              {shown.map((e) => {
                const picked = chosen === e.name
                return (
                  <button
                    key={e.name}
                    onClick={() => setChosen(e.name)}
                    aria-pressed={picked}
                    className={`w-full px-3.5 min-h-taplg py-2.5 rounded-control text-left flex items-center gap-3 transition-colors duration-150 ${
                      picked ? 'bg-brand-blue/15 border border-brand-blue/30' : 'bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07]'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-white text-label font-body truncate">{e.name}</span>
                      <span className="block text-ink-4 text-caption font-body capitalize truncate">
                        {e.primaryMuscles[0]} &middot; {e.equipment}
                      </span>
                    </span>
                    {picked && (
                      <svg className="w-4 h-4 text-brand-blueink shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                )
              })}
              {results.length === 0 && (
                <p className="text-ink-4 text-caption font-body py-3">
                  Try fewer filters, or clear the muscle group.
                </p>
              )}
            </div>
          </div>
        )}

        {/* How long for — the question that used to be a checkbox under the
            tap target that had already committed the answer. Both options are
            spelled out, because "just today" and "from now on" are different
            enough that guessing on the client's behalf is how a rebuilt leg
            day quietly reverts overnight. */}
        {chosen && (
          <div className="mt-5 pt-4 border-t border-white/[0.08]">
            <p className="text-ink-3 text-caption font-display font-bold uppercase tracking-wide mb-2">
              For how long?
            </p>
            <div className="space-y-1.5">
              <button
                onClick={() => onPick(chosen, false, reason)}
                className="w-full py-3 px-3.5 rounded-control bg-white/[0.06] text-left hover:bg-white/[0.10] active:scale-[0.98] transition-all duration-200"
              >
                <span className="block text-white text-label font-display font-bold">Just today</span>
                <span className="block text-ink-3 text-caption font-body mt-0.5">
                  Your program is unchanged and comes back as it was next session.
                </span>
              </button>
              <button
                onClick={() => onPick(chosen, true, reason)}
                className="w-full py-3 px-3.5 rounded-control bg-brand-blue text-left hover:bg-brand-blue/85 active:scale-[0.98] transition-all duration-200"
              >
                <span className="block text-white text-label font-display font-bold">Every time from now on</span>
                <span className="block text-white/70 text-caption font-body mt-0.5">
                  {chosen} replaces {exerciseName} in your program until you undo it.
                </span>
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-control bg-white/[0.06] text-white text-label font-display font-bold uppercase tracking-wide hover:bg-white/[0.10] active:scale-[0.98] transition-all duration-200"
          >
            Cancel
          </button>
          {isSwapped && (
            <button
              onClick={onReset}
              className="flex-1 py-3 rounded-control bg-brand-orange/15 text-brand-orange text-label font-display font-bold uppercase tracking-wide hover:bg-brand-orange/25 active:scale-[0.98] transition-all duration-200"
            >
              Undo swap
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}

/**
 * How to do it, without leaving the session.
 *
 * The exercise detail used to replace the whole workout screen, so checking
 * form meant navigating away mid-set and finding your way back. Same content,
 * over the top, and the cues come before the full instruction list — nobody
 * holding a dumbbell reads eight numbered steps.
 */
function DemoSheet({
  name,
  data,
  onClose,
}: {
  name: string
  data: ExerciseDB | null
  onClose: () => void
}) {
  const coaching = cuesFor(name)
  return (
    <div className="fixed inset-0 z-[68] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="relative w-full sm:max-w-sm max-h-[85vh] overflow-y-auto bg-surface-raised border-t sm:border border-white/[0.12] sm:rounded-card rounded-t-card px-5 py-5"
        role="dialog"
        aria-label={`How to do ${name}`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display font-extrabold text-lg text-white tracking-tight">{name}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-ink-2 hover:text-white shrink-0 active:scale-95 transition-all duration-150"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {data?.images[0] && (
          <div className="mt-4">
            <ExerciseImageCycler images={data.images} name={data.name} />
          </div>
        )}

        {data && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {data.primaryMuscles.map((m) => (
              <span key={m} className="px-2 py-0.5 rounded-control bg-brand-orange/15 text-brand-orange text-caption font-display font-bold uppercase tracking-wide capitalize">
                {m}
              </span>
            ))}
            <span className="px-2 py-0.5 rounded-control bg-white/[0.06] text-ink-2 text-caption font-body capitalize">{data.equipment}</span>
          </div>
        )}

        {/* Coaching before description.
            The library's instructions describe a movement; they do not coach
            one. These are the two or three things that decide whether the set
            was any good, written for someone holding a dumbbell. */}
        {coaching && (
          <div className="mt-5">
            <p className="text-ink-3 text-caption font-display font-bold uppercase tracking-wide mb-2">Get these right</p>
            <ul className="space-y-2">
              {coaching.cues.map((cue, i) => (
                <li key={i} className="flex gap-2.5 text-white text-body font-body leading-relaxed">
                  <span className="text-brand-blueink shrink-0">&bull;</span>
                  {cue}
                </li>
              ))}
            </ul>
            <div className="mt-3 px-3 py-2.5 rounded-control bg-state-warning/[0.08] border border-state-warning/20">
              <p className="text-state-warning text-caption font-display font-bold uppercase tracking-wide mb-1">Common mistake</p>
              <p className="text-ink-2 text-body font-body leading-relaxed">{coaching.mistake}</p>
            </div>
          </div>
        )}

        {data && data.instructions.length > 0 && (
          <details className="mt-4">
            <summary className="text-brand-blueink text-label font-body cursor-pointer">
              {coaching ? 'Full step-by-step' : 'Step-by-step'} ({data.instructions.length} steps)
            </summary>
            <ol className="space-y-2 mt-2">
              {data.instructions.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-ink-2 text-body font-body leading-relaxed">
                  <span className="text-ink-4 font-display font-bold shrink-0">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </details>
        )}
      </motion.div>
    </div>
  )
}

/**
 * The last thing between a client and a closed session.
 *
 * Ending a workout cannot be undone from the UI — it stamps the end time,
 * clears the screen and files the session — and until now it was one tap on a
 * full-width button at the bottom of the list, with no prompt at all. The
 * count is the whole point: a client who meant to end is unbothered by one
 * tap, and a client who did not sees the number that tells them.
 */
function ConfirmEnd({
  logged,
  planned,
  onCancel,
  onConfirm,
}: {
  logged: number
  planned: number
  onCancel: () => void
  onConfirm: () => void
}) {
  const short = planned > 0 && logged < planned
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center px-4 bg-black/70">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="w-full max-w-xs px-6 py-6 rounded-card bg-surface-raised border border-white/[0.12] shadow-[0_10px_60px_rgba(0,0,0,0.5)]"
        role="alertdialog"
        aria-label="End workout"
      >
        <h2 className="font-display font-extrabold text-xl text-white tracking-tight">End this workout?</h2>
        <p className="text-ink-2 text-body font-body leading-relaxed mt-2">
          {short ? (
            <>
              You&rsquo;ve logged <span className="text-state-warning font-semibold">{logged} of {planned} sets</span>. Anything
              not logged won&rsquo;t be saved.
            </>
          ) : logged > 0 ? (
            <>All {logged} sets logged. Nice work.</>
          ) : (
            <>Nothing has been logged yet, so this session won&rsquo;t count towards your program.</>
          )}
        </p>
        <div className="flex gap-2 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-control bg-white/[0.06] text-white text-label font-display font-bold uppercase tracking-wide hover:bg-white/[0.10] active:scale-[0.98] transition-all duration-200"
          >
            Keep going
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-control bg-brand-orange text-white text-label font-display font-bold uppercase tracking-wide hover:bg-brand-orangedark active:scale-[0.98] transition-all duration-200"
          >
            End
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function WorkoutComplete({
  summary,
  pendingSets,
  askWeight,
  onWeigh,
  onDone,
}: {
  /**
   * Sets written to this phone that have not reached the server.
   *
   * The session already shows this while training. Saying it once more at the
   * end is the difference between finishing a workout in a basement gym and
   * wondering all evening whether it counted.
   */
  pendingSets: number
  summary: {
    dayName: string
    seconds: number
    sets: number
    reps: number
    volume: number
    fatigue: string | null
    improvements: string[]
    records: Array<{ exerciseName: string } & RecordHit>
    nextUp: string | null
    firstEver: boolean
    weekDone: boolean
  }
  /** Offer the weigh-in: they have a program, and have not weighed in today. */
  askWeight: boolean
  onWeigh: (lb: number) => Promise<void>
  onDone: () => void
}) {
  const mins = Math.max(1, Math.round(summary.seconds / 60))
  /**
   * One field, no Save button of its own.
   *
   * Typing a number changes what the closing button says, so recording a
   * weight costs no extra tap and skipping it costs nothing at all. A second
   * button here would make an optional thing look like a step.
   */
  const [weight, setWeight] = useState('')
  /* Three sheets, one at a time. The primary screen celebrates; these
     three are where the analysis lives. */
  const [showRecords, setShowRecords] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [weighing, setWeighing] = useState(false)
  const lb = Number(weight)
  const weightOk = weight.trim() !== '' && !isNaN(lb) && lb > 0 && lb < 1000

  const finish = async () => {
    if (weightOk && !weighing) {
      setWeighing(true)
      // A failed weigh-in must not trap them on this screen. The session is
      // already saved; the weight is the small part.
      try {
        await onWeigh(lb)
      } catch (e) {
        console.error('[Weigh-in] failed', e)
      }
    }
    onDone()
  }
  /* One tile. The number is the thing; the label only has to be findable. */
  const stat = (value: string, label: string) => (
    <div className="flex-1 min-w-0 rounded-card bg-white/[0.04] border border-white/[0.06] px-2 py-card text-center">
      <p className="font-display font-extrabold text-metric text-white tabular-nums leading-none">{value}</p>
      <p className="text-ink-3 text-label font-body mt-2">{label}</p>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-surface-base">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="min-h-full flex flex-col items-center justify-center px-6 py-10"
        style={{
          paddingTop: 'max(2.5rem, env(safe-area-inset-top))',
          paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="w-full max-w-sm text-center">
          {/* The logo, small. It is the only piece of branding on a screen
              that belongs to the client's achievement, and a second hero
              element above the checkmark would compete with it. */}
          <Image
            src="/AJMfit-logo.png"
            alt="AJM Fit"
            width={192}
            height={64}
            className="h-16 w-auto mx-auto object-contain"
            priority
          />

          {/* The mark of the thing being celebrated. Scales in once, settles,
              and does not loop — globals.css already disables transforms
              under prefers-reduced-motion, so this lands instantly for anyone
              who has asked for that. */}
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
            className="mt-10 mx-auto w-[84px] h-[84px] rounded-full bg-brand-blue flex items-center justify-center"
          >
            <svg className="w-11 h-11 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </motion.div>

          <h2 className="font-display font-extrabold text-4xl text-white tracking-tight mt-7 text-balance">
            Workout Complete
          </h2>
          <p className="text-ink-3 text-heading font-body mt-1.5">{summary.dayName}</p>

          {/* Reps, sets, minutes. Volume is deliberately not a fourth: 14,200
              lb reads as an achievement and is mostly a property of the
              program, going up whenever a day gains a set. It is in the
              session details, where it is a figure rather than a headline. */}
          <div className="flex items-stretch gap-2.5 mt-8">
            {stat(`${summary.reps}`, 'Total Reps')}
            {stat(`${summary.sets}`, summary.sets === 1 ? 'Set' : 'Sets')}
            {stat(durationLabel(summary.seconds) ?? '—', 'Duration')}
          </div>

          {/* The one thing worth reading twice, or — far more often — a line
              that does not mention records at all. Most sessions set none,
              and most of those are the sessions that actually build somebody,
              so this slot must never read as a consolation prize. */}
          {prHeadline(summary.records) ? (
            <button
              onClick={() => setShowRecords(true)}
              className="w-full mt-7 min-h-taplg px-card rounded-card bg-brand-gold flex items-center justify-center gap-3 text-surface-base active:scale-[0.98] transition-transform duration-150"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M5 3h14l-1.5 5H6.5L5 3Zm1.5 5v2a5.5 5.5 0 0 0 11 0V8h-11ZM12 16a5.5 5.5 0 0 1-5.08-3.39A6.5 6.5 0 0 0 12 15.5a6.5 6.5 0 0 0 5.08-2.89A5.5 5.5 0 0 1 12 16Zm0 2a1 1 0 0 1 1 1v2h-2v-2a1 1 0 0 1 1-1Z" />
              </svg>
              <span className="font-display font-bold text-heading">{prHeadline(summary.records)}</span>
              <svg className="w-5 h-5 shrink-0 ml-auto opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
              </svg>
            </button>
          ) : (
            <p className="mt-7 text-ink-2 text-heading font-body">{encouragement(summary.dayName + summary.seconds)}</p>
          )}

          {/* Said plainly, because a client who trained in a basement and
              closed the app wondering whether it counted is the failure this
              line exists to prevent. */}
          {pendingSets > 0 ? (
            <p className="mt-5 text-state-warning text-label font-body">
              {pendingSets} {pendingSets === 1 ? 'set is' : 'sets are'} still waiting for signal. They&rsquo;ll sync on their own.
            </p>
          ) : null}

          {/* The weigh-in stays, and it is the one deliberate departure from
              "two buttons and nothing else". It is a single optional field,
              and this is the only moment a client is standing still with the
              app already open — the place that used to ask, behind a More
              menu under an empty chart, has never been used by anybody. */}
          {askWeight && (
            <div className="flex items-center gap-3 mt-7 px-card min-h-taplg py-2 rounded-card bg-white/[0.04] border border-white/[0.06] text-left">
              <label htmlFor="weigh-in" className="text-ink-2 text-label font-body flex-1">
                Weigh in?
                <span className="text-ink-4"> optional</span>
              </label>
              <input
                id="weigh-in"
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="—"
                aria-label="Bodyweight in pounds"
                className="w-20 px-2.5 min-h-tap rounded-control bg-white/[0.06] border border-white/[0.10] text-white text-body font-body text-center placeholder:text-ink-4 focus:outline-none focus:border-brand-blue/50 transition-colors duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-ink-3 text-label font-body">lbs</span>
            </div>
          )}

          <button
            onClick={() => void finish()}
            disabled={weighing}
            className="w-full mt-8 h-14 rounded-card bg-brand-blue text-white text-heading font-display font-bold hover:bg-brand-bluedark active:scale-[0.98] disabled:opacity-60 transition-all duration-200"
          >
            {weighing ? 'Saving…' : weightOk ? 'Save & finish' : 'Done'}
          </button>

          <button
            onClick={() => setShowShare(true)}
            className="w-full mt-3 h-14 rounded-card border border-white/[0.14] text-white text-heading font-display font-bold flex items-center justify-center gap-2.5 hover:bg-white/[0.04] active:scale-[0.98] transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
            </svg>
            Share
          </button>

          {/* Everything the old screen said at once, one tap away. The lifts
              that beat last week, the recovery signal, the volume and what is
              next are all still here — they were just never the headline. */}
          {(summary.improvements.length > 0 ||
            summary.fatigue ||
            summary.nextUp ||
            summary.volume > 0 ||
            summary.firstEver ||
            summary.weekDone) && (
            <button
              onClick={() => setShowDetails(true)}
              className="mt-5 min-h-tap px-4 text-ink-3 text-label font-body hover:text-ink-2 transition-colors duration-200"
            >
              Session details &rsaquo;
            </button>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showRecords && (
          <RecordSheet records={summary.records} onClose={() => setShowRecords(false)} />
        )}
        {showDetails && (
          <SessionDetailSheet summary={summary} onClose={() => setShowDetails(false)} />
        )}
        {showShare && (
          <ShareSheet
            input={{
              dayName: summary.dayName,
              reps: summary.reps,
              sets: summary.sets,
              /* Quoted from the screen, never recomputed - see share-card. */
              duration: durationLabel(summary.seconds) ?? '',
              recordCount: summary.records.length,
              /* The figure the card leads on. Already rounded pounds; the card
                 shows nothing at all when it is zero rather than posting a
                 bodyweight day as "0 LBS" — see lib/share-card.ts. */
              volume: summary.volume,
            }}
            onClose={() => setShowShare(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * A shared bottom sheet, so the three that follow cannot drift apart.
 *
 * Native-feeling: slides from the bottom, dims what is behind, closes on the
 * backdrop. One grab handle, no title bar — the content says what it is.
 */
function Sheet({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="relative w-full sm:max-w-sm max-h-[85vh] overflow-y-auto bg-surface-raised border-t sm:border border-white/[0.12] rounded-t-card sm:rounded-card px-card pb-card"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        role="dialog"
        aria-label={label}
      >
        <div className="sticky top-0 -mx-card px-card pt-3 pb-2 bg-surface-raised">
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto" aria-hidden="true" />
        </div>
        {children}
        <button
          onClick={onClose}
          className="w-full mt-5 h-taplg rounded-control bg-white/[0.08] text-white text-label font-display font-bold uppercase tracking-wide active:scale-[0.98] transition-transform duration-150"
        >
          Close
        </button>
      </motion.div>
    </div>
  )
}

/**
 * What each record actually was.
 *
 * The figures all existed already — judgeSet returns the kind, the new value
 * and the one it beat — and none of them survived past a single line of
 * prose on the old screen. The unit changes with the kind, which is why
 * recordDetail does the wording rather than a template here: a rep record
 * improves by reps, and "+4 lb" about four extra repetitions is the kind of
 * wrong that makes a client stop trusting the rest of the numbers.
 */
function RecordSheet({
  records,
  onClose,
}: {
  records: Array<{ exerciseName: string } & RecordHit>
  onClose: () => void
}) {
  return (
    <Sheet label="Personal records" onClose={onClose}>
      <p className="text-brand-gold text-caption font-display font-bold uppercase tracking-[0.18em] mt-2">
        {records.length === 1 ? 'Personal record' : `${records.length} personal records`}
      </p>

      <div className="mt-4 space-y-2.5">
        {records.map((r) => {
          const d = recordDetail(r)
          return (
            <div key={`${r.exerciseName}-${r.kind}`} className="rounded-card bg-white/[0.04] border border-white/[0.07] px-card py-base">
              <p className="text-white text-heading font-body font-semibold leading-tight">{d.exercise}</p>
              <p className="text-brand-gold text-label font-body mt-0.5">{d.kindLabel}</p>

              <div className="flex items-end gap-3 mt-3">
                <div>
                  <p className="text-ink-4 text-caption font-display font-bold uppercase tracking-wide">Previous</p>
                  <p className="text-ink-3 text-label font-body tabular-nums mt-0.5">{d.previous}</p>
                </div>
                <svg className="w-4 h-4 text-ink-4 mb-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5-5m5 5-5 5" />
                </svg>
                <div>
                  <p className="text-ink-4 text-caption font-display font-bold uppercase tracking-wide">New</p>
                  <p className="text-white text-heading font-display font-bold tabular-nums mt-0.5">{d.now}</p>
                </div>
                {d.improvement && (
                  <span className="ml-auto mb-1 text-state-success text-label font-display font-bold tabular-nums">
                    {d.improvement}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

/**
 * Everything the old completion screen said at once.
 *
 * None of it was wrong — the lifts that beat last week, the recovery signal,
 * the volume, what comes next — it was just all competing with the thing the
 * client had actually come to see. One tap away is not hidden.
 */
function SessionDetailSheet({
  summary,
  onClose,
}: {
  summary: {
    dayName: string
    seconds: number
    reps: number
    sets: number
    volume: number
    fatigue: string | null
    improvements: string[]
    nextUp: string | null
    firstEver: boolean
    weekDone: boolean
  }
  onClose: () => void
}) {
  return (
    <Sheet label="Session details" onClose={onClose}>
      <p className="text-ink-4 text-caption font-display font-bold uppercase tracking-[0.18em] mt-2">
        {summary.dayName}
      </p>

      {summary.firstEver && (
        <p className="mt-4 text-ink-2 text-body font-body leading-relaxed px-card py-base rounded-card bg-brand-blue/[0.08] border border-brand-blue/20">
          That&rsquo;s your first session logged. Everything from here gets measured against it.
        </p>
      )}

      {summary.weekDone && !summary.firstEver && (
        <p className="mt-4 text-ink-2 text-body font-body leading-relaxed px-card py-base rounded-card bg-state-success/[0.08] border border-state-success/20">
          Every session this week done. Rest is part of it &mdash; the next one will keep.
        </p>
      )}

      {summary.improvements.length > 0 && (
        <div className="mt-5">
          <p className="text-ink-4 text-caption font-display font-bold uppercase tracking-[0.18em]">Up on last time</p>
          <ul className="mt-2 space-y-1.5">
            {summary.improvements.map((line) => (
              <li key={line} className="text-ink text-body font-body leading-relaxed">{line}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Said once, here. The same sentence on every exercise during a session
          would read as nagging; a client who has just finished is receptive. */}
      {summary.fatigue && (
        <p className="mt-5 text-ink-2 text-body font-body leading-relaxed px-card py-base rounded-card bg-white/[0.04] border border-white/[0.08]">
          {summary.fatigue}
        </p>
      )}

      {summary.volume > 0 && (
        <div className="mt-5">
          <p className="text-ink-4 text-caption font-display font-bold uppercase tracking-[0.18em]">Total volume</p>
          <p className="text-white text-heading font-display font-bold tabular-nums mt-1">
            {summary.volume.toLocaleString()} lb
          </p>
          {/* Why it is down here and not a headline tile. */}
          <p className="text-ink-4 text-label font-body mt-1">
            Weight moved across every logged set. It rises whenever a day gains a set, so it tracks the
            program as much as you.
          </p>
        </div>
      )}

      {summary.nextUp && (
        <p className="mt-5 text-ink-3 text-body font-body">
          Next up: <span className="text-ink-2 font-semibold">{summary.nextUp}</span>
        </p>
      )}
    </Sheet>
  )
}
