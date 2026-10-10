import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface Program {
  id: string
  name: string
  description: string | null
  level: string | null
  days_per_week: number | null
  split: string | null
  created_at: string
}

export interface Assignment {
  id: string
  user_id: string
  program_id: string
  assigned_at: string
  ended_at: string | null
  block_weeks: number
  completed_at: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  review: any | null
}

/** The block a client is currently in, or null if they have no program. */
export async function fetchMyBlock(userId: string): Promise<Assignment | null> {
  const { data } = await db
    .from('program_assignments')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as Assignment) ?? null
}

/**
 * Freeze the review onto the block and mark it finished.
 *
 * completed_at rather than ended_at: ended_at already means "switched away
 * from", and a block someone abandoned should not carry a results review as
 * though they had seen it through.
 */
export async function completeBlock(
  assignmentId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  review: any
): Promise<void> {
  const { error } = await db
    .from('program_assignments')
    .update({ completed_at: new Date().toISOString(), review })
    .eq('id', assignmentId)
    .is('completed_at', null)
  if (error) throw error
}

/**
 * Every running block, keyed by client, for the coach dashboard.
 *
 * One query rather than one per client: the dashboard already loads every
 * client in a single pass and should not acquire an N+1 to add a column.
 */
export async function fetchActiveBlocks(): Promise<Map<string, Assignment>> {
  const { data } = await db
    .from('program_assignments')
    .select('*')
    .is('ended_at', null)
    .is('completed_at', null)
    .order('assigned_at', { ascending: false })
  const out = new Map<string, Assignment>()
  for (const a of (data ?? []) as Assignment[]) {
    // Rows arrive newest first, so the first one seen per client is current.
    if (!out.has(a.user_id)) out.set(a.user_id, a)
  }
  return out
}

/**
 * When this client first started this program, or null if they never have.
 *
 * The EARLIEST assignment, not the current one: a client who switched away and
 * came back should keep the sessions from their first run at it. Used to bound
 * the rotation's history and the day-rename migration to one program's life.
 */
