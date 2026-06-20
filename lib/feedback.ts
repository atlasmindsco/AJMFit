import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface Feedback {
  id: string
  user_id: string | null
  name: string | null
  page: string | null
  message: string
  created_at: string
}

export async function submitFeedback(input: {
  userId: string | null
  name: string
  page: string
  message: string
}): Promise<void> {
  const { error } = await db.from('feedback').insert({
    user_id: input.userId,
    name: input.name,
    page: input.page,
    message: input.message,
  })
  if (error) throw error
}

/** Trainer-only (RLS). Newest first. */
export async function fetchFeedback(): Promise<Feedback[]> {
  const { data, error } = await db.from('feedback').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Feedback[]
}
