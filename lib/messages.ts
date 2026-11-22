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

/**
 * Clients whose last message has no reply from the coach, oldest wait first.
 *
 * The dashboard ranked on training and never on this, so Shane's message sat
 * 154 days and Jamel's 105 without either appearing anywhere. A person
 * waiting on an answer outranks every training signal in the app: a missed
 * workout is a pattern, an unanswered question is a broken promise.
 */
export async function fetchUnansweredThreads(): Promise<
  Array<{ userId: string; waitingDays: number; lastBody: string }>
> {
  const { data, error } = await db
    .from('messages')
    .select('user_id, from_trainer, body, created_at')
    .order('created_at', { ascending: false })
  if (error) return []

  const rows = (data ?? []) as Array<{
    user_id: string
    from_trainer: boolean
    body: string
    created_at: string
  }>

  // Newest first, so the first row per client is their latest message.
  const latest = new Map<string, { from_trainer: boolean; body: string; created_at: string }>()
  for (const m of rows) if (!latest.has(m.user_id)) latest.set(m.user_id, m)

  const out: Array<{ userId: string; waitingDays: number; lastBody: string }> = []
  for (const [userId, m] of Array.from(latest)) {
    if (m.from_trainer) continue // the coach spoke last; nobody is waiting
    const days = Math.floor((Date.now() - Date.parse(m.created_at)) / 86400000)
    out.push({ userId, waitingDays: Math.max(0, days), lastBody: m.body })
  }
  return out.sort((a, b) => b.waitingDays - a.waitingDays)
}
