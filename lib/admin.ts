import { supabase } from '@/lib/supabase'
import { stalledLifts, historyFromSets, type StalledLift } from '@/lib/coach-signals'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export type UserStatus = 'pending' | 'active' | 'paused' | 'cancelled'
export type ApplicationStatus = 'pending' | 'reviewing' | 'accepted' | 'declined'
export type Tier = 'blueprint' | 'accelerator' | 'full-experience'

export interface ClientRow {
  id: string
  name: string
  email: string
  phone: string | null
  status: UserStatus
  is_beta: boolean
  created_at: string
  application: {
    id: string
    tier: Tier
    billing_cycle: 'monthly' | 'weekly'
    goals: string
    equipment: string[]
    health_limitations: string | null
    availability: string
    referral: string | null
    status: ApplicationStatus
    created_at: string
  } | null
  last_workout_at: string | null
}

/**
 * Fetches all users with their most recent application and last workout timestamp.
 */
export async function fetchClients(): Promise<ClientRow[]> {
  const { data: users, error } = await db
    .from('users')
    .select('id, name, email, phone, status, is_beta, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error

  const userIds: string[] = (users ?? []).map((u: { id: string }) => u.id)
  if (userIds.length === 0) return []

  // Fetch all applications for these users (latest first)
  const { data: apps } = await db
    .from('applications')
    .select('id, user_id, tier, billing_cycle, goals, equipment, health_limitations, availability, referral, status, created_at')
    .in('user_id', userIds)
    .order('created_at', { ascending: false })

  // Fetch most recent workout per user (just started_at + user_id)
  const { data: workouts } = await db
    .from('workouts')
    .select('user_id, started_at')
    .in('user_id', userIds)
    .order('started_at', { ascending: false })

  // Map: user_id → latest application
  const latestApp = new Map<string, ClientRow['application']>()
  for (const app of apps ?? []) {
    if (!latestApp.has(app.user_id)) {
      latestApp.set(app.user_id, {
        id: app.id,
        tier: app.tier,
        billing_cycle: app.billing_cycle,
        goals: app.goals,
        equipment: app.equipment ?? [],
        health_limitations: app.health_limitations,
        availability: app.availability,
        referral: app.referral,
        status: app.status,
        created_at: app.created_at,
      })
    }
  }

  // Map: user_id → latest workout timestamp
  const latestWorkout = new Map<string, string>()
  for (const w of workouts ?? []) {
    if (!latestWorkout.has(w.user_id)) latestWorkout.set(w.user_id, w.started_at)
  }

  return (users ?? []).map((u: { id: string; name: string; email: string; phone: string | null; status: UserStatus; is_beta: boolean; created_at: string }) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    status: u.status,
    is_beta: u.is_beta ?? false,
    created_at: u.created_at,
    application: latestApp.get(u.id) ?? null,
    last_workout_at: latestWorkout.get(u.id) ?? null,
  }))
}

export async function setUserBeta(userId: string, isBeta: boolean) {
  const { error } = await db.from('users').update({ is_beta: isBeta }).eq('id', userId)
  if (error) throw error
}

export async function acceptApplication(applicationId: string, userId: string) {
  const now = new Date().toISOString()
  const { error: appErr } = await db
    .from('applications')
    .update({ status: 'accepted', reviewed_at: now })
    .eq('id', applicationId)
  if (appErr) throw appErr

  // Keep the user 'pending' until they start their subscription, the Stripe
  // webhook flips them to 'active' on payment/trial start.
  const { error: userErr } = await db
    .from('users')
    .update({ status: 'pending' })
    .eq('id', userId)
  if (userErr) throw userErr
}

/**
 * Sends the approved client their "set your password" invite email (via the
 * trainer-only server route). Safe to call after acceptApplication().
 * Pass { approval: true } (Accept flow only) to ALSO send the branded
 * "you're approved, next steps" email with the onboarding form + call links.
 */
export async function inviteClient(userId: string, opts?: { approval?: boolean }): Promise<void> {
  const res = await fetch('/api/admin/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, approval: opts?.approval === true }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Failed to send invite')
  }
}

export async function declineApplication(applicationId: string, userId: string) {
  const now = new Date().toISOString()
  const { error: appErr } = await db
    .from('applications')
    .update({ status: 'declined', reviewed_at: now })
    .eq('id', applicationId)
  if (appErr) throw appErr

  const { error: userErr } = await db
    .from('users')
    .update({ status: 'cancelled' })
    .eq('id', userId)
  if (userErr) throw userErr
}

