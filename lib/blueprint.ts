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

/** Days/week → the recommended split key (matches seeded programs.split_key). */
export const DAYS_TO_SPLIT: Record<number, string> = {
  3: '3day_fullbody',
  4: '4day_ul',
  5: '5day_ulppl',
  6: '6day_ppl_arnold',
}

/** Short human label for each day-count's recommended split. */
export const SPLIT_LABEL: Record<number, string> = {
  3: 'Full Body (all 3 days)',
  4: 'Upper / Lower / Upper / Lower',
  5: 'Upper / Lower / Push / Pull / Legs',
  6: 'Push / Pull / Legs (6-day)',
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
    .select('id, name, level, split, location')
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
  }
}