export async function fetchAssignmentStart(
  userId: string,
  programId: string
): Promise<string | null> {
  const { data } = await db
    .from('program_assignments')
    .select('assigned_at')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .order('assigned_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return ((data as { assigned_at: string } | null)?.assigned_at) ?? null
}

/** Blocks a client has finished, newest first, for the progress screen. */
export async function fetchCompletedBlocks(userId: string, limit = 6): Promise<Assignment[]> {
  const { data } = await db
    .from('program_assignments')
    .select('*')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as Assignment[]
}

/**
 * Everything the end-of-block review needs, scoped to the block's own window.
 *
 * Deliberately not reusing fetchExerciseHistory: that returns the last six
 * sessions wherever they fall, which for a review would quietly mix in work
 * from the previous block and credit this one with progress it did not make.
 */
export async function gatherReviewInputs(
  userId: string,
  assignedAt: string
): Promise<{
  sessionCount: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  history: Record<string, any[]>
  startWeightLb: number | null
  endWeightLb: number | null
}> {
  const since = new Date(assignedAt).toISOString().slice(0, 10)

  const [{ data: workouts }, { data: sets }, { data: weights }] = await Promise.all([
    db
      .from('workouts')
      .select('id, date')
      .eq('user_id', userId)
      .gte('date', since)
      .not('ended_at', 'is', null),
    db
      .from('workout_sets')
      .select('exercise_name, weight, reps, workout_id, workouts!inner(date)')
      .eq('user_id', userId)
      .eq('completed', true)
      .eq('is_intensity_set', false)
      .gte('workouts.date', since)
      .limit(4000),
    db
      .from('body_metrics')
      .select('recorded_on, weight_lb')
      .eq('user_id', userId)
      .gte('recorded_on', since)
      .not('weight_lb', 'is', null)
      .order('recorded_on', { ascending: true }),
  ])

  // Collapse to one summary per exercise per workout, newest first, so the
  // review reads the same shape as the progression engine does.
  const byExercise = new Map<string, Map<string, { date: string; top: number; reps: number }>>()
  for (const row of (sets ?? []) as Array<{
    exercise_name: string
    weight: number | null
    reps: number | null
    workout_id: string
    workouts: { date: string } | { date: string }[] | null
  }>) {
    if (row.weight == null || row.reps == null) continue
    const w = Array.isArray(row.workouts) ? row.workouts[0] : row.workouts
    if (!w?.date) continue
    let sessions = byExercise.get(row.exercise_name)
    if (!sessions) {
      sessions = new Map()
      byExercise.set(row.exercise_name, sessions)
    }
    const cur = sessions.get(row.workout_id)
    const weight = Number(row.weight)
    if (!cur || weight > cur.top) {
      sessions.set(row.workout_id, { date: w.date, top: weight, reps: Number(row.reps) })
    }
  }

  const history: Record<string, Array<{ date: string; topWeight: number; topReps: number; lowestReps: number; sets: number; rir: number | null }>> = {}
  for (const [name, sessions] of Array.from(byExercise.entries())) {
    history[name] = Array.from(sessions.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((s) => ({
        date: s.date,
        topWeight: s.top,
        topReps: s.reps,
        lowestReps: s.reps,
        sets: 1,
        rir: null,
      }))
  }

  const ws = (weights ?? []) as Array<{ weight_lb: number }>
  return {
    sessionCount: (workouts ?? []).length,
    history,
    startWeightLb: ws.length ? Number(ws[0].weight_lb) : null,
    endWeightLb: ws.length ? Number(ws[ws.length - 1].weight_lb) : null,
  }
}

export async function fetchPrograms(): Promise<Program[]> {
  const { data, error } = await db.from('programs').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Program[]
}

export async function createProgram(input: {
  name: string
  description?: string
  level?: string
  days_per_week?: number
  split?: string
}): Promise<void> {
  const { error } = await db.from('programs').insert(input)
  if (error) throw error
}

export async function deleteProgram(id: string): Promise<void> {
  const { error } = await db.from('programs').delete().eq('id', id)
  if (error) throw error
}

/** Active assignments (ended_at null), with client + program names attached. */
export async function fetchActiveAssignments(): Promise<
  Array<{ id: string; user_id: string; program_id: string; clientName: string; programName: string }>
> {
  const [{ data: assigns, error }, { data: users }, { data: programs }] = await Promise.all([
    db.from('program_assignments').select('*').is('ended_at', null),
    db.from('users').select('id, name'),
    db.from('programs').select('id, name'),
  ])
  if (error) throw error
  const uNames = new Map((users ?? []).map((u: { id: string; name: string }) => [u.id, u.name]))
  const pNames = new Map((programs ?? []).map((p: { id: string; name: string }) => [p.id, p.name]))
  return (assigns ?? []).map((a: Assignment) => ({
    id: a.id,
    user_id: a.user_id,
    program_id: a.program_id,
    clientName: (uNames.get(a.user_id) as string) ?? 'Client',
    programName: (pNames.get(a.program_id) as string) ?? 'Program',
  }))
}

export async function assignProgram(userId: string, programId: string): Promise<void> {
  // close any existing active assignment for this client, then add the new one
  await db.from('program_assignments').update({ ended_at: new Date().toISOString() }).eq('user_id', userId).is('ended_at', null)
  const { error } = await db.from('program_assignments').insert({ user_id: userId, program_id: programId })
  if (error) throw error
}

/** Client: their currently-assigned program (or null). */
export async function fetchMyProgram(userId: string): Promise<Program | null> {
  const { data: a } = await db
    .from('program_assignments')
    .select('program_id')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!a) return null
  const { data: p } = await db.from('programs').select('*').eq('id', a.program_id).maybeSingle()
  return (p as Program) ?? null
}
