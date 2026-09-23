import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface CheckIn {
  id: string
  user_id: string
  week_of: string
  weight_lb: number | null
  workouts_completed: number | null
  nutrition_adherence: number | null
  energy: number | null
  win: string | null
  obstacle: string | null
  submitted_at: string
  coach_response: string | null
  coach_responded_at: string | null
}

export type CheckInInput = Pick<
  CheckIn,
  'weight_lb' | 'workouts_completed' | 'nutrition_adherence' | 'energy' | 'win' | 'obstacle'
>

/**
 * Monday of the week containing `d`, as YYYY-MM-DD.
 *
 * Check-ins are keyed to a week rather than a timestamp so that one week has
 * exactly one check-in no matter which day the client gets round to it.
 */
export function weekOf(d: Date = new Date()): string {
  const t = new Date(d)
  const day = (t.getDay() + 6) % 7 // Monday = 0
  t.setDate(t.getDate() - day)
  t.setHours(0, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
}

export function previousWeekOf(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00')
  d.setDate(d.getDate() - 7)
  return weekOf(d)
}

/** Newest first. */
export async function fetchMyCheckIns(userId: string, limit = 12): Promise<CheckIn[]> {
  const { data, error } = await db
    .from('check_ins')
    .select('*')
    .eq('user_id', userId)
    .order('week_of', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as CheckIn[]
}

export async function fetchCheckInForWeek(userId: string, week: string): Promise<CheckIn | null> {
  const { data } = await db
    .from('check_ins')
    .select('*')
    .eq('user_id', userId)
    .eq('week_of', week)
    .maybeSingle()
  return (data ?? null) as CheckIn | null
}

/** Upsert on (user_id, week_of) so re-submitting corrects rather than duplicates. */
export async function submitCheckIn(
  userId: string,
  week: string,
  input: CheckInInput
): Promise<CheckIn> {
  const { data, error } = await db
    .from('check_ins')
    .upsert(
      { ...input, user_id: userId, week_of: week, submitted_at: new Date().toISOString() },
      { onConflict: 'user_id,week_of' }
    )
    .select('*')
    .single()
  if (error) throw error
  return data as CheckIn
}

/** Trainer view: every check-in still waiting on a reply, oldest first. */
export async function fetchAwaitingReview(): Promise<CheckIn[]> {
  const { data, error } = await db
    .from('check_ins')
    .select('*')
    .is('coach_response', null)
    .order('submitted_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as CheckIn[]
}

export async function fetchAllCheckIns(limit = 400): Promise<CheckIn[]> {
  const { data, error } = await db
    .from('check_ins')
    .select('*')
    .order('week_of', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as CheckIn[]
}
