/**
 * Current-user helper, backed by Supabase Auth.
 *
 * Studio pages call `getCurrentUserId()` to scope their data to the signed-in
 * client. It resolves the public.users.id linked to the current auth session
 * (users.auth_id = auth.uid()). RLS enforces the same boundary at the database.
 */
import { createClient } from '@/lib/supabase/client'

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle<{ id: string }>()

  return data?.id ?? null
}

export async function signOut(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
}
