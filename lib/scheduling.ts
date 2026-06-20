import { supabase } from '@/lib/supabase'

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
}): Promise<void> {
  const { error } = await db.from('scheduled_sessions').insert({ ...input, status: 'scheduled' })
  if (error) throw error
}

export async function setSessionStatus(id: string, status: Session['status']): Promise<void> {
  const { error } = await db.from('scheduled_sessions').update({ status }).eq('id', id)
  if (error) throw error
}
