import { supabase } from '@/lib/supabase'
import type { BlueprintGoal, BlueprintLocation } from '@/lib/splits'
import { seriesLabels } from '@/lib/supersets'
import { estimateMinutes } from '@/lib/builder-rules'

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

export type {
  BlueprintGoal,
  BlueprintLocation,
  SplitOption,
} from '@/lib/splits'
export {
  GOAL_LABELS,
  LOCATION_LABELS,
  SPLIT_OPTIONS,
  splitsFor,
  DAYS_TO_SPLIT,
  isValidSplitForDays,
} from '@/lib/splits'

/* ── Shapes the Programs page consumes ── */
export interface PlanExercise {
  name: string
  sets: number
  reps: string
  rest: string
  series: string
  /**
   * Reps to leave in the tank on a working set, or null when the program
   * does not say.
   *
   * The app has always ASKED for this at the end of an exercise and never
   * told anyone what to aim for, which is most of why only 2 of 432 sets in
   * production carry a rating. A question with no target is a quiz.
   */
  targetRir: number | null
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
  /** 'custom' when the client built it themselves. */
  source: string | null
}

interface DayRow { id: string; day_index: number; name: string; focus: string | null; notes: string | null }
interface ExRow { program_day_id: string; order_index: number; exercise_name: string; sets: number | null; reps: string | null; rest_seconds: number | null; superset_group: string | null; target_rir: number | null }

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
    .select('id, name, level, split, location, goal, source')
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
    .select('program_day_id, order_index, exercise_name, sets, reps, rest_seconds, superset_group, target_rir')
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
    // A1/A2 for anything paired, plain A/B/C otherwise. The execution view has
    // always grouped by these letters and shown a Superset badge for a shared
    // one; nothing ever produced them, because this line handed out a letter
    // per position regardless of superset_group. The 68 seeded programs carry
    // no groups, so they are unaffected.
    const labels = seriesLabels(list.map((e) => ({ supersetGroup: e.superset_group })))
    const exercises: PlanExercise[] = list.map((e, xi) => ({
      name: e.exercise_name,
      sets: e.sets ?? 3,
      reps: e.reps ?? '10',
      rest: e.rest_seconds ? `${e.rest_seconds}s` : '60s',
      series: labels[xi],
      targetRir: e.target_rir ?? null,
    }))
    return {
      day: `Day ${i + 1}`,
      name: shortName(d.name),
      muscles: d.focus || (exercises.length === 0 ? 'Recovery' : ''),
      primaryMuscle: '',
      // The one estimator, the same one the builder and the health check use.
      // This line used to be `~${Math.max(30, exercises.length * 10)} min`,
      // which is the only duration a client ever saw. Ten minutes an exercise,
      // floored at thirty: it ignored sets and rest entirely, so a 5x5 with
      // three-minute rests and a circuit with forty-second rests read the same.
      //
      // The floor was the real damage. Not one of the 69 programs could show a
      // session under half an hour — the Lean Out Full Body day runs 21 minutes
      // and the card said "~50 min". Eighteen programs average half an hour or
      // less and the app had no way to say so, which is why a client with
      // thirty minutes concluded nothing in the library fitted.
      //
      // Built from `list`, not from `exercises`, because the estimator wants
      // rest in seconds and PlanExercise carries it as a string.
      //
      // `?? 60` and not `|| 60`: all 56 zero-rest rows in the library are
      // explicit zeros, not nulls, and every one of them is a conditioning
      // block. A run has no rest after it, and `||` would hand each one a
      // minute it does not take. Matches lib/custom-program.ts.
      duration: exercises.length
        ? `~${estimateMinutes(
            list.map((e) => ({
              sets: e.sets ?? 3,
              restSeconds: e.rest_seconds ?? 60,
              reps: e.reps,
            }))
          )} min`
        : '',
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
    source: (prog.source as string) ?? null,
  }
}
