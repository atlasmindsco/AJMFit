import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface Message {
  id: string
  user_id: string
  from_trainer: boolean
  body: string
  read_at: string | null
  created_at: string
}

export interface ThreadSummary {
  userId: string
  name: string
  email: string
  lastBody: string | null
  lastAt: string | null
  unread: number // messages from the client the trainer hasn't read
}

/** One client's thread (oldest first). RLS scopes clients to their own. */
export async function fetchThread(userId: string): Promise<Message[]> {
  const { data, error } = await db
    .from('messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Message[]
}

export async function sendMessage(
  userId: string,
  body: string,
  fromTrainer: boolean
): Promise<Message> {
  const { data, error } = await db
    .from('messages')
    .insert({ user_id: userId, body, from_trainer: fromTrainer })
    .select('*')
    .single()
  if (error) throw error
  return data as Message
}

/** Mark the other side's unread messages in this thread as read. */
export async function markThreadRead(userId: string, viewerIsTrainer: boolean) {
  await db
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('from_trainer', !viewerIsTrainer)
    .is('read_at', null)
}

/** Trainer view: every client with their last message + unread count. */
export async function fetchAllThreads(): Promise<ThreadSummary[]> {
  const [{ data: users }, { data: msgs, error }] = await Promise.all([
    db.from('users').select('id, name, email, status'),
    db.from('messages').select('user_id, from_trainer, body, read_at, created_at').order('created_at', { ascending: false }),
  ])
  if (error) throw error

  const summaries = new Map<string, ThreadSummary>()
  for (const u of (users ?? []) as Array<{ id: string; name: string; email: string }>) {
    summaries.set(u.id, { userId: u.id, name: u.name, email: u.email, lastBody: null, lastAt: null, unread: 0 })
  }
  for (const m of (msgs ?? []) as Message[]) {
    const s = summaries.get(m.user_id)
    if (!s) continue
    if (!s.lastAt) {
      s.lastBody = m.body
      s.lastAt = m.created_at
    }
    if (!m.from_trainer && !m.read_at) s.unread++
  }
  // most recent first; clients with no messages sink to the bottom
  return Array.from(summaries.values()).sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))
}

export function formatMsgTime(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ', ' +
        d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
