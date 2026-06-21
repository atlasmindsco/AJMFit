import { supabase } from '@/lib/supabase'
import type { Tier } from '@/lib/stripe/catalog'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface Session {
  id: string
  user_id: string
  starts_at: string
  duration_min: number
  type: string | null
  notes: string | null
  status: 'scheduled' | 'completed' | 'cancelled'
  join_url: string | null
  zoom_meeting_id: string | null
  clientName?: string
}

/** Trainer: all sessions with client names, soonest first. */
export async function fetchAllSessions(): Promise<Session[]> {
  const [{ data: sessions, error }, { data: users }] = await Promise.all([
    db.from('scheduled_sessions').select('*').order('starts_at', { ascending: true }),
    db.from('users').select('id, name'),
  ])
  if (error) throw error
  const names = new Map((users ?? []).map((u: { id: string; name: string }) => [u.id, u.name]))
  return (sessions ?? []).map((s: Session) => ({ ...s, clientName: names.get(s.user_id) ?? 'Client' }))
}

/** Client: their own sessions. */
export async function fetchMySessions(userId: string): Promise<Session[]> {
  const { data, error } = await db
    .from('scheduled_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('starts_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Session[]
}

export async function createSession(input: {
  user_id: string
  starts_at: string
  duration_min: number
  type: string
  notes?: string
  join_url?: string | null
  zoom_meeting_id?: string | null
}): Promise<void> {
  const { error } = await db.from('scheduled_sessions').insert({ ...input, status: 'scheduled' })
  if (error) throw error
}

export async function setSessionStatus(id: string, status: Session['status']): Promise<void> {
  const { error } = await db.from('scheduled_sessions').update({ status }).eq('id', id)
  if (error) throw error
}

// ---- Calendly booking gating ------------------------------------------------

/** The signed-in client's plan tier (from their subscription), or null. */
export async function fetchMyTier(userId: string): Promise<Tier | null> {
  const { data } = await db
    .from('subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.tier as Tier | undefined) ?? null
}

/** ISO bounds of the current week, Monday 00:00 → next Monday 00:00 (local). */
function weekBounds(now = new Date()): { start: string; end: string } {
  const start = new Date(now)
  const mondayOffset = (start.getDay() + 6) % 7 // Sun=6, Mon=0
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - mondayOffset)
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return { start: start.toISOString(), end: end.toISOString() }
}

/**
 * This week's non-cancelled sessions. The caller counts per call type (check-in
 * vs training session) by testing each tier's matchType against `type`.
 */
export async function fetchWeekSessions(userId: string): Promise<Session[]> {
  const { start, end } = weekBounds()
  const { data } = await db
    .from('scheduled_sessions')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .gte('starts_at', start)
    .lt('starts_at', end)
  return (data ?? []) as Session[]
}

/** Whether the client has an active (non-cancelled) welcome/onboarding call booked. */
export async function hasBookedOnboarding(userId: string): Promise<boolean> {
  const { data } = await db
    .from('scheduled_sessions')
    .select('type')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
  return (data ?? []).some((s: { type: string | null }) => /welcome|onboarding/i.test(s.type ?? ''))
}
