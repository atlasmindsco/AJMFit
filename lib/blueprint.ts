import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * Blueprint self-serve program library.
 *
 * Blueprint (self-guided, no coaching) clients pick a pre-made program by
 * Goal + Days/week + Location. The 30 templates live in `programs`
 * (source='blueprint') with program_days / program_exercises content, seeded by
 * tools/ops/seed-blueprint-programs.mjs. This module reads the assigned one and
 * maps it into the shape the studio Programs page already renders.
 */

export type BlueprintGoal = 'muscle' | 'strength' | 'lean_out'
export type BlueprintLocation = 'gym' | 'home'

export const GOAL_LABELS: Record<BlueprintGoal, string> = {
  muscle: 'Build Muscle',
  strength: 'Build Strength',
  lean_out: 'Lean Out',
}

export const LOCATION_LABELS: Record<BlueprintLocation, string> = {
  gym: 'At a gym',
  home: 'At home',
}

export interface SplitOption {
  /** Matches programs.split_key. */
  key: string
  label: string
  sub: string
  /**
   * Hybrid tracks carry sprinting, jumping and running. Those belong to people
   * already training consistently, not to someone picking their first program,
   * so the beginner flow does not offer them.
   */
  advanced?: boolean
  /** Goals this split is seeded for; omitted means all three. */
  goals?: BlueprintGoal[]
}

/**
 * Every split available at each day count, recommended one first.
 *
 * Two days used to map to the 3-day full-body program — a 2-day client was
 * handed a 3-day plan and left to work out which sessions to skip. Four and
 * six days offered exactly one split each.
 */
export const SPLIT_OPTIONS: Record<number, SplitOption[]> = {
  2: [{ key: '2day_fullbody', label: 'Full Body', sub: 'Two sessions, whole body each time.' }],
  3: [{ key: '3day_fullbody', label: 'Full Body', sub: 'Three sessions, whole body each time.' }],
  4: [
    { key: '4day_ul', label: 'Upper / Lower', sub: 'Two upper days, two lower days. Everything twice a week.' },
    { key: '4day_torso_limbs', label: 'Torso / Limbs', sub: 'Chest, back and delts together; legs and arms together.' },
    { key: 'hybrid_athletic', label: 'Athletic Performance', sub: 'Sprints, jumps and change of direction before the strength work.', advanced: true, goals: ['strength', 'muscle'] },
  ],
  5: [
    { key: '5day_ulppl', label: 'Upper / Lower / Push / Pull / Legs', sub: 'Balanced. Most muscles twice a week, varied stimulus.' },
    { key: '5day_bro', label: 'Bodybuilding Split', sub: 'One muscle group per day. Higher volume, once a week each.' },
    { key: 'hybrid_hyper_cond', label: 'Muscle + Conditioning', sub: 'Four lifting days plus low-impact conditioning.', goals: ['muscle', 'lean_out'] },
    { key: 'hybrid_strength_endurance', label: 'Strength + Endurance', sub: 'Three lifting days and two long easy sessions.', advanced: true, goals: ['strength', 'muscle'] },
  ],
  6: [
    { key: '6day_ppl', label: 'Push / Pull / Legs ×2', sub: 'The classic. Each rotation twice a week with different lifts.' },
    { key: '6day_ppl_arnold', label: 'Arnold-Style Split', sub: 'Split horizontal and vertical pulls, two lower days, two push days.' },
    { key: 'hybrid_strength_run', label: 'Strength + Running', sub: 'Three lifting days and three runs, kept off each other.', advanced: true, goals: ['strength', 'muscle'] },
    { key: 'hybrid_complete', label: 'Complete Athlete', sub: 'Speed, power, strength and conditioning in one week.', advanced: true, goals: ['strength', 'muscle'] },
  ],
}

/** Splits available at this day count for this goal, hiding advanced tracks from beginners. */
export function splitsFor(days: number, goal: BlueprintGoal | null, beginner: boolean): SplitOption[] {
  return (SPLIT_OPTIONS[days] ?? []).filter(
    (o) => !(beginner && o.advanced) && (!o.goals || !goal || o.goals.includes(goal))
  )
}