export async function setUserStatus(userId: string, status: UserStatus) {
  const { error } = await db.from('users').update({ status }).eq('id', userId)
  if (error) throw error
}

const TIER_LABELS: Record<Tier, string> = {
  blueprint: 'The Blueprint',
  accelerator: 'The Accelerator',
  'full-experience': 'The Full Experience',
}

export function tierLabel(tier: Tier | null | undefined): string {
  if (!tier) return ', '
  return TIER_LABELS[tier]
}

export function relativeTime(iso: string | null): string {
  if (!iso) return ', '
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Stalled and declining lifts for every client, in one pass.
 *
 * The progression engine already works this out per exercise on the client's
 * own screen, and it has never reached the coach. A client who turns up
 * reliably and gets nowhere is the hardest one to spot -- they are never
 * quiet, they never miss, and every surface-level number about them looks
 * fine -- which makes this the signal most worth carrying across.
 *
 * Deliberately one query rather than per-client: the dashboard already loads
 * every client in a single pass and should not acquire an N+1 to add a column.
 */
export async function fetchStalledLifts(): Promise<Map<string, StalledLift[]>> {
  // Only recent sessions can produce a current verdict, and the progression
  // engine treats anything past a fortnight as a layoff rather than a stall.
  // Ninety days of history is enough to see a trend into that window.
  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)

  const { data: workouts } = await db
    .from('workouts')
    .select('id, date, started_at')
    .gte('date', since)
  const rows = (workouts ?? []) as Array<{ id: string; date: string | null; started_at: string }>
  if (rows.length === 0) return new Map()

  const dateOfWorkout: Record<string, string> = {}
  for (const w of rows) dateOfWorkout[w.id] = w.date || w.started_at.slice(0, 10)

  const { data: sets } = await db
    .from('workout_sets')
    .select('user_id, exercise_name, weight, reps, rir, workout_id, is_intensity_set')
    .in('workout_id', Object.keys(dateOfWorkout))

  const byUser = historyFromSets((sets ?? []) as never, dateOfWorkout)
  const out = new Map<string, StalledLift[]>()
  for (const [userId, history] of Object.entries(byUser)) {
    const lifts = stalledLifts({ history })
    if (lifts.length > 0) out.set(userId, lifts)
  }
  return out
}

/**
 * Nutrition target changes proposed by the weekly review and still waiting.
 *
 * The cron already queues these; the only coach-facing surface is a separate
 * Nutrition tab, so a proposal can sit for a week without anyone seeing it.
 */
export async function fetchPendingNutritionProposals(): Promise<Map<string, { created_at: string }>> {
  const { data } = await db
    .from('nutrition_adjustments')
    .select('user_id, created_at, status')
    .eq('status', 'proposed')
    .order('created_at', { ascending: true })
  const out = new Map<string, { created_at: string }>()
  for (const r of (data ?? []) as Array<{ user_id: string; created_at: string }>) {
    // Oldest first, so the first seen per client is the longest wait.
    if (!out.has(r.user_id)) out.set(r.user_id, { created_at: r.created_at })
  }
  return out
}

export interface RecentWin {
  userId: string
  name: string
  exerciseName: string
  weight: number
  reps: number
  at: string
}

/**
 * Records set in the last week, newest first.
 *
 * Replaces the per-PR email to the coach, which fired on every weight record
 * across every client. A dashboard that only ever shows problems is one you
 * avoid opening; this is the column that makes it a place worth looking.
 */
export async function fetchRecentWins(days = 7, limit = 8): Promise<RecentWin[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const { data } = await db
    .from('exercise_prs')
    .select('user_id, exercise_name, weight, reps, set_at')
    .gte('set_at', since)
    .order('set_at', { ascending: false })
    .limit(limit)
  const rows = (data ?? []) as Array<{
    user_id: string
    exercise_name: string
    weight: number
    reps: number
    set_at: string
  }>
  if (rows.length === 0) return []

  const { data: users } = await db
    .from('users')
    .select('id, name')
    .in('id', Array.from(new Set(rows.map((r) => r.user_id))))
  const nameOf = new Map(((users ?? []) as Array<{ id: string; name: string }>).map((u) => [u.id, u.name]))

  return rows.map((r) => ({
    userId: r.user_id,
    name: nameOf.get(r.user_id) ?? 'Unknown',
    exerciseName: r.exercise_name,
    weight: Number(r.weight),
    reps: Number(r.reps),
    at: r.set_at,
  }))
}
