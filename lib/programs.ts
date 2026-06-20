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