/** Days/week → the recommended split key (matches seeded programs.split_key). */
export const DAYS_TO_SPLIT: Record<number, string> = Object.fromEntries(
  Object.entries(SPLIT_OPTIONS).map(([days, opts]) => [Number(days), opts[0].key])
)

/** Is this split key a legitimate choice for that day count and goal? */
export function isValidSplitForDays(days: number, splitKey: string, goal?: BlueprintGoal): boolean {
  return (SPLIT_OPTIONS[days] ?? []).some(
    (o) => o.key === splitKey && (!o.goals || !goal || o.goals.includes(goal))
  )
}

/* ── Shapes the Programs page consumes ── */
export interface PlanExercise {
  name: string
  sets: number
  reps: string
  rest: string
  series: string
}
export interface PlanDay {
  day: string
  name: string
  muscles: string
  primaryMuscle: string
  duration: string
  completed: boolean
  exercises: PlanExercise[]
}
export interface PlanProgram {
  name: string
  level: string
  phase: string
  weeks: { current: number; total: number }
  startDate: string
  coach: string
}
export interface LoadedProgram {
  program: PlanProgram
  weeklyPlan: PlanDay[]
  location: BlueprintLocation | null
  goal: BlueprintGoal | null
}

interface DayRow { id: string; day_index: number; name: string; focus: string | null; notes: string | null }
interface ExRow { program_day_id: string; order_index: number; exercise_name: string; sets: number | null; reps: string | null; rest_seconds: number | null; superset_group: string | null }

/** Strip the "Day N — " prefix to a short title, e.g. "Day 3 — Push A" → "Push A". */
function shortName(dayName: string): string {
  return dayName.replace(/^day\s*\d+\s*[—–-]\s*/i, '').trim() || dayName
}

/**
 * Load an assigned program's full content and map it into the Programs page
 * shape (weeklyPlan + currentProgram). Returns null if the program has no days.
 */
export async function loadAssignedProgram(programId: string): Promise<LoadedProgram | null> {
  const { data: prog } = await db
    .from('programs')
    .select('id, name, level, split, location, goal')
    .eq('id', programId)
    .maybeSingle()
  if (!prog) return null

  const { data: days } = await db
    .from('program_days')
    .select('id, day_index, name, focus, notes')
    .eq('program_id', programId)
    .order('day_index', { ascending: true })

  const dayRows = (days ?? []) as DayRow[]
  if (dayRows.length === 0) return null

  const dayIds = dayRows.map((d) => d.id)
  const { data: exs } = await db
    .from('program_exercises')
    .select('program_day_id, order_index, exercise_name, sets, reps, rest_seconds, superset_group')
    .in('program_day_id', dayIds)
    .order('order_index', { ascending: true })
  const exRows = (exs ?? []) as ExRow[]

  const byDay = new Map<string, ExRow[]>()
  for (const e of exRows) {
    if (!byDay.has(e.program_day_id)) byDay.set(e.program_day_id, [])
    byDay.get(e.program_day_id)!.push(e)
  }

  const weeklyPlan: PlanDay[] = dayRows.map((d, i) => {
    const list = (byDay.get(d.id) ?? []).sort((a, b) => a.order_index - b.order_index)
    const exercises: PlanExercise[] = list.map((e, xi) => ({
      name: e.exercise_name,
      sets: e.sets ?? 3,
      reps: e.reps ?? '10',
      rest: e.rest_seconds ? `${e.rest_seconds}s` : '60s',
      // Blueprint programs have no supersets, so a plain A/B/C per exercise.
      series: String.fromCharCode(65 + xi),
    }))
    return {
      day: `Day ${i + 1}`,
      name: shortName(d.name),
      muscles: d.focus || (exercises.length === 0 ? 'Recovery' : ''),
      primaryMuscle: '',
      duration: exercises.length ? `~${Math.max(30, exercises.length * 10)} min` : '',
      completed: false,
      exercises,
    }
  })

  return {
    program: {
      name: prog.name,
      level: prog.level || 'All Levels',
      phase: prog.split || 'Your program',
      weeks: { current: 1, total: 1 },
      startDate: '—',
      coach: 'Self-guided',
    },
    weeklyPlan,
    location: (prog.location as BlueprintLocation) ?? null,
    goal: (prog.goal as BlueprintGoal) ?? null,
  }
}
